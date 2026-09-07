import { db, type Database } from '../data/db';
import { config } from '../lib/config';
export async function schedule(now = new Date(), injected?: Database) {
  const c = config();
  if (c.SYNC_ENABLED !== 'true') return;
  const database = injected || (await db());
  const paused = (
    await database.query<{ data: { paused: boolean } }>(
      "SELECT data FROM operations WHERE key='sync'",
    )
  ).rows[0]?.data.paused;
  if (paused) return;
  const day = now.toISOString().slice(0, 10);
  const window = Math.floor(now.getTime() / 21600000);
  const jobs: { key: string; kind: string; payload: unknown }[] = [
    'countries',
    'bootstrap',
    'maintenance',
  ].map((kind) => ({ key: `${kind}:${day}`, kind, payload: {} }));
  for (const market of c.markets)
    for (const type of ['movie', 'tv'])
      for (const order of ['release_date', 'popularity_1week']) {
        const batch = `daily-discovery:${day}:${order}`;
        jobs.push({
          key: `catalog-page:${batch}:${market}:${type}:1`,
          kind: 'catalog-page',
          payload: { market, type, order, batch, page: 1, maxPages: 2 },
        });
      }
  for (const market of c.markets)
    for (const changeType of ['new', 'updated', 'removed'])
      jobs.push({
        key: `changes:${market}:${changeType}:${window}`,
        kind: 'changes',
        payload: {
          market,
          changeType,
          to: Math.floor(now.getTime() / 1000),
        },
      });
  await database.query(
    `INSERT INTO jobs(key,kind,payload)
    SELECT key,kind,payload FROM jsonb_to_recordset($1::jsonb) AS planned(key text,kind text,payload jsonb)
    ON CONFLICT(key) DO NOTHING`,
    [JSON.stringify(jobs)],
  );
  // Claim and enqueue one daily refresh batch atomically. The minute cron must
  // not select another 500 titles whenever the oldest snapshots change.
  await database.query(
    `WITH batch AS (
      INSERT INTO operations(key,data) VALUES($1,'{}') ON CONFLICT(key) DO NOTHING RETURNING key
    ), oldest AS (
      SELECT t.id,t.updated_at FROM titles t LEFT JOIN snapshots s ON s.title_id=t.id
      WHERE EXISTS(SELECT 1 FROM batch) GROUP BY t.id
      ORDER BY min(s.checked_at) ASC NULLS FIRST,t.id LIMIT 500
    ) INSERT INTO jobs(key,kind,payload)
      SELECT 'daily:'||id||':'||$2,
        CASE WHEN updated_at<$3::timestamptz-interval '7 days' THEN 'import' ELSE 'reconcile' END,
        jsonb_build_object('type',split_part(id,':',1),'id',split_part(id,':',2)::bigint)
      FROM oldest ON CONFLICT(key) DO NOTHING`,
    ['daily-refresh:' + day, day, now.toISOString()],
  );
  await database.query(
    "INSERT INTO operations(key,data) VALUES('scheduler',$1) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data,updated_at=now()",
    [
      JSON.stringify({
        heartbeat: now.toISOString(),
        nextRun: new Date(now.getTime() + 60000).toISOString(),
      }),
    ],
  );
}

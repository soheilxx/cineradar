import { db } from '../data/db';
import { config } from '../lib/config';
import { enqueue } from './queue';
export async function schedule(now = new Date()) {
  const c = config();
  if (c.SYNC_ENABLED !== 'true') return;
  const database = await db();
  const paused = (
    await database.query<{ data: { paused: boolean } }>(
      "SELECT data FROM operations WHERE key='sync'",
    )
  ).rows[0]?.data.paused;
  if (paused) return;
  const day = now.toISOString().slice(0, 10);
  const window = Math.floor(now.getTime() / 21600000);
  await enqueue('countries:' + day, 'countries', {});
  await enqueue('bootstrap:' + day, 'bootstrap', {});
  await enqueue('maintenance:' + day, 'maintenance', {});
  for (const market of c.markets)
    for (const changeType of ['new', 'updated', 'removed'])
      await enqueue(`changes:${market}:${changeType}:${window}`, 'changes', {
        market,
        changeType,
        to: Math.floor(now.getTime() / 1000),
      });
  const titles = (
    await database.query<{ id: string; updated_at: string }>(
      'SELECT id,updated_at FROM titles ORDER BY updated_at ASC LIMIT 50',
    )
  ).rows;
  for (const title of titles) {
    const [type, id] = title.id.split(':');
    await enqueue(
      'daily:' + title.id + ':' + day,
      Date.now() - new Date(title.updated_at).getTime() > 7 * 86400000
        ? 'import'
        : 'reconcile',
      { type, id: Number(id) },
    );
  }
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

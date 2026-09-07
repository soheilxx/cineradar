import { z } from 'zod';
import type { Database } from '../data/db';
import { normalizeShow, type SAA } from '../data/providers/saa';
import { ProviderError } from '../data/providers/http';
import type { Job } from './queue';

// Discovery shares the existing SAA/TMDB budgets with refreshes. These limits
// additionally prevent a catalog walk from generating an unbounded title queue.
export const BACKFILL_PAGES_PER_SCOPE_PER_DAY = 2;
export const BACKFILL_MAX_PENDING_TITLES = 1000;
const stateSchema = z.object({
  market: z.string().regex(/^[a-z]{2}$/),
  type: z.enum(['movie', 'tv']),
  cycle: z.string().min(1),
  page: z.number().int().nonnegative(),
  order: z.enum(['release_date', 'popularity_1week', 'popularity_1year']),
  cursor: z.string().min(1).nullable(),
  seen: z.array(z.string()),
  discoveryComplete: z.boolean(),
  startedAt: z.string(),
});

export async function scheduleCatalogBackfill(
  database: Database,
  markets: string[],
  now: Date,
) {
  const day = now.toISOString().slice(0, 10);
  const scopes = markets.flatMap((market) =>
    ['movie', 'tv'].map((type) => ({ market, type })),
  );
  // An older manually requested catalog walk keeps ownership of its scope.
  // When that walk stops at its page cap, adopt its durable cursor; when the
  // provider actually ended the walk, retain the completed discovery state.
  await database.query(
    `INSERT INTO operations(key,data)
     SELECT 'catalog-backfill:'||scope.market||':'||scope.type,
       jsonb_build_object(
         'market',scope.market,'type',scope.type,'cycle',$2::text,
         'page',COALESCE((legacy.data->>'page')::int,0),
         'order',COALESCE(legacy.data->>'order','release_date'),
         'cursor',CASE WHEN legacy.data->>'hasMore'='true' THEN legacy.data->>'nextCursor' ELSE NULL END,
         'seen',COALESCE(legacy.data->'seen','[]'::jsonb),
         'discoveryComplete',COALESCE(legacy.data->>'hasMore'='false',false),
         'startedAt',$3::text,'adoptedFrom',legacy.key)
     FROM jsonb_to_recordset($1::jsonb) AS scope(market text,type text)
     LEFT JOIN LATERAL (
       SELECT key,data FROM operations
       WHERE key LIKE 'catalog:%:'||scope.market||':'||scope.type
         AND (data->>'hasMore'='false' OR
           (data->>'hasMore'='true' AND length(data->>'nextCursor')>0))
       ORDER BY (data->>'hasMore'='false') DESC,(data->>'page')::int DESC,updated_at DESC
       LIMIT 1
     ) legacy ON true
     WHERE NOT EXISTS (
       SELECT 1 FROM jobs WHERE kind='catalog-page'
         AND state IN ('queued','running','paused')
         AND payload->>'market'=scope.market AND payload->>'type'=scope.type
         AND COALESCE(payload->>'batch','') NOT LIKE 'daily-discovery:%'
     )
     ON CONFLICT(key) DO NOTHING`,
    [JSON.stringify(scopes), day, now.toISOString()],
  );
  await database.query(
    `INSERT INTO jobs(key,kind,payload)
     SELECT 'catalog-backfill:'||(state.data->>'cycle')||':'||scope.market||':'||scope.type||':'||((state.data->>'page')::int+1),
       'catalog-backfill',jsonb_build_object(
         'market',scope.market,'type',scope.type,'cycle',state.data->>'cycle',
         'page',(state.data->>'page')::int+1,'scheduledDay',$2::text)
     FROM jsonb_to_recordset($1::jsonb) AS scope(market text,type text)
     JOIN operations state ON state.key='catalog-backfill:'||scope.market||':'||scope.type
     WHERE state.data->>'discoveryComplete'='false'
       AND (SELECT count(*) FROM jobs WHERE kind='catalog-title' AND state IN ('queued','running'))<$4
       AND (SELECT count(*) FROM jobs WHERE kind='catalog-backfill'
         AND payload->>'market'=scope.market AND payload->>'type'=scope.type
         AND payload->>'scheduledDay'=$2)<$3
       AND NOT EXISTS (
         SELECT 1 FROM jobs WHERE kind='catalog-page' AND state IN ('queued','running','paused')
           AND payload->>'market'=scope.market AND payload->>'type'=scope.type
           AND COALESCE(payload->>'batch','') NOT LIKE 'daily-discovery:%'
       )
     ON CONFLICT(key) DO NOTHING`,
    [
      JSON.stringify(scopes),
      day,
      BACKFILL_PAGES_PER_SCOPE_PER_DAY,
      BACKFILL_MAX_PENDING_TITLES,
    ],
  );
}

export async function handleCatalogBackfill(
  job: Job,
  database: Database,
  saa: Pick<SAA, 'catalog'>,
  markets: string[],
  now = new Date(),
) {
  const payload = z
    .object({
      market: z.string().regex(/^[a-z]{2}$/),
      type: z.enum(['movie', 'tv']),
      cycle: z.string().min(1),
      page: z.number().int().positive(),
    })
    .safeParse(job.payload);
  if (!payload.success || !markets.includes(payload.data.market))
    throw new ProviderError('schema');
  const { market, type, cycle, page } = payload.data;
  const key = `catalog-backfill:${market}:${type}`;
  const previous = (
    await database.query<{ data: unknown }>(
      'SELECT data FROM operations WHERE key=$1',
      [key],
    )
  ).rows[0]?.data;
  const parsed = stateSchema.safeParse(previous);
  if (!parsed.success) throw new ProviderError('schema');
  const state = parsed.data;
  if (state.market !== market || state.type !== type || state.cycle !== cycle)
    throw new ProviderError('schema');
  // A committed page may be replayed after the worker lost its response. It
  // must neither issue another paid request nor rewind the persisted cursor.
  if (state.page >= page || state.discoveryComplete) return;
  if (state.page !== page - 1) throw new ProviderError('schema');
  const result = await saa.catalog(
    market,
    type,
    state.cursor || undefined,
    state.order,
  );
  if (
    result.hasMore &&
    (!result.nextCursor ||
      result.nextCursor === state.cursor ||
      state.seen.includes(result.nextCursor))
  )
    throw new ProviderError('schema');
  const titleJobs = result.shows.map((show) => {
    const id = Number(show.tmdbId.split('/').at(-1));
    if (!Number.isSafeInteger(id) || id < 1) throw new ProviderError('schema');
    normalizeShow(show, type, id, market);
    return {
      key: `catalog-title:backfill:${cycle}:${market}:${type}:${id}`,
      kind: 'catalog-title',
      payload: { market, type, id, show },
    };
  });
  const next = {
    ...state,
    page,
    cursor: result.hasMore ? result.nextCursor : null,
    seen: result.hasMore
      ? [...state.seen, ...(state.cursor ? [state.cursor] : [])]
      : [],
    hasMore: result.hasMore,
    discoveryComplete: !result.hasMore,
    checkedAt: now.toISOString(),
    ...(result.hasMore ? {} : { completedAt: now.toISOString() }),
  };
  // Keep imports and the resume point in one statement. The lease check locks
  // the job row until commit so a superseded worker cannot advance discovery.
  await database.query(
    `WITH lease AS MATERIALIZED (SELECT assert_job_lease($1,$2)),
     checkpoint AS (
       UPDATE operations SET data=$3::jsonb,updated_at=now()
       FROM lease WHERE key=$4 AND data->>'cycle'=$5 AND (data->>'page')::int=$6
       RETURNING key
     )
     INSERT INTO jobs(key,kind,payload)
     SELECT planned.key,planned.kind,planned.payload
     FROM jsonb_to_recordset($7::jsonb) AS planned(key text,kind text,payload jsonb)
     WHERE EXISTS(SELECT 1 FROM checkpoint)
     ON CONFLICT(key) DO NOTHING`,
    [
      job.id,
      job.lock_token,
      JSON.stringify(next),
      key,
      cycle,
      page - 1,
      JSON.stringify(titleJobs),
    ],
  );
}

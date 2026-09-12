import { randomUUID } from 'node:crypto';
import { db, type Database } from '../db';
import { config } from '../../lib/config';
import {
  OMDB_REFRESH_DAYS,
  omdbDataSchema,
  type OmdbData,
  type OmdbEnrichment,
  type OmdbFailure,
  type OmdbJob,
} from '../../domain/enrichment';
import type { OmdbReservation } from '../providers/omdb';

export async function getEnrichment(
  titleId: string,
  database?: Database,
): Promise<OmdbEnrichment | null> {
  if (!config().omdbEnabled) return null;
  const result = await (database ?? (await db())).query<{
    data: unknown;
    fetched_at: string | Date;
    expires_at: string | Date;
  }>(
    `SELECT e.data,e.fetched_at,e.expires_at FROM omdb_enrichments e JOIN titles t ON t.id=e.title_id
      WHERE e.title_id=$1 AND e.data IS NOT NULL AND e.fetched_at IS NOT NULL AND e.expires_at IS NOT NULL
        AND t.data->'externalIds'->>'imdb'=e.imdb_id AND t.media_type=e.media_type
        AND e.data->>'imdbId'=e.imdb_id AND e.data->>'type'=e.media_type`,
    [titleId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const parsed = omdbDataSchema.safeParse(row.data);
  if (!parsed.success) return null;
  const expiresAt = new Date(row.expires_at).toISOString();
  return {
    ...parsed.data,
    fetchedAt: new Date(row.fetched_at).toISOString(),
    expiresAt,
    stale: Date.parse(expiresAt) <= Date.now(),
  };
}

export async function registerOmdbTitles(
  database?: Database,
  limit = 250,
): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
    throw new Error('Invalid OMDb registration limit');
  const result = await (database ?? (await db())).query(
    `
    INSERT INTO omdb_enrichments(title_id,imdb_id,media_type)
    SELECT t.id,t.data->'externalIds'->>'imdb',t.media_type FROM titles t
    LEFT JOIN omdb_enrichments e ON e.title_id=t.id
    WHERE t.data->'externalIds'->>'imdb' ~ '^tt[0-9]{7,12}$'
      AND (e.title_id IS NULL OR e.imdb_id IS DISTINCT FROM t.data->'externalIds'->>'imdb'
        OR e.media_type<>t.media_type OR (e.state IN ('ready','missing') AND e.run_at<=now()))
    ORDER BY e.run_at NULLS FIRST,t.id LIMIT $1
    ON CONFLICT(title_id) DO UPDATE SET imdb_id=EXCLUDED.imdb_id,media_type=EXCLUDED.media_type,
      state='queued',attempts=0,run_at=now(),lock_token=null,lock_until=null,error_code=null,updated_at=now()
    WHERE omdb_enrichments.imdb_id<>EXCLUDED.imdb_id OR omdb_enrichments.media_type<>EXCLUDED.media_type
      OR (omdb_enrichments.state IN ('ready','missing') AND omdb_enrichments.run_at<=now())
    RETURNING title_id`,
    [limit],
  );
  return result.rows.length;
}

export async function claimOmdb(database?: Database): Promise<OmdbJob | null> {
  return (
    (
      await (database ?? (await db())).query<OmdbJob>(
        'SELECT title_id,imdb_id,media_type,attempts,lock_token FROM claim_omdb($1)',
        [randomUUID()],
      )
    ).rows[0] ?? null
  );
}

export async function reserveOmdbRequest(
  database?: Database,
  dailyBudget = config().OMDB_DAILY_BUDGET,
): Promise<OmdbReservation> {
  const result = await (database ?? (await db())).query<{
    retry_after: number | string;
  }>('SELECT reserve_omdb_request($1) AS retry_after', [dailyBudget]);
  const delay = Number(result.rows[0]?.retry_after);
  if (!Number.isSafeInteger(delay) || delay < 0)
    throw new Error('Invalid OMDb reservation');
  return { allowed: delay === 0, retryAfter: delay };
}

export async function finishOmdb(
  job: OmdbJob,
  data: OmdbData,
  database?: Database,
): Promise<boolean> {
  const parsed = omdbDataSchema.safeParse(data);
  if (
    !parsed.success ||
    parsed.data.imdbId !== job.imdb_id ||
    parsed.data.type !== job.media_type
  )
    throw new Error('Invalid OMDb enrichment identity');
  const result = await (database ?? (await db())).query(
    `
    WITH current_title AS MATERIALIZED (
      SELECT id FROM titles WHERE id=$1 AND data->'externalIds'->>'imdb'=$3 AND media_type=$4 FOR UPDATE
    ) UPDATE omdb_enrichments e SET data=$5::jsonb,state='ready',attempts=0,
      fetched_at=now(),expires_at=now()+make_interval(days=>$6),run_at=now()+make_interval(days=>$6),
      lock_token=null,lock_until=null,error_code=null,updated_at=now()
    WHERE e.title_id=$1 AND e.lock_token=$2 AND e.imdb_id=$3 AND e.media_type=$4
      AND e.state='running' AND e.lock_until>now() AND EXISTS(SELECT 1 FROM current_title)
    RETURNING e.title_id`,
    [
      job.title_id,
      job.lock_token,
      job.imdb_id,
      job.media_type,
      JSON.stringify(parsed.data),
      OMDB_REFRESH_DAYS,
    ],
  );
  return result.rows.length === 1;
}

export async function failOmdb(
  job: OmdbJob,
  code: OmdbFailure,
  retryAfter = 0,
  database?: Database,
): Promise<boolean> {
  const connection = database ?? (await db());
  const minDelay =
    code === 'missing' || code === 'identity'
      ? OMDB_REFRESH_DAYS * 86400
      : code === 'auth' || code === 'disabled'
        ? 86400
        : code === 'quota'
          ? 900
          : code === 'budget'
            ? 60
            : Math.min(86400, 60 * 2 ** Math.min(job.attempts - 1, 10));
  const seconds = Math.ceil(
    Math.max(minDelay, Math.min(86400000, Math.max(0, retryAfter)) / 1000),
  );
  // A provider-wide rejection must pause every worker, including one that lost its title lease.
  if (code === 'quota' || code === 'auth') {
    await connection.query(
      `UPDATE omdb_control SET paused_until=greatest(COALESCE(paused_until,now()),now()+make_interval(secs=>$1)),error_code=$2 WHERE id=true`,
      [seconds, code],
    );
  }
  const result = await connection.query(
    `
    UPDATE omdb_enrichments SET state=$3,error_code=$4,run_at=now()+make_interval(secs=>$5),
      attempts=CASE WHEN $4='budget' THEN greatest(0,attempts-1) ELSE attempts END,
      lock_token=null,lock_until=null,updated_at=now()
    WHERE title_id=$1 AND lock_token=$2 AND state='running' AND lock_until>now() RETURNING title_id`,
    [
      job.title_id,
      job.lock_token,
      code === 'missing' || code === 'identity' ? 'missing' : 'queued',
      code,
      seconds,
    ],
  );
  return result.rows.length === 1;
}

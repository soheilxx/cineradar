import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, type Database } from '../data/db';
import { TMDB } from '../data/providers/tmdb';
import { getTvmazeDiscoveryCandidates } from '../data/repositories/episodes';
import { ProviderError } from '../data/providers/http';
import { config } from '../lib/config';
import type { MediaType } from '../domain/types';

type DiscoveryProvider = Pick<TMDB, 'externalIds' | 'findSeries'>;
const idsSchema = z.object({
  imdb: z
    .string()
    .regex(/^tt\d{7,12}$/)
    .optional(),
  tvdb: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
});
const positiveId = (id: number) => Number.isSafeInteger(id) && id > 0;
const bounded = (value: number | undefined, fallback: number, max: number) =>
  value === undefined
    ? fallback
    : Number.isFinite(value)
      ? Math.max(0, Math.min(max, Math.floor(value)))
      : 0;

/** Exact-ID enrichment and new-title discovery, independent of visitor requests. */
export async function runProviderDiscovery(
  options: {
    database?: Database;
    maxDurationMs?: number;
    maxTitles?: number;
    maxDiscoveries?: number;
    tmdb?: DiscoveryProvider;
  } = {},
) {
  const c = config();
  const result = {
    enabled: c.tvmazeEnabled || c.omdbEnabled,
    identifiers: 0,
    discovered: 0,
    queued: 0,
    error: null as string | null,
  };
  const maxTitles = bounded(options.maxTitles, 20, 100);
  const maxDiscoveries = c.tvmazeEnabled
    ? bounded(options.maxDiscoveries, 3, 20)
    : 0;
  const duration = bounded(options.maxDurationMs, 20000, 60000);
  if (!result.enabled || duration <= 11000 || (!maxTitles && !maxDiscoveries))
    return result;
  const deadline = Date.now() + duration;
  const database = options.database ?? (await db());
  const token = randomUUID();
  const acquired = (
    await database.query(
      `INSERT INTO operations(key,data) VALUES('provider-discovery',jsonb_build_object('token',$1::text,'until',now()+interval '2 minutes'))
    ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data,updated_at=now()
    WHERE (operations.data->>'until')::timestamptz<=now() RETURNING key`,
      [token],
    )
  ).rows.length;
  if (!acquired) return result;
  const owner =
    "SELECT key FROM operations WHERE key='provider-discovery' AND data->>'token'=$1 AND (data->>'until')::timestamptz>now()";
  const canRequest = async () =>
    Date.now() + 11000 < deadline &&
    (await database.query(owner, [token])).rows.length === 1 &&
    Date.now() + 11000 < deadline;
  // Bind the allowance to the same connection as the job; injected databases
  // must never silently reserve against the global production connection.
  const tmdb =
    options.tmdb ??
    new TMDB(async (service, units) => {
      if (service !== 'tmdb') return false;
      const allowance = await database.query<{ ok: boolean }>(
        `WITH owner AS MATERIALIZED (${owner} FOR UPDATE)
       SELECT CASE WHEN EXISTS(SELECT 1 FROM owner) THEN reserve_budget('tmdb',$2,$3,$4) ELSE false END AS ok`,
        [token, units, c.TMDB_DAILY_BUDGET, c.TMDB_DAILY_BUDGET * 31],
      );
      return allowance.rows[0]?.ok === true;
    });
  try {
    const titles = maxTitles
      ? (
          await database.query<{
            id: string;
            media_type: MediaType;
            tmdb_id: string;
          }>(
            `SELECT id,media_type,tmdb_id FROM titles
      WHERE NOT(data ? 'externalIdsCheckedAt')
      ORDER BY (media_type='tv') DESC,
        CASE WHEN jsonb_typeof(data->'popularity')='number' THEN (data->>'popularity')::numeric ELSE 0 END DESC,id LIMIT $1`,
            [maxTitles],
          )
        ).rows
      : [];
    for (const title of titles) {
      if (!(await canRequest())) break;
      const id = Number(title.tmdb_id);
      if (
        !positiveId(id) ||
        !['movie', 'tv'].includes(title.media_type) ||
        title.id !== `${title.media_type}:${id}`
      ) {
        result.error = 'schema';
        continue;
      }
      let external;
      try {
        const parsed = idsSchema.safeParse(
          await tmdb.externalIds(title.media_type, id),
        );
        if (!parsed.success) throw new ProviderError('schema');
        external = parsed.data;
      } catch (error) {
        // An absent/invalid title must not prevent the other selected titles
        // from progressing. Quota, authentication and transport failures stop.
        if (
          error instanceof ProviderError &&
          ['missing', 'schema'].includes(error.code)
        ) {
          result.error = error.code;
          continue;
        }
        throw error;
      }
      const updated = await database.query(
        `WITH owner AS MATERIALIZED (${owner} FOR UPDATE)
        UPDATE titles SET data=jsonb_set(jsonb_set(data,'{externalIds}',
          (CASE WHEN jsonb_typeof(data->'externalIds')='object' THEN data->'externalIds' ELSE '{}'::jsonb END)-'imdb'-'tvdb'||$3::jsonb),
          '{externalIdsCheckedAt}',to_jsonb(now()::text))
        WHERE id=$2 AND media_type=$4 AND tmdb_id=$5 AND NOT(data ? 'externalIdsCheckedAt')
          AND EXISTS(SELECT 1 FROM owner) RETURNING id`,
        [token, title.id, JSON.stringify(external), title.media_type, id],
      );
      result.identifiers += updated.rows.length;
    }
    if (maxDiscoveries && (await canRequest())) {
      const candidates = await getTvmazeDiscoveryCandidates(
        maxDiscoveries,
        database,
      );
      for (const candidate of candidates) {
        if (!(await canRequest())) break;
        const hasImdb =
          typeof candidate.imdbId === 'string' &&
          /^tt\d{7,12}$/.test(candidate.imdbId);
        const hasTvdb =
          typeof candidate.tvdbId === 'number' && positiveId(candidate.tvdbId);
        if (!positiveId(candidate.tvmazeId) || (!hasImdb && !hasTvdb)) {
          result.error = 'schema';
          continue;
        }
        const identifier = hasImdb
          ? candidate.imdbId!
          : String(candidate.tvdbId);
        const tmdbId = await tmdb.findSeries(
          identifier,
          hasImdb ? 'imdb_id' : 'tvdb_id',
        );
        if (tmdbId !== null && !positiveId(tmdbId))
          throw new ProviderError('schema');
        // The check and enqueue are one transaction. A crash cannot record a
        // completed discovery while losing its import, and a replaced lease or
        // changed source identity cannot publish an obsolete lookup result.
        const committed = (
          await database.query<{ checked: number; queued: number }>(
            `
          WITH owner AS MATERIALIZED (${owner} FOR UPDATE),
          checked AS (
            UPDATE tvmaze_shows s SET discovery_checked_at=now()
            WHERE s.id=$2 AND s.imdb_id IS NOT DISTINCT FROM $3::text AND s.tvdb_id IS NOT DISTINCT FROM $4::bigint
              AND (s.discovery_checked_at IS NULL OR s.discovery_checked_at<now()-interval '30 days')
              AND NOT EXISTS(SELECT 1 FROM tvmaze_title_map m WHERE m.show_id=s.id)
              AND EXISTS(SELECT 1 FROM owner) RETURNING s.id
          ), queued AS (
            INSERT INTO jobs(key,kind,payload,priority)
            SELECT 'tvmaze-import:tv:'||$5::text,'import',jsonb_build_object('type','tv','id',$5::bigint,'source','tvmaze'),55
            FROM checked WHERE $5::bigint IS NOT NULL
              AND NOT EXISTS(SELECT 1 FROM titles WHERE id='tv:'||$5::text)
              AND NOT EXISTS(SELECT 1 FROM jobs WHERE kind IN ('import','catalog-title')
                AND payload->>'type'='tv' AND payload->>'id'=$5::text AND state IN ('queued','running','paused'))
            ON CONFLICT(key) DO UPDATE SET state='queued',attempts=0,run_at=now(),error_code=null,lock_token=null,lock_until=null,priority=greatest(jobs.priority,55)
              WHERE jobs.state IN ('done','dead')
            RETURNING id
          ) SELECT (SELECT count(*)::int FROM checked) AS checked,(SELECT count(*)::int FROM queued) AS queued`,
            [
              token,
              candidate.tvmazeId,
              candidate.imdbId,
              candidate.tvdbId,
              tmdbId,
            ],
          )
        ).rows[0];
        if (tmdbId !== null) result.discovered += committed?.checked ?? 0;
        result.queued += committed?.queued ?? 0;
      }
    }
  } catch (error) {
    result.error =
      error instanceof ProviderError ? error.code : 'discovery_failed';
  } finally {
    await database.query(
      `UPDATE operations SET data=jsonb_build_object('until',now(),'result',$2::jsonb),updated_at=now() WHERE key='provider-discovery' AND data->>'token'=$1`,
      [token, JSON.stringify(result)],
    );
  }
  return result;
}

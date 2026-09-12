import { randomUUID } from 'node:crypto';
import { db, type Database } from '../data/db';
import { config } from '../lib/config';
import { ProviderError } from '../data/providers/http';
import { TVmaze, normalizeTvmazeEpisode } from '../data/providers/tvmaze';
import {
  matchTvmazeTitles,
  storeTvmazeEpisodes,
  storeTvmazeShows,
} from '../data/repositories/episodes';

export interface TvmazeBatchOptions {
  database?: Database;
  maxDurationMs?: number;
  maxRequests?: number;
  maxPages?: number;
  maxShows?: number;
  markets?: string[];
  /** Dependency injection for isolated provider tests; never used by a read route. */
  fetcher?: typeof fetch;
}

function limit(value: number | undefined, fallback: number, max: number) {
  return value === undefined || !Number.isFinite(value)
    ? fallback
    : Math.max(0, Math.min(max, Math.floor(value)));
}

/** Independent of paid SAA syncing. Visitor reads only access persisted data. */
export async function runTvmazeBatch(options: TvmazeBatchOptions = {}) {
  const c = config();
  const result = {
    enabled: c.tvmazeEnabled,
    indexed: 0,
    matched: 0,
    guides: 0,
    scheduled: 0,
    requests: 0,
    error: null as string | null,
  };
  if (!c.tvmazeEnabled) return result;
  const d = options.database ?? (await db());
  const token = randomUUID();
  const deadline = Date.now() + limit(options.maxDurationMs, 55000, 120000);
  const maxRequests = limit(options.maxRequests, 20, 100);
  const owner = (
    await d.query<{
      next_page: number;
      index_completed_at: string | null;
      next_request_at: string | Date;
    }>(
      `UPDATE tvmaze_sync SET lock_token=$1,lock_until=now()+interval '2 minutes',
       next_page=CASE WHEN index_completed_at<now()-interval '24 hours' THEN tail_page ELSE next_page END,
       index_completed_at=CASE WHEN index_completed_at<now()-interval '24 hours' THEN NULL ELSE index_completed_at END
     WHERE id=1 AND (lock_until IS NULL OR lock_until<=now()) AND next_request_at<now()+interval '1 second'
     RETURNING next_page,index_completed_at,next_request_at`,
      [token],
    )
  ).rows[0];
  if (!owner) return result;
  let lastRequestAt = new Date(owner.next_request_at).valueOf() - 700;
  const hasTime = () =>
    result.requests < maxRequests && Date.now() + 9000 < deadline;
  const api = new TVmaze(async () => {
    if (!hasTime()) return false;
    const wait = Math.max(0, lastRequestAt + 710 - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    if (!hasTime()) return false;
    const reserved = (
      await d.query<{ allowed: boolean }>(
        'SELECT reserve_tvmaze($1,$2) AS allowed',
        [token, c.TVMAZE_DAILY_BUDGET],
      )
    ).rows[0]?.allowed;
    if (reserved) {
      lastRequestAt = Date.now();
      result.requests++;
    }
    return Boolean(reserved);
  }, options.fetcher);
  const owned = `EXISTS(SELECT 1 FROM tvmaze_sync WHERE id=1 AND lock_token=$1 AND lock_until>now())`;
  let pages = 0;
  const maxPages = limit(options.maxPages, 2, 50);
  const indexPage = async () => {
    if (owner.index_completed_at || pages >= maxPages || !hasTime())
      return false;
    const page = owner.next_page;
    const shows = await api.index(page);
    pages++;
    if (shows === null) {
      await storeTvmazeShows([], token, d, null);
      owner.index_completed_at = new Date().toISOString();
    } else {
      result.indexed += await storeTvmazeShows(shows, token, d, page);
      owner.next_page++;
    }
    return true;
  };
  try {
    result.matched += await matchTvmazeTitles(d, token);
    // Bootstrap known titles by exact external IDs before a long index crawl
    // reaches their TVmaze IDs. Cache misses for a week to avoid hot retries.
    const lookups = (
      await d.query<{ id: string; external: { imdb?: string; tvdb?: number } }>(
        `SELECT t.id,t.data->'externalIds' AS external FROM titles t
       LEFT JOIN tvmaze_title_map m ON m.title_id=t.id LEFT JOIN tvmaze_title_lookups l ON l.title_id=t.id
       WHERE t.media_type='tv' AND m.title_id IS NULL
         AND ((t.data->'externalIds'->>'imdb') ~ '^tt[0-9]{5,12}$' OR (t.data->'externalIds'->>'tvdb') ~ '^[1-9][0-9]*$')
         AND (l.checked_at IS NULL OR l.checked_at<now()-interval '7 days')
       ORDER BY l.checked_at NULLS FIRST,t.updated_at DESC LIMIT 1`,
      )
    ).rows;
    for (const row of lookups) {
      if (!hasTime()) break;
      const show = await api.lookup(row.external);
      if (show) await storeTvmazeShows([show], token, d);
      await d.query(
        `INSERT INTO tvmaze_title_lookups(title_id,checked_at) SELECT $2,now() WHERE ${owned} ON CONFLICT(title_id) DO UPDATE SET checked_at=now()`,
        [token, row.id],
      );
    }
    // Start one index page, then give guides and the calendar a turn before
    // continuing the crawl. Large requested page caps cannot consume the whole
    // batch before any episode data is saved. Empty pages still advance.
    await indexPage();
    result.matched += await matchTvmazeTitles(d, token);
    const guides = (
      await d.query<{ id: number }>(
        `SELECT s.id::int AS id FROM tvmaze_shows s JOIN tvmaze_title_map m ON m.show_id=s.id
       WHERE (s.episodes_retry_at IS NULL OR s.episodes_retry_at<=now())
         AND (s.data->>'type' IS NULL OR s.episodes_fetched_at IS NULL OR s.episodes_fetched_at<now()-
           CASE WHEN s.data->>'status'='Ended' THEN interval '7 days' ELSE interval '12 hours' END)
       ORDER BY s.episodes_fetched_at NULLS FIRST,s.id LIMIT $1`,
        [limit(options.maxShows, 4, 20)],
      )
    ).rows;
    const updateGuide = async () => {
      if (
        !guides.length ||
        !hasTime() ||
        result.requests + 2 > maxRequests ||
        Date.now() + 18000 >= deadline
      )
        return false;
      const row = guides.shift()!;
      try {
        const show = await api.show(row.id);
        const episodes = await api.episodes(row.id);
        await storeTvmazeShows([show], token, d);
        await storeTvmazeEpisodes(
          row.id,
          episodes.map((episode) => normalizeTvmazeEpisode(episode, row.id)),
          token,
          d,
          true,
        );
        result.guides++;
      } catch (error) {
        if (error instanceof ProviderError && error.code === 'missing') {
          await d.query(
            `UPDATE tvmaze_shows SET episodes_retry_at=now()+interval '7 days' WHERE id=$2 AND ${owned}`,
            [token, row.id],
          );
        } else throw error;
      }
      return true;
    };
    await updateGuide();
    const markets = [
      ...new Set([
        ...(options.markets ?? c.markets).filter((market) =>
          /^[a-z]{2}$/.test(market),
        ),
        'global',
      ]),
    ].slice(0, 20);
    await d.query(
      `INSERT INTO tvmaze_schedule_scopes(market,day)
       SELECT market,(now() AT TIME ZONE 'UTC')::date+offset_day FROM unnest($2::text[]) market CROSS JOIN generate_series(0,13) offset_day
       WHERE ${owned} ON CONFLICT DO NOTHING`,
      [token, markets],
    );
    await d.query(
      `DELETE FROM tvmaze_schedule_scopes WHERE day<(now() AT TIME ZONE 'UTC')::date-2 AND ${owned}`,
      [token],
    );
    // Upgrade schedules saved before show types were retained, once. The
    // ordinary bounded queue then fills the missing type metadata; restarting
    // the job must not reset progress and fetch the first day forever.
    await d.query(
      `WITH owner AS MATERIALIZED (SELECT id FROM tvmaze_sync WHERE id=1 AND lock_token=$1 AND lock_until>now() FOR UPDATE),
       upgrade AS (INSERT INTO operations(key,data)
         SELECT 'tvmaze:schedule-types:v1','{"version":1}'::jsonb WHERE EXISTS(SELECT 1 FROM owner)
         ON CONFLICT(key) DO NOTHING RETURNING key)
       UPDATE tvmaze_schedule_scopes SET fetched_at=NULL
       WHERE day>=(now() AT TIME ZONE 'UTC')::date AND EXISTS(SELECT 1 FROM upgrade)`,
      [token],
    );
    const scopes = (
      await d.query<{ market: string; day: string }>(
        `SELECT market,day::text FROM tvmaze_schedule_scopes WHERE day>=(now() AT TIME ZONE 'UTC')::date
       AND day<(now() AT TIME ZONE 'UTC')::date+14 AND market=ANY($1::text[])
       AND (fetched_at IS NULL OR fetched_at<now()-interval '6 hours')
       ORDER BY fetched_at NULLS FIRST,day,market LIMIT $2`,
        [markets, maxRequests],
      )
    ).rows;
    const updateSchedule = async () => {
      if (!scopes.length || !hasTime()) return false;
      const scope = scopes.shift()!;
      const entries = await api.schedule(scope.market, scope.day);
      const shows = entries.map(
        (entry) => (entry.show ?? entry._embedded?.show)!,
      );
      await storeTvmazeShows(shows, token, d);
      await storeTvmazeEpisodes(
        null,
        entries.map((entry, index) =>
          normalizeTvmazeEpisode(entry, shows[index].id),
        ),
        token,
        d,
      );
      await d.query(
        `UPDATE tvmaze_schedule_scopes SET fetched_at=now() WHERE market=$2 AND day=$3 AND ${owned}`,
        [token, scope.market, scope.day],
      );
      result.scheduled += entries.length;
      return true;
    };
    await updateSchedule();
    while (hasTime()) {
      const indexed = await indexPage();
      const guided = await updateGuide();
      const scheduled = await updateSchedule();
      if (!indexed && !guided && !scheduled) break;
    }
    result.matched += await matchTvmazeTitles(d, token);
  } catch (error) {
    result.error =
      error instanceof ProviderError
        ? error.code
        : typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === '57014'
          ? 'database_timeout'
          : 'sync_failed';
    // The shared cooldown applies to overlapping deployments as well. 429 is
    // retryable; cursor/guide work already committed remains resumable.
    const retryMs =
      error instanceof ProviderError && error.code === 'quota'
        ? Math.max(10000, Math.min(86400000, error.retryAfter || 10000))
        : result.error === 'budget'
          ? 1000
          : 60000;
    await d.query(
      `UPDATE tvmaze_sync SET next_request_at=GREATEST(next_request_at,now()+$2::int*interval '1 millisecond'),error_code=$3 WHERE ${owned}`,
      [token, retryMs, result.error],
    );
  } finally {
    await d.query(
      `UPDATE tvmaze_sync SET lock_token=NULL,lock_until=NULL,updated_at=now(),error_code=$2 WHERE lock_token=$1`,
      [token, result.error],
    );
  }
  return result;
}

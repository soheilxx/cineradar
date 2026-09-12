import { db, type Database } from '../db';
import { config } from '../../lib/config';
import {
  TVMAZE_SOURCE,
  type Episode,
  type EpisodeGuide,
  type EpisodeShow,
  type UpcomingEpisodes,
} from '../../domain/episodes';
import type { Title } from '../../domain/types';
import { normalizeTvmazeShow, type TvmazeShow } from '../providers/tvmaze';

function bounded(value: number, max: number, fallback: number) {
  return Number.isFinite(value)
    ? Math.max(1, Math.min(max, Math.floor(value)))
    : fallback;
}

function withKnownAirTime(episode: Episode): Episode {
  return episode.airTime ? episode : { ...episode, airStamp: null };
}

export async function getEpisodeGuide(
  titleId: string,
  database?: Database,
): Promise<EpisodeGuide | null> {
  if (!database && config().APP_MODE !== 'live') return null;
  const d = database ?? (await db());
  const record = (
    await d.query<{
      data: EpisodeShow;
      episodes_fetched_at: string | Date | null;
    }>(
      `SELECT s.data,s.episodes_fetched_at FROM tvmaze_title_map m JOIN tvmaze_shows s ON s.id=m.show_id WHERE m.title_id=$1`,
      [titleId],
    )
  ).rows[0];
  if (!record) return null;
  const [episodeRows, totals, next] = await Promise.all([
    d.query<{ data: Episode }>(
      `SELECT data FROM tvmaze_episodes WHERE show_id=$1 ORDER BY season DESC,number DESC NULLS LAST,id DESC LIMIT 500`,
      [record.data.id],
    ),
    d.query<{ season: number; total: number }>(
      `SELECT season,count(*)::int AS total FROM tvmaze_episodes WHERE show_id=$1 GROUP BY season ORDER BY season`,
      [record.data.id],
    ),
    d.query<{ data: Episode }>(
      `SELECT data FROM tvmaze_episodes WHERE show_id=$1 AND (
        (air_stamp>=now() AND COALESCE(data->>'airTime','')<>'')
        OR ((air_stamp IS NULL OR COALESCE(data->>'airTime','')='') AND air_date>=(now() AT TIME ZONE 'UTC')::date))
       ORDER BY COALESCE(CASE WHEN COALESCE(data->>'airTime','')<>'' THEN air_stamp END,air_date::timestamp AT TIME ZONE 'UTC'),id LIMIT 1`,
      [record.data.id],
    ),
  ]);
  const totalEpisodes = totals.rows.reduce((sum, row) => sum + row.total, 0);
  const visibleSeasons = totals.rows.slice(-100);
  return {
    show: record.data,
    seasons: visibleSeasons.map((row) => ({
      number: row.season,
      total: row.total,
      episodes: episodeRows.rows
        .map((entry) => withKnownAirTime(entry.data))
        .filter((episode) => episode.season === row.season)
        .sort(
          (a, b) =>
            (a.number ?? Number.MAX_SAFE_INTEGER) -
              (b.number ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
        ),
    })),
    nextEpisode: next.rows[0] ? withKnownAirTime(next.rows[0].data) : null,
    totalEpisodes,
    truncated:
      totalEpisodes > episodeRows.rows.length ||
      totals.rows.length > visibleSeasons.length,
    updatedAt: record.episodes_fetched_at
      ? new Date(record.episodes_fetched_at).toISOString()
      : null,
    source: TVMAZE_SOURCE,
  };
}

export async function getUpcomingEpisodes(
  market: string,
  days = 14,
  limit = 100,
  database?: Database,
): Promise<UpcomingEpisodes> {
  const normalizedMarket = /^[a-z]{2}$/i.test(market)
    ? market.toLowerCase()
    : 'de';
  const boundedDays = bounded(days, 30, 14),
    boundedLimit = bounded(limit, 200, 100);
  const result: UpcomingEpisodes = {
    episodes: [],
    source: TVMAZE_SOURCE,
    days: boundedDays,
    market: normalizedMarket,
    truncated: false,
  };
  if (!database && config().APP_MODE !== 'live') return result;
  const d = database ?? (await db());
  const rows = (
    await d.query<{ episode: Episode; show: EpisodeShow; title: Title | null }>(
      `SELECT e.data AS episode,s.data AS show,t.data AS title
     FROM tvmaze_episodes e JOIN tvmaze_shows s ON s.id=e.show_id
     LEFT JOIN tvmaze_title_map m ON m.show_id=s.id LEFT JOIN titles t ON t.id=m.title_id
     WHERE s.data->>'type' IN ('Scripted','Animation','Documentary','Reality') AND (
       (e.air_stamp>=now() AND e.air_stamp<now()+make_interval(days=>$1) AND COALESCE(e.data->>'airTime','')<>'')
       OR ((e.air_stamp IS NULL OR COALESCE(e.data->>'airTime','')='') AND e.air_date>=(now() AT TIME ZONE 'UTC')::date
         AND e.air_date<(now() AT TIME ZONE 'UTC')::date+$1::int))
     ORDER BY COALESCE(CASE WHEN COALESCE(e.data->>'airTime','')<>'' THEN e.air_stamp END,e.air_date::timestamp AT TIME ZONE 'UTC'),e.id LIMIT $2`,
      [boundedDays, boundedLimit + 1],
    )
  ).rows;
  result.truncated = rows.length > boundedLimit;
  result.episodes = rows.slice(0, boundedLimit).map((row) => ({
    ...row,
    episode: withKnownAirTime(row.episode),
    marketRelation:
      row.show.country === normalizedMarket
        ? 'market'
        : row.show.distribution === 'global'
          ? 'global'
          : 'original',
    source: TVMAZE_SOURCE,
  }));
  return result;
}

export async function getTvmazeDiscoveryCandidates(
  limit = 20,
  database?: Database,
) {
  const d = database ?? (await db());
  return (
    await d.query<{
      tvmazeId: number;
      imdbId: string | null;
      tvdbId: number | null;
      name: string;
    }>(
      `SELECT s.id::int AS "tvmazeId",s.imdb_id AS "imdbId",s.tvdb_id::int AS "tvdbId",s.data->>'name' AS name
     FROM tvmaze_shows s LEFT JOIN tvmaze_title_map m ON m.show_id=s.id
     WHERE m.show_id IS NULL AND (s.imdb_id IS NOT NULL OR s.tvdb_id IS NOT NULL)
       AND (s.discovery_checked_at IS NULL OR s.discovery_checked_at<now()-interval '30 days')
     ORDER BY s.discovery_checked_at NULLS FIRST,s.id LIMIT $1`,
      [bounded(limit, 100, 20)],
    )
  ).rows;
}

/** Writes are fenced by the shared background lease, including cursor commits. */
export async function storeTvmazeShows(
  shows: TvmazeShow[],
  token: string,
  database: Database,
  page?: number | null,
) {
  const unique = [...new Map(shows.map((show) => [show.id, show])).values()];
  const rows = unique.map((show) => ({
    id: show.id,
    imdb: show.externals.imdb,
    tvdb: show.externals.thetvdb,
    updated: show.updated,
    url: show.url,
    data: normalizeTvmazeShow(show),
  }));
  const result = await database.query<{ stored: number }>(
    `WITH owner AS MATERIALIZED (SELECT id FROM tvmaze_sync WHERE id=1 AND lock_token=$2 AND lock_until>now() FOR UPDATE),
     stored AS (
       INSERT INTO tvmaze_shows(id,imdb_id,tvdb_id,data,source_updated,source_url)
       SELECT r.id,r.imdb,r.tvdb,r.data,r.updated,r.url
       FROM jsonb_to_recordset($1::jsonb) AS r(id bigint,imdb text,tvdb bigint,data jsonb,updated bigint,url text)
       WHERE EXISTS(SELECT 1 FROM owner)
       ON CONFLICT(id) DO UPDATE SET imdb_id=EXCLUDED.imdb_id,tvdb_id=EXCLUDED.tvdb_id,data=EXCLUDED.data,
         source_updated=EXCLUDED.source_updated,source_url=EXCLUDED.source_url,fetched_at=now()
       WHERE tvmaze_shows.source_updated<=EXCLUDED.source_updated RETURNING id
     ), advanced AS (
       UPDATE tvmaze_sync SET next_page=CASE WHEN $3::int IS NOT NULL THEN $3+1 ELSE next_page END,
         tail_page=CASE WHEN $4::boolean THEN GREATEST(0,next_page-1) ELSE tail_page END,
         index_completed_at=CASE WHEN $4::boolean THEN now() ELSE index_completed_at END,
         updated_at=now()
       WHERE EXISTS(SELECT 1 FROM owner) AND (SELECT count(*) FROM stored)>=0 RETURNING id
     ) SELECT count(*)::int AS stored FROM stored WHERE EXISTS(SELECT 1 FROM advanced)`,
    [
      JSON.stringify(rows),
      token,
      typeof page === 'number' ? page : null,
      page === null,
    ],
  );
  return result.rows[0]?.stored ?? 0;
}

export async function matchTvmazeTitles(database: Database, token: string) {
  const result = await database.query<{ title_id: string }>(
    `WITH owner AS MATERIALIZED (SELECT id FROM tvmaze_sync WHERE id=1 AND lock_token=$1 AND lock_until>now() FOR UPDATE),
     eligible AS MATERIALIZED (
       SELECT t.id,t.data->'externalIds'->>'imdb' AS imdb,
         t.data->'externalIds'->>'tvdb' AS tvdb,t.data->'externalIds'->>'tvmaze' AS tvmaze,
         CASE WHEN t.data->'externalIds'->>'tvdb' ~ '^[1-9][0-9]{0,15}$'
           THEN (t.data->'externalIds'->>'tvdb')::bigint END AS tvdb_id,
         CASE WHEN t.data->'externalIds'->>'tvmaze' ~ '^[1-9][0-9]{0,15}$'
           THEN (t.data->'externalIds'->>'tvmaze')::bigint END AS tvmaze_id
       FROM titles t WHERE t.media_type='tv' AND EXISTS(SELECT 1 FROM owner)
         AND (t.data->'externalIds'->>'imdb' IS NOT NULL OR t.data->'externalIds'->>'tvdb' IS NOT NULL
           OR t.data->'externalIds'->>'tvmaze' IS NOT NULL)
     ), exact_matches AS (
       SELECT t.*,s.id AS show_id,s.imdb_id AS show_imdb,s.tvdb_id AS show_tvdb,1 AS priority
       FROM eligible t JOIN tvmaze_shows s ON s.id=t.tvmaze_id
       UNION ALL
       SELECT t.*,s.id,s.imdb_id,s.tvdb_id,2 FROM eligible t JOIN tvmaze_shows s ON s.imdb_id=t.imdb
       UNION ALL
       SELECT t.*,s.id,s.imdb_id,s.tvdb_id,3 FROM eligible t JOIN tvmaze_shows s ON s.tvdb_id=t.tvdb_id
     ), candidates AS (
       SELECT id AS title_id,show_id,
         CASE min(priority) WHEN 1 THEN 'tvmaze' WHEN 2 THEN 'imdb' ELSE 'tvdb' END AS source
       FROM exact_matches
       WHERE (tvmaze IS NULL OR tvmaze=show_id::text)
         AND (imdb IS NULL OR show_imdb IS NULL OR imdb=show_imdb)
         AND (tvdb IS NULL OR show_tvdb IS NULL OR tvdb=show_tvdb::text)
       GROUP BY id,show_id
     ), unambiguous AS (
       SELECT *,count(*) OVER(PARTITION BY title_id) AS title_matches,count(*) OVER(PARTITION BY show_id) AS show_matches FROM candidates
     )
     INSERT INTO tvmaze_title_map(title_id,show_id,match_source)
     SELECT title_id,show_id,source FROM unambiguous WHERE title_matches=1 AND show_matches=1
     ON CONFLICT DO NOTHING RETURNING title_id`,
    [token],
  );
  return result.rows.length;
}

export async function storeTvmazeEpisodes(
  showId: number | null,
  episodes: Episode[],
  token: string,
  database: Database,
  completeGuide = false,
) {
  if (showId === null && completeGuide)
    throw new Error('A complete guide requires one show');
  const unique = [
    ...new Map(
      episodes
        .filter((episode) => showId === null || episode.showId === showId)
        .map((episode) => [
          episode.id,
          { ...episode, airStamp: episode.airTime ? episode.airStamp : null },
        ]),
    ).values(),
  ];
  await database.query(
    `WITH owner AS MATERIALIZED (SELECT id FROM tvmaze_sync WHERE id=1 AND lock_token=$3 AND lock_until>now() FOR UPDATE),
     stored AS (
       INSERT INTO tvmaze_episodes(id,show_id,season,number,air_stamp,air_date,data)
       SELECT r.id,COALESCE($1::bigint,r."showId"),r.season,r.number,(r."airStamp")::timestamptz,(r."airDate")::date,to_jsonb(r)
       FROM jsonb_to_recordset($2::jsonb) AS r(id bigint,"showId" bigint,name text,season int,number int,type text,"airDate" text,"airTime" text,"airStamp" text,runtime int,summary text,url text)
       WHERE EXISTS(SELECT 1 FROM owner)
       ON CONFLICT(id) DO UPDATE SET season=EXCLUDED.season,number=EXCLUDED.number,air_stamp=EXCLUDED.air_stamp,
         air_date=EXCLUDED.air_date,data=EXCLUDED.data,fetched_at=now()
       WHERE tvmaze_episodes.show_id=EXCLUDED.show_id RETURNING id
     ), removed AS (
       DELETE FROM tvmaze_episodes WHERE show_id=$1 AND $4::boolean AND EXISTS(SELECT 1 FROM owner)
         AND id NOT IN (SELECT (value->>'id')::bigint FROM jsonb_array_elements($2::jsonb)) RETURNING id
     )
     UPDATE tvmaze_shows SET episodes_fetched_at=now(),episodes_retry_at=NULL
     WHERE id=$1 AND $4::boolean AND EXISTS(SELECT 1 FROM owner)
       AND (SELECT count(*) FROM stored)>=0 AND (SELECT count(*) FROM removed)>=0`,
    [showId, JSON.stringify(unique), token, completeGuide],
  );
}

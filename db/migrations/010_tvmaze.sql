-- TVmaze's CC BY-SA data has its own provenance and never replaces TMDB data.
CREATE TABLE tvmaze_shows (
 id bigint PRIMARY KEY CHECK(id>0), imdb_id text, tvdb_id bigint,
 data jsonb NOT NULL, source_updated bigint NOT NULL,
 fetched_at timestamptz NOT NULL DEFAULT now(),
 episodes_fetched_at timestamptz, episodes_retry_at timestamptz,
 discovery_checked_at timestamptz,
 source_url text NOT NULL,
 license text NOT NULL DEFAULT 'CC BY-SA 4.0'
);
CREATE INDEX tvmaze_shows_imdb ON tvmaze_shows(imdb_id) WHERE imdb_id IS NOT NULL;
CREATE INDEX tvmaze_shows_tvdb ON tvmaze_shows(tvdb_id) WHERE tvdb_id IS NOT NULL;
CREATE INDEX tvmaze_shows_discovery ON tvmaze_shows(discovery_checked_at NULLS FIRST,id);
CREATE TABLE tvmaze_title_map (
 title_id text PRIMARY KEY REFERENCES titles(id) ON DELETE CASCADE,
 show_id bigint NOT NULL UNIQUE REFERENCES tvmaze_shows(id) ON DELETE CASCADE,
 match_source text NOT NULL CHECK(match_source IN ('imdb','tvdb','tvmaze')),
 matched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tvmaze_episodes (
 id bigint PRIMARY KEY CHECK(id>0),
 show_id bigint NOT NULL REFERENCES tvmaze_shows(id) ON DELETE CASCADE,
 season integer NOT NULL CHECK(season>=0), number integer,
 air_stamp timestamptz, air_date date,
 data jsonb NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tvmaze_episodes_show ON tvmaze_episodes(show_id,season,number,id);
CREATE INDEX tvmaze_episodes_upcoming ON tvmaze_episodes(air_stamp) WHERE air_stamp IS NOT NULL;
CREATE INDEX tvmaze_episodes_date ON tvmaze_episodes(air_date) WHERE air_stamp IS NULL;
CREATE TABLE tvmaze_title_lookups (
 title_id text PRIMARY KEY REFERENCES titles(id) ON DELETE CASCADE,
 checked_at timestamptz NOT NULL
);
CREATE TABLE tvmaze_schedule_scopes (
 market text NOT NULL CHECK(market='global' OR market ~ '^[a-z]{2}$'),
 day date NOT NULL, fetched_at timestamptz, PRIMARY KEY(market,day)
);
CREATE TABLE tvmaze_sync (
 id integer PRIMARY KEY CHECK(id=1),
 next_page integer NOT NULL DEFAULT 0 CHECK(next_page>=0),
 tail_page integer NOT NULL DEFAULT 0,
 index_completed_at timestamptz,
 lock_token text, lock_until timestamptz,
 next_request_at timestamptz NOT NULL DEFAULT now(),
 budget_day date NOT NULL DEFAULT CURRENT_DATE,
 requests_today integer NOT NULL DEFAULT 0,
 error_code text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tvmaze_sync(id) VALUES(1);
CREATE INDEX title_external_imdb ON titles((data->'externalIds'->>'imdb')) WHERE media_type='tv';
CREATE INDEX title_external_tvdb ON titles((data->'externalIds'->>'tvdb')) WHERE media_type='tv';

-- This gate serializes cron runs and spaces requests globally across deployments.
-- 700 ms between starts permits at most 15 starts in any ten-second interval.
CREATE FUNCTION reserve_tvmaze(p_token text,p_daily integer,p_now timestamptz DEFAULT now())
RETURNS boolean LANGUAGE sql AS $$
 WITH reserved AS (
  UPDATE tvmaze_sync SET next_request_at=p_now+interval '700 milliseconds',
    budget_day=(p_now AT TIME ZONE 'UTC')::date,
    requests_today=CASE WHEN budget_day=(p_now AT TIME ZONE 'UTC')::date THEN requests_today+1 ELSE 1 END,
    lock_until=p_now+interval '2 minutes',updated_at=p_now
  WHERE id=1 AND lock_token=p_token AND lock_until>p_now AND next_request_at<=p_now
    AND p_daily>0 AND (budget_day<>(p_now AT TIME ZONE 'UTC')::date OR requests_today<p_daily)
  RETURNING id
 ) SELECT EXISTS(SELECT 1 FROM reserved);
$$;

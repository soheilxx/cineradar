-- OMDb enriches exact IMDb identities in the existing catalogue. Its data never
-- replaces TMDB metadata, localized editorial copy, ratings or availability.
CREATE TABLE omdb_enrichments (
 title_id text PRIMARY KEY REFERENCES titles(id) ON DELETE CASCADE,
 imdb_id text NOT NULL CHECK(imdb_id ~ '^tt[0-9]{7,12}$'),
 media_type text NOT NULL CHECK(media_type IN ('movie','tv')),
 data jsonb CHECK(data IS NULL OR (jsonb_typeof(data)='object' AND data->>'source'='omdb')),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','ready','missing')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 run_at timestamptz NOT NULL DEFAULT now(),
 lock_token text,
 lock_until timestamptz,
 error_code text,
 fetched_at timestamptz,
 expires_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((fetched_at IS NULL AND expires_at IS NULL) OR
   (fetched_at IS NOT NULL AND expires_at>fetched_at AND expires_at<=fetched_at+interval '30 days'))
);
CREATE INDEX omdb_enrichments_due ON omdb_enrichments(run_at,title_id);
CREATE INDEX titles_imdb_identity ON titles((data->'externalIds'->>'imdb'))
 WHERE data->'externalIds'->>'imdb' ~ '^tt[0-9]{7,12}$';

CREATE TABLE omdb_control (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 paused_until timestamptz,
 error_code text
);
INSERT INTO omdb_control(id) VALUES(true);
CREATE TABLE omdb_request_days (
 day date PRIMARY KEY,
 consumed integer NOT NULL DEFAULT 0 CHECK(consumed>=0)
);

-- The singleton lock makes budget checks and provider-wide backoff shared by
-- overlapping cron/manual runs. A reservation is charged even if a request fails.
-- Return zero for permission, otherwise milliseconds until the next attempt.
CREATE FUNCTION reserve_omdb_request(p_limit integer,p_now timestamptz DEFAULT now())
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
 v_day date := (p_now AT TIME ZONE 'UTC')::date;
 v_used integer;
 v_pause timestamptz;
BEGIN
 IF p_limit IS NULL OR p_limit<0 OR p_limit>100000 THEN
   RAISE EXCEPTION 'Invalid OMDb daily budget';
 END IF;
 SELECT paused_until INTO v_pause FROM omdb_control WHERE id=true FOR UPDATE;
 IF v_pause>p_now THEN RETURN ceil(extract(epoch FROM v_pause-p_now)*1000)::bigint; END IF;
 INSERT INTO omdb_request_days(day) VALUES(v_day) ON CONFLICT DO NOTHING;
 SELECT consumed INTO v_used FROM omdb_request_days WHERE day=v_day FOR UPDATE;
 IF v_used>=p_limit THEN
   RETURN ceil(extract(epoch FROM ((v_day+1)::timestamp AT TIME ZONE 'UTC')-p_now)*1000)::bigint;
 END IF;
 UPDATE omdb_request_days SET consumed=consumed+1 WHERE day=v_day;
 RETURN 0;
END;
$$;

CREATE FUNCTION claim_omdb(p_token text,p_now timestamptz DEFAULT now())
RETURNS SETOF omdb_enrichments LANGUAGE sql AS $$
 UPDATE omdb_enrichments SET state='running',attempts=least(attempts+1,20),
   lock_token=p_token,lock_until=p_now+interval '1 minute',updated_at=p_now
 WHERE title_id=(
   SELECT e.title_id FROM omdb_enrichments e JOIN titles t ON t.id=e.title_id
   WHERE ((e.state='queued' AND e.run_at<=p_now) OR (e.state='running' AND e.lock_until<=p_now))
     AND t.data->'externalIds'->>'imdb'=e.imdb_id AND t.media_type=e.media_type
     AND NOT EXISTS(SELECT 1 FROM omdb_control WHERE paused_until>p_now)
   ORDER BY e.run_at,e.title_id FOR UPDATE OF e SKIP LOCKED LIMIT 1
 ) RETURNING *;
$$;

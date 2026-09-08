-- Media work is independent of paid catalogue-sync jobs and their pause switch.
CREATE TABLE media_assets (
 id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{24}$'),
 kind text NOT NULL CHECK(kind IN ('poster','backdrop')),
 source_url text NOT NULL,
 profile text NOT NULL,
 filename text NOT NULL CHECK(filename ~ '^[a-z0-9-]{1,120}$'),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','ready','failed','withdrawn')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 run_at timestamptz NOT NULL DEFAULT now(),
 lock_token text,
 lock_until timestamptz,
 heartbeat timestamptz,
 error_code text,
 revision text,
 variants jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(variants)='array'),
 original_pathname text,
 original_hash text,
 original_mime text,
 original_bytes bigint,
 width integer,
 height integer,
 verified_at timestamptz,
 expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(kind,source_url,profile),
 CHECK(expires_at IS NULL OR (verified_at IS NOT NULL AND expires_at<=verified_at+interval '180 days')),
 CHECK(state<>'ready' OR (revision IS NOT NULL AND expires_at IS NOT NULL AND jsonb_array_length(variants)>0))
);
CREATE INDEX media_assets_due ON media_assets(run_at,id) WHERE state IN ('queued','running');
CREATE INDEX media_assets_expiry ON media_assets(expires_at) WHERE state='ready';
CREATE INDEX media_assets_withdrawn ON media_assets(kind,source_url) WHERE state='withdrawn';

-- Keep every published address until its own expiry, including earlier refresh revisions.
CREATE TABLE media_variants (
 public_path text PRIMARY KEY,
 asset_id text NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
 variant jsonb NOT NULL CHECK(jsonb_typeof(variant)='object' AND variant->>'publicPath'=public_path),
 expires_at timestamptz NOT NULL
);
CREATE INDEX media_variants_asset ON media_variants(asset_id);
CREATE INDEX media_variants_expiry ON media_variants(expires_at);

-- One shared reservation window covers cron, pilots and overlapping deployments.
CREATE TABLE media_rate_windows (
 window_start timestamptz PRIMARY KEY,
 claimed integer NOT NULL DEFAULT 0 CHECK(claimed>=0)
);

CREATE TABLE title_media (
 title_id text NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('poster','backdrop')),
 source text NOT NULL,
 profile text NOT NULL,
 asset_id text REFERENCES media_assets(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(title_id,kind)
);
CREATE INDEX title_media_asset ON title_media(asset_id);

CREATE FUNCTION claim_media(p_token text,p_limit integer DEFAULT 60,p_now timestamptz DEFAULT now())
RETURNS SETOF media_assets LANGUAGE plpgsql AS $$
DECLARE
 v_window timestamptz := date_trunc('minute',p_now);
 v_claimed integer;
 v_id text;
BEGIN
 IF p_limit IS NULL OR p_limit<1 OR p_limit>120 THEN
   RAISE EXCEPTION 'Invalid media rate limit';
 END IF;
 INSERT INTO media_rate_windows(window_start) VALUES(v_window) ON CONFLICT DO NOTHING;
 -- The row lock serializes the allowance check and the actual claim in one transaction.
 SELECT claimed INTO v_claimed FROM media_rate_windows WHERE window_start=v_window FOR UPDATE;
 DELETE FROM media_rate_windows WHERE window_start<v_window-interval '2 days';
 IF v_claimed>=p_limit THEN RETURN; END IF;

 UPDATE media_assets SET state='failed',error_code='attempts_exhausted',lock_token=null,lock_until=null,updated_at=p_now
 WHERE state='running' AND attempts>=6 AND lock_until<=p_now;
 SELECT a.id INTO v_id FROM media_assets a
 WHERE ((a.state='queued' AND a.run_at<=p_now) OR (a.state='running' AND a.lock_until<=p_now))
   AND a.attempts<6
   AND EXISTS(SELECT 1 FROM title_media m WHERE m.asset_id=a.id)
   AND NOT EXISTS(SELECT 1 FROM media_assets blocked WHERE blocked.kind=a.kind AND blocked.source_url=a.source_url AND blocked.state='withdrawn')
 ORDER BY a.run_at,a.id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF v_id IS NULL THEN RETURN; END IF;

 UPDATE media_rate_windows SET claimed=claimed+1 WHERE window_start=v_window;
 RETURN QUERY UPDATE media_assets SET state='running',attempts=attempts+1,lock_token=p_token,
   lock_until=p_now+interval '2 minutes',heartbeat=p_now,updated_at=p_now
 WHERE id=v_id RETURNING *;
END;
$$;

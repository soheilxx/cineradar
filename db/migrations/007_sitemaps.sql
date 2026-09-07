CREATE TABLE seo_sitemap_generations (
 id text PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now(),
 manifest jsonb NOT NULL,
 index_xml text NOT NULL,
 total_urls integer NOT NULL CHECK(total_urls>0)
);
CREATE TABLE seo_sitemap_state (
 id integer PRIMARY KEY CHECK(id=1),
 current_generation text REFERENCES seo_sitemap_generations,
 last_success timestamptz,
 last_attempt timestamptz,
 lock_token text,
 locked_until timestamptz,
 last_error text
);
INSERT INTO seo_sitemap_state(id) VALUES(1);
CREATE TABLE seo_sitemap_artifacts (
 name text PRIMARY KEY,
 segment text NOT NULL,
 shard integer NOT NULL,
 hash text NOT NULL,
 xml_gzip_base64 text NOT NULL,
 uncompressed_bytes integer NOT NULL CHECK(uncompressed_bytes BETWEEN 1 AND 20971520),
 url_count integer NOT NULL CHECK(url_count BETWEEN 1 AND 5000),
 lastmod timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE seo_sitemap_generation_artifacts (
 generation text REFERENCES seo_sitemap_generations ON DELETE CASCADE,
 name text REFERENCES seo_sitemap_artifacts,
 PRIMARY KEY(generation,name)
);
CREATE TABLE seo_url_registry (
 url text PRIMARY KEY,
 entity text NOT NULL,
 segment text NOT NULL,
 ordinal bigint NOT NULL CHECK(ordinal>=0),
 locale text NOT NULL,
 market text,
 revision text NOT NULL,
 lastmod timestamptz,
 indexable boolean NOT NULL,
 sitemap_eligible boolean NOT NULL CHECK(NOT sitemap_eligible OR indexable),
 exclusion_reason text,
 alternates jsonb NOT NULL,
 images jsonb NOT NULL,
 generation text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(segment,ordinal)
);
CREATE INDEX seo_registry_entity ON seo_url_registry(entity);

CREATE FUNCTION publish_sitemap_generation(p_token text,p_generation text,p_manifest jsonb,p_xml text,p_urls integer) RETURNS text LANGUAGE plpgsql AS $$
DECLARE current_id text;
BEGIN
 PERFORM 1 FROM seo_sitemap_state WHERE id=1 AND lock_token=p_token AND locked_until>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sitemap lease lost'; END IF;
 IF jsonb_array_length(p_manifest)=0 OR p_urls<1 THEN RAISE EXCEPTION 'Empty sitemap generation'; END IF;
 SELECT g.id INTO current_id FROM seo_sitemap_generations g JOIN seo_sitemap_state s ON s.current_generation=g.id WHERE s.id=1 AND g.index_xml=p_xml AND g.manifest=p_manifest AND g.total_urls=p_urls;
 IF current_id IS NOT NULL THEN
  UPDATE seo_url_registry SET indexable=false,sitemap_eligible=false,exclusion_reason='removed_variant' WHERE generation<>p_generation;
  UPDATE seo_url_registry SET generation=current_id WHERE generation=p_generation;
  UPDATE seo_sitemap_state SET last_success=now(),last_error=null,lock_token=null,locked_until=null WHERE id=1;
  RETURN current_id;
 END IF;
 INSERT INTO seo_sitemap_generations(id,manifest,index_xml,total_urls) VALUES(p_generation,p_manifest,p_xml,p_urls);
 INSERT INTO seo_sitemap_generation_artifacts(generation,name) SELECT p_generation,value->>'name' FROM jsonb_array_elements(p_manifest);
 UPDATE seo_url_registry SET indexable=false,sitemap_eligible=false,exclusion_reason='removed_variant' WHERE generation<>p_generation;
 UPDATE seo_sitemap_state SET current_generation=p_generation,last_success=now(),last_error=null,lock_token=null,locked_until=null WHERE id=1;
 -- Referenced files remain available for at least seven days after their last
 -- publication, so a cached index always resolves during the overlap period.
 DELETE FROM seo_sitemap_generations WHERE id<>p_generation AND created_at<now()-interval '8 days';
 DELETE FROM seo_sitemap_artifacts a WHERE a.created_at<now()-interval '8 days' AND NOT EXISTS(SELECT 1 FROM seo_sitemap_generation_artifacts r WHERE r.name=a.name);
 RETURN p_generation;
END $$;

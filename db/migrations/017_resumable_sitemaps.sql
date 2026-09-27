CREATE TABLE seo_sitemap_builds (
 id text PRIMARY KEY,
 config_hash text NOT NULL,
 origin text NOT NULL,
 markets text[] NOT NULL,
 as_of timestamptz NOT NULL,
 upper_title_id text NOT NULL,
 phase text NOT NULL DEFAULT 'source',
 cursor text NOT NULL DEFAULT '',
 artifact_segment text NOT NULL DEFAULT '',
 artifact_ordinal bigint NOT NULL DEFAULT -1,
 next_ordinals jsonb NOT NULL DEFAULT '{}',
 total_entries integer NOT NULL DEFAULT 0,
 total_urls integer NOT NULL DEFAULT 0,
 registry_changed integer NOT NULL DEFAULT 0,
 registry_unchanged integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE seo_sitemap_state ADD COLUMN building_generation text REFERENCES seo_sitemap_builds;

-- URL documents reuse seo_url_registry, which is never the public sitemap.
-- Compact membership chunks let landing hashes be finalized independently.
CREATE TABLE seo_sitemap_build_landings (
 build_id text REFERENCES seo_sitemap_builds ON DELETE CASCADE,
 url text NOT NULL,
 entity text NOT NULL,
 locale text NOT NULL,
 market text NOT NULL,
 route text NOT NULL,
 tail text NOT NULL,
 PRIMARY KEY(build_id,url)
);
CREATE INDEX seo_build_landing_alternates ON seo_sitemap_build_landings(build_id,entity);
CREATE TABLE seo_sitemap_build_members (
 build_id text NOT NULL,
 url text NOT NULL,
 batch_key text NOT NULL,
 title_ids jsonb NOT NULL,
 PRIMARY KEY(build_id,url,batch_key),
 FOREIGN KEY(build_id,url) REFERENCES seo_sitemap_build_landings(build_id,url) ON DELETE CASCADE
);
CREATE TABLE seo_sitemap_build_artifacts (
 build_id text REFERENCES seo_sitemap_builds ON DELETE CASCADE,
 name text NOT NULL REFERENCES seo_sitemap_artifacts,
 segment text NOT NULL,
 shard integer NOT NULL,
 lastmod timestamptz NOT NULL,
 urls integer NOT NULL,
 bytes integer NOT NULL,
 PRIMARY KEY(build_id,segment,shard)
);
CREATE TABLE seo_sitemap_shard_cache (
 segment text NOT NULL,
 shard integer NOT NULL,
 revision text NOT NULL,
 name text NOT NULL REFERENCES seo_sitemap_artifacts,
 PRIMARY KEY(segment,shard)
);
CREATE INDEX seo_build_artifact_name ON seo_sitemap_build_artifacts(name);
CREATE INDEX seo_shard_cache_name ON seo_sitemap_shard_cache(name);
-- Production may prebuild these concurrently before the migration transaction.
CREATE INDEX IF NOT EXISTS seo_generation_artifact_name ON seo_sitemap_generation_artifacts(name);
CREATE INDEX IF NOT EXISTS seo_registry_build_shards ON seo_url_registry(generation,segment,ordinal) WHERE sitemap_eligible;
ALTER TABLE seo_sitemap_generations ADD COLUMN retired_at timestamptz;
UPDATE seo_sitemap_generations SET retired_at=now()
 WHERE id IS DISTINCT FROM (SELECT current_generation FROM seo_sitemap_state WHERE id=1);

-- The expensive registry work is completed in resumable batches beforehand.
-- The final transaction only verifies counters and atomically switches the index.
CREATE FUNCTION publish_resumable_sitemap(p_token text,p_build text,p_manifest jsonb,p_xml text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE b seo_sitemap_builds; current_id text; previous_id text; artifact_urls bigint; artifact_count bigint;
BEGIN
 SELECT current_generation INTO previous_id FROM seo_sitemap_state
 WHERE id=1 AND lock_token=p_token AND locked_until>now() AND building_generation=p_build FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sitemap lease lost'; END IF;
 SELECT * INTO b FROM seo_sitemap_builds WHERE id=p_build AND phase='publish' FOR UPDATE;
 IF NOT FOUND OR b.total_urls<1 THEN RAISE EXCEPTION 'Incomplete sitemap build'; END IF;
 IF NOT EXISTS(SELECT 1 FROM seo_url_registry WHERE generation=p_build AND sitemap_eligible
   AND (entity LIKE 'movie:%' OR entity LIKE 'tv:%')) THEN RAISE EXCEPTION 'No eligible catalog'; END IF;
 SELECT count(*),COALESCE(sum(urls),0) INTO artifact_count,artifact_urls
 FROM seo_sitemap_build_artifacts WHERE build_id=p_build;
 IF artifact_urls<>b.total_urls OR artifact_count<>jsonb_array_length(p_manifest) OR artifact_count=0 THEN
  RAISE EXCEPTION 'Incomplete sitemap artifacts';
 END IF;
 IF (SELECT count(DISTINCT value->>'name') FROM jsonb_array_elements(p_manifest))<>artifact_count
 OR EXISTS(SELECT 1 FROM jsonb_to_recordset(p_manifest) AS m(name text,lastmod timestamptz,urls integer,bytes integer)
   LEFT JOIN seo_sitemap_build_artifacts a ON a.build_id=p_build AND a.name=m.name
   WHERE a.name IS NULL OR (a.lastmod,a.urls,a.bytes) IS DISTINCT FROM (m.lastmod,m.urls,m.bytes)) THEN
  RAISE EXCEPTION 'Sitemap manifest mismatch';
 END IF;
 SELECT id INTO current_id FROM seo_sitemap_generations
 WHERE id=previous_id AND index_xml=p_xml AND manifest=p_manifest AND total_urls=b.total_urls;
 IF current_id IS NULL THEN
  current_id:=p_build;
  INSERT INTO seo_sitemap_generations(id,manifest,index_xml,total_urls) VALUES(current_id,p_manifest,p_xml,b.total_urls);
  INSERT INTO seo_sitemap_generation_artifacts(generation,name)
    SELECT current_id,name FROM seo_sitemap_build_artifacts WHERE build_id=p_build;
  UPDATE seo_sitemap_generations SET retired_at=now() WHERE id=previous_id AND retired_at IS NULL;
 END IF;
 UPDATE seo_sitemap_state SET current_generation=current_id,building_generation=null,
   last_success=now(),last_error=null,lock_token=null,locked_until=null WHERE id=1;
 UPDATE seo_sitemap_builds SET phase='complete',updated_at=now() WHERE id=p_build;
 -- Completed staging and retired generations are cleaned separately in bounded
 -- batches; publication never cascades through a large registry or old build.
 RETURN current_id;
END $$;

-- Keep catalogue filtering/ranking out of the large provider JSON documents.
-- All projections remain current through generated columns, including imports.
ALTER TABLE titles
  ADD COLUMN catalog_year integer GENERATED ALWAYS AS ((data->>'year')::integer) STORED,
  ADD COLUMN catalog_runtime integer GENERATED ALWAYS AS ((data->>'runtime')::integer) STORED,
  ADD COLUMN catalog_genres jsonb GENERATED ALWAYS AS (data->'genres') STORED,
  ADD COLUMN catalog_votes numeric GENERATED ALWAYS AS (greatest(COALESCE((data->>'votes')::numeric,0),0)) STORED,
  ADD COLUMN catalog_score numeric GENERATED ALWAYS AS (
    COALESCE((data->>'rating')::numeric,0)*COALESCE((data->>'votes')::numeric,0)/(COALESCE((data->>'votes')::numeric,0)+500)
  ) STORED,
  ADD COLUMN catalog_popularity numeric GENERATED ALWAYS AS (greatest(COALESCE((data->>'popularity')::numeric,0),0)) STORED,
  ADD COLUMN catalog_popularity_updated text GENERATED ALWAYS AS (data->>'popularityUpdatedAt') STORED;

-- Cover broad catalogue reads without fetching/decompressing title JSON.
CREATE INDEX title_catalog_browse ON titles(media_type,id)
  INCLUDE(catalog_year,catalog_runtime,catalog_genres,catalog_votes,catalog_score,catalog_popularity,catalog_popularity_updated);
CREATE INDEX title_catalog_genres ON titles USING gin(catalog_genres);

CREATE FUNCTION catalog_search_name(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT trim(regexp_replace(public.unaccent('public.unaccent'::regdictionary,lower(value)),'[^[:alnum:]]+',' ','g'))
$$;

-- Candidate selection must use exactly the normalization used for relevance.
-- Both translations and original titles participate, regardless of UI locale.
CREATE INDEX localization_catalog_name_trigrams ON localizations
  USING gin(catalog_search_name(title) gin_trgm_ops);
CREATE INDEX localization_catalog_name_words ON localizations
  USING gin(to_tsvector('simple'::regconfig,catalog_search_name(title)));
CREATE INDEX title_catalog_original_trigrams ON titles
  USING gin(catalog_search_name(data->>'originalTitle') gin_trgm_ops);
CREATE INDEX title_catalog_original_words ON titles
  USING gin(to_tsvector('simple'::regconfig,catalog_search_name(data->>'originalTitle')));

ANALYZE titles;
ANALYZE localizations;

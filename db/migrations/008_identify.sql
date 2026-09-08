-- Separate description-search indexes; existing title search stays unchanged.
-- The qualified extension dictionary is fixed for this index definition.
CREATE FUNCTION identify_normalize(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, lower(value))
$$;
CREATE FUNCTION identify_language(locale text) RETURNS regconfig
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE locale WHEN 'de' THEN 'german'::regconfig
    WHEN 'fr' THEN 'french'::regconfig WHEN 'it' THEN 'italian'::regconfig
    WHEN 'es' THEN 'spanish'::regconfig ELSE 'english'::regconfig END
$$;

ALTER TABLE localizations ADD COLUMN identify_document tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector(identify_language(locale), identify_normalize(title)), 'A') ||
  setweight(to_tsvector(identify_language(locale), identify_normalize(overview)), 'B')
) STORED;
CREATE INDEX localization_identify_search ON localizations USING gin(identify_document);
ALTER TABLE titles ADD COLUMN identify_people tsvector GENERATED ALWAYS AS (
  to_tsvector('simple'::regconfig, identify_normalize(coalesce(data->'cast', '[]'::jsonb)::text))
) STORED;
CREATE INDEX title_identify_people ON titles USING gin(identify_people);

-- The existing reserve_budget advisory lock atomically protects both periods.
-- The dedicated service 'openai-identify' counts text and voice call attempts.

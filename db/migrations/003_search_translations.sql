CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE INDEX localization_trigrams ON localizations USING gin(lower(title) gin_trgm_ops);
CREATE TABLE translations (title_id text REFERENCES titles ON DELETE CASCADE, locale text NOT NULL, source_hash text NOT NULL, content text NOT NULL, at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(title_id,locale,source_hash));
ALTER TABLE snapshots ADD COLUMN changed_at timestamptz NOT NULL DEFAULT now();
CREATE FUNCTION mark_offer_content_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN UPDATE snapshots SET changed_at=now() WHERE title_id=OLD.title_id AND market=OLD.market;
 ELSIF TG_OP='INSERT' OR (NEW.data-'observedAt')<>(OLD.data-'observedAt') THEN UPDATE snapshots SET changed_at=now() WHERE title_id=NEW.title_id AND market=NEW.market;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER offer_content_changed AFTER INSERT OR UPDATE OR DELETE ON offers FOR EACH ROW EXECUTE FUNCTION mark_offer_content_changed();

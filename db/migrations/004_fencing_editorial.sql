-- A reclaimed job must not let its former worker overwrite a newer snapshot.
CREATE FUNCTION assert_job_lease(p_id bigint,p_token text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM jobs WHERE id=p_id AND lock_token=p_token AND state='running' AND lock_until>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lost job lease'; END IF;
END $$;
CREATE FUNCTION save_job_title(p_data jsonb,p_job bigint,p_token text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM assert_job_lease(p_job,p_token);
 PERFORM save_title(p_data);
END $$;
CREATE FUNCTION reconcile_job_offers(p_title text,p_market text,p_offers jsonb,p_run text,p_supported boolean,p_job bigint,p_token text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
 PERFORM assert_job_lease(p_job,p_token);
 RETURN reconcile_offers(p_title,p_market,p_offers,p_run,true,p_supported);
END $$;
-- Preserve editorial content in the denormalized document used by server pages.
CREATE FUNCTION preserve_editorial_document() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l record;
BEGIN
 FOR l IN SELECT * FROM localizations WHERE title_id=NEW.id AND source='editorial' LOOP
  NEW.data:=jsonb_set(NEW.data,ARRAY['localizations',l.locale,'overview'],to_jsonb(l.overview));
  NEW.data:=jsonb_set(NEW.data,ARRAY['localizations',l.locale,'source'],'"editorial"'::jsonb);
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER title_editorial BEFORE UPDATE ON titles FOR EACH ROW EXECUTE FUNCTION preserve_editorial_document();

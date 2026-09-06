CREATE FUNCTION reserve_budget(p_service text,p_units int,p_daily bigint,p_monthly bigint,p_now timestamptz DEFAULT now()) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE d text := to_char(p_now AT TIME ZONE 'UTC','YYYY-MM-DD'); m text := to_char(p_now AT TIME ZONE 'UTC','YYYY-MM'); used_d bigint; used_m bigint;
BEGIN
 IF p_units<1 THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('budget:'||p_service));
 INSERT INTO budgets(service,period) VALUES(p_service,d),(p_service,m) ON CONFLICT DO NOTHING;
 SELECT consumed INTO used_d FROM budgets WHERE service=p_service AND period=d;
 SELECT consumed INTO used_m FROM budgets WHERE service=p_service AND period=m;
 IF used_d+p_units>p_daily OR used_m+p_units>p_monthly THEN RETURN false; END IF;
 UPDATE budgets SET consumed=consumed+p_units WHERE service=p_service AND period IN(d,m);
 INSERT INTO budget_reservations(service,units,at) VALUES(p_service,p_units,p_now);
 RETURN true;
END $$;
CREATE FUNCTION claim_job(p_token text,p_now timestamptz DEFAULT now()) RETURNS SETOF jobs LANGUAGE sql AS $$
 UPDATE jobs SET state='running',attempts=attempts+1,lock_until=p_now+interval '2 minutes',lock_token=p_token,heartbeat=p_now WHERE id=(SELECT id FROM jobs WHERE ((state='queued' AND run_at<=p_now) OR (state='running' AND lock_until<p_now)) AND attempts<6 ORDER BY run_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *;
$$;
CREATE FUNCTION rate_limit(p_key text,p_limit int,p_seconds int) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
 INSERT INTO rate_limits(key,count,expires_at) VALUES(p_key,1,now()+make_interval(secs=>p_seconds)) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+make_interval(secs=>p_seconds) ELSE rate_limits.expires_at END RETURNING count INTO n;
 RETURN n<=p_limit;
END $$;
CREATE FUNCTION save_title(p_data jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE l jsonb; s jsonb;
BEGIN
 INSERT INTO titles(id,media_type,tmdb_id,data,revision) VALUES(p_data->>'id',p_data->>'type',(p_data->>'tmdbId')::bigint,p_data,p_data->>'revision') ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,revision=EXCLUDED.revision,updated_at=CASE WHEN titles.revision<>EXCLUDED.revision THEN now() ELSE titles.updated_at END;
 FOR l IN SELECT value FROM jsonb_each(p_data->'localizations') LOOP
 INSERT INTO slug_history SELECT title_id,locale,slug FROM localizations WHERE title_id=p_data->>'id' AND locale=l->>'locale' AND slug<>l->>'slug' ON CONFLICT DO NOTHING;
 INSERT INTO localizations(title_id,locale,title,overview,slug,source,source_hash) VALUES(p_data->>'id',l->>'locale',l->>'title',l->>'overview',l->>'slug',l->>'source',l->>'sourceHash') ON CONFLICT(title_id,locale) DO UPDATE SET title=EXCLUDED.title,overview=CASE WHEN localizations.source='editorial' THEN localizations.overview ELSE EXCLUDED.overview END,slug=EXCLUDED.slug,source=CASE WHEN localizations.source='editorial' THEN localizations.source ELSE EXCLUDED.source END,source_hash=EXCLUDED.source_hash;
 END LOOP;
 FOR s IN SELECT value FROM jsonb_array_elements(p_data->'seasons') LOOP
 INSERT INTO seasons VALUES(p_data->>'id',(s->>'number')::int,s) ON CONFLICT(title_id,number) DO UPDATE SET data=EXCLUDED.data;
 END LOOP;
END $$;
CREATE FUNCTION reconcile_offers(p_title text,p_market text,p_offers jsonb,p_run text,p_complete boolean,p_supported boolean DEFAULT true) RETURNS text LANGUAGE plpgsql AS $$
DECLARE o jsonb; old_count int; new_count int; rev bigint;
BEGIN
 IF NOT p_complete THEN RAISE EXCEPTION 'Incomplete snapshot'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_title||':'||p_market));
 IF EXISTS(SELECT 1 FROM sync_runs WHERE id=p_run AND completed) THEN RETURN 'duplicate'; END IF;
 SELECT count(*) INTO old_count FROM offers WHERE title_id=p_title AND market=p_market;
 new_count:=jsonb_array_length(p_offers);
 IF old_count>=10 AND new_count<old_count*.3 THEN INSERT INTO quarantines(scope,reason,data) VALUES(p_title||':'||p_market,'suspicious_drop',p_offers); RETURN 'quarantined'; END IF;
 INSERT INTO markets(code,supported) VALUES(p_market,p_supported) ON CONFLICT DO NOTHING;
 INSERT INTO snapshots(title_id,market,availability) VALUES(p_title,p_market,'unchecked') ON CONFLICT DO NOTHING;
 SELECT revision+1 INTO rev FROM snapshots WHERE title_id=p_title AND market=p_market;
 INSERT INTO changes(id,title_id,market,kind,provider) SELECT md5(p_run||o.id||'removed'),p_title,p_market,'removed',o.data->'provider'->>'name' FROM offers o WHERE title_id=p_title AND market=p_market AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_offers) n WHERE n->>'id'=o.id) ON CONFLICT DO NOTHING;
 FOR o IN SELECT value FROM jsonb_array_elements(p_offers) LOOP
 INSERT INTO providers(market,id,data) VALUES(p_market,o->'provider'->>'id',o->'provider') ON CONFLICT(market,id) DO NOTHING;
 INSERT INTO changes(id,title_id,market,kind,provider) SELECT md5(p_run||(o->>'id')||'added'),p_title,p_market,'added',o->'provider'->>'name' WHERE NOT EXISTS(SELECT 1 FROM offers WHERE id=o->>'id') ON CONFLICT DO NOTHING;
 INSERT INTO changes(id,title_id,market,kind,provider) SELECT md5(p_run||(o->>'id')||'updated'),p_title,p_market,'updated',o->'provider'->>'name' WHERE EXISTS(SELECT 1 FROM offers WHERE id=o->>'id' AND (data-'observedAt')<>(o-'observedAt')) ON CONFLICT DO NOTHING;
 INSERT INTO offers(id,title_id,market,provider_id,data,expires_at) VALUES(o->>'id',p_title,p_market,o->'provider'->>'id',o,(o->>'expiresOn')::timestamptz) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,expires_at=EXCLUDED.expires_at;
 END LOOP;
 DELETE FROM offers WHERE title_id=p_title AND market=p_market AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_offers) n WHERE n->>'id'=offers.id);
 UPDATE snapshots SET availability=CASE WHEN NOT p_supported THEN 'unsupported' WHEN new_count=0 THEN 'empty' ELSE 'available' END,checked_at=now(),attempt_at=now(),error_code=null,revision=rev WHERE title_id=p_title AND market=p_market;
 INSERT INTO sync_runs(id,scope,completed,completed_at) VALUES(p_run,p_title||':'||p_market,true,now()) ON CONFLICT(id) DO UPDATE SET completed=true,completed_at=now();
 RETURN 'committed';
END $$;

ALTER TABLE jobs ADD COLUMN priority integer NOT NULL DEFAULT 0 CHECK(priority BETWEEN 0 AND 100);
CREATE INDEX jobs_priority_due ON jobs(priority DESC,run_at,id) WHERE state IN ('queued','running');
CREATE OR REPLACE FUNCTION claim_job(p_token text,p_now timestamptz DEFAULT now()) RETURNS SETOF jobs LANGUAGE sql AS $$
 UPDATE jobs SET state='running',attempts=attempts+1,lock_until=p_now+interval '2 minutes',lock_token=p_token,heartbeat=p_now
 WHERE id=(SELECT id FROM jobs WHERE ((state='queued' AND run_at<=p_now) OR (state='running' AND lock_until<p_now)) AND attempts<6
 ORDER BY priority DESC,run_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *;
$$;
CREATE FUNCTION claim_search_job(p_key text,p_token text,p_now timestamptz DEFAULT now()) RETURNS SETOF jobs LANGUAGE sql AS $$
 UPDATE jobs SET state='running',attempts=attempts+1,lock_until=p_now+interval '2 minutes',lock_token=p_token,heartbeat=p_now
 WHERE id=(SELECT id FROM jobs WHERE ((state='queued' AND run_at<=p_now) OR (state='running' AND lock_until<p_now)) AND attempts<6
 AND EXISTS (SELECT 1 FROM jobs root WHERE root.key=p_key AND root.kind='search')
 AND (key=p_key OR key IN (SELECT jsonb_array_elements_text(COALESCE(payload->'imports','[]'::jsonb)) FROM jobs WHERE key=p_key AND kind='search'))
 ORDER BY priority DESC,run_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *;
$$;

import type { Database } from '../data/db';

const BATCH_SIZE = 1000;
// Never compete with an active export or its final pointer switch. Each SQL
// statement holds this row only for its own bounded batch; it never waits.
const guard = `SELECT current_generation,building_generation FROM seo_sitemap_state
  WHERE id=1 AND building_generation IS NULL
    AND (locked_until IS NULL OR locked_until<now()) FOR UPDATE SKIP LOCKED`;

type CleanupKind = 'builds' | 'generations';

async function beginCleanup(database: Database, kind: CleanupKind) {
  const builds = kind === 'builds';
  const table = builds ? 'seo_sitemap_builds' : 'seo_sitemap_generations';
  const eligible = builds
    ? "b.phase IN('complete','abandoned') AND b.updated_at<now()-interval '1 day'"
    : "b.retired_at<now()-interval '8 days'";
  const protectedField = builds ? 'building_generation' : 'current_generation';
  const key = `sitemap:cleanup:${kind}`;
  const childBatch = builds
    ? `SELECT m.build_id,m.url,m.batch_key FROM seo_sitemap_build_members m
        WHERE m.build_id=(SELECT id FROM picked) ORDER BY m.url,m.batch_key LIMIT $2 FOR UPDATE SKIP LOCKED`
    : `SELECT r.generation,r.name FROM seo_sitemap_generation_artifacts r
        WHERE r.generation=(SELECT id FROM picked) ORDER BY r.name LIMIT $2 FOR UPDATE SKIP LOCKED`;
  const removeChildren = builds
    ? `DELETE FROM seo_sitemap_build_members m USING child_batch c
        WHERE (m.build_id,m.url,m.batch_key)=(c.build_id,c.url,c.batch_key) RETURNING 1`
    : `DELETE FROM seo_sitemap_generation_artifacts r USING child_batch c
        WHERE (r.generation,r.name)=(c.generation,c.name) RETURNING 1`;
  const result = await database.query<{ id: string }>(
    `WITH guard AS MATERIALIZED (${guard}),
    checkpoint AS MATERIALIZED (SELECT data FROM operations WHERE key=$1),
    pending AS MATERIALIZED (
      SELECT b.id FROM ${table} b WHERE b.id=(SELECT data->>'target' FROM checkpoint)
        AND ${eligible} AND b.id IS DISTINCT FROM (SELECT ${protectedField} FROM guard)
        AND EXISTS(SELECT 1 FROM guard)
    ), batch AS MATERIALIZED (
      SELECT b.id,${builds ? 'b.phase,b.updated_at' : 'b.retired_at'} FROM ${table} b
      WHERE b.id>COALESCE((SELECT data->>'after' FROM checkpoint),'')
        AND NOT EXISTS(SELECT 1 FROM pending) AND EXISTS(SELECT 1 FROM guard)
      ORDER BY b.id LIMIT $2
    ), picked AS MATERIALIZED (
      SELECT id FROM pending UNION ALL
      (SELECT b.id FROM batch b WHERE ${eligible}
        AND b.id IS DISTINCT FROM (SELECT ${protectedField} FROM guard)
        ORDER BY b.id LIMIT 1)
    ), child_batch AS MATERIALIZED (${childBatch}), removed AS (${removeChildren}),
    progress AS (
      INSERT INTO operations(key,data) SELECT $1,jsonb_build_object(
        'after',CASE WHEN EXISTS(SELECT 1 FROM picked)
          THEN COALESCE((SELECT data->>'after' FROM checkpoint),'')
          ELSE COALESCE((SELECT max(id) FROM batch),'') END,
        'target',COALESCE((SELECT id FROM picked),'')) WHERE EXISTS(SELECT 1 FROM guard)
      ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data,updated_at=now() RETURNING key
    ) SELECT id FROM picked WHERE EXISTS(SELECT 1 FROM progress)`,
    [key, BATCH_SIZE],
  );
  return result.rows[0]?.id;
}

async function cleanBuild(database: Database, id: string) {
  // The first batch of membership chunks was removed by beginCleanup. Limit
  // parent candidates before checking children, so a blocked landing cannot
  // turn this operation into a scan through all landing/member documents.
  await database.query(
    `WITH guard AS MATERIALIZED (${guard}), batch AS MATERIALIZED (
      SELECT l.build_id,l.url FROM seo_sitemap_build_landings l
      WHERE l.build_id=$1 AND EXISTS(SELECT 1 FROM guard)
      ORDER BY l.url LIMIT $2 FOR UPDATE SKIP LOCKED
    ) DELETE FROM seo_sitemap_build_landings l USING batch b
      WHERE (l.build_id,l.url)=(b.build_id,b.url)
        AND NOT EXISTS(SELECT 1 FROM seo_sitemap_build_members m WHERE m.build_id=l.build_id AND m.url=l.url)`,
    [id, BATCH_SIZE],
  );
  await database.query(
    `WITH guard AS MATERIALIZED (${guard}), batch AS MATERIALIZED (
      SELECT a.build_id,a.segment,a.shard FROM seo_sitemap_build_artifacts a
      WHERE a.build_id=$1 AND EXISTS(SELECT 1 FROM guard)
      ORDER BY a.segment,a.shard LIMIT $2 FOR UPDATE SKIP LOCKED
    ) DELETE FROM seo_sitemap_build_artifacts a USING batch b
      WHERE (a.build_id,a.segment,a.shard)=(b.build_id,b.segment,b.shard)`,
    [id, BATCH_SIZE],
  );
  await finishCleanup(database, 'builds', id);
}

async function finishCleanup(
  database: Database,
  kind: CleanupKind,
  id: string,
) {
  const builds = kind === 'builds';
  const table = builds ? 'seo_sitemap_builds' : 'seo_sitemap_generations';
  const protectedField = builds ? 'building_generation' : 'current_generation';
  const noChildren = builds
    ? `NOT EXISTS(SELECT 1 FROM seo_sitemap_build_members m WHERE m.build_id=b.id)
       AND NOT EXISTS(SELECT 1 FROM seo_sitemap_build_landings l WHERE l.build_id=b.id)
       AND NOT EXISTS(SELECT 1 FROM seo_sitemap_build_artifacts a WHERE a.build_id=b.id)
       AND b.phase IN('complete','abandoned') AND b.updated_at<now()-interval '1 day'`
    : `NOT EXISTS(SELECT 1 FROM seo_sitemap_generation_artifacts r WHERE r.generation=b.id)
       AND b.retired_at<now()-interval '8 days'`;
  // All child rows must already be gone: FK cascades therefore have no work.
  await database.query(
    `WITH guard AS MATERIALIZED (${guard}), removed AS (
      DELETE FROM ${table} b WHERE b.id=$1 AND ${noChildren}
        AND b.id IS DISTINCT FROM (SELECT ${protectedField} FROM guard)
        AND EXISTS(SELECT 1 FROM guard) RETURNING id
    ) UPDATE operations SET data=jsonb_build_object('after',$1::text,'target',''),updated_at=now()
      WHERE key=$2 AND EXISTS(SELECT 1 FROM removed)`,
    [id, `sitemap:cleanup:${kind}`],
  );
}

async function cleanArtifacts(database: Database) {
  await database.query(
    `WITH guard AS MATERIALIZED (${guard}), checkpoint AS MATERIALIZED (
      SELECT data->>'after' AS cursor FROM operations WHERE key=$1
    ), batch AS MATERIALIZED (
      SELECT a.name,a.created_at FROM seo_sitemap_artifacts a
      WHERE a.name>COALESCE((SELECT cursor FROM checkpoint),'') AND EXISTS(SELECT 1 FROM guard)
      ORDER BY a.name LIMIT $2 FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM seo_sitemap_artifacts a USING batch b WHERE a.name=b.name
        AND b.created_at<now()-interval '8 days'
        AND NOT EXISTS(SELECT 1 FROM seo_sitemap_generation_artifacts r WHERE r.name=a.name)
        AND NOT EXISTS(SELECT 1 FROM seo_sitemap_build_artifacts r WHERE r.name=a.name)
        AND NOT EXISTS(SELECT 1 FROM seo_sitemap_shard_cache r WHERE r.name=a.name)
      RETURNING a.name
    ) INSERT INTO operations(key,data)
      SELECT $1,jsonb_build_object('after',COALESCE((SELECT max(name) FROM batch),''))
      WHERE EXISTS(SELECT 1 FROM guard)
      ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,
    ['sitemap:cleanup:artifacts', BATCH_SIZE],
  );
}

/** At most seven short statements; every row-deletion batch is <= 1,000.
 * Progress is durable across cron invocations and never touches URL documents.
 */
export async function cleanupSitemapStorage(database: Database): Promise<void> {
  const build = await beginCleanup(database, 'builds');
  if (build) await cleanBuild(database, build);
  const generation = await beginCleanup(database, 'generations');
  if (generation) await finishCleanup(database, 'generations', generation);
  await cleanArtifacts(database);
}

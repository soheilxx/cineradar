import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from '../data/db';
import { cleanupSitemapStorage } from '../seo/sitemap-cleanup';

async function setup() {
  const database = new PGlite();
  await database.exec(
    `CREATE TABLE operations(key text PRIMARY KEY,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());`,
  );
  for (const migration of ['007_sitemaps.sql', '017_resumable_sitemaps.sql'])
    await database.exec(await readFile('db/migrations/' + migration, 'utf8'));
  let queries = 0;
  const adapter: Database = {
    async query<T>(sql: string, params?: unknown[]) {
      queries++;
      return { rows: (await database.query<T>(sql, params)).rows };
    },
  };
  async function run() {
    queries = 0;
    await cleanupSitemapStorage(adapter);
    assert.ok(
      queries <= 7,
      'one cleanup invocation stays within seven statements',
    );
  }
  async function count(table: string, where = 'true') {
    return (
      await database.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ${table} WHERE ${where}`,
      )
    ).rows[0].n;
  }
  async function build(id: string, phase = 'complete', age = '2 days') {
    await database.query(
      `INSERT INTO seo_sitemap_builds(id,config_hash,origin,markets,as_of,upper_title_id,phase,updated_at)
      VALUES($1,'test','https://cineradar.test',ARRAY['de'],now(),'tv:999',$2,now()-$3::interval)`,
      [id, phase, age],
    );
  }
  async function generation(id: string, age = '9 days') {
    await database.query(
      `INSERT INTO seo_sitemap_generations(id,manifest,index_xml,total_urls,retired_at)
      VALUES($1,'[]','<index/>',1,now()-$2::interval)`,
      [id, age],
    );
  }
  async function artifact(name: string, age = '9 days') {
    await database.query(
      `INSERT INTO seo_sitemap_artifacts(name,segment,shard,hash,xml_gzip_base64,uncompressed_bytes,url_count,lastmod,created_at)
      VALUES($1,'de-movies',1,'hash','AA==',1,1,now(),now()-$2::interval)`,
      [name, age],
    );
  }
  return { database, run, count, build, generation, artifact };
}

test('large retired generations and completed builds drain in bounded batches before their parents', async () => {
  const { database, run, count, build, generation, artifact } = await setup();
  try {
    await build('old-build');
    await generation('old-generation');
    await artifact('build-file');
    await database.exec(`INSERT INTO seo_sitemap_build_landings(build_id,url,entity,locale,market,route,tail)
      VALUES('old-build','/big','catalog','de','de','movies',''),('old-build','/empty','catalog','de','de','movies','');
      INSERT INTO seo_sitemap_build_members SELECT 'old-build','/big',lpad(n::text,4,'0'),'[]'::jsonb FROM generate_series(1,1500) AS n;
      INSERT INTO seo_sitemap_build_artifacts SELECT 'old-build','build-file','movies',n,now(),1,1 FROM generate_series(1,1505) AS n;
      INSERT INTO seo_sitemap_artifacts
        SELECT 'generation-'||lpad(n::text,4,'0'),'movies',n,'hash','AA==',1,1,now(),now()-interval '9 days' FROM generate_series(1,1500) AS n;
      INSERT INTO seo_sitemap_generation_artifacts SELECT 'old-generation',name FROM seo_sitemap_artifacts WHERE name LIKE 'generation-%';`);

    await run();
    assert.equal(await count('seo_sitemap_build_members'), 500);
    assert.equal(
      await count('seo_sitemap_build_landings'),
      1,
      'the landing containing remaining members is preserved',
    );
    assert.equal(await count('seo_sitemap_build_artifacts'), 505);
    assert.equal(await count('seo_sitemap_generation_artifacts'), 500);
    assert.equal(
      await count('seo_sitemap_builds'),
      1,
      'no parent cascade removes the remaining child rows',
    );
    assert.equal(await count('seo_sitemap_generations'), 1);

    await run();
    for (const table of [
      'seo_sitemap_build_members',
      'seo_sitemap_build_landings',
      'seo_sitemap_build_artifacts',
      'seo_sitemap_generation_artifacts',
      'seo_sitemap_builds',
      'seo_sitemap_generations',
    ])
      assert.equal(await count(table), 0, table);
    for (let pass = 0; pass < 3; pass++) await run();
    assert.equal(
      await count('seo_sitemap_artifacts'),
      0,
      'orphaned artifacts are eventually reclaimed',
    );
  } finally {
    await database.close();
  }
});

test('retention, current pointers and every artifact reference protect public and in-progress data', async () => {
  const { database, run, count, build, generation, artifact } = await setup();
  try {
    await build('a-abandoned', 'abandoned');
    await build('b-current', 'source');
    await build('c-young', 'complete', '12 hours');
    await build('d-incomplete', 'source');
    await generation('a-current');
    await generation('b-recent', '7 days');
    for (const name of ['build-ref', 'cache-ref', 'generation-ref', 'orphan'])
      await artifact(name);
    await artifact('young', '7 days');
    await database.exec(`UPDATE seo_sitemap_state SET building_generation='b-current',current_generation='a-current';
      INSERT INTO seo_sitemap_build_artifacts VALUES('b-current','build-ref','movies',1,now(),1,1);
      INSERT INTO seo_sitemap_generation_artifacts VALUES('a-current','generation-ref');
      INSERT INTO seo_sitemap_shard_cache VALUES('movies',1,'revision','cache-ref');`);

    await run();
    assert.equal(
      await count('seo_sitemap_builds'),
      4,
      'a pending resumable build suspends all cleanup, even between leases',
    );
    assert.equal(await count('operations'), 0);
    await database.exec(
      'UPDATE seo_sitemap_state SET building_generation=null',
    );
    for (let pass = 0; pass < 4; pass++) await run();
    assert.equal(await count('seo_sitemap_builds', "id='a-abandoned'"), 0);
    assert.equal(await count('seo_sitemap_builds'), 3);
    assert.equal(await count('seo_sitemap_generations'), 2);
    assert.equal(await count('seo_sitemap_artifacts', "name='orphan'"), 0);
    assert.equal(await count('seo_sitemap_artifacts'), 4);
    assert.equal(await count('seo_sitemap_build_artifacts'), 1);
    assert.equal(await count('seo_sitemap_generation_artifacts'), 1);
    assert.equal(await count('seo_sitemap_shard_cache'), 1);
  } finally {
    await database.close();
  }
});

test('durable cursors reach old rows beyond a full batch of protected recent rows', async () => {
  const { database, run, count, build, generation, artifact } = await setup();
  try {
    await database.exec(`INSERT INTO seo_sitemap_builds(id,config_hash,origin,markets,as_of,upper_title_id,phase)
      SELECT 'a-'||lpad(n::text,4,'0'),'test','https://cineradar.test',ARRAY['de'],now(),'tv:999','complete' FROM generate_series(1,1000) AS n;
      INSERT INTO seo_sitemap_generations(id,manifest,index_xml,total_urls,retired_at)
        SELECT 'a-'||lpad(n::text,4,'0'),'[]'::jsonb,'<index/>',1,now() FROM generate_series(1,1000) AS n;
      INSERT INTO seo_sitemap_artifacts
        SELECT 'a-'||lpad(n::text,4,'0'),'movies',n,'hash','AA==',1,1,now(),now() FROM generate_series(1,1000) AS n;`);
    await build('z-old');
    await generation('z-old');
    await artifact('z-old');
    await run();
    for (const table of [
      'seo_sitemap_builds',
      'seo_sitemap_generations',
      'seo_sitemap_artifacts',
    ])
      assert.equal(await count(table), 1001);
    await run();
    for (const table of [
      'seo_sitemap_builds',
      'seo_sitemap_generations',
      'seo_sitemap_artifacts',
    ])
      assert.equal(await count(table), 1000, table);
  } finally {
    await database.close();
  }
});

test('an active export lease prevents cleanup and cursor writes', async () => {
  const { database, run, count, build, generation, artifact } = await setup();
  try {
    await build('old-build');
    await generation('old-generation');
    await artifact('old-artifact');
    await database.exec(
      "UPDATE seo_sitemap_state SET lock_token='worker',locked_until=now()+interval '10 minutes'",
    );
    await run();
    assert.equal(await count('seo_sitemap_builds'), 1);
    assert.equal(await count('seo_sitemap_generations'), 1);
    assert.equal(await count('seo_sitemap_artifacts'), 1);
    assert.equal(await count('operations'), 0);
    await database.exec(
      "UPDATE seo_sitemap_state SET locked_until=now()-interval '1 second'",
    );
    await run();
    assert.equal(await count('seo_sitemap_builds'), 0);
    assert.equal(await count('seo_sitemap_generations'), 0);
    assert.equal(await count('seo_sitemap_artifacts'), 0);
  } finally {
    await database.close();
  }
});

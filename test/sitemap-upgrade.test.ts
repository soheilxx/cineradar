import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('resumable publication upgrades an existing generation without restamping the registry or retiring old files prematurely', async () => {
  const database = new PGlite();
  const firstManifest = [
    {
      name: 'original',
      lastmod: '2026-09-01T00:00:00.000Z',
      urls: 1,
      bytes: 5,
    },
  ];
  try {
    await database.exec(
      await readFile('db/migrations/007_sitemaps.sql', 'utf8'),
    );
    await database.exec(`
      INSERT INTO seo_sitemap_artifacts(name,segment,shard,hash,xml_gzip_base64,uncompressed_bytes,url_count,lastmod)
      VALUES('original','movies-de-de',1,'first-hash','data',5,1,'2026-09-01T00:00:00Z');
      UPDATE seo_sitemap_state SET lock_token='legacy',locked_until=now()+interval '10 minutes';
    `);
    await database.query('SELECT publish_sitemap_generation($1,$2,$3,$4,$5)', [
      'legacy',
      'legacy-generation',
      JSON.stringify(firstManifest),
      '<original/>',
      1,
    ]);
    await database.query(
      "UPDATE seo_sitemap_generations SET created_at=now()-interval '14 days'",
    );
    await database.exec(
      await readFile('db/migrations/017_resumable_sitemaps.sql', 'utf8'),
    );

    async function prepare(build: string, artifact: string) {
      await database.query(
        `INSERT INTO seo_sitemap_builds(id,config_hash,origin,markets,as_of,upper_title_id,phase,total_entries,total_urls)
        VALUES($1,'config','https://cineradar.tv',ARRAY['de'],now(),'movie:1','publish',1,1)`,
        [build],
      );
      await database.query(
        `INSERT INTO seo_sitemap_build_artifacts(build_id,name,segment,shard,lastmod,urls,bytes)
        SELECT $1,name,segment,shard,lastmod,url_count,uncompressed_bytes FROM seo_sitemap_artifacts WHERE name=$2`,
        [build, artifact],
      );
      await database.query(
        `UPDATE seo_sitemap_state SET building_generation=$1,lock_token=$1,locked_until=now()+interval '10 minutes'`,
        [build],
      );
      await database.query('UPDATE seo_url_registry SET generation=$1', [build]);
    }
    async function publish(build: string, manifest: unknown, xml: string) {
      return database.query<{ generation: string }>(
        'SELECT publish_resumable_sitemap($1,$1,$2,$3) generation',
        [build, JSON.stringify(manifest), xml],
      );
    }
    async function current() {
      return (
        await database.query<{ current_generation: string }>(
          'SELECT current_generation FROM seo_sitemap_state',
        )
      ).rows[0].current_generation;
    }

    await prepare('unchanged-build', 'original');
    await database.query(`INSERT INTO seo_url_registry(url,entity,segment,ordinal,locale,market,revision,lastmod,indexable,sitemap_eligible,alternates,images,generation)
      VALUES('https://cineradar.tv/de/de/film/example-1/','movie:1','movies-de-de',0,'de','de','revision',now(),true,true,'{}','[]','unchanged-build')`);
    assert.equal(
      (await publish('unchanged-build', firstManifest, '<original/>')).rows[0]
        .generation,
      'legacy-generation',
    );
    assert.equal(await current(), 'legacy-generation');
    assert.equal(
      (
        await database.query<{ generation: string }>(
          'SELECT generation FROM seo_url_registry',
        )
      ).rows[0].generation,
      'unchanged-build',
    );
    assert.equal(
      (
        await database.query<{ retired_at: unknown }>(
          "SELECT retired_at FROM seo_sitemap_generations WHERE id='legacy-generation'",
        )
      ).rows[0].retired_at,
      null,
    );

    const secondModified = new Date().toISOString();
    await database.query(`INSERT INTO seo_sitemap_artifacts(name,segment,shard,hash,xml_gzip_base64,uncompressed_bytes,url_count,lastmod)
      VALUES('replacement','movies-de-de',1,'second-hash','data',5,1,$1)`, [secondModified]);
    await prepare('changed-build', 'replacement');
    const secondManifest = [
      {
        name: 'replacement',
        lastmod: secondModified,
        urls: 1,
        bytes: 5,
      },
    ];
    await assert.rejects(
      publish('changed-build', firstManifest, '<wrong-file/>'),
    );
    assert.equal(await current(), 'legacy-generation');
    await database.query(
      "UPDATE seo_sitemap_builds SET total_urls=2 WHERE id='changed-build'",
    );
    await assert.rejects(
      publish('changed-build', secondManifest, '<replacement/>'),
    );
    assert.equal(await current(), 'legacy-generation');
    await database.query(
      "UPDATE seo_sitemap_builds SET total_urls=1 WHERE id='changed-build'",
    );
    await database.query("UPDATE seo_sitemap_state SET lock_token='new-owner'");
    await assert.rejects(
      publish('changed-build', secondManifest, '<replacement/>'),
    );
    assert.equal(await current(), 'legacy-generation');
    await database.query(
      "UPDATE seo_sitemap_state SET lock_token='changed-build'",
    );
    const beforePublication = Date.now();
    assert.equal(
      (await publish('changed-build', secondManifest, '<replacement/>')).rows[0]
        .generation,
      'changed-build',
    );
    assert.equal(await current(), 'changed-build');
    const retained = (
      await database.query<{ created_at: Date; retired_at: Date }>(
        "SELECT created_at,retired_at FROM seo_sitemap_generations WHERE id='legacy-generation'",
      )
    ).rows[0];
    assert.ok(
      new Date(retained.created_at).getTime() < Date.now() - 13 * 86400000,
    );
    assert.ok(
      new Date(retained.retired_at).getTime() >= beforePublication - 1000,
    );
    assert.equal(
      (
        await database.query(
          "SELECT 1 FROM seo_sitemap_artifacts a WHERE name='original' AND EXISTS(SELECT 1 FROM seo_sitemap_generation_artifacts r WHERE r.name=a.name)",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await database.query<{ phase: string }>(
          "SELECT phase FROM seo_sitemap_builds WHERE id='changed-build'",
        )
      ).rows[0].phase,
      'complete',
    );
  } finally {
    await database.close();
  }
});

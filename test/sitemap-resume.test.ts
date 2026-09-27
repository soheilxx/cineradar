import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from '../data/db';
import { fixtureCatalog } from './fixtures/catalog';
import { publishSitemaps } from '../seo/sitemap-publish';
import { serveSitemap } from '../seo/sitemap-response';

const saved = { ...process.env };
const origin = 'https://cineradar.test';
function restore() {
  for (const key of Object.keys(process.env))
    if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
}
beforeEach(() => {
  restore();
  Object.assign(process.env, {
    APP_MODE: 'live',
    DEPLOYMENT_ENV: 'production',
    SITE_URL: origin,
    ENABLED_MARKETS: 'de,us',
    DATABASE_URL: 'postgres://unused',
    TMDB_READ_ACCESS_TOKEN: 'unused',
    SAA_API_KEY: 'unused',
    SESSION_SECRET: 'a'.repeat(40),
    ADMIN_KEY: 'b'.repeat(32),
    OPERATOR_NAME: 'Test',
    OPERATOR_ADDRESS: 'Test',
    CONTACT_EMAIL: 'test@example.com',
    LEGAL_APPROVED: 'true',
    LICENSES_CONFIRMED: 'true',
    SYNC_ENABLED: 'false',
    MEDIA_ENABLED: 'false',
    TVMAZE_ENABLED: 'false',
    OMDB_ENABLED: 'false',
  });
});
after(restore);

async function setup() {
  const database = new PGlite();
  await database.exec(await readFile('db/migrations/007_sitemaps.sql', 'utf8'));
  await database.exec(`CREATE TABLE titles(id text PRIMARY KEY,data jsonb,updated_at timestamptz);
    CREATE TABLE snapshots(title_id text,market text,availability text,checked_at timestamptz,changed_at timestamptz,PRIMARY KEY(title_id,market));
    CREATE TABLE offers(id text,title_id text,market text,provider_id text,data jsonb,expires_at timestamptz);`);
  for (const migration of [
    '015_sitemap_offer_revisions.sql',
    '017_resumable_sitemaps.sql',
  ])
    await database.exec(await readFile('db/migrations/' + migration, 'utf8'));
  const adapter: Database = {
    query: async <T>(sql: string, params?: unknown[]) => ({
      rows: (await database.query<T>(sql, params)).rows,
    }),
  };
  async function addTitles(start: number, count: number) {
    const rows = Array.from({ length: count }, (_, offset) => {
      const number = start + offset;
      const title = structuredClone(fixtureCatalog()[0].title);
      title.id = `movie:${String(number).padStart(5, '0')}`;
      title.fixture = false;
      for (const localized of Object.values(title.localizations)) {
        localized.slug = `verified-title-${number}`;
        localized.overview =
          'A verified film synopsis for this isolated recovery test.';
      }
      return { id: title.id, data: title };
    });
    await database.query(
      `INSERT INTO titles SELECT id,data,'2026-09-01T00:00:00Z' FROM jsonb_to_recordset($1::jsonb) AS r(id text,data jsonb)`,
      [JSON.stringify(rows)],
    );
    await database.query(`INSERT INTO snapshots SELECT id,market,'empty','2026-09-02T00:00:00Z','2026-09-02T00:00:00Z'
      FROM titles CROSS JOIN unnest(ARRAY['de','us']) AS market ON CONFLICT DO NOTHING`);
  }
  await addTitles(1, 1);
  return { database, adapter, addTitles };
}
async function index(database: Database) {
  const response = await serveSitemap(
    new Request(origin + '/sitemap.xml'),
    undefined,
    database,
  );
  assert.equal(response.status, 200);
  return { xml: await response.text(), etag: response.headers.get('etag') };
}
async function complete(database: Database, force = false) {
  let result = await publishSitemaps({ force, maxSteps: 1 }, database);
  for (let attempt = 0; result.state === 'building' && attempt < 150; attempt++)
    result = await publishSitemaps({ maxSteps: 1 }, database);
  assert.equal(result.state, 'published');
  if (result.state !== 'published') throw new Error('Build never completed');
  return result;
}

test('scheduled checkpoints resume without force, preserve ordinals and keep the former index public until completion', async () => {
  const { database, adapter, addTitles } = await setup();
  try {
    const first = await complete(adapter, true);
    const oldIndex = await index(adapter);
    const previous = (
      await database.query<{ url: string; ordinal: number }>(
        'SELECT url,ordinal FROM seo_url_registry',
      )
    ).rows;
    await addTitles(2, 100);
    let result = await publishSitemaps({ force: true, maxSteps: 1 }, adapter);
    assert.equal(result.state, 'building');
    if (result.state !== 'building') throw new Error('Expected a checkpoint');
    const buildId = result.build;
    assert.equal(
      result.phase,
      'source',
      '101 titles need more than one source batch',
    );
    const frozen = (
      await database.query<{ as_of: Date; upper_title_id: string }>(
        'SELECT as_of,upper_title_id FROM seo_sitemap_builds WHERE id=$1',
        [buildId],
      )
    ).rows[0];
    let sawUnpublishedArtifact = false;
    for (
      let attempt = 0;
      result.state === 'building' && attempt < 150;
      attempt++
    ) {
      assert.equal(result.build, buildId);
      assert.deepEqual(await index(adapter), oldIndex);
      assert.deepEqual(
        (
          await database.query(
            'SELECT as_of,upper_title_id FROM seo_sitemap_builds WHERE id=$1',
            [buildId],
          )
        ).rows[0],
        frozen,
      );
      const staged = (
        await database.query<{ name: string }>(
          `SELECT a.name FROM seo_sitemap_build_artifacts a
        WHERE build_id=$1 AND NOT EXISTS(SELECT 1 FROM seo_sitemap_generation_artifacts p WHERE p.name=a.name) LIMIT 1`,
          [buildId],
        )
      ).rows[0];
      if (staged) {
        sawUnpublishedArtifact = true;
        assert.equal(
          (
            await serveSitemap(
              new Request(origin + '/' + staged.name),
              staged.name,
              adapter,
            )
          ).status,
          404,
        );
      }
      result = await publishSitemaps({ maxSteps: 1 }, adapter);
    }
    assert.equal(result.state, 'published');
    if (result.state !== 'published') throw new Error('Build never completed');
    assert.notEqual(result.generation, first.generation);
    assert.ok(sawUnpublishedArtifact);
    assert.notDeepEqual(await index(adapter), oldIndex);
    for (const prior of previous) {
      const current = (
        await database.query<{ ordinal: number }>(
          'SELECT ordinal FROM seo_url_registry WHERE url=$1',
          [prior.url],
        )
      ).rows[0];
      assert.equal(current.ordinal, prior.ordinal, prior.url);
    }
    const manifest = (
      await database.query<{ name: string; urls: number }>(
        'SELECT name,urls FROM seo_sitemap_build_artifacts WHERE build_id=$1',
        [buildId],
      )
    ).rows;
    assert.equal(
      manifest.reduce((sum, artifact) => sum + artifact.urls, 0),
      result.urls,
    );
    assert.equal(
      new Set(manifest.map((artifact) => artifact.name)).size,
      manifest.length,
    );
    for (const artifact of manifest)
      assert.equal(
        (
          await serveSitemap(
            new Request(origin + '/' + artifact.name),
            artifact.name,
            adapter,
          )
        ).status,
        200,
      );
    assert.equal((await publishSitemaps({}, adapter)).state, 'current');
    const unchanged = await complete(adapter, true);
    assert.equal(
      unchanged.generation,
      result.generation,
      'replaying unchanged content must reuse the public generation',
    );
  } finally {
    await database.close();
  }
});

test('an artifact committed before a lost checkpoint remains private and is reused on recovery', async () => {
  const { database, adapter } = await setup();
  try {
    const baseline = await complete(adapter, true);
    const oldIndex = await index(adapter);
    await database.query(
      `UPDATE titles SET data=jsonb_set(data,'{localizations,de,overview}','"A materially changed verified synopsis for a new artifact."')`,
    );
    let result = await publishSitemaps({ force: true, maxSteps: 1 }, adapter);
    while (result.state === 'building' && result.phase !== 'artifacts')
      result = await publishSitemaps({ maxSteps: 1 }, adapter);
    assert.equal(result.state, 'building');
    if (result.state !== 'building') throw new Error('Missing artifact phase');
    const buildId = result.build;
    const injected = Object.assign(
      new Error('Injected response loss after commit'),
      { code: '57014' },
    );
    let committedName: string | undefined;
    const lossy: Database = {
      query: async <T>(sql: string, params?: unknown[]) => {
        const response = await adapter.query<T>(sql, params);
        if (
          !committedName &&
          sql.includes('INSERT INTO seo_sitemap_artifacts(')
        ) {
          committedName = String(params?.[1]);
          throw injected;
        }
        return response;
      },
    };
    let observedFailure = false;
    for (let attempt = 0; !observedFailure && attempt < 100; attempt++) {
      try {
        await publishSitemaps({ maxSteps: 1 }, lossy);
      } catch (error) {
        assert.equal(error, injected);
        observedFailure = true;
      }
    }
    assert.ok(observedFailure && committedName);
    const artifactBefore = (
      await database.query(
        'SELECT name,hash,lastmod FROM seo_sitemap_artifacts WHERE name=$1',
        [committedName],
      )
    ).rows[0];
    assert.ok(artifactBefore);
    assert.deepEqual(await index(adapter), oldIndex);
    assert.equal(
      (
        await serveSitemap(
          new Request(origin + '/' + committedName),
          committedName,
          adapter,
        )
      ).status,
      404,
    );
    assert.equal(
      (await publishSitemaps({ maxSteps: 1 }, adapter)).state,
      'current',
      'real errors retain scheduled backoff',
    );
    const recovered = await complete(adapter, true);
    assert.notEqual(recovered.generation, baseline.generation);
    assert.equal(recovered.generation, buildId);
    assert.deepEqual(
      (
        await database.query(
          'SELECT name,hash,lastmod FROM seo_sitemap_artifacts WHERE name=$1',
          [committedName],
        )
      ).rows[0],
      artifactBefore,
    );
    assert.equal(
      (
        await database.query(
          'SELECT 1 FROM seo_sitemap_build_artifacts WHERE build_id=$1 AND name=$2',
          [buildId, committedName],
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await serveSitemap(
          new Request(origin + '/' + committedName),
          committedName,
          adapter,
        )
      ).status,
      200,
    );
  } finally {
    await database.close();
  }
});

test('a market configuration change abandons an unfinished build without mixing its URLs into the new publication', async () => {
  const { database, adapter } = await setup();
  try {
    await complete(adapter, true);
    const oldIndex = await index(adapter);
    const abandoned = await publishSitemaps(
      { force: true, maxSteps: 1 },
      adapter,
    );
    assert.equal(abandoned.state, 'building');
    if (abandoned.state !== 'building')
      throw new Error('Expected an unfinished build');
    process.env.ENABLED_MARKETS = 'de';
    const replacement = await publishSitemaps({ maxSteps: 1 }, adapter);
    assert.equal(replacement.state, 'building');
    if (replacement.state !== 'building')
      throw new Error('Expected replacement build');
    assert.notEqual(replacement.build, abandoned.build);
    assert.equal(
      (
        await database.query<{ phase: string }>(
          'SELECT phase FROM seo_sitemap_builds WHERE id=$1',
          [abandoned.build],
        )
      ).rows[0].phase,
      'abandoned',
    );
    assert.deepEqual(await index(adapter), oldIndex);
    const published = await complete(adapter);
    assert.equal(published.generation, replacement.build);
    const active = (
      await database.query<{ market: string | null }>(
        'SELECT market FROM seo_url_registry WHERE generation=$1 AND sitemap_eligible',
        [published.generation],
      )
    ).rows;
    assert.ok(active.length);
    assert.ok(
      active.every((entry) => entry.market === 'de' || entry.market === null),
    );
    const manifest = (await index(adapter)).xml;
    assert.doesNotMatch(
      manifest,
      /sitemap-(?:movies|series|landings|providers|topics)-[a-z]{2}-us-/,
    );
  } finally {
    await database.close();
  }
});

test('source replay reconciles changed slugs, removed genres and a deleted final title after committed partial writes', async () => {
  const { database, adapter, addTitles } = await setup();
  try {
    await addTitles(2, 1);
    await complete(adapter, true);
    const oldIndex = await index(adapter);
    const injected = Object.assign(new Error('Lost source checkpoint'), {
      code: '57014',
    });
    let interrupted = false;
    const lossy: Database = {
      query: async <T>(sql: string, params?: unknown[]) => {
        const response = await adapter.query<T>(sql, params);
        // Registry and landing membership have committed; the source cursor has not.
        if (
          !interrupted &&
          sql.includes('INSERT INTO seo_sitemap_build_members(')
        ) {
          interrupted = true;
          throw injected;
        }
        return response;
      },
    };
    await assert.rejects(
      publishSitemaps({ force: true, maxSteps: 1 }, lossy),
      (error) => error === injected,
    );
    assert.ok(interrupted);
    const build = (
      await database.query<{
        id: string;
        cursor: string;
        total_urls: number;
      }>(`SELECT b.id,b.cursor,b.total_urls FROM seo_sitemap_builds b
      JOIN seo_sitemap_state s ON s.building_generation=b.id`)
    ).rows[0];
    assert.equal(build.cursor, '');
    assert.equal(build.total_urls, 0);
    assert.ok(
      (
        await database.query(
          'SELECT 1 FROM seo_sitemap_build_members WHERE build_id=$1',
          [build.id],
        )
      ).rows.length > 0,
    );
    assert.deepEqual(await index(adapter), oldIndex);

    await database.query(
      `UPDATE titles SET data=jsonb_set(jsonb_set(data,'{genres}','[]'),'{localizations,de,slug}','"renamed-film-1"') WHERE id='movie:00001'`,
    );
    await database.query("DELETE FROM titles WHERE id='movie:00002'");
    const recovered = await complete(adapter, true);
    assert.equal(recovered.generation, build.id);
    const active = (
      await database.query<{
        url: string;
        entity: string;
        alternates: Record<string, string>;
      }>(
        'SELECT url,entity,alternates FROM seo_url_registry WHERE generation=$1 AND sitemap_eligible',
        [build.id],
      )
    ).rows;
    assert.ok(active.some((entry) => entry.url.endsWith('/renamed-film-1/')));
    assert.ok(active.every((entry) => entry.entity !== 'movie:00002'));
    assert.ok(
      active.every(
        (entry) =>
          !new URL(entry.url).pathname.startsWith('/de/') ||
          !entry.url.endsWith('/verified-title-1/'),
      ),
    );
    assert.ok(active.every((entry) => !entry.entity.startsWith('topics:')));
    const allowed = new Set(active.map((entry) => entry.url));
    for (const entry of active)
      for (const target of Object.values(entry.alternates))
        assert.ok(allowed.has(target), target);
    const memberships = (
      await database.query<{ title_ids: string[]; route: string }>(
        `SELECT m.title_ids,l.route FROM seo_sitemap_build_members m
      JOIN seo_sitemap_build_landings l ON l.build_id=m.build_id AND l.url=m.url WHERE m.build_id=$1`,
        [build.id],
      )
    ).rows;
    assert.ok(memberships.length);
    assert.ok(
      memberships.every(
        (row) =>
          row.route !== 'topics' &&
          row.title_ids.every((id) => id === 'movie:00001'),
      ),
    );
    assert.equal(active.length, recovered.urls);
  } finally {
    await database.close();
  }
});

test('a former worker cannot mutate the registry or release the replacement lease', async () => {
  const { database, adapter } = await setup();
  try {
    await complete(adapter, true);
    const oldIndex = await index(adapter);
    const before = (
      await database.query('SELECT * FROM seo_url_registry ORDER BY url')
    ).rows;
    let displaced = false;
    const takeover: Database = {
      query: async <T>(sql: string, params?: unknown[]) => {
        if (!displaced && sql.includes('INSERT INTO seo_url_registry(')) {
          displaced = true;
          await database.query(
            "UPDATE seo_sitemap_state SET lock_token='replacement-worker',locked_until=now()+interval '10 minutes' WHERE id=1",
          );
        }
        return adapter.query<T>(sql, params);
      },
    };
    await assert.rejects(
      publishSitemaps({ force: true, maxSteps: 1 }, takeover),
      /Sitemap lease lost/,
    );
    assert.ok(displaced);
    assert.deepEqual(
      (await database.query('SELECT * FROM seo_url_registry ORDER BY url'))
        .rows,
      before,
    );
    assert.deepEqual(await index(adapter), oldIndex);
    const state = (
      await database.query<{ lock_token: string; last_error: string | null }>(
        'SELECT lock_token,last_error FROM seo_sitemap_state',
      )
    ).rows[0];
    assert.equal(state.lock_token, 'replacement-worker');
    assert.equal(state.last_error, null);
    assert.equal(
      (await publishSitemaps({ force: true }, adapter)).state,
      'current',
      'force must not overtake an active replacement lease',
    );
  } finally {
    await database.close();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { fixtureCatalog } from './fixtures/catalog';
import { titleEligibility } from '../seo/indexing';
import {
  buildSitemapEntries,
  assignSitemapRevisions,
  publishSitemaps,
  type SitemapTitleRow,
} from '../seo/sitemap-publish';
import {
  urlset,
  xmlEscape,
  MAX_SITEMAP_URLS,
  type SitemapEntry,
} from '../seo/sitemap-xml';
import type { Database } from '../data/db';
import { routeFor } from '../i18n/routes';
import { serveLegacySitemap } from '../seo/sitemap-response';

const origin = 'https://cineradar.tv';
const now = new Date('2026-09-07T20:00:00Z');
test('Italian film and series detail URLs resolve separately from listing routes', () => {
  assert.equal(routeFor('it', 'film'), 'movies');
  assert.equal(routeFor('it', 'film', true), 'movie');
  assert.equal(routeFor('it', 'serie'), 'series');
  assert.equal(routeFor('it', 'serie', true), 'tv');
  assert.equal(routeFor('en', 'films', true), 'movies');
});
function sample(): SitemapTitleRow {
  const title = structuredClone(fixtureCatalog()[0].title);
  title.fixture = false;
  for (const localized of Object.values(title.localizations))
    localized.overview =
      'A verified film synopsis used only in this isolated test.';
  return {
    data: title,
    updated_at: '2026-09-01T10:00:00Z',
    snapshots: [
      {
        market: 'de',
        availability: 'available',
        checkedAt: '2026-09-07T10:00:00Z',
        hasOffers: true,
        changedAt: '2026-09-02T10:00:00Z',
        revision: 'offer-1',
        providers: ['netflix'],
      },
      {
        market: 'us',
        availability: 'empty',
        checkedAt: '2026-09-07T10:00:00Z',
        hasOffers: false,
        changedAt: '2026-09-02T10:00:00Z',
        revision: '',
        providers: [],
      },
    ],
  };
}
test('sitemap eligibility keeps checked empty markets and temporary failures, excludes unchecked and missing content', () => {
  const row = sample();
  assert.equal(
    titleEligibility(row.data, 'en', row.snapshots[1]).sitemapEligible,
    true,
  );
  assert.equal(
    titleEligibility(row.data, 'en', {
      ...row.snapshots[0],
      availability: 'error',
    }).indexable,
    true,
  );
  assert.equal(
    titleEligibility(row.data, 'en', {
      ...row.snapshots[0],
      availability: 'error',
      checkedAt: null,
    }).sitemapEligible,
    false,
  );
  row.data.localizations.en.overview = '';
  assert.equal(
    titleEligibility(row.data, 'en', row.snapshots[1]).sitemapEligible,
    false,
  );
});
test('all valid language and market variants are reciprocal and unused markets or empty providers are excluded', () => {
  const entries = buildSitemapEntries([sample()], origin, ['de', 'us'], now);
  const titles = entries.filter((e) => e.entity.startsWith('movie:'));
  assert.equal(titles.length, 10);
  const targets = new Set(
    entries.filter((e) => e.sitemapEligible).map((e) => e.url),
  );
  for (const entry of titles) {
    assert.equal(Object.keys(entry.alternates).length, 10);
    assert.ok(entry.alternates['en-US']?.startsWith(origin + '/en/us/'));
    assert.ok(Object.values(entry.alternates).includes(entry.url));
    for (const target of Object.values(entry.alternates))
      assert.ok(targets.has(target));
  }
  assert.equal(
    entries.some((e) => e.segment === 'providers-en-us'),
    false,
  );
  assert.equal(
    entries.some((e) => e.market === 'fr'),
    false,
  );
  assert.equal(
    entries.filter((e) => e.segment.startsWith('comparisons')).length,
    55,
  );
});
test('real content revisions keep lastmod stable across checks and change only affected language or market', () => {
  const row = sample();
  const first = assignSitemapRevisions(
    buildSitemapEntries([row], origin, ['de', 'us'], now),
    [],
    now,
  );
  const previous = first.map((e) => ({ ...e, ordinal: e.ordinal! }));
  row.snapshots[0].checkedAt = '2026-09-07T15:00:00Z';
  row.data.localizations.de.sourceHash = 'refetched';
  const same = assignSitemapRevisions(
    buildSitemapEntries([row], origin, ['de', 'us'], now),
    previous,
    now,
  );
  const title = same.find(
    (e) => e.entity === row.data.id && e.locale === 'de' && e.market === 'de',
  )!;
  assert.equal(title.lastmod, '2026-09-02T10:00:00.000Z');
  row.data.localizations.de.overview += ' Neue belegte Beschreibung.';
  const changed = assignSitemapRevisions(
    buildSitemapEntries([row], origin, ['de', 'us'], now),
    previous,
    now,
  );
  assert.equal(
    changed.find((e) => e.url === title.url)!.lastmod,
    now.toISOString(),
  );
  assert.equal(
    changed.find((e) => e.entity === row.data.id && e.locale === 'en')!.lastmod,
    '2026-09-02T10:00:00.000Z',
  );
  assert.equal(
    changed.find((e) => e.url === title.url)!.ordinal,
    title.ordinal,
  );
});
test('XML includes real images and escapes content, rejects duplicate/filter URLs and excess size', () => {
  const entry = buildSitemapEntries([sample()], origin, ['de'], now)[0];
  assert.equal(xmlEscape(`A&B<"'>`), 'A&amp;B&lt;&quot;&apos;&gt;');
  const xml = urlset([entry], origin);
  assert.match(xml, /xmlns:image=/);
  assert.match(xml, /<xhtml:link rel="alternate"/);
  assert.doesNotMatch(xml, /<priority>|<changefreq>|<video:|<news:/);
  assert.throws(() => urlset([entry, entry], origin));
  assert.throws(() =>
    urlset([{ ...entry, url: entry.url + '?q=private' }], origin),
  );
  assert.throws(() =>
    urlset(Array(MAX_SITEMAP_URLS + 1).fill(entry) as SitemapEntry[], origin),
  );
  assert.throws(() =>
    urlset(
      [
        {
          ...entry,
          images: ['https://image.tmdb.org/' + 'x'.repeat(21 * 1024 * 1024)],
        },
      ],
      origin,
    ),
  );
});
test('database publication is atomic, preserves former generation on failure and rejects stale leases', async () => {
  const database = new PGlite();
  try {
    await database.exec(
      await readFile('db/migrations/007_sitemaps.sql', 'utf8'),
    );
    await database.query(
      "UPDATE seo_sitemap_state SET lock_token='valid',locked_until=now()+interval '10 minutes' WHERE id=1",
    );
    await database.query(
      "INSERT INTO seo_sitemap_artifacts(name,segment,shard,hash,xml_gzip_base64,uncompressed_bytes,url_count,lastmod) VALUES('one','movies-de-de',1,'hash','data',5,1,now())",
    );
    await database.query('SELECT publish_sitemap_generation($1,$2,$3,$4,$5)', [
      'valid',
      'first',
      JSON.stringify([{ name: 'one' }]),
      '<index/>',
      1,
    ]);
    await assert.rejects(
      database.query('SELECT publish_sitemap_generation($1,$2,$3,$4,$5)', [
        'valid',
        'stale',
        JSON.stringify([{ name: 'one' }]),
        '<index/>',
        1,
      ]),
    );
    await database.query(
      "UPDATE seo_sitemap_state SET lock_token='second',locked_until=now()+interval '10 minutes' WHERE id=1",
    );
    await assert.rejects(
      database.query('SELECT publish_sitemap_generation($1,$2,$3,$4,$5)', [
        'second',
        'broken',
        JSON.stringify([{ name: 'missing-artifact' }]),
        '<index/>',
        1,
      ]),
    );
    assert.equal(
      (
        await database.query<{ current_generation: string }>(
          'SELECT current_generation FROM seo_sitemap_state',
        )
      ).rows[0].current_generation,
      'first',
    );
    assert.equal(
      (
        await database.query(
          "SELECT 1 FROM seo_sitemap_generations WHERE id='broken'",
        )
      ).rows.length,
      0,
    );
  } finally {
    await database.close();
  }
});
test('export works with provider synchronization disabled, reuses immutable content and deduplicates scheduled runs', async () => {
  const previous = { ...process.env };
  const database = new PGlite();
  try {
    Object.assign(process.env, {
      APP_MODE: 'live',
      DEPLOYMENT_ENV: 'production',
      SITE_URL: origin,
      ENABLED_MARKETS: 'de,us',
      DATABASE_URL: 'postgres://unused',
      TMDB_READ_ACCESS_TOKEN: 'unused',
      SAA_API_KEY: 'unused',
      SESSION_SECRET: 'a'.repeat(40),
      ADMIN_KEY: 'b'.repeat(30),
      OPERATOR_NAME: 'Test',
      OPERATOR_ADDRESS: 'Test',
      CONTACT_EMAIL: 'test@example.com',
      LEGAL_APPROVED: 'true',
      LICENSES_CONFIRMED: 'true',
      SYNC_ENABLED: 'false',
    });
    await database.exec(
      await readFile('db/migrations/007_sitemaps.sql', 'utf8'),
    );
    await database.exec(
      'CREATE TABLE titles(id text PRIMARY KEY,data jsonb,updated_at timestamptz); CREATE TABLE snapshots(title_id text,market text,availability text,checked_at timestamptz,changed_at timestamptz); CREATE TABLE offers(id text,title_id text,market text,provider_id text,data jsonb,expires_at timestamptz);',
    );
    const row = sample();
    await database.query('INSERT INTO titles VALUES($1,$2,$3)', [
      row.data.id,
      JSON.stringify(row.data),
      row.updated_at,
    ]);
    for (const snapshot of row.snapshots)
      await database.query('INSERT INTO snapshots VALUES($1,$2,$3,$4,$5)', [
        row.data.id,
        snapshot.market,
        'empty',
        snapshot.checkedAt,
        snapshot.changedAt,
      ]);
    let documentWrites = 0;
    let artifactWrites = 0;
    const adapter: Database = {
      query: async <T>(sql: string, params?: unknown[]) => {
        if (sql.includes('INSERT INTO seo_url_registry')) documentWrites++;
        if (sql.includes('INSERT INTO seo_sitemap_artifacts')) artifactWrites++;
        return { rows: (await database.query<T>(sql, params)).rows };
      },
    };
    const result = await publishSitemaps({ force: true }, adapter);
    assert.equal(result.state, 'published');
    const loadedArtifacts: string[] = [];
    const legacyDatabase: Database = {
      query: async <T>(sql: string, params?: unknown[]) => {
        const result = await adapter.query<T>(sql, params);
        if (sql.includes('xml_gzip_base64')) {
          assert.equal(result.rows.length, 1);
          loadedArtifacts.push(String(params?.[0]));
        }
        return result;
      },
    };
    const legacy = await serveLegacySitemap(
      new Request(origin + '/sitemaps/titles.xml?page=1'),
      true,
      legacyDatabase,
    );
    assert.equal(legacy.status, 200);
    assert.equal(loadedArtifacts.length, 1);
    assert.equal(legacy.headers.get('Cache-Control'), 'public, max-age=300');
    const legacyXml = await legacy.text();
    assert.ok((legacyXml.match(/<url>/g) || []).length <= 1000);
    assert.ok(Buffer.byteLength(legacyXml) < 4.5 * 1024 * 1024);
    const missingPage = await serveLegacySitemap(
      new Request(origin + '/sitemaps/titles.xml?page=100000'),
      true,
      legacyDatabase,
    );
    assert.equal(missingPage.status, 404);
    const first = (
      await database.query<{ manifest: unknown }>(
        'SELECT manifest FROM seo_sitemap_generations',
      )
    ).rows[0].manifest;
    assert.equal((await publishSitemaps({}, adapter)).state, 'current');
    documentWrites = 0;
    artifactWrites = 0;
    const unchangedExport = await publishSitemaps({ force: true }, adapter);
    assert.equal(unchangedExport.generation, result.generation);
    assert.equal(unchangedExport.registryChanged, 0);
    assert.ok((unchangedExport.registryUnchanged || 0) > 0);
    assert.equal(documentWrites, 0);
    assert.equal(artifactWrites, 0);
    const latest = (
      await database.query<{ manifest: unknown }>(
        'SELECT manifest FROM seo_sitemap_generations ORDER BY created_at DESC LIMIT 1',
      )
    ).rows[0].manifest;
    assert.deepEqual(latest, first);
    assert.equal(
      (await database.query('SELECT 1 FROM seo_sitemap_generations')).rows
        .length,
      1,
    );
  } finally {
    process.env = previous;
    await database.close();
  }
});

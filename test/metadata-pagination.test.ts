import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from '../data/db';
import { landingAlternates } from '../seo/landings';
import { missingCatalogPage, routeQuery } from '../seo/routing';

const origin = 'https://cineradar.tv';
let database: PGlite;
let alternateQueries = 0;
const adapter: Database = {
  async query<T>(sql: string, parameters: unknown[] = []) {
    alternateQueries++;
    return { rows: (await database.query<T>(sql, parameters)).rows };
  },
};

before(async () => {
  database = new PGlite();
  await database.exec(`
    CREATE TABLE titles (id text PRIMARY KEY, media_type text, data jsonb);
    CREATE TABLE localizations (
      title_id text, locale text, title text, overview text, slug text,
      PRIMARY KEY(title_id, locale)
    );
    CREATE TABLE snapshots (
      title_id text, market text, availability text, checked_at timestamptz,
      PRIMARY KEY(title_id, market)
    );
    CREATE TABLE offers (
      id text PRIMARY KEY, title_id text, market text,
      provider_id text, expires_at timestamptz
    );
  `);
});
after(async () => database?.close());
beforeEach(async () => {
  await database.exec('TRUNCATE titles, localizations, snapshots, offers');
  alternateQueries = 0;
});

async function seed(count: number, locales = ['en']) {
  await database.query(
    `INSERT INTO titles
     SELECT 'movie:'||n, 'movie',
       jsonb_build_object('year',2024,'fixture',false,'genres',jsonb_build_array('drama'),'cast','[]'::jsonb)
     FROM generate_series(1,$1::int) AS n`,
    [count],
  );
  await database.query(
    `INSERT INTO localizations
     SELECT t.id, locale, 'Title '||t.id, 'A verified plot description.', 'title-'||t.id
     FROM titles t CROSS JOIN unnest($1::text[]) AS locale`,
    [locales],
  );
  await database.exec(`
    INSERT INTO snapshots
    SELECT t.id, market, 'empty', now()-interval '1 day'
    FROM titles t CROSS JOIN unnest(ARRAY['de','us']) AS market;
  `);
}

test('page two includes only locales with at least 25 browsable titles and uses one query', async () => {
  await seed(25, ['en', 'de']);
  await database.exec(`
    DELETE FROM localizations WHERE title_id='movie:25' AND locale='de';
    UPDATE localizations SET overview='' WHERE title_id<>'movie:1';
  `);
  const first = await landingAlternates(
    adapter,
    origin,
    ['de', 'us'],
    'movies',
    '',
    1,
  );
  assert.equal(Object.keys(first).length, 4);
  assert.ok(Object.values(first).every((url) => !url.includes('?')));
  alternateQueries = 0;
  const second = await landingAlternates(
    adapter,
    origin,
    ['de', 'us'],
    'movies',
    '',
    2,
  );
  assert.equal(alternateQueries, 1);
  assert.deepEqual(second, {
    'en-DE': origin + '/en/de/films/?page=2',
    'en-US': origin + '/en/us/films/?page=2',
  });
  assert.deepEqual(
    await landingAlternates(adapter, origin, ['de', 'us'], 'movies', '', 3),
    {},
  );
  assert.deepEqual(
    await landingAlternates(adapter, origin, ['us'], 'series', '', 1),
    {},
  );
  assert.equal(
    Object.keys(
      await landingAlternates(adapter, origin, ['us'], 'topics', 'drama', 2),
    ).length,
    1,
  );
  assert.deepEqual(
    await landingAlternates(adapter, origin, ['us'], 'topics', 'scifi', 2),
    {},
  );
});

test('provider pagination counts titles per market, ignores expired offers and does not count duplicate offers twice', async () => {
  await seed(26);
  await database.exec(`
    INSERT INTO offers
    SELECT 'us-'||n, 'movie:'||n, 'us', 'netflix', NULL
    FROM generate_series(1,25) AS n;
    INSERT INTO offers
    SELECT 'de-'||n, 'movie:'||n, 'de', 'netflix', NULL
    FROM generate_series(1,24) AS n;
    INSERT INTO offers VALUES
      ('de-expired','movie:25','de','netflix',now()-interval '1 day'),
      ('de-prime','movie:26','de','prime',NULL),
      ('us-duplicate','movie:1','us','netflix',NULL),
      ('de-duplicate','movie:1','de','netflix',NULL);
  `);
  assert.deepEqual(
    await landingAlternates(
      adapter,
      origin,
      ['de', 'us'],
      'providers',
      'netflix',
      2,
    ),
    { 'en-US': origin + '/en/us/providers/netflix/?page=2' },
  );
  assert.deepEqual(
    await landingAlternates(
      adapter,
      origin,
      ['de', 'us'],
      'providers',
      'prime',
      1,
    ),
    { 'en-DE': origin + '/en/de/providers/prime/' },
  );
  await database.exec("DELETE FROM offers WHERE id='us-25'");
  assert.deepEqual(
    await landingAlternates(
      adapter,
      origin,
      ['de', 'us'],
      'providers',
      'netflix',
      2,
    ),
    {},
  );
});

test('landing eligibility requires a checked market and readable localized content, while retaining checked refresh failures', async () => {
  await seed(1, ['en', 'de', 'fr']);
  await database.exec(`
    UPDATE snapshots SET availability='error' WHERE market='de';
    UPDATE snapshots SET availability='unchecked',checked_at=NULL WHERE market='us';
    UPDATE localizations SET overview='' WHERE locale='de';
    UPDATE localizations SET title='   ' WHERE locale='fr';
  `);
  const languages = () =>
    landingAlternates(adapter, origin, ['de', 'us'], 'movies', '', 1);
  assert.deepEqual(await languages(), {
    'en-DE': origin + '/en/de/films/',
  });
  await database.exec(`
    UPDATE titles SET data=jsonb_set(data,'{cast}','["An actor"]');
    INSERT INTO offers VALUES
      ('de-offer','movie:1','de','netflix',NULL),
      ('us-offer','movie:1','us','netflix',NULL);
  `);
  assert.deepEqual(await languages(), {
    'de-DE': origin + '/de/de/filme/',
    'en-DE': origin + '/en/de/films/',
  });
  await database.exec("UPDATE localizations SET slug='   ' WHERE locale='de'");
  assert.deepEqual(await languages(), {
    'en-DE': origin + '/en/de/films/',
  });
  await database.exec(
    "UPDATE titles SET data=jsonb_set(data,'{fixture}','true')",
  );
  assert.deepEqual(await languages(), {});
  await database.exec(
    "UPDATE titles SET data=jsonb_set(jsonb_set(data,'{fixture}','false'),'{year}','null')",
  );
  assert.deepEqual(await languages(), {});
});

test('routing keeps genuine page two catalogs and marks nonpaginated query variants for clean noindex metadata', () => {
  const movies = routeQuery('movies', '', { page: '2' });
  assert.equal(movies?.page, 2);
  assert.equal(movies?.filtered, false);
  assert.equal(movies?.filters.type, 'movie');
  assert.equal(movies?.filters.sort, 'latest');
  const provider = routeQuery('providers', 'netflix', {
    page: '2',
    provider: 'prime',
  });
  assert.equal(provider?.page, 2);
  assert.equal(provider?.filters.provider, 'netflix');
  assert.equal(provider?.filtered, true);
  for (const route of ['home', 'movie', 'tv', 'providers', 'legal'] as const) {
    const result = routeQuery(route, '', { page: '2' });
    assert.equal(result?.page, 1, route);
    assert.equal(result?.filters.page, 1, route);
    assert.equal(result?.filtered, true, route);
  }
  assert.equal(routeQuery('movies', '', { page: ['2', '3'] }), null);
  assert.equal(routeQuery('search', '', { q: ['one', 'two'] }), null);
  for (const page of ['0', '-1', '1001', '2.5', 'invalid'])
    assert.equal(routeQuery('movies', '', { page }), null, page);
});

test('only an empty successfully loaded later catalog page is missing', () => {
  assert.equal(missingCatalogPage(1, { items: [], unavailable: false }), false);
  assert.equal(missingCatalogPage(1, { items: [], unavailable: true }), false);
  assert.equal(missingCatalogPage(2, { items: [], unavailable: true }), false);
  assert.equal(
    missingCatalogPage(2, { items: [{}], unavailable: false }),
    false,
  );
  assert.equal(missingCatalogPage(2, { items: [], unavailable: false }), true);
});

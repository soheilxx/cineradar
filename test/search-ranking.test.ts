import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { filterCatalog, prominenceScore } from '../domain/search';
import { loadCatalog } from '../data/repositories/catalog';
import { TMDB } from '../data/providers/tmdb';
import type { CatalogItem, Filters, MediaType } from '../domain/types';
import type { Locale } from '../i18n/config';
import { fixtureCatalog } from './fixtures/catalog';

let database: PGlite;
const savedEnv = { ...process.env };
const now = Date.now();
function item(
  id: number,
  name: string,
  votes: number,
  type: MediaType = 'movie',
  year = 2026,
) {
  const result = structuredClone(fixtureCatalog()[0]);
  Object.assign(result.title, {
    id: `${type}:${id}`,
    tmdbId: id,
    type,
    originalTitle: name,
    votes,
    year,
  });
  result.snapshot.offers = [];
  for (const translation of Object.values(result.title.localizations)) {
    translation.title = name;
    translation.slug = `${id}-${translation.locale}`;
  }
  return result;
}
const lucifer = item(63174, 'Lucifer', 16000, 'tv', 2016);
const namesakes = Array.from({ length: 8 }, (_, i) =>
  item(90000 + i, 'Lucifer', i + 1),
);
const partial = item(90010, 'Lucifer Returns', 1000000);
const original = item(90011, 'Ein anderer deutscher Titel', 8000);
original.title.originalTitle = 'Lucifer';
const alternate = item(90012, 'Another localized title', 6000);
alternate.title.localizations.fr.title = 'Lucifer';
const numeric = item(90013, '1917', 15000, 'movie', 2019);
const unrelated = item(90014, 'An unrelated film', 100, 'movie', 1917);
const accent = item(90015, 'Léon: Der Profi', 20000, 'movie', 1994);
const rows = [
  partial,
  ...namesakes,
  original,
  alternate,
  numeric,
  unrelated,
  accent,
  lucifer,
];
const adapter = {
  async query<T>(sql: string, parameters: unknown[] = []) {
    return { rows: (await database.query<T>(sql, parameters)).rows };
  },
};
before(async () => {
  Object.assign(process.env, {
    APP_MODE: 'live',
    DEPLOYMENT_ENV: 'local',
    SITE_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgres://test',
    TMDB_READ_ACCESS_TOKEN: 'test',
    SAA_API_KEY: 'test',
    SESSION_SECRET: 'x'.repeat(32),
  });
  database = new PGlite({ extensions: { pg_trgm, unaccent } });
  for (const file of (await readdir('db/migrations')).sort())
    await database.exec(await readFile(`db/migrations/${file}`, 'utf8'));
  for (const row of rows)
    await database.query('SELECT save_title($1)', [JSON.stringify(row.title)]);
  // Re-importing obscure namesakes must not make them outrank the established series.
  await database.query(
    "UPDATE titles SET updated_at=now()+interval '1 day' WHERE id LIKE 'movie:9000%'",
  );
});
after(async () => {
  await database?.close();
  for (const key of Object.keys(process.env))
    if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
});
const ids = (items: CatalogItem[]) => items.map((entry) => entry.title.id);
async function verify(
  filters: Filters,
  locale: Locale = 'de',
  ranking: string[] = [],
) {
  const actual = await loadCatalog(locale, 'de', filters, 100, adapter);
  assert.equal(actual.unavailable, false, 'SQL must execute successfully');
  const expected = filterCatalog(rows, locale, filters, now, ranking);
  assert.deepEqual(ids(actual.items), ids(expected));
  assert.equal(actual.total, expected.length);
  const shelf = await loadCatalog(locale, 'de', filters, 5, adapter, false);
  assert.equal(shelf.unavailable, false);
  assert.deepEqual(ids(shelf.items), ids(expected).slice(0, 5));
  assert.equal(shelf.total, 0);
  return actual.items;
}

test('Lucifer series wins over eight recently imported namesakes in SQL and fixtures', async () => {
  const found = await verify({ q: 'Lucifer' });
  assert.equal(found[0].title.id, lucifer.title.id);
  assert.equal(found[1].title.id, original.title.id);
  assert.equal(found[2].title.id, alternate.title.id);
  assert(found.findIndex((entry) => entry.title.id === partial.title.id) > 10);
  const autocomplete = await loadCatalog(
    'de',
    'de',
    { q: 'Lucifer' },
    8,
    adapter,
  );
  assert.equal(autocomplete.items[0].title.id, lucifer.title.id);
});

test('Accents, punctuation, alternate titles and typos share SQL and fixture ordering', async () => {
  for (const query of [
    'lucifer',
    'LUCIFER',
    'Lucifr',
    'Lucifer Returns',
    'Léon Der Profi',
    'Leon: Der Profi',
  ])
    await verify({ q: query });
  assert.equal(
    (await verify({ q: 'Leon Der Profi' }))[0].title.id,
    accent.title.id,
  );
});

test('Numeric titles preserve exact search and separate release years', async () => {
  assert.deepEqual(ids(await verify({ q: '1917' })), [numeric.title.id]);
  assert.deepEqual(ids(await verify({ q: '1917 2019' })), [numeric.title.id]);
  assert.deepEqual(ids(await verify({ q: '1917 2020' })), []);
  assert.deepEqual(ids(await verify({ q: '1917', year: 1917 })), []);
});

test('Trending uses current country ranks, ignores stale ranks and falls back to prominence', async () => {
  await database.query(
    'INSERT INTO operations(key,data,updated_at) VALUES($1,$2,now())',
    [
      'ranking:de:movie:popularity_1week:1',
      JSON.stringify({
        page: 1,
        ids: [namesakes[0].title.id, partial.title.id],
      }),
    ],
  );
  await database.query(
    "INSERT INTO operations(key,data,updated_at) VALUES($1,$2,now()-interval '8 days')",
    [
      'ranking:de:movie:popularity_1week:2',
      JSON.stringify({ page: 2, ids: [namesakes[1].title.id] }),
    ],
  );
  await database.query(
    'INSERT INTO operations(key,data,updated_at) VALUES($1,$2,now())',
    [
      'ranking:us:movie:popularity_1week:1',
      JSON.stringify({ page: 1, ids: [namesakes[2].title.id] }),
    ],
  );
  try {
    const ranking = [namesakes[0].title.id, partial.title.id];
    const relevance = await verify({ q: 'Lucifer' }, 'de', ranking);
    assert.equal(
      relevance[0].title.id,
      lucifer.title.id,
      'Bounded trend bonus must preserve strong known-title signal',
    );
    const trending = await verify(
      { q: 'Lucifer', sort: 'trending' },
      'de',
      ranking,
    );
    assert.equal(trending[0].title.id, namesakes[0].title.id);
    assert.equal(trending[1].title.id, lucifer.title.id);
    assert.equal(
      trending.at(-1)?.title.id,
      partial.title.id,
      'Even a trending partial match follows exact matches',
    );
    const all = await verify({ sort: 'trending' }, 'de', ranking);
    assert.deepEqual(ids(all).slice(0, 2), ranking);
    assert(
      ids(all).indexOf(numeric.title.id) <
        ids(all).indexOf(namesakes[1].title.id),
      'Known older titles precede new obscure fallback titles',
    );
    const page1 = await loadCatalog(
      'de',
      'de',
      { q: 'Lucifer', sort: 'trending' },
      5,
      adapter,
    );
    const page2 = await loadCatalog(
      'de',
      'de',
      { q: 'Lucifer', sort: 'trending', page: 2 },
      5,
      adapter,
    );
    assert.deepEqual(
      ids([...page1.items, ...page2.items]),
      ids(trending).slice(0, 10),
    );
  } finally {
    await database.query("DELETE FROM operations WHERE key LIKE 'ranking:%'");
  }
});

test('Only fresh TMDB popularity contributes, and missing popularity has a votes fallback', async () => {
  const fresh = item(90030, 'Same name', 10);
  fresh.title.popularity = 1000;
  fresh.title.popularityUpdatedAt = new Date(now - 1000).toISOString();
  const stale = structuredClone(fresh);
  stale.title.popularityUpdatedAt = new Date(now - 8 * 86400000).toISOString();
  assert(
    prominenceScore(fresh.title, -1, now) >
      prominenceScore(stale.title, -1, now),
  );
  assert.equal(prominenceScore(stale.title, -1, now), Math.log1p(10));
  assert.equal(
    prominenceScore(item(90031, 'Old import', 10).title, -1, now),
    Math.log1p(10),
  );
  const namesake = namesakes[0].title;
  namesake.popularity = 10000;
  namesake.popularityUpdatedAt = new Date(now - 1000).toISOString();
  try {
    await database.query('SELECT save_title($1)', [JSON.stringify(namesake)]);
    const freshResult = await verify({ q: 'Lucifer' });
    assert.equal(freshResult[3].title.id, namesake.id);
    namesake.popularityUpdatedAt = new Date(now - 8 * 86400000).toISOString();
    await database.query('SELECT save_title($1)', [JSON.stringify(namesake)]);
    const oldResult = await verify({ q: 'Lucifer' });
    assert.equal(oldResult[10].title.id, namesake.id);
  } finally {
    delete namesake.popularity;
    delete namesake.popularityUpdatedAt;
    await database.query('SELECT save_title($1)', [JSON.stringify(namesake)]);
  }
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      return Response.json(
        url.pathname.endsWith('/configuration')
          ? {
              images: {
                secure_base_url: 'https://image.tmdb.org/t/p/',
                poster_sizes: [],
                backdrop_sizes: [],
              },
            }
          : {
              id: 63174,
              name: 'Lucifer',
              vote_count: 16000,
              vote_average: 8.4,
              popularity: 72.5,
            },
      );
    };
    const title = await new TMDB(async () => true).title('tv', 63174);
    assert.equal(title.popularity, 72.5);
    assert(Date.parse(title.popularityUpdatedAt!) >= now);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

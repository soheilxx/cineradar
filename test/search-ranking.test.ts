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
import { fixtureCatalog, fixtureProviders } from './fixtures/catalog';
import { catalogCard } from '../domain/cards';

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

test('ID-first shelves preserve offer filters, exact totals, ranked prefixes and fallback pagination', async () => {
  const testRows = Array.from({ length: 7 }, (_, i) =>
    item(
      91000 + i,
      `Catalog test ${i}`,
      1000 + i * 200,
      i === 2 || i === 3 ? 'tv' : 'movie',
      2020 + i,
    ),
  );
  const [a, b, addon, abroad, expired, unavailable, duplicate] = testRows;
  a.title.runtime = 90;
  b.title.runtime = 120;
  b.title.genres = ['scifi'];
  const template = fixtureCatalog()[0].snapshot.offers[0];
  const offer = (
    row: CatalogItem,
    id: string,
    patch: Partial<typeof template> = {},
  ) => ({
    ...structuredClone(template),
    id,
    titleId: row.title.id,
    market: 'de',
    provider: fixtureProviders[0],
    type: 'subscription' as const,
    availableSince: new Date(now - 30 * 86400000).toISOString(),
    expiresOn: null,
    ...patch,
  });
  a.snapshot.offers = [
    offer(a, 'catalog-a'),
    offer(a, 'catalog-a-prime', { provider: fixtureProviders[1] }),
  ];
  b.snapshot.offers = [
    offer(b, 'catalog-b', {
      type: 'free',
      quality: '4k',
      audio: ['es'],
      subtitles: ['en'],
      availableSince: new Date(now - 86400000).toISOString(),
      expiresOn: new Date(now + 10 * 86400000).toISOString(),
    }),
  ];
  addon.snapshot.offers = [
    offer(addon, 'catalog-addon', {
      type: 'addon',
      provider: fixtureProviders[1],
      addon: { id: 'mubi', name: 'MUBI' },
    }),
  ];
  // The US-only offer is stored but must not leak into German discovery.
  abroad.snapshot.offers = [];
  expired.snapshot.offers = [
    offer(expired, 'catalog-expired', {
      expiresOn: new Date(now - 86400000).toISOString(),
    }),
  ];
  duplicate.snapshot.offers = [
    offer(duplicate, 'catalog-duplicate-1', {
      expiresOn: new Date(now + 3600000).toISOString(),
    }),
    offer(duplicate, 'catalog-duplicate-2', { season: 1 }),
  ];
  await database.exec('BEGIN');
  try {
    for (const market of ['de', 'us']) {
      await database.query(
        'INSERT INTO markets(code,supported) VALUES($1,true) ON CONFLICT DO NOTHING',
        [market],
      );
      for (const provider of fixtureProviders.slice(0, 2))
        await database.query(
          'INSERT INTO providers(market,id,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [market, provider.id, JSON.stringify(provider)],
        );
    }
    for (const row of testRows) {
      await database.query('SELECT save_title($1)', [
        JSON.stringify(row.title),
      ]);
      for (const market of ['de', 'us'])
        await database.query(
          "INSERT INTO snapshots(title_id,market,availability,checked_at) VALUES($1,$2,'available',now())",
          [row.title.id, market],
        );
      for (const entry of row.snapshot.offers)
        await database.query(
          'INSERT INTO offers(id,title_id,market,provider_id,data,expires_at) VALUES($1,$2,$3,$4,$5,$6)',
          [
            entry.id,
            row.title.id,
            entry.market,
            entry.provider.id,
            JSON.stringify(entry),
            entry.expiresOn,
          ],
        );
    }
    const us = offer(abroad, 'catalog-us', { market: 'us' });
    await database.query(
      'INSERT INTO offers(id,title_id,market,provider_id,data) VALUES($1,$2,$3,$4,$5)',
      [us.id, abroad.title.id, us.market, us.provider.id, JSON.stringify(us)],
    );
    const movieRanks = [
      a.title.id,
      expired.title.id,
      b.title.id,
      duplicate.title.id,
    ];
    const tvRanks = [abroad.title.id, addon.title.id];
    const combinedRanks = [
      a.title.id,
      abroad.title.id,
      expired.title.id,
      addon.title.id,
      b.title.id,
      duplicate.title.id,
    ];
    for (const order of ['popularity_1week', 'release_date'])
      for (const [type, ranking] of [
        ['movie', movieRanks],
        ['tv', tvRanks],
      ] as const)
        await database.query('INSERT INTO operations(key,data) VALUES($1,$2)', [
          `ranking:de:${type}:${order}:1`,
          JSON.stringify({ page: 1, ids: ranking }),
        ]);
    const filters: Filters[] = [
      { scope: 'finder' },
      { scope: 'finder', sort: 'year' },
      { scope: 'finder', type: 'movie', maxMinutes: 100 },
      { scope: 'free' },
      { scope: 'leaving' },
      { scope: 'new' },
      { provider: 'netflix' },
      {
        provider: 'netflix',
        offerType: 'free',
        quality: '4k',
        audio: 'es',
        subtitles: 'en',
      },
      { mine: ['prime:mubi'] },
      { scope: 'finder', genre: 'drama' },
      { scope: 'finder', year: unavailable.title.year! },
      { scope: 'finder', sort: 'trending' },
      { scope: 'finder', sort: 'latest' },
      { scope: 'finder', type: 'movie', sort: 'latest' },
      { scope: 'finder', provider: 'netflix', sort: 'trending' },
    ];
    for (const filter of filters) {
      const ranking = filter.type === 'movie' ? movieRanks : combinedRanks;
      const expected = filterCatalog(testRows, 'de', filter, now, ranking);
      for (const count of [true, false]) {
        const paged: CatalogItem[] = [];
        for (let page = 1; page <= 3; page++) {
          const actual = await loadCatalog(
            'de',
            'de',
            { ...filter, page },
            2,
            adapter,
            count,
          );
          assert.equal(actual.unavailable, false, JSON.stringify(filter));
          assert.deepEqual(
            ids(actual.items),
            ids(expected).slice((page - 1) * 2, page * 2),
            JSON.stringify({ filter, page, count }),
          );
          assert.equal(
            actual.total,
            count && actual.items.length ? expected.length : 0,
          );
          paged.push(...actual.items);
        }
        assert.equal(
          new Set(ids(paged)).size,
          paged.length,
          'Page boundaries never duplicate titles or duplicate offers',
        );
      }
    }
    const netflix = await loadCatalog(
      'de',
      'de',
      { provider: 'netflix' },
      24,
      adapter,
    );
    assert.equal(
      netflix.items.find((entry) => entry.title.id === a.title.id)?.snapshot
        .offers.length,
      2,
      'Enrichment still includes all active offers in the selected country',
    );
    const compact = await loadCatalog(
      'de',
      'de',
      { provider: 'netflix' },
      24,
      adapter,
      false,
    );
    assert.deepEqual(ids(compact.items), ids(netflix.items));
    for (const row of compact.items) {
      const complete = netflix.items.find(
        (entry) => entry.title.id === row.title.id,
      )!;
      assert.deepEqual(
        catalogCard(row, 'de').providers.toSorted((a, b) =>
          a.id.localeCompare(b.id),
        ),
        catalogCard(complete, 'de').providers.toSorted((a, b) =>
          a.id.localeCompare(b.id),
        ),
        'Compact shelf offers preserve every provider badge and its subscription/free priority',
      );
    }
    const compactDuplicate = compact.items.find(
      (entry) => entry.title.id === duplicate.title.id,
    )!;
    assert.equal(compactDuplicate.snapshot.offers.length, 1);
    assert.equal(
      compactDuplicate.snapshot.offers[0].expiresOn,
      null,
      'Keep the provider available for the longest known validity',
    );
    assert.equal(
      netflix.items.find((entry) => entry.title.id === duplicate.title.id)!
        .snapshot.offers.length,
      2,
      'Normal listings retain every offer',
    );
  } finally {
    await database.exec('ROLLBACK');
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

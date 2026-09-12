import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neonConfig } from '@neondatabase/serverless';
import {
  catalog,
  catalogShelves,
  providerStatus,
} from '../data/repositories/catalog';
import { fixtureCatalog, fixtureProviders } from './fixtures/catalog';

test('public catalog work is coalesced, private filters stay uncached, and artwork revocation is immediate', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = neonConfig.fetchFunction;
  Object.assign(process.env, {
    APP_MODE: 'live',
    DEPLOYMENT_ENV: 'local',
    SITE_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgres://unused:unused@catalog-cache.invalid/test',
    DATABASE_DRIVER: 'neon',
    TMDB_READ_ACCESS_TOKEN: 'unused',
    SAA_API_KEY: 'unused',
    SESSION_SECRET: 'x'.repeat(40),
    MEDIA_ENABLED: 'true',
  });
  const title = fixtureCatalog()[0].title;
  const queries: { query: string; params: unknown[] }[] = [];
  let withdrawn = false;
  let failProviders = false;
  const response = (rows: Record<string, unknown>[]) => {
    const names = Object.keys(rows[0] || {});
    return Response.json({
      fields: names.map((name) => ({
        name,
        dataTypeID: ['data', 'offers', 'variants'].includes(name) ? 3802 : 25,
      })),
      rows: rows.map((row) =>
        names.map((name) =>
          row[name] === null
            ? null
            : typeof row[name] === 'object'
              ? JSON.stringify(row[name])
              : typeof row[name] === 'string'
                ? row[name]
                : JSON.stringify(row[name]),
        ),
      ),
      command: 'SELECT',
      rowCount: rows.length,
    });
  };
  function execute(request: (typeof queries)[number]) {
    if (request.query.includes("set_config('statement_timeout'")) {
      assert.deepEqual(request.params, ['30000']);
      return response([{ set_config: '30000' }]);
    }
    queries.push(request);
    if (request.query.includes('FROM operations')) return response([]);
    if (request.query.includes('FROM providers')) {
      if (failProviders) return new Response('Unavailable', { status: 503 });
      return response([{ data: fixtureProviders[0] }]);
    }
    if (request.query.includes('FROM title_media'))
      return response(
        withdrawn
          ? [
              {
                titleId: title.id,
                kind: 'poster',
                source: title.poster,
                state: 'withdrawn',
                revision: null,
                variants: [],
                expiresAt: null,
              },
            ]
          : [],
      );
    assert(
      request.query.includes('FROM titles t'),
      'Unexpected database access',
    );
    return response([
      {
        data: title,
        availability: 'available',
        checked_at: new Date().toISOString(),
        attempt_at: null,
        error_code: null,
        revision: '1',
        offers: [],
        total: request.query.includes('count(*) OVER()') ? 42 : 0,
      },
    ]);
  }
  neonConfig.fetchFunction = async (
    _url: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    assert.equal(typeof init?.body, 'string');
    const payload = JSON.parse(init!.body as string) as
      | (typeof queries)[number]
      | { queries: typeof queries };
    if (!('queries' in payload)) return execute(payload);
    const results: unknown[] = [];
    for (const query of payload.queries) {
      const result = execute(query);
      if (!result.ok) return result;
      results.push(await result.json());
    }
    return Response.json({ results });
  };
  const count = (fragment: string) =>
    queries.filter((entry) => entry.query.includes(fragment)).length;
  try {
    const filters = ['netflix', 'prime', 'disney'].map((provider) => ({
      provider,
      scope: 'finder' as const,
      sort: 'trending' as const,
    }));
    const first = await catalogShelves('de', 'de', filters);
    assert.equal(first.length, 3);
    assert.equal(
      count('FROM operations'),
      1,
      'All provider shelves share a ranking query',
    );
    assert.equal(count('FROM titles t'), 3);
    assert.equal(
      count('FROM title_media'),
      1,
      'All shelf artwork is checked in one query',
    );
    assert.equal(
      count('count(*) OVER()'),
      3,
      'Selective provider shelves retain their efficient filtering plan',
    );
    assert.equal(first[0].items[0].title.poster, title.poster);
    withdrawn = true;
    const cached = await catalogShelves('de', 'de', filters);
    assert.equal(
      count('FROM titles t'),
      3,
      'Repeated shelves reuse public catalog data',
    );
    assert.equal(
      count('FROM title_media'),
      2,
      'Artwork remains fresh across catalog cache hits',
    );
    assert(cached.every((shelf) => shelf.items[0].title.poster === null));

    await catalogShelves('fr', 'de', filters);
    await catalogShelves('de', 'fr', filters);
    assert.equal(
      count('FROM titles t'),
      9,
      'Language and market have separate catalog entries',
    );
    assert.equal(
      count('FROM operations'),
      2,
      'Rankings are shared across languages, separated by market',
    );
    for (const filter of [
      { q: 'private search' },
      { mine: ['private-provider'] },
    ]) {
      const previous = count('FROM titles t');
      await catalog('de', 'de', filter);
      await catalog('de', 'de', filter);
      assert.equal(
        count('FROM titles t') - previous,
        2,
        'Personal queries never enter the public cache',
      );
    }
    const listing = await catalog('de', 'de', { type: 'movie', page: 2 });
    assert.equal(
      listing.total,
      42,
      'Paginated listings keep their exact total',
    );
    assert(count('count(*) OVER()') > 0);
    await Promise.all([providerStatus('de'), providerStatus('de')]);
    assert.equal(
      count('FROM providers'),
      1,
      'Concurrent provider reads are coalesced',
    );
    failProviders = true;
    assert.equal((await providerStatus('us')).unavailable, true);
    failProviders = false;
    assert.equal(
      (await providerStatus('us')).unavailable,
      false,
      'A transient error does not poison the provider cache',
    );
    const previousCounts = count('count(*) OVER()');
    await catalogShelves('de', 'de', [
      { scope: 'new', sort: 'latest' },
      { scope: 'finder', type: 'movie', sort: 'latest' },
    ]);
    assert.equal(
      count('count(*) OVER()'),
      previousCounts,
      'Release shelves skip the unnecessary total count',
    );
  } finally {
    neonConfig.fetchFunction = originalFetch;
    process.env = originalEnv;
  }
});

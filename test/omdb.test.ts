import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import type { Database } from '../data/db';
import { config } from '../lib/config';
import { OMDb, normalizeOmdb } from '../data/providers/omdb';
import { OmdbError } from '../domain/enrichment';
import {
  claimOmdb,
  failOmdb,
  finishOmdb,
  getEnrichment,
  registerOmdbTitles,
  reserveOmdbRequest,
} from '../data/repositories/enrichment';
import { runOmdbBatch } from '../jobs/omdb';
import { fixtureCatalog } from './fixtures/catalog';

const saved = { ...process.env };
const imdbId = 'tt1234567';
const payload = {
  Response: 'True',
  imdbID: imdbId,
  Type: 'movie',
  Title: 'A verified title',
  Plot: 'An English source plot.',
  Runtime: '121 min',
  Awards: '2 wins & 3 nominations.',
  Rated: 'PG-13',
  Director: 'First Director, Second Director',
  Writer: 'A Writer',
  Language: 'English, German',
  Country: 'United States, Germany',
  imdbRating: '7.8',
  imdbVotes: '123,456',
  Metascore: '81',
  Ratings: [
    { Source: 'Internet Movie Database', Value: '7.8/10' },
    { Source: 'Rotten Tomatoes', Value: '93%' },
    { Source: 'Metacritic', Value: '81/100' },
  ],
};
const normalized = normalizeOmdb(payload, imdbId, 'movie');
let pglite: PGlite;
let database: Database;

function restoreEnv() {
  for (const key of Object.keys(process.env))
    if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
}
function liveEnv() {
  restoreEnv();
  Object.assign(process.env, {
    APP_MODE: 'live',
    DEPLOYMENT_ENV: 'local',
    SITE_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgres://test',
    TMDB_READ_ACCESS_TOKEN: 'test',
    SESSION_SECRET: 'x'.repeat(32),
    SAA_ACCESS_MODE: 'direct',
    SAA_API_KEY: 'test',
    SYNC_ENABLED: 'false',
    OMDB_ENABLED: 'true',
    OMDB_COMMERCIAL_USE_CONFIRMED: 'true',
    OMDB_API_KEY: 'unit-test-key',
    OMDB_DAILY_BUDGET: '900',
  });
}
async function seed(
  id = 990000001,
  externalId: string | null = imdbId,
  type: 'movie' | 'tv' = 'movie',
) {
  const title = {
    ...fixtureCatalog()[0].title,
    id: `${type}:${id}`,
    tmdbId: id,
    type,
    externalIds: externalId ? { imdb: externalId } : {},
  };
  await database.query('SELECT save_title($1)', [JSON.stringify(title)]);
  return title;
}
const mockFetch =
  (data: unknown = payload): typeof fetch =>
  async () =>
    Response.json(data);

before(async () => {
  pglite = new PGlite({ extensions: { pg_trgm, unaccent } });
  for (const name of (await readdir('db/migrations')).sort())
    await pglite.exec(await readFile(`db/migrations/${name}`, 'utf8'));
  database = {
    query: async <T>(sql: string, params: unknown[] = []) => ({
      rows: (await pglite.query<T>(sql, params)).rows,
    }),
  };
});
beforeEach(async () => {
  liveEnv();
  await pglite.exec(
    'TRUNCATE omdb_enrichments,omdb_request_days; UPDATE omdb_control SET paused_until=null,error_code=null; DELETE FROM titles',
  );
});
after(async () => {
  restoreEnv();
  await pglite.close();
});

test('OMDb normalizes absent fields and source ratings without mixing TMDB data', () => {
  assert.equal(normalized.imdbVotes, 123456);
  assert.equal(normalized.runtimeMinutes, 121);
  assert.deepEqual(normalized.directors, ['First Director', 'Second Director']);
  assert.equal(normalized.ratings.length, 3);
  assert.equal(normalized.sourceUrl, 'https://www.omdbapi.com/');
  const missing = normalizeOmdb(
    {
      ...payload,
      Plot: ' N/A ',
      Runtime: 'N/A',
      Awards: 'N/A',
      imdbRating: 'N/A',
      imdbVotes: 'N/A',
      Metascore: 'N/A',
      Director: 'N/A',
      Ratings: [],
    },
    imdbId,
    'movie',
  );
  assert.equal(missing.plot, null);
  assert.equal(missing.runtimeMinutes, null);
  assert.equal(missing.awards, null);
  assert.equal(missing.imdbRating, null);
  assert.equal(missing.imdbVotes, null);
  assert.equal(missing.metascore, null);
  assert.deepEqual(missing.directors, []);
  assert.deepEqual(missing.ratings, []);
  const invalid = normalizeOmdb(
    {
      ...payload,
      imdbRating: '11',
      Metascore: '101',
      Ratings: [
        { Source: 'Rotten Tomatoes', Value: '150%' },
        { Source: 'Untrusted rating', Value: '10/10' },
      ],
    },
    imdbId,
    'movie',
  );
  assert.deepEqual(invalid.ratings, []);
});

test('OMDb rejects different IDs and episode/series/movie mismatches', () => {
  assert.equal(
    normalizeOmdb(
      { ...payload, imdbID: 'tt123456789012' },
      'tt123456789012',
      'movie',
    ).imdbId,
    'tt123456789012',
  );
  assert.throws(
    () =>
      normalizeOmdb(
        { ...payload, imdbID: 'tt1234567890123' },
        'tt1234567890123',
        'movie',
      ),
    { code: 'schema' },
  );
  assert.throws(() => normalizeOmdb(payload, 'tt7654321', 'movie'), {
    code: 'identity',
  });
  assert.throws(() => normalizeOmdb(payload, imdbId, 'tv'), {
    code: 'identity',
  });
  assert.throws(
    () => normalizeOmdb({ ...payload, Type: 'episode' }, imdbId, 'tv'),
    { code: 'identity' },
  );
  assert.equal(
    normalizeOmdb({ ...payload, Type: 'series' }, imdbId, 'tv').type,
    'tv',
  );
  assert.throws(() => normalizeOmdb({ Response: 'True' }, imdbId, 'movie'), {
    code: 'schema',
  });
});

test('Every OMDb enabling condition is required before DB work or network', async () => {
  const source = { ...process.env };
  let calls = 0;
  const forbidden = async () => {
    calls++;
    throw new Error('Unexpected operation');
  };
  for (const changed of [
    { OMDB_ENABLED: 'false' },
    { OMDB_COMMERCIAL_USE_CONFIRMED: 'false' },
    { OMDB_API_KEY: '' },
    { APP_MODE: 'fixture' },
    { APP_MODE: 'unconfigured' },
  ]) {
    Object.assign(process.env, source, changed);
    assert.equal(config().omdbEnabled, false);
    assert.equal(
      (
        await runOmdbBatch({
          database: { query: forbidden },
          fetcher: forbidden,
        })
      ).enabled,
      false,
    );
    assert.equal(await getEnrichment('movie:1', { query: forbidden }), null);
    await assert.rejects(
      new OMDb(forbidden, forbidden).title(imdbId, 'movie'),
      { code: 'disabled' },
    );
  }
  assert.equal(calls, 0);
});

test('OMDb requests HTTPS and exact IMDb/type only after a budget reservation', async () => {
  let reservations = 0;
  const adapter = new OMDb(
    async () => ({ allowed: ++reservations === 1 }),
    async (input, init) => {
      assert.equal(reservations, 1);
      const url = new URL(input instanceof Request ? input.url : input);
      assert.equal(url.origin, 'https://www.omdbapi.com');
      assert.equal(url.searchParams.get('i'), imdbId);
      assert.equal(url.searchParams.get('type'), 'series');
      assert.equal(url.searchParams.get('plot'), 'full');
      assert.equal(url.searchParams.has('t'), false);
      assert.equal(url.searchParams.has('s'), false);
      assert.equal(init?.redirect, 'error');
      assert.equal(init?.cache, 'no-store');
      assert.ok(init?.signal);
      return Response.json({ ...payload, Type: 'series' });
    },
  );
  assert.equal((await adapter.title(imdbId, 'tv')).type, 'tv');
  await assert.rejects(adapter.title(imdbId, 'tv'), { code: 'budget' });
  await assert.rejects(adapter.title('../search', 'movie'), {
    code: 'identity',
  });
  assert.equal(reservations, 2);
});

test('HTTP-200 OMDb errors and HTTP failures expose only safe error codes', async () => {
  for (const [error, code] of [
    ['Invalid API key: unit-test-key', 'auth'],
    ['Request limit reached!', 'quota'],
    ['Movie not found!', 'missing'],
    ['Unknown failure with unit-test-key', 'upstream'],
  ]) {
    await assert.rejects(
      new OMDb(
        async () => ({ allowed: true }),
        mockFetch({ Response: 'False', Error: error }),
      ).title(imdbId, 'movie'),
      (failure: unknown) => {
        assert.ok(failure instanceof OmdbError);
        assert.equal(failure.code, code);
        assert.equal(String(failure).includes('unit-test-key'), false);
        return true;
      },
    );
  }
  await assert.rejects(
    new OMDb(
      async () => ({ allowed: true }),
      async () =>
        new Response('', { status: 429, headers: { 'retry-after': '1200' } }),
    ).title(imdbId, 'movie'),
    { code: 'quota', retryAfter: 1200000 },
  );
  await assert.rejects(
    new OMDb(
      async () => ({ allowed: true }),
      async () => {
        throw new Error('https://www.omdbapi.com/?apikey=unit-test-key');
      },
    ).title(imdbId, 'movie'),
    { code: 'network', message: 'network' },
  );
  await assert.rejects(
    new OMDb(
      async () => ({ allowed: true }),
      async () => {
        throw new DOMException('unit-test-key', 'TimeoutError');
      },
    ).title(imdbId, 'movie'),
    { code: 'timeout', message: 'timeout' },
  );
});

test('OMDb bounds JSON response size and rejects invalid payloads', async () => {
  for (const response of [
    () => new Response('x'.repeat(262145)),
    () => new Response('{}', { headers: { 'content-length': '262145' } }),
    () => new Response('<html>upstream failure</html>'),
    () => Response.json({ ...payload, imdbID: 'tt7654321' }),
  ]) {
    await assert.rejects(
      new OMDb(
        async () => ({ allowed: true }),
        async () => response(),
      ).title(imdbId, 'movie'),
      (error: unknown) =>
        error instanceof OmdbError &&
        ['schema', 'identity'].includes(error.code),
    );
  }
});

test('OMDb batch persists source data once without modifying title, editorial text or availability', async () => {
  const title = await seed();
  await seed(990000002, null);
  await seed(990000003, 'invalid-imdb');
  await database.query(
    "UPDATE localizations SET overview='Reviewed editorial text',source='editorial' WHERE title_id=$1 AND locale='de'",
    [title.id],
  );
  const titleBefore = await database.query(
    'SELECT data,revision FROM titles WHERE id=$1',
    [title.id],
  );
  const localesBefore = await database.query(
    'SELECT * FROM localizations WHERE title_id=$1 ORDER BY locale',
    [title.id],
  );
  const offersBefore = await database.query('SELECT * FROM offers');
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return Response.json(payload);
  };
  const first = await runOmdbBatch({ database, maxJobs: 5, fetcher });
  assert.equal(first.registered, 1);
  assert.equal(first.completed, 1);
  assert.equal(
    (await runOmdbBatch({ database, maxJobs: 5, fetcher })).completed,
    0,
  );
  assert.equal(calls, 1);
  assert.deepEqual(
    await database.query('SELECT data,revision FROM titles WHERE id=$1', [
      title.id,
    ]),
    titleBefore,
  );
  assert.deepEqual(
    await database.query(
      'SELECT * FROM localizations WHERE title_id=$1 ORDER BY locale',
      [title.id],
    ),
    localesBefore,
  );
  assert.deepEqual(await database.query('SELECT * FROM offers'), offersBefore);
  const enriched = await getEnrichment(title.id, database);
  assert.equal(enriched?.imdbId, imdbId);
  assert.equal(enriched?.stale, false);
  assert.equal(
    Date.parse(enriched!.expiresAt) - Date.parse(enriched!.fetchedAt),
    30 * 86400000,
  );
  assert.equal(
    (
      await database.query<{ consumed: number }>(
        'SELECT consumed FROM omdb_request_days',
      )
    ).rows[0].consumed,
    1,
  );
});

test('Failed refresh preserves the last good source data and marks its age', async () => {
  const title = await seed();
  await runOmdbBatch({ database, maxJobs: 1, fetcher: mockFetch() });
  await database.query(
    "UPDATE omdb_enrichments SET fetched_at=now()-interval '31 days',expires_at=now()-interval '1 day',run_at=now()-interval '1 day'",
  );
  const before = await getEnrichment(title.id, database);
  assert.equal(before?.stale, true);
  const failed = await runOmdbBatch({
    database,
    maxJobs: 1,
    fetcher: async () => new Response('', { status: 503 }),
  });
  assert.equal(failed.failed, 1);
  assert.deepEqual(await getEnrichment(title.id, database), before);
  const state = (
    await database.query<{
      state: string;
      error_code: string;
      delayed: boolean;
    }>('SELECT state,error_code,run_at>now() AS delayed FROM omdb_enrichments')
  ).rows[0];
  assert.deepEqual(state, {
    state: 'queued',
    error_code: 'upstream',
    delayed: true,
  });
});

test('Identity changes hide old data, reject an in-flight result and schedule the new exact ID', async () => {
  const title = await seed();
  await runOmdbBatch({ database, maxJobs: 1, fetcher: mockFetch() });
  await database.query(
    "UPDATE omdb_enrichments SET state='queued',run_at=now()",
  );
  const job = (await claimOmdb(database))!;
  await database.query(
    "UPDATE titles SET data=jsonb_set(data,'{externalIds,imdb}','\"tt7654321\"') WHERE id=$1",
    [title.id],
  );
  assert.equal(await finishOmdb(job, normalized, database), false);
  assert.equal(await getEnrichment(title.id, database), null);
  await registerOmdbTitles(database);
  const replacement = (await claimOmdb(database))!;
  assert.equal(replacement.imdb_id, 'tt7654321');
  assert.equal(await finishOmdb(job, normalized, database), false);
  const changed = normalizeOmdb(
    { ...payload, imdbID: 'tt7654321' },
    'tt7654321',
    'movie',
  );
  assert.equal(await finishOmdb(replacement, changed, database), true);
  assert.equal((await getEnrichment(title.id, database))?.imdbId, 'tt7654321');
  await database.query(
    "UPDATE titles SET data=data-'externalIds' WHERE id=$1",
    [title.id],
  );
  assert.equal(await getEnrichment(title.id, database), null);
});

test('Atomic OMDb daily budget cannot overspend and resets at UTC midnight', async () => {
  const paused = await reserveOmdbRequest(database, 0);
  assert.equal(paused.allowed, false);
  assert.ok(paused.retryAfter! > 0);
  await database.query('DELETE FROM omdb_request_days');
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      database.query<{ retry_after: number | string }>(
        "SELECT reserve_omdb_request(5,'2026-09-12T23:59:59Z') AS retry_after",
      ),
    ),
  );
  assert.equal(
    results.filter((result) => Number(result.rows[0].retry_after) === 0).length,
    5,
  );
  assert.equal(
    results.filter((result) => Number(result.rows[0].retry_after) === 1000)
      .length,
    15,
  );
  assert.equal(
    Number(
      (
        await database.query<{ retry_after: number | string }>(
          "SELECT reserve_omdb_request(5,'2026-09-13T00:00:00Z') AS retry_after",
        )
      ).rows[0].retry_after,
    ),
    0,
  );
  assert.deepEqual(
    (
      await database.query<{ consumed: number }>(
        'SELECT consumed FROM omdb_request_days ORDER BY day',
      )
    ).rows.map((row) => row.consumed),
    [5, 1],
  );
});

test('Concurrent workers claim different jobs, recover expired leases and fence old commits', async () => {
  await seed();
  await seed(990000002, 'tt7654321');
  await registerOmdbTitles(database);
  const jobs = await Promise.all([claimOmdb(database), claimOmdb(database)]);
  assert.ok(jobs[0] && jobs[1]);
  assert.notEqual(jobs[0].title_id, jobs[1].title_id);
  assert.equal(await claimOmdb(database), null);
  const old = jobs.find((job) => job?.imdb_id === imdbId)!;
  await database.query(
    "UPDATE omdb_enrichments SET lock_until=now()-interval '1 second' WHERE title_id=$1",
    [old.title_id],
  );
  const replacement = (await claimOmdb(database))!;
  assert.equal(replacement.title_id, old.title_id);
  assert.notEqual(replacement.lock_token, old.lock_token);
  assert.equal(await finishOmdb(old, normalized, database), false);
  assert.equal(await failOmdb(old, 'upstream', 0, database), false);
  assert.equal(await finishOmdb(replacement, normalized, database), true);
});

test('429 stops the batch and creates durable backoff for every worker', async () => {
  await seed();
  await seed(990000002, 'tt7654321');
  let calls = 0;
  const result = await runOmdbBatch({
    database,
    maxJobs: 10,
    fetcher: async () => {
      calls++;
      return new Response('', {
        status: 429,
        headers: { 'retry-after': '1800' },
      });
    },
  });
  assert.equal(result.failed, 1);
  assert.equal(calls, 1);
  assert.equal(await claimOmdb(database), null);
  const allowance = await reserveOmdbRequest(database);
  assert.equal(allowance.allowed, false);
  assert.ok(allowance.retryAfter! > 1700000);
  const next = await runOmdbBatch({
    database,
    maxJobs: 10,
    fetcher: async () => {
      calls++;
      return Response.json(payload);
    },
  });
  assert.equal(next.completed, 0);
  assert.equal(calls, 1);
});

test('Budget exhaustion defers work without a network request or consuming attempts', async () => {
  const title = await seed();
  process.env.OMDB_DAILY_BUDGET = '1';
  assert.equal((await reserveOmdbRequest(database, 1)).allowed, true);
  let calls = 0;
  const result = await runOmdbBatch({
    database,
    fetcher: async () => {
      calls++;
      return Response.json(payload);
    },
  });
  assert.equal(result.deferred, 1);
  assert.equal(calls, 0);
  const row = (
    await database.query<{ attempts: number; delayed: boolean; data: unknown }>(
      'SELECT attempts,run_at>now() AS delayed,data FROM omdb_enrichments WHERE title_id=$1',
      [title.id],
    )
  ).rows[0];
  assert.deepEqual(row, { attempts: 0, delayed: true, data: null });
});

test('A missing OMDb match retries in 30 days and preserves any earlier valid record', async () => {
  const title = await seed();
  await runOmdbBatch({ database, maxJobs: 1, fetcher: mockFetch() });
  const before = await getEnrichment(title.id, database);
  await database.query(
    "UPDATE omdb_enrichments SET state='queued',run_at=now()",
  );
  const result = await runOmdbBatch({
    database,
    maxJobs: 1,
    fetcher: mockFetch({ Response: 'False', Error: 'Movie not found!' }),
  });
  assert.equal(result.failed, 1);
  assert.deepEqual(await getEnrichment(title.id, database), before);
  assert.equal(
    (
      await database.query<{ state: string; delayed: boolean }>(
        "SELECT state,run_at>now()+interval '29 days' AS delayed FROM omdb_enrichments",
      )
    ).rows[0].delayed,
    true,
  );
  assert.equal(await claimOmdb(database), null);
});

test('Read path performs no provider request and short batches do not start work', async () => {
  const title = await seed();
  const calls: string[] = [];
  const readDatabase: Database = {
    query: async <T>(sql: string, params?: unknown[]) => {
      calls.push(sql);
      return database.query<T>(sql, params);
    },
  };
  assert.equal(await getEnrichment(title.id, readDatabase), null);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith('SELECT '));
  const forbidden: Database = {
    query: async () => {
      throw new Error('Batch should not start');
    },
  };
  assert.equal(
    (await runOmdbBatch({ database: forbidden, maxDurationMs: 100 }))
      .registered,
    0,
  );
  assert.equal(
    (await runOmdbBatch({ database: forbidden, maxJobs: 0 })).registered,
    0,
  );
});

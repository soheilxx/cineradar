import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import type { Database } from '../data/db';
import type { MediaType, Title } from '../domain/types';
import { TMDB, normalizeExternalIds } from '../data/providers/tmdb';
import { ProviderError } from '../data/providers/http';
import { runProviderDiscovery } from '../jobs/provider-discovery';
import { fixtureCatalog } from './fixtures/catalog';

const saved = { ...process.env };
let pglite: PGlite;
let database: Database;
type DiscoveryProvider = Pick<TMDB, 'externalIds' | 'findSeries'>;
const provider = (
  overrides: Partial<DiscoveryProvider> = {},
): DiscoveryProvider => ({
  externalIds: async () => ({ imdb: 'tt1234567', tvdb: 101 }),
  findSeries: async () => 900001,
  ...overrides,
});
function restoreEnv() {
  for (const key of Object.keys(process.env))
    if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
}
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
  restoreEnv();
  Object.assign(process.env, {
    APP_MODE: 'live',
    DEPLOYMENT_ENV: 'local',
    SITE_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgres://must-not-connect',
    TMDB_READ_ACCESS_TOKEN: 'test',
    SESSION_SECRET: 'x'.repeat(32),
    SAA_ACCESS_MODE: 'direct',
    SAA_API_KEY: 'test',
    SYNC_ENABLED: 'false',
    TVMAZE_ENABLED: 'true',
    OMDB_ENABLED: 'false',
    TMDB_DAILY_BUDGET: '500',
  });
  await pglite.exec(
    'DELETE FROM titles; TRUNCATE tvmaze_shows CASCADE; TRUNCATE jobs,operations,budgets,budget_reservations',
  );
});
after(async () => {
  restoreEnv();
  await pglite.close();
});
async function seedTitle(id = 990000001, extra: Partial<Title> = {}) {
  const title = {
    ...fixtureCatalog()[0].title,
    id: `tv:${id}`,
    tmdbId: id,
    type: 'tv' as const,
    ...extra,
  };
  delete title.externalIdsCheckedAt;
  await database.query('SELECT save_title($1)', [JSON.stringify(title)]);
  return title;
}
async function seedShow(
  id = 1,
  imdb: string | null = 'tt1234567',
  tvdb: number | null = null,
) {
  await database.query(
    `INSERT INTO tvmaze_shows(id,imdb_id,tvdb_id,data,source_updated,source_url)
    VALUES($1,$2,$3,$4,1,$5)`,
    [
      id,
      imdb,
      tvdb,
      JSON.stringify({ id, name: `Show ${id}` }),
      `https://www.tvmaze.com/shows/${id}`,
    ],
  );
}
async function storedTitle(id: string) {
  return (
    await database.query<{ data: Title }>(
      'SELECT data FROM titles WHERE id=$1',
      [id],
    )
  ).rows[0]?.data;
}
async function checkedShow(id = 1) {
  return (
    await database.query<{ discovery_checked_at: Date | string | null }>(
      'SELECT discovery_checked_at FROM tvmaze_shows WHERE id=$1',
      [id],
    )
  ).rows[0]?.discovery_checked_at;
}

test('Discovery disabling and zero, invalid or too-short limits perform no work', async () => {
  const forbidden: Database = {
    query: async () => {
      throw new Error('Unexpected database work');
    },
  };
  const tmdb = provider({
    findSeries: async () => {
      throw new Error('Unexpected network');
    },
  });
  for (const limits of [
    { maxTitles: 0, maxDiscoveries: 0 },
    { maxTitles: 0, maxDiscoveries: 0.9 },
    { maxTitles: Number.NaN, maxDiscoveries: 0 },
    { maxTitles: -10, maxDiscoveries: -1 },
    { maxDurationMs: 11000 },
    { maxDurationMs: Number.POSITIVE_INFINITY },
    { maxDurationMs: Number.NaN },
  ])
    assert.equal(
      (await runProviderDiscovery({ database: forbidden, tmdb, ...limits }))
        .queued,
      0,
    );
  process.env.TVMAZE_ENABLED = 'false';
  assert.equal(
    (await runProviderDiscovery({ database: forbidden, tmdb })).enabled,
    false,
  );
});

test('Identifier backfill removes obsolete source IDs, preserves other metadata and runs once', async () => {
  const title = await seedTitle(990000001, {
    externalIds: { imdb: 'tt7654321', tvdb: 8, tvmaze: 9 },
  });
  const result = await runProviderDiscovery({
    database,
    maxDiscoveries: 0,
    tmdb: provider({ externalIds: async () => ({}) }),
  });
  assert.equal(result.error, null);
  assert.equal(result.identifiers, 1);
  const after = await storedTitle(title.id);
  assert.deepEqual(after.externalIds, { tvmaze: 9 });
  assert.ok(after.externalIdsCheckedAt);
  assert.equal(after.revision, title.revision);
  assert.deepEqual(after.localizations, title.localizations);
  assert.equal(after.rating, title.rating);
  assert.equal(
    (
      await runProviderDiscovery({
        database,
        maxDiscoveries: 0,
        tmdb: provider(),
      })
    ).identifiers,
    0,
  );
});

test('A missing lookup leaves its data unchecked while other titles can progress', async () => {
  const first = await seedTitle();
  const second = await seedTitle(990000002);
  const result = await runProviderDiscovery({
    database,
    maxDiscoveries: 0,
    tmdb: provider({
      externalIds: async (_type, id) => {
        if (id === first.tmdbId) throw new ProviderError('missing');
        return { imdb: 'tt1234567' };
      },
    }),
  });
  assert.equal(result.error, 'missing');
  assert.equal(result.identifiers, 1);
  assert.equal((await storedTitle(first.id)).externalIdsCheckedAt, undefined);
  assert.ok((await storedTitle(second.id)).externalIdsCheckedAt);
});

test('Quota failure stops the batch and releases its lease without marking success', async () => {
  const title = await seedTitle();
  await seedTitle(990000002);
  let calls = 0;
  const result = await runProviderDiscovery({
    database,
    tmdb: provider({
      externalIds: async () => {
        calls++;
        throw new ProviderError('budget');
      },
    }),
  });
  assert.equal(result.error, 'budget');
  assert.equal(calls, 1);
  assert.equal((await storedTitle(title.id)).externalIdsCheckedAt, undefined);
  assert.equal(
    (
      await database.query<{ locked: boolean }>(
        "SELECT data ? 'token' AS locked FROM operations WHERE key='provider-discovery'",
      )
    ).rows[0].locked,
    false,
  );
});

test('Identifier backfill cannot overwrite a newer concurrent title import', async () => {
  const title = await seedTitle();
  const result = await runProviderDiscovery({
    database,
    maxDiscoveries: 0,
    tmdb: provider({
      externalIds: async () => {
        await database.query(
          `UPDATE titles SET data=jsonb_set(jsonb_set(data,'{externalIds}',$2::jsonb),'{externalIdsCheckedAt}','"newer-import"') WHERE id=$1`,
          [title.id, JSON.stringify({ imdb: 'tt7654321', tvdb: 19 })],
        );
        return { imdb: 'tt1234567' };
      },
    }),
  });
  assert.equal(result.identifiers, 0);
  assert.deepEqual((await storedTitle(title.id)).externalIds, {
    imdb: 'tt7654321',
    tvdb: 19,
  });
});

test('Overlapping discovery runs cannot share a lease or duplicate API work', async () => {
  await seedTitle();
  let outerCalls = 0,
    innerCalls = 0;
  const result = await runProviderDiscovery({
    database,
    maxDiscoveries: 0,
    tmdb: provider({
      externalIds: async () => {
        outerCalls++;
        const overlapping = await runProviderDiscovery({
          database,
          maxDiscoveries: 0,
          tmdb: provider({
            externalIds: async () => {
              innerCalls++;
              return {};
            },
          }),
        });
        assert.equal(overlapping.identifiers, 0);
        return { imdb: 'tt1234567' };
      },
    }),
  });
  assert.equal(result.identifiers, 1);
  assert.equal(outerCalls, 1);
  assert.equal(innerCalls, 0);
});

test('A replaced or expired discovery lease prevents stale writes and further requests', async () => {
  for (const replace of [true, false]) {
    await database.query('DELETE FROM operations');
    await database.query('DELETE FROM titles');
    const title = await seedTitle();
    await seedTitle(990000002);
    let calls = 0;
    const result = await runProviderDiscovery({
      database,
      maxDiscoveries: 0,
      tmdb: provider({
        externalIds: async () => {
          calls++;
          await database.query(
            replace
              ? "UPDATE operations SET data=jsonb_build_object('token','replacement','until',now()+interval '2 minutes') WHERE key='provider-discovery'"
              : "UPDATE operations SET data=jsonb_set(data,'{until}',to_jsonb((now()-interval '1 second')::text)) WHERE key='provider-discovery'",
          );
          return { imdb: 'tt1234567' };
        },
      }),
    });
    assert.equal(result.identifiers, 0);
    assert.equal(calls, 1);
    assert.equal((await storedTitle(title.id)).externalIdsCheckedAt, undefined);
    if (replace)
      assert.equal(
        (
          await database.query<{ token: string }>(
            "SELECT data->>'token' AS token FROM operations WHERE key='provider-discovery'",
          )
        ).rows[0].token,
        'replacement',
      );
  }
});

test('Source discoveries enqueue one import per TMDB title, respect existing work and retry dead jobs', async () => {
  await seedShow(1, 'tt1234567');
  await seedShow(2, 'tt7654321');
  let calls = 0;
  const tmdb = provider({
    findSeries: async () => {
      calls++;
      return 900001;
    },
  });
  const first = await runProviderDiscovery({
    database,
    maxTitles: 0,
    maxDiscoveries: 10,
    tmdb,
  });
  assert.equal(first.error, null);
  assert.equal(first.discovered, 2);
  assert.equal(first.queued, 1);
  const job = (
    await database.query<{ key: string; payload: unknown; priority: number }>(
      'SELECT key,payload,priority FROM jobs',
    )
  ).rows[0];
  assert.equal(job.key, 'tvmaze-import:tv:900001');
  assert.deepEqual(job.payload, { type: 'tv', id: 900001, source: 'tvmaze' });
  assert.equal(job.priority, 55);
  assert.equal(
    (await runProviderDiscovery({ database, maxTitles: 0, tmdb })).queued,
    0,
  );
  assert.equal(calls, 2);
  await database.query(
    "UPDATE tvmaze_shows SET discovery_checked_at=now()-interval '31 days'",
  );
  assert.equal(
    (await runProviderDiscovery({ database, maxTitles: 0, tmdb })).queued,
    0,
  );
  await database.query(
    "UPDATE tvmaze_shows SET discovery_checked_at=now()-interval '31 days'",
  );
  await database.query(
    "UPDATE jobs SET state='dead',attempts=6,error_code='upstream'",
  );
  assert.equal(
    (await runProviderDiscovery({ database, maxTitles: 0, tmdb })).queued,
    1,
  );
  assert.equal(
    (await database.query<{ attempts: number }>('SELECT attempts FROM jobs'))
      .rows[0].attempts,
    0,
  );
});

test('Discovery skips imported titles and imports already queued by another source', async () => {
  await seedTitle(900001);
  await seedShow(1, 'tt1234567');
  await seedShow(2, 'tt7654321');
  await database.query(
    'INSERT INTO jobs(key,kind,payload) VALUES(\'search-import\',\'import\',\'{"type":"tv","id":900002}\')',
  );
  const result = await runProviderDiscovery({
    database,
    maxTitles: 0,
    maxDiscoveries: 10,
    tmdb: provider({
      findSeries: async (id) => (id === 'tt1234567' ? 900001 : 900002),
    }),
  });
  assert.equal(result.discovered, 2);
  assert.equal(result.queued, 0);
  assert.equal((await database.query('SELECT id FROM jobs')).rows.length, 1);
});

test('A queue write failure rolls back the source discovery checkpoint', async () => {
  await seedShow();
  await database.query(
    "ALTER TABLE jobs ADD CONSTRAINT reject_discovery_test CHECK(payload->>'source' IS DISTINCT FROM 'tvmaze')",
  );
  try {
    const result = await runProviderDiscovery({
      database,
      maxTitles: 0,
      tmdb: provider(),
    });
    assert.equal(result.error, 'discovery_failed');
    assert.equal(await checkedShow(), null);
    assert.equal((await database.query('SELECT id FROM jobs')).rows.length, 0);
  } finally {
    await database.query(
      'ALTER TABLE jobs DROP CONSTRAINT reject_discovery_test',
    );
  }
  assert.equal(
    (await runProviderDiscovery({ database, maxTitles: 0, tmdb: provider() }))
      .queued,
    1,
  );
});

test('Changed TVmaze identity or lost lease cannot checkpoint or enqueue a stale result', async () => {
  await seedShow();
  const changed = await runProviderDiscovery({
    database,
    maxTitles: 0,
    tmdb: provider({
      findSeries: async () => {
        await database.query(
          "UPDATE tvmaze_shows SET imdb_id='tt7654321' WHERE id=1",
        );
        return 900001;
      },
    }),
  });
  assert.equal(changed.queued, 0);
  assert.equal(await checkedShow(), null);
  const lost = await runProviderDiscovery({
    database,
    maxTitles: 0,
    tmdb: provider({
      findSeries: async () => {
        await database.query(
          "UPDATE operations SET data=jsonb_build_object('token','replacement','until',now()+interval '2 minutes') WHERE key='provider-discovery'",
        );
        return 900001;
      },
    }),
  });
  assert.equal(lost.queued, 0);
  assert.equal(await checkedShow(), null);
});

test('Empty lookup results are cached for 30 days; failed lookups remain retryable', async () => {
  await seedShow();
  const failed = await runProviderDiscovery({
    database,
    maxTitles: 0,
    tmdb: provider({
      findSeries: async () => {
        throw new ProviderError('network');
      },
    }),
  });
  assert.equal(failed.error, 'network');
  assert.equal(await checkedShow(), null);
  const absent = await runProviderDiscovery({
    database,
    maxTitles: 0,
    tmdb: provider({ findSeries: async () => null }),
  });
  assert.equal(absent.discovered, 0);
  assert.equal(absent.queued, 0);
  assert.ok(await checkedShow());
  let calls = 0;
  await runProviderDiscovery({
    database,
    maxTitles: 0,
    tmdb: provider({
      findSeries: async () => {
        calls++;
        return 1;
      },
    }),
  });
  assert.equal(calls, 0);
});

test('Malformed source identifiers and returned IDs never become import jobs', async () => {
  await seedShow(1, 'invalid-imdb', -1);
  await seedShow(2, null, 77);
  const calls: unknown[][] = [];
  const invalid = await runProviderDiscovery({
    database,
    maxTitles: 0,
    maxDiscoveries: 10,
    tmdb: provider({
      findSeries: async (...args) => {
        calls.push(args);
        return Number.MAX_SAFE_INTEGER + 1;
      },
    }),
  });
  assert.equal(invalid.error, 'schema');
  assert.deepEqual(calls, [['77', 'tvdb_id']]);
  assert.equal((await database.query('SELECT id FROM jobs')).rows.length, 0);
  assert.equal(await checkedShow(2), null);
});

test('Fractional bounds are floored and a deadline stops before another provider request', async (t) => {
  await seedTitle();
  await seedTitle(990000002);
  const limited = await runProviderDiscovery({
    database,
    maxTitles: 1.9,
    maxDiscoveries: 0,
    tmdb: provider(),
  });
  assert.equal(limited.identifiers, 1);
  await database.query("UPDATE titles SET data=data-'externalIdsCheckedAt'");
  let now = Date.now(),
    calls = 0;
  t.mock.method(Date, 'now', () => now);
  const timed = await runProviderDiscovery({
    database,
    maxDurationMs: 20000,
    maxDiscoveries: 0,
    tmdb: provider({
      externalIds: async () => {
        calls++;
        now += 9001;
        return { imdb: 'tt1234567' };
      },
    }),
  });
  assert.equal(timed.identifiers, 1);
  assert.equal(calls, 1);
});

test('Default TMDB provider reserves budget in the injected discovery database', async (t) => {
  process.env.TMDB_DAILY_BUDGET = '1';
  await seedTitle();
  await seedTitle(990000002);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (input: URL | Request | string) => {
    calls++;
    const url = new URL(input instanceof Request ? input.url : input);
    return Response.json({
      id: Number(url.pathname.split('/').at(-2)),
      imdb_id: 'tt1234567',
      tvdb_id: null,
    });
  });
  const result = await runProviderDiscovery({ database, maxDiscoveries: 0 });
  assert.equal(result.identifiers, 1);
  assert.equal(result.error, 'budget');
  assert.equal(calls, 1);
  assert.deepEqual(
    (
      await database.query<{ service: string; consumed: number | string }>(
        'SELECT service,consumed FROM budgets ORDER BY period',
      )
    ).rows.map((row) => [row.service, Number(row.consumed)]),
    [
      ['tmdb', 1],
      ['tmdb', 1],
    ],
  );
});

test('TMDB normalization accepts only usable exact external identifiers', () => {
  assert.deepEqual(
    normalizeExternalIds({ imdb_id: 'tt123456789012', tvdb_id: 12 }),
    { imdb: 'tt123456789012', tvdb: 12 },
  );
  for (const tvdb_id of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])
    assert.deepEqual(normalizeExternalIds({ imdb_id: 'N/A', tvdb_id }), {});
  assert.deepEqual(normalizeExternalIds({ imdb_id: null, tvdb_id: null }), {});
});

test('TMDB externalIds and findSeries validate inputs before spending and reject mismatched responses', async (t) => {
  let reservations = 0,
    calls = 0;
  const tmdb = new TMDB(async () => {
    reservations++;
    return true;
  });
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ id: 99, imdb_id: 'tt1234567' });
  });
  for (const id of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(tmdb.externalIds('tv', id), { code: 'schema' });
    await assert.rejects(tmdb.title('movie', id), { code: 'schema' });
  }
  await assert.rejects(tmdb.externalIds('person' as MediaType, 1), {
    code: 'schema',
  });
  await assert.rejects(tmdb.findSeries('123', 'invalid' as 'tvdb_id'), {
    code: 'schema',
  });
  for (const id of ['../other', '0', '-1', '1.5', '9007199254740992'])
    await assert.rejects(tmdb.findSeries(id, 'tvdb_id'), { code: 'schema' });
  assert.equal(reservations, 0);
  assert.equal(calls, 0);
  await assert.rejects(tmdb.externalIds('tv', 1), { code: 'schema' });
  assert.equal(calls, 1);
});

test('TMDB findSeries accepts one TV match and rejects ambiguous or unsafe results', async (t) => {
  let response: unknown = { tv_results: [] };
  const paths: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: URL | Request | string) => {
    const url = new URL(input instanceof Request ? input.url : input);
    paths.push(url.pathname + url.search);
    return Response.json(response);
  });
  const tmdb = new TMDB(async () => true);
  assert.equal(await tmdb.findSeries('tt1234567', 'imdb_id'), null);
  response = { tv_results: [{ id: 12 }, { id: 13 }] };
  assert.equal(await tmdb.findSeries('tt1234567', 'imdb_id'), null);
  response = { tv_results: [{ id: 12 }], movie_results: [{ id: 18 }] };
  assert.equal(await tmdb.findSeries('78', 'tvdb_id'), 12);
  assert.ok(paths.includes('/3/find/78?external_source=tvdb_id'));
  response = { tv_results: [{ id: Number.MAX_SAFE_INTEGER + 1 }] };
  await assert.rejects(tmdb.findSeries('tt1234567', 'imdb_id'), {
    code: 'schema',
  });
});

test('TMDB preserves earlier IDs when appended metadata is absent and clears them only when supplied empty', async (t) => {
  let append: Record<string, unknown> | undefined;
  t.mock.method(globalThis, 'fetch', async (input: URL | Request | string) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname.endsWith('/configuration'))
      return Response.json({
        images: {
          secure_base_url: 'https://image.tmdb.org/t/p/',
          poster_sizes: ['w500'],
          backdrop_sizes: ['w1280'],
        },
      });
    assert.equal(
      url.searchParams.get('append_to_response'),
      'credits,external_ids',
    );
    return Response.json({
      id: 12,
      title: 'Source title',
      original_title: 'Source title',
      overview: 'Source plot',
      ...(append === undefined ? {} : { external_ids: append }),
    });
  });
  const previous: Title = {
    ...fixtureCatalog()[0].title,
    externalIds: { imdb: 'tt1234567', tvdb: 17, tvmaze: 9 },
    externalIdsCheckedAt: '2026-01-01T00:00:00.000Z',
  };
  const missing = await new TMDB(async () => true).title('movie', 12, previous);
  assert.deepEqual(missing.externalIds, previous.externalIds);
  assert.equal(missing.externalIdsCheckedAt, previous.externalIdsCheckedAt);
  const newMissing = await new TMDB(async () => true).title('movie', 12);
  assert.equal(newMissing.externalIdsCheckedAt, undefined);
  append = {};
  const empty = await new TMDB(async () => true).title('movie', 12, previous);
  assert.deepEqual(empty.externalIds, { tvmaze: 9 });
  assert.notEqual(empty.externalIdsCheckedAt, previous.externalIdsCheckedAt);
  append = { imdb_id: 'tt7654321', tvdb_id: 19 };
  const changed = await new TMDB(async () => true).title('movie', 12, previous);
  assert.deepEqual(changed.externalIds, {
    imdb: 'tt7654321',
    tvdb: 19,
    tvmaze: 9,
  });
});

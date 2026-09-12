import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from '../data/db';
import { ProviderError } from '../data/providers/http';
import {
  TVmaze,
  normalizeTvmazeEpisode,
  normalizeTvmazeShow,
  tvmazeEpisodeSchema,
  type TvmazeShow,
} from '../data/providers/tvmaze';
import {
  getEpisodeGuide,
  getUpcomingEpisodes,
  getTvmazeDiscoveryCandidates,
  matchTvmazeTitles,
  storeTvmazeEpisodes,
  storeTvmazeShows,
} from '../data/repositories/episodes';
import { runTvmazeBatch } from '../jobs/tvmaze';

const requestUrl = (input: Parameters<typeof fetch>[0]) =>
  typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

const show = (
  id = 1,
  imdb: string | null = 'tt1234567',
  tvdb: number | null = 10,
): TvmazeShow => ({
  id,
  name: 'Example',
  url: `https://www.tvmaze.com/shows/${id}/example`,
  status: 'Running',
  type: 'Scripted',
  updated: 1789000000,
  externals: { imdb, thetvdb: tvdb },
  network: {
    name: 'ABC',
    country: { code: 'US', timezone: 'America/New_York' },
  },
  webChannel: null,
});
const episode = (id = 1, fields: Record<string, unknown> = {}) =>
  tvmazeEpisodeSchema.parse({
    id,
    name: `Episode ${id}`,
    url: `https://www.tvmaze.com/episodes/${id}/example`,
    season: 1,
    number: id,
    type: 'regular',
    airdate: '2026-09-12',
    airtime: '20:00',
    airstamp: '2026-09-12T20:00:00-04:00',
    runtime: 40,
    summary: '<p>Example <b>story</b></p>',
    ...fields,
  });
const response = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) => new Response(JSON.stringify(body), { status, headers });

test('TVmaze normalizes UTC, unknown dates, specials and plain text without fabricating a market', () => {
  const normalized = normalizeTvmazeEpisode(episode(), 1);
  assert.equal(normalized.airStamp, '2026-09-13T00:00:00.000Z');
  assert.equal(normalized.airDate, '2026-09-12');
  assert.equal(normalized.summary, 'Example story');
  const special = normalizeTvmazeEpisode(
    episode(2, {
      season: 0,
      number: null,
      type: 'significant_special',
      airdate: '',
      airtime: '',
      airstamp: null,
    }),
    1,
  );
  assert.equal(special.season, 0);
  assert.equal(special.number, null);
  assert.equal(special.airStamp, null);
  const global = normalizeTvmazeShow({
    ...show(),
    network: null,
    webChannel: { name: 'Netflix', country: null },
  });
  assert.equal(global.distribution, 'global');
  assert.equal(global.country, null);
  assert.equal(global.timezone, null);
  assert.equal(
    tvmazeEpisodeSchema.safeParse({ ...episode(), airdate: '2026-02-31' })
      .success,
    false,
  );
});

test('TVmaze sparse pages continue, 404 ends, exact lookup mismatches are rejected', async () => {
  const requests: string[] = [];
  const api = new TVmaze(
    async () => true,
    async (url) => {
      requests.push(requestUrl(url));
      if (requestUrl(url).endsWith('page=0')) return response([]);
      if (requestUrl(url).endsWith('page=1')) return response({}, 404);
      return response(show());
    },
  );
  assert.deepEqual(await api.index(0), []);
  assert.equal(await api.index(1), null);
  assert.equal(await api.lookup({ imdb: 'tt7654321' }), null);
  assert.equal(await api.lookup({ tvdb: 20 }), null);
  assert.equal((await api.lookup({ imdb: 'tt1234567', tvdb: 10 }))?.id, 1);
  assert.ok(requests.every((url) => url.startsWith('https://api.tvmaze.com/')));
});

test('Global schedule uses the bounded web endpoint and accepts its embedded show shape', async () => {
  let called = '';
  const api = new TVmaze(
    async () => true,
    async (url) => {
      called = requestUrl(url);
      return response([
        {
          ...episode(),
          _embedded: {
            show: {
              ...show(),
              network: null,
              webChannel: { name: 'Netflix', country: null },
            },
          },
        },
      ]);
    },
  );
  const result = await api.schedule('global', '2026-09-12');
  assert.equal(
    called,
    'https://api.tvmaze.com/schedule/web?country=&date=2026-09-12',
  );
  assert.equal(result[0]._embedded?.show.webChannel?.name, 'Netflix');
});

test('TVmaze rejects schema drift and malformed JSON, preserves 429 backoff, and stops before fetching when budget is denied', async () => {
  let calls = 0;
  const denied = new TVmaze(
    async () => false,
    async () => {
      calls++;
      return response(show());
    },
  );
  await assert.rejects(
    () => denied.show(1),
    (error: unknown) =>
      error instanceof ProviderError && error.code === 'budget',
  );
  assert.equal(calls, 0);
  const quota = new TVmaze(
    async () => true,
    async () => response({}, 429, { 'Retry-After': '17' }),
  );
  await assert.rejects(
    () => quota.show(1),
    (error: unknown) =>
      error instanceof ProviderError &&
      error.code === 'quota' &&
      error.retryAfter === 17000,
  );
  const broken = new TVmaze(
    async () => true,
    async () => new Response('{'),
  );
  await assert.rejects(
    () => broken.show(1),
    (error: unknown) =>
      error instanceof ProviderError && error.code === 'schema',
  );
  const drift = new TVmaze(
    async () => true,
    async () => response({ ...show(), url: 'https://malicious.example/test' }),
  );
  await assert.rejects(
    () => drift.show(1),
    (error: unknown) =>
      error instanceof ProviderError && error.code === 'schema',
  );
  const timeout = new TVmaze(
    async () => true,
    async () => {
      throw new DOMException('timeout', 'TimeoutError');
    },
  );
  await assert.rejects(
    () => timeout.show(1),
    (error: unknown) =>
      error instanceof ProviderError && error.code === 'timeout',
  );
});

let pglite: PGlite;
const database: Database = {
  async query<T>(sql: string, parameters: unknown[] = []) {
    return { rows: (await pglite.query<T>(sql, parameters)).rows };
  },
};
before(async () => {
  pglite = new PGlite();
  await pglite.exec(await readFile('db/migrations/001_core.sql', 'utf8'));
  await pglite.exec(await readFile('db/migrations/010_tvmaze.sql', 'utf8'));
});
beforeEach(async () => {
  await pglite.exec(`TRUNCATE titles,tvmaze_shows,tvmaze_title_map,tvmaze_title_lookups,tvmaze_schedule_scopes,operations CASCADE;
    UPDATE tvmaze_sync SET next_page=0,tail_page=0,index_completed_at=NULL,lock_token='owner',lock_until=now()+interval '2 minutes',requests_today=0,budget_day=CURRENT_DATE,next_request_at=now(),error_code=NULL`);
});
after(async () => pglite.close());
async function title(id: string, external: object, type = 'tv') {
  await database.query(
    "INSERT INTO titles(id,media_type,tmdb_id,data,revision) VALUES($1,$2,$3,$4,'test')",
    [
      id,
      type,
      Number(id.split(':')[1]),
      JSON.stringify({ id, type, externalIds: external }),
    ],
  );
}

test('Index rows and cursor commit together; expired owners cannot alter data or advance the cursor', async () => {
  assert.equal(await storeTvmazeShows([show()], 'owner', database, 0), 1);
  assert.equal(
    (
      await database.query<{ next_page: number }>(
        'SELECT next_page FROM tvmaze_sync',
      )
    ).rows[0].next_page,
    1,
  );
  await database.query("UPDATE tvmaze_sync SET lock_token='new-owner'");
  assert.equal(await storeTvmazeShows([show(2)], 'owner', database, 1), 0);
  assert.equal(
    (
      await database.query<{ next_page: number }>(
        'SELECT next_page FROM tvmaze_sync',
      )
    ).rows[0].next_page,
    1,
  );
  assert.equal(
    (await database.query('SELECT id FROM tvmaze_shows')).rows.length,
    1,
  );
  await storeTvmazeShows([], 'new-owner', database, 1);
  await storeTvmazeShows([], 'new-owner', database, null);
  const state = (
    await database.query<{
      next_page: number;
      tail_page: number;
      index_completed_at: unknown;
    }>('SELECT * FROM tvmaze_sync')
  ).rows[0];
  assert.equal(state.next_page, 2);
  assert.equal(state.tail_page, 1);
  assert.ok(state.index_completed_at);
});

test('Matching uses only unambiguous exact external IDs, rejects conflict, and keeps unmatched native shows discoverable', async () => {
  await storeTvmazeShows(
    [show(), show(2, 'tt2222222', 20), show(3, 'tt3333333', 30)],
    'owner',
    database,
  );
  await title('tv:1', { imdb: 'tt1234567', tvdb: 10 });
  await title('tv:2', { imdb: 'tt2222222', tvdb: 999 });
  await title('movie:3', { imdb: 'tt3333333' }, 'movie');
  await title('tv:4', { imdb: 'tt3333333' });
  await title('tv:5', { imdb: 'tt3333333' });
  assert.equal(await matchTvmazeTitles(database, 'owner'), 1);
  const mappings = (
    await database.query<{ title_id: string }>(
      'SELECT title_id FROM tvmaze_title_map',
    )
  ).rows;
  assert.deepEqual(
    mappings.map((row) => row.title_id),
    ['tv:1'],
  );
  const candidates = await getTvmazeDiscoveryCandidates(1000, database);
  assert.deepEqual(
    candidates.map((row) => row.tvmazeId),
    [2, 3],
  );
});

test('Exact matching scales with eligible IDs rather than multiplying all titles by the native catalog', async () => {
  await database.query(`INSERT INTO titles(id,media_type,tmdb_id,data,revision)
    SELECT 'tv:'||n,'tv',n,jsonb_build_object('id','tv:'||n,'externalIds',
      CASE WHEN n%100=0 THEN jsonb_build_object('imdb','tt'||(1000000+n)::text,'tvdb',n)
      ELSE '{}'::jsonb END),'test' FROM generate_series(1,20000) n`);
  await database.query(`INSERT INTO tvmaze_shows(id,imdb_id,tvdb_id,data,source_updated,source_url)
    SELECT n,'tt'||(1000000+n)::text,n,jsonb_build_object('id',n,'name','Show '||n),1,
      'https://www.tvmaze.com/shows/'||n FROM generate_series(1,5000) n`);
  await database.query('ANALYZE titles');
  await database.query('ANALYZE tvmaze_shows');
  let statement = '',
    parameters: unknown[] = [];
  await matchTvmazeTitles(
    {
      query: async <T>(sql: string, values: unknown[] = []) => {
        statement = sql;
        parameters = values;
        return { rows: [] as T[] };
      },
    },
    'owner',
  );
  type Plan = {
    'Node Type': string;
    'Actual Rows': number;
    'Actual Loops': number;
    'Subplan Name'?: string;
    'Join Filter'?: string;
    Plans?: Plan[];
  };
  const explained = (
    await database.query<{
      'QUERY PLAN': { Plan: Plan; 'Execution Time': number }[];
    }>('EXPLAIN (ANALYZE,FORMAT JSON,TIMING OFF) ' + statement, parameters)
  ).rows[0]['QUERY PLAN'][0];
  const nodes: Plan[] = [];
  const walk = (node: Plan) => {
    nodes.push(node);
    node.Plans?.forEach(walk);
  };
  walk(explained.Plan);
  assert.equal(
    nodes.find((node) => node['Subplan Name'] === 'CTE eligible')?.[
      'Actual Rows'
    ],
    200,
  );
  assert.ok(
    nodes.every((node) => node['Actual Rows'] * node['Actual Loops'] <= 20000),
  );
  assert.equal(
    (await database.query('SELECT title_id FROM tvmaze_title_map')).rows.length,
    50,
  );
  console.log(
    JSON.stringify({
      tvmazeMatchPlan: {
        titles: 20000,
        shows: 5000,
        eligible: 200,
        matches: 50,
        executionMs: explained['Execution Time'],
      },
    }),
  );
});

test('Guides preserve special IDs, deduplicate safely, reconcile deleted episodes, and distinguish a US premiere in Germany', async () => {
  await storeTvmazeShows([show()], 'owner', database);
  await title('tv:1', { imdb: 'tt1234567' });
  await matchTvmazeTitles(database, 'owner');
  const future = new Date(Date.now() + 86400000).toISOString();
  const regular = normalizeTvmazeEpisode(
    episode(1, { airstamp: future, airdate: future.slice(0, 10) }),
    1,
  );
  const special = normalizeTvmazeEpisode(
    episode(2, {
      season: 0,
      number: null,
      airdate: '',
      airstamp: null,
      airtime: '',
    }),
    1,
  );
  await storeTvmazeEpisodes(
    1,
    [regular, regular, special],
    'owner',
    database,
    true,
  );
  const guide = await getEpisodeGuide('tv:1', database);
  assert.equal(guide?.totalEpisodes, 2);
  assert.equal(guide?.seasons[0].number, 0);
  assert.equal(guide?.nextEpisode?.id, 1);
  assert.ok(guide?.updatedAt);
  assert.equal(guide?.source.license, 'CC BY-SA 4.0');
  const upcomingDE = await getUpcomingEpisodes('de', 14, 100, database);
  assert.equal(upcomingDE.episodes[0].marketRelation, 'original');
  assert.equal(upcomingDE.episodes[0].show.country, 'us');
  const upcomingUS = await getUpcomingEpisodes('us', 14, 100, database);
  assert.equal(upcomingUS.episodes[0].marketRelation, 'market');
  await storeTvmazeEpisodes(1, [special], 'owner', database, true);
  assert.equal((await getEpisodeGuide('tv:1', database))?.nextEpisode, null);
  assert.equal(
    (await getUpcomingEpisodes('de', 14, 100, database)).episodes.length,
    0,
  );
});

test('News and sports cannot crowd series out of the calendar; legacy untyped shows stay excluded until refreshed', async () => {
  const types = [
    'Scripted',
    'News',
    'Sports',
    'Talk Show',
    'Game Show',
    'Award Show',
    null,
    'Animation',
    'Documentary',
    'Reality',
  ];
  await storeTvmazeShows(
    types.map((type, index) => ({
      ...show(index + 1, 'tt' + (1000001 + index), index + 1),
      type,
    })),
    'owner',
    database,
  );
  await title('tv:7', { imdb: 'tt1000007' });
  await matchTvmazeTitles(database, 'owner');
  const early = new Date(Date.now() + 60000).toISOString();
  const later = new Date(Date.now() + 2 * 86400000).toISOString();
  const news = Array.from({ length: 200 }, (_, index) =>
    normalizeTvmazeEpisode(
      episode(1000 + index, { airdate: early.slice(0, 10), airstamp: early }),
      2,
    ),
  );
  const others = types.map((_, index) =>
    normalizeTvmazeEpisode(
      episode(index + 1, { airdate: later.slice(0, 10), airstamp: later }),
      index + 1,
    ),
  );
  await storeTvmazeEpisodes(null, [...news, ...others], 'owner', database);
  const calendar = await getUpcomingEpisodes('de', 14, 4, database);
  assert.deepEqual(
    calendar.episodes.map((entry) => entry.show.type),
    ['Scripted', 'Animation', 'Documentary', 'Reality'],
  );
  assert.equal(calendar.truncated, false);
  assert.equal(
    (await database.query('SELECT id FROM tvmaze_shows')).rows.length,
    10,
    'Every native show remains stored',
  );
  await storeTvmazeShows(
    [{ ...show(7, 'tt1000007', 7), type: 'Scripted' }],
    'owner',
    database,
  );
  assert.equal(
    (await getUpcomingEpisodes('de', 14, 10, database)).episodes.length,
    5,
  );
});

test('A full guide is bounded without losing its independent next-episode query', async () => {
  await storeTvmazeShows([show()], 'owner', database);
  await title('tv:1', { imdb: 'tt1234567' });
  await matchTvmazeTitles(database, 'owner');
  const episodes = Array.from({ length: 501 }, (_, index) =>
    normalizeTvmazeEpisode(
      episode(index + 1, { airstamp: null, airdate: '' }),
      1,
    ),
  );
  await storeTvmazeEpisodes(1, episodes, 'owner', database, true);
  const guide = await getEpisodeGuide('tv:1', database);
  assert.equal(guide?.totalEpisodes, 501);
  assert.equal(guide?.seasons[0].episodes.length, 500);
  assert.equal(guide?.truncated, true);
});

test('Unknown global release times never become precise noon timestamps or disappear after a synthetic cached time', async () => {
  await storeTvmazeShows(
    [
      {
        ...show(),
        network: null,
        webChannel: { name: 'Netflix', country: null },
      },
    ],
    'owner',
    database,
  );
  await title('tv:1', { imdb: 'tt1234567' });
  await matchTvmazeTitles(database, 'owner');
  const day = new Date().toISOString().slice(0, 10);
  const globalEpisode = normalizeTvmazeEpisode(
    episode(1, {
      airdate: day,
      airtime: '',
      airstamp: day + 'T12:00:00+00:00',
    }),
    1,
  );
  assert.equal(globalEpisode.airTime, null);
  assert.equal(globalEpisode.airStamp, null);
  assert.equal(globalEpisode.airDate, day);
  await storeTvmazeEpisodes(
    1,
    [{ ...globalEpisode, airStamp: day + 'T12:00:00.000Z' }],
    'owner',
    database,
    true,
  );
  const stored = (
    await database.query<{
      air_stamp: unknown;
      data: { airStamp: string | null };
    }>('SELECT air_stamp,data FROM tvmaze_episodes')
  ).rows[0];
  assert.equal(stored.air_stamp, null);
  assert.equal(stored.data.airStamp, null);
  // Older cached rows may predate normalization. Their synthetic timestamp
  // must not determine whether a date-only episode is still upcoming today.
  await database.query(`UPDATE tvmaze_episodes SET air_stamp=now()-interval '1 minute',
    data=jsonb_set(data,'{airStamp}',to_jsonb((now()-interval '1 minute')::text))`);
  assert.equal((await getEpisodeGuide('tv:1', database))?.nextEpisode?.id, 1);
  assert.equal(
    (await getEpisodeGuide('tv:1', database))?.nextEpisode?.airStamp,
    null,
  );
  const upcoming = await getUpcomingEpisodes('de', 14, 100, database);
  assert.equal(upcoming.episodes.length, 1);
  assert.equal(upcoming.episodes[0].episode.airStamp, null);
  assert.equal(upcoming.episodes[0].marketRelation, 'global');
});

test('Shared request gate enforces 700 ms, daily budgets, and fencing across overlapping workers', async () => {
  const now = new Date();
  const reserve = async (token: string, daily: number, offset: number) =>
    (
      await database.query<{ allowed: boolean }>(
        'SELECT reserve_tvmaze($1,$2,$3) AS allowed',
        [token, daily, new Date(now.valueOf() + offset).toISOString()],
      )
    ).rows[0].allowed;
  assert.equal(await reserve('owner', 2, 10), true);
  assert.equal(await reserve('owner', 2, 11), false);
  assert.equal(await reserve('other', 2, 720), false);
  assert.equal(await reserve('owner', 2, 720), true);
  assert.equal(await reserve('owner', 2, 1500), false);
  assert.equal(await reserve('owner', 0, 2200), false);
});

test('Background batch resumes sparse index pages, caches schedules, and never issues an API request when disabled', async () => {
  const previous = { ...process.env };
  try {
    process.env.APP_MODE = 'live';
    process.env.DEPLOYMENT_ENV = 'local';
    process.env.TVMAZE_ENABLED = 'true';
    process.env.TVMAZE_DAILY_BUDGET = '2000';
    process.env.DATABASE_URL = 'postgresql://local/test';
    process.env.TMDB_READ_ACCESS_TOKEN = 'test';
    process.env.SAA_API_KEY = 'test';
    process.env.SESSION_SECRET = 's'.repeat(32);
    process.env.SYNC_ENABLED = 'false';
    await database.query(
      'UPDATE tvmaze_sync SET lock_token=NULL,lock_until=NULL',
    );
    await database.query(`INSERT INTO tvmaze_schedule_scopes(market,day,fetched_at)
      VALUES('us',(now() AT TIME ZONE 'UTC')::date+1,now())`);
    const urls: string[] = [];
    const fetcher: typeof fetch = async (url) => {
      urls.push(requestUrl(url));
      if (requestUrl(url).endsWith('page=0')) return response([show()]);
      if (requestUrl(url).endsWith('page=1')) return response([]);
      if (requestUrl(url).endsWith('page=2')) return response({}, 404);
      return response([]);
    };
    const batch = await runTvmazeBatch({
      database,
      maxPages: 2,
      maxRequests: 3,
      maxShows: 0,
      markets: ['de'],
      fetcher,
    });
    assert.equal(batch.error, null);
    assert.equal(batch.indexed, 1);
    assert.equal(batch.requests, 3);
    assert.equal(
      (
        await database.query<{ next_page: number }>(
          'SELECT next_page FROM tvmaze_sync',
        )
      ).rows[0].next_page,
      2,
    );
    assert.equal(
      (
        await database.query(
          "SELECT key FROM operations WHERE key='tvmaze:schedule-types:v1'",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await database.query(
          "SELECT day FROM tvmaze_schedule_scopes WHERE market='us' AND day=(now() AT TIME ZONE 'UTC')::date+1 AND fetched_at IS NULL",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await database.query(
          'SELECT * FROM tvmaze_schedule_scopes WHERE fetched_at IS NOT NULL',
        )
      ).rows.length,
      1,
    );
    const end = await runTvmazeBatch({
      database,
      maxPages: 1,
      maxRequests: 1,
      maxShows: 0,
      markets: ['de'],
      fetcher,
    });
    assert.equal(end.requests, 1);
    assert.ok(
      (
        await database.query<{ index_completed_at: unknown }>(
          'SELECT index_completed_at FROM tvmaze_sync',
        )
      ).rows[0].index_completed_at,
    );
    process.env.TVMAZE_ENABLED = 'false';
    const count = urls.length;
    assert.equal((await runTvmazeBatch({ database, fetcher })).enabled, false);
    assert.equal(urls.length, count);
  } finally {
    process.env = previous;
  }
});

test('A large initial index request still saves an exact-match guide and calendar entries in its first batch', async () => {
  const previous = { ...process.env };
  try {
    Object.assign(process.env, {
      APP_MODE: 'live',
      DEPLOYMENT_ENV: 'local',
      TVMAZE_ENABLED: 'true',
      TVMAZE_DAILY_BUDGET: '2000',
      DATABASE_URL: 'postgresql://local/test',
      TMDB_READ_ACCESS_TOKEN: 'test',
      SAA_API_KEY: 'test',
      SESSION_SECRET: 's'.repeat(32),
      SYNC_ENABLED: 'false',
    });
    await title('tv:1', { imdb: 'tt1234567' });
    await database.query(
      'UPDATE tvmaze_sync SET lock_token=NULL,lock_until=NULL',
    );
    const urls: string[] = [];
    const future = new Date(Date.now() + 86400000).toISOString();
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(requestUrl(input));
      urls.push(url.href);
      if (url.pathname === '/lookup/shows' || url.pathname === '/shows/1')
        return response(show());
      if (url.pathname === '/shows/1/episodes')
        return response([
          episode(1, { airdate: future.slice(0, 10), airstamp: future }),
        ]);
      if (url.pathname === '/shows') {
        const id = 10 + Number(url.searchParams.get('page'));
        return response([show(id, 'tt' + (1000000 + id), id)]);
      }
      return response([
        {
          ...episode(99, {
            airdate: future.slice(0, 10),
            airtime: '',
            airstamp: future,
          }),
          _embedded: {
            show: {
              ...show(99, 'tt9999999', 99),
              network: null,
              webChannel: { name: 'Global channel', country: null },
            },
          },
        },
      ]);
    };
    const batch = await runTvmazeBatch({
      database,
      maxPages: 50,
      maxRequests: 6,
      maxShows: 4,
      markets: ['us'],
      fetcher,
    });
    assert.equal(batch.error, null);
    assert.equal(batch.guides, 1);
    assert.equal(batch.scheduled, 1);
    assert.equal(batch.requests, 6);
    assert.equal((await getEpisodeGuide('tv:1', database))?.totalEpisodes, 1);
    const calendar = await getUpcomingEpisodes('us', 14, 100, database);
    assert.equal(calendar.episodes.length, 2);
    assert.equal(
      calendar.episodes.find((item) => item.episode.id === 99)?.episode
        .airStamp,
      null,
    );
    assert.ok(
      urls.findIndex((url) => url.includes('/schedule')) <
        urls.findIndex((url) => url.endsWith('page=1')),
    );
    assert.equal(
      (
        await database.query<{ next_page: number }>(
          'SELECT next_page FROM tvmaze_sync',
        )
      ).rows[0].next_page,
      2,
    );
  } finally {
    process.env = previous;
  }
});

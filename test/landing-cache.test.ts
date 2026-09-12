import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Database } from '../data/db';
import { landingAlternates } from '../seo/landings';

const origin = 'https://cineradar.tv';
const rows = [
  { locale: 'de', market: 'de', total: 100 },
  { locale: 'en', market: 'us', total: 100 },
];

test('landing reads coalesce across contexts and expire twenty seconds after the query finishes', async (t) => {
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  let complete!: () => void;
  const gate = new Promise<void>((resolve) => {
    complete = resolve;
  });
  let currentRows = rows;
  const database: Database = {
    async query<T>() {
      calls++;
      await gate;
      return { rows: currentRows as T[] };
    },
  };
  const get = () =>
    landingAlternates(database, origin, ['de', 'us'], 'home', '', 1);
  const first = get();
  const concurrent = get();
  assert.equal(calls, 1);
  now = 5000;
  complete();
  const [de, en] = await Promise.all([first, concurrent]);
  assert.deepEqual(de, {
    'de-DE': origin + '/de/de/',
    'en-US': origin + '/en/us/',
  });
  assert.deepEqual(en, de);
  de['de-DE'] = 'https://untrusted.invalid/';
  now = 24999;
  assert.equal(
    (await get())['de-DE'],
    origin + '/de/de/',
    'Callers cannot alter later visitors’ links',
  );
  assert.equal(calls, 1);
  now = 25000;
  currentRows = [];
  assert.deepEqual(
    await get(),
    {},
    'Expired eligibility is refreshed, without serving stale links',
  );
  assert.equal(calls, 2);
});

test('failed eligibility queries are shared only while pending and never cached or replaced with stale links', async (t) => {
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  let fail = true;
  const database: Database = {
    async query<T>() {
      calls++;
      if (fail) throw new Error('Registry unavailable');
      return { rows: rows as T[] };
    },
  };
  const get = () =>
    landingAlternates(database, origin, ['de', 'us'], 'movies', '', 1);
  const failures = await Promise.allSettled([get(), get()]);
  assert(failures.every((result) => result.status === 'rejected'));
  assert.equal(calls, 1);
  fail = false;
  assert.equal(Object.keys(await get()).length, 2);
  assert.equal(calls, 2);
  now = 20000;
  fail = true;
  await assert.rejects(get(), /Registry unavailable/);
  assert.equal(calls, 3);
  fail = false;
  assert.equal(Object.keys(await get()).length, 2);
  assert.equal(
    calls,
    4,
    'A retry is possible immediately after an expired-cache failure',
  );
});

test('database, enabled markets, origin, route, tail and page have isolated cache entries', async () => {
  let calls = 0;
  const query: Database['query'] = async <T>() => {
    calls++;
    return { rows: rows as T[] };
  };
  const first: Database = { query };
  const second: Database = { query };
  const links = await landingAlternates(
    first,
    origin,
    ['de', 'us'],
    'providers',
    'netflix',
    1,
  );
  assert.equal(links['en-US'], origin + '/en/us/providers/netflix/');
  await landingAlternates(
    first,
    origin,
    ['us', 'de'],
    'providers',
    'netflix',
    1,
  );
  assert.equal(calls, 1, 'Reordering the same enabled countries is equivalent');
  await landingAlternates(
    second,
    origin,
    ['de', 'us'],
    'providers',
    'netflix',
    1,
  );
  await landingAlternates(first, origin, ['de'], 'providers', 'netflix', 1);
  const alternateOrigin = await landingAlternates(
    first,
    'https://preview.cineradar.tv',
    ['de', 'us'],
    'providers',
    'netflix',
    1,
  );
  assert(alternateOrigin['de-DE'].startsWith('https://preview.cineradar.tv/'));
  await landingAlternates(first, origin, ['de', 'us'], 'topics', 'netflix', 1);
  const provider = await landingAlternates(
    first,
    origin,
    ['de', 'us'],
    'providers',
    'prime',
    1,
  );
  assert(provider['en-US'].endsWith('/providers/prime/'));
  const page = await landingAlternates(
    first,
    origin,
    ['de', 'us'],
    'providers',
    'netflix',
    2,
  );
  assert(page['en-US'].endsWith('?page=2'));
  assert.equal(calls, 7);
});

test('the cache retains at most 128 landing contexts, with LRU eviction', async () => {
  let calls = 0;
  const database: Database = {
    async query<T>() {
      calls++;
      return { rows: rows as T[] };
    },
  };
  const get = (page: number) =>
    landingAlternates(database, origin, ['de', 'us'], 'movies', '', page);
  for (let page = 1; page <= 128; page++) await get(page);
  assert.equal(calls, 128);
  await get(1);
  await get(129);
  assert.equal(calls, 129);
  await get(1);
  assert.equal(calls, 129, 'Recently reused contexts survive eviction');
  await get(2);
  assert.equal(calls, 130, 'The oldest context is recomputed after eviction');
});

test('completion of an evicted request cannot grow the cache or resurrect the evicted entry', async () => {
  let calls = 0;
  let complete!: () => void;
  const gate = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const database: Database = {
    async query<T>() {
      calls++;
      if (calls === 1) await gate;
      return { rows: rows as T[] };
    },
  };
  const get = (page: number) =>
    landingAlternates(database, origin, ['de', 'us'], 'series', '', page);
  const old = get(1);
  for (let page = 2; page <= 129; page++) await get(page);
  complete();
  await old;
  await get(2);
  assert.equal(
    calls,
    129,
    'The evicted request did not displace an existing entry on completion',
  );
  await get(1);
  assert.equal(calls, 130, 'An evicted completed request remains uncached');
});

test('a slow evicted request cannot overwrite a newer eligibility result for the same landing', async () => {
  let calls = 0;
  let complete!: () => void;
  const gate = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const database: Database = {
    async query<T>() {
      const request = ++calls;
      if (request === 1) {
        await gate;
        return { rows: rows as T[] };
      }
      return { rows: [] as T[] };
    },
  };
  const get = (page: number) =>
    landingAlternates(database, origin, ['de', 'us'], 'movies', '', page);
  const old = get(1);
  for (let page = 2; page <= 129; page++) await get(page);
  assert.deepEqual(await get(1), {});
  assert.equal(calls, 130);
  complete();
  assert.equal(Object.keys(await old).length, 2);
  assert.deepEqual(
    await get(1),
    {},
    'A completed older request must not restore obsolete links',
  );
  assert.equal(calls, 130);
});

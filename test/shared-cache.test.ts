import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

test('Next public cache survives callers, isolates datasets and bounds stale data', async (t) => {
  const saved = { ...process.env };
  const runtime = globalThis as typeof globalThis & {
    AsyncLocalStorage?: typeof AsyncLocalStorage;
    __incrementalCache?: unknown;
  };
  const oldStorage = runtime.AsyncLocalStorage;
  const oldCache = runtime.__incrementalCache;
  runtime.AsyncLocalStorage = AsyncLocalStorage;
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const entries = new Map<string, unknown>();
  runtime.__incrementalCache = {
    generateSimpleCacheKey: async (key: string) => key,
    get: async (key: string) => entries.get(key),
    set: async (key: string, value: unknown) => {
      entries.set(key, { value, isStale: false });
    },
  };
  Object.assign(process.env, {
    NEXT_RUNTIME: 'nodejs', APP_MODE: 'live',
    DATABASE_URL: 'postgres://private-password@one.invalid/test',
    SITE_URL: 'https://cineradar.tv', DEPLOYMENT_ENV: 'production',
  });
  try {
    const { sharedPublicCache } = await import('../data/shared-cache');
    let reads = 0;
    const load = async () => ({ reads: ++reads });
    assert.deepEqual(await sharedPublicCache('catalog:de:de', load), { reads: 1 });
    assert.deepEqual(await sharedPublicCache('catalog:de:de', load), { reads: 1 });
    assert.equal(reads, 1, 'Independent calls reuse the shared entry');
    assert.deepEqual(await sharedPublicCache('catalog:en:us', load), { reads: 2 });
    process.env.DATABASE_URL = 'postgres://private-password@two.invalid/test';
    assert.deepEqual(await sharedPublicCache('catalog:de:de', load), { reads: 3 });
    assert(![...entries.keys()].some((key) => key.includes('private-password')));
    now += 900000;
    assert.deepEqual(await sharedPublicCache('catalog:de:de', load), { reads: 4 }, 'An old entry is synchronously refreshed, never returned as a false outage');
    await assert.rejects(sharedPublicCache('catalog:de:de', async () => { throw new Error('offline'); }), /offline/);
    const count = entries.size;
    await assert.rejects(sharedPublicCache('failed', async () => { throw new Error('offline'); }), /offline/);
    assert.equal(entries.size, count, 'Failed loads never become cached successes');
    delete process.env.NEXT_RUNTIME;
    assert.deepEqual(await sharedPublicCache('catalog:de:de', load), { reads: 5 });
    assert.deepEqual(await sharedPublicCache('catalog:de:de', load), { reads: 6 });
  } finally {
    process.env = saved;
    runtime.AsyncLocalStorage = oldStorage;
    runtime.__incrementalCache = oldCache;
  }
});

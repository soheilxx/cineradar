import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import {
  BACKFILL_MAX_PENDING_TITLES,
  handleCatalogBackfill,
  scheduleCatalogBackfill,
} from '../jobs/catalog-backfill';
import type { Database } from '../data/db';
import type { Job } from '../jobs/queue';
import { ProviderError } from '../data/providers/http';

let d: PGlite;
let database: Database;
const day = new Date('2026-09-07T12:00:00Z');
const show = {
  itemType: 'show' as const,
  id: '4-blocks',
  showType: 'series' as const,
  tmdbId: 'tv/71641',
  streamingOptions: { de: [] },
};
before(async () => {
  d = new PGlite({ extensions: { pg_trgm, unaccent } });
  for (const file of (await readdir('db/migrations')).sort())
    await d.exec(await readFile('db/migrations/' + file, 'utf8'));
  database = {
    query: async <T>(sql: string, params: unknown[] = []) => ({
      rows: (await d.query<T>(sql, params)).rows,
    }),
  };
});
beforeEach(async () => {
  await d.exec('TRUNCATE jobs,operations');
});
after(async () => {
  await d.close();
});

async function claim(page: number, market = 'de', type = 'tv') {
  const result = await d.query<Job>(
    `UPDATE jobs SET state='running',attempts=1,lock_token='backfill-test',lock_until=now()+interval '2 minutes'
     WHERE kind='catalog-backfill' AND payload->>'market'=$1 AND payload->>'type'=$2 AND (payload->>'page')::int=$3 RETURNING *`,
    [market, type, page],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}
async function state(market = 'de', type = 'tv') {
  return (
    await d.query<{ data: Record<string, unknown> }>(
      'SELECT data FROM operations WHERE key=$1',
      [`catalog-backfill:${market}:${type}`],
    )
  ).rows[0]?.data;
}

test('Backfill resumes opaque cursors across days without declaring a capped batch complete', async () => {
  await scheduleCatalogBackfill(database, ['de', 'us'], day);
  await scheduleCatalogBackfill(database, ['de', 'us'], day);
  assert.equal(
    (await d.query("SELECT id FROM jobs WHERE kind='catalog-backfill'")).rows
      .length,
    4,
  );
  const calls: Array<{ market: string; cursor?: string }> = [];
  const saa = {
    catalog: async (market: string, _type: 'movie' | 'tv', cursor?: string) => {
      calls.push({ market, cursor });
      return {
        shows: [show],
        hasMore: calls.length < 3,
        nextCursor: `opaque+/=cursor-${calls.length}`,
      };
    },
  };
  const first = await claim(1);
  await handleCatalogBackfill(first, database, saa, ['de', 'us'], day);
  await handleCatalogBackfill(first, database, saa, ['de', 'us'], day);
  assert.equal(calls.length, 1, 'A replay must not spend another API request');
  await scheduleCatalogBackfill(database, ['de', 'us'], day);
  await handleCatalogBackfill(await claim(2), database, saa, ['de', 'us'], day);
  await scheduleCatalogBackfill(database, ['de', 'us'], day);
  assert.equal(
    (
      await d.query(
        "SELECT id FROM jobs WHERE kind='catalog-backfill' AND payload->>'market'='de' AND payload->>'type'='tv'",
      )
    ).rows.length,
    2,
  );
  assert.equal((await state()).discoveryComplete, false);
  assert.equal((await state()).cursor, 'opaque+/=cursor-2');
  const tomorrow = new Date('2026-09-08T12:00:00Z');
  await scheduleCatalogBackfill(database, ['de', 'us'], tomorrow);
  await handleCatalogBackfill(
    await claim(3),
    database,
    saa,
    ['de', 'us'],
    tomorrow,
  );
  await scheduleCatalogBackfill(database, ['de', 'us'], tomorrow);
  assert.deepEqual(calls, [
    { market: 'de', cursor: undefined },
    { market: 'de', cursor: 'opaque+/=cursor-1' },
    { market: 'de', cursor: 'opaque+/=cursor-2' },
  ]);
  assert.equal((await state()).discoveryComplete, true);
  assert.equal((await state()).cursor, null);
  assert.equal(
    (
      await d.query(
        "SELECT id FROM jobs WHERE kind='catalog-backfill' AND payload->>'market'='de' AND payload->>'type'='tv'",
      )
    ).rows.length,
    3,
  );
  const titleJobs = (
    await d.query<{ payload: Record<string, unknown> }>(
      "SELECT payload FROM jobs WHERE kind='catalog-title'",
    )
  ).rows;
  assert.equal(
    titleJobs.length,
    1,
    'Repeated source titles are imported once per country and cycle',
  );
  assert.equal(
    titleJobs[0].payload.market,
    'de',
    'Country-limited responses stay country-limited',
  );
});

test('Backfill waits for older imports and adopts their cursor when their requested batch ends', async () => {
  await d.query(
    "INSERT INTO jobs(key,kind,payload,state) VALUES('legacy','catalog-page',$1,'queued')",
    [
      JSON.stringify({
        market: 'de',
        type: 'tv',
        batch: 'old-manual',
        page: 80,
      }),
    ],
  );
  await scheduleCatalogBackfill(database, ['de'], day);
  assert.equal(await state(), undefined);
  await d.query("UPDATE jobs SET state='done' WHERE key='legacy'");
  await d.query(
    "INSERT INTO operations(key,data) VALUES('catalog:old-manual:de:tv',$1)",
    [
      JSON.stringify({
        page: 80,
        hasMore: true,
        discoveryComplete: false,
        batchComplete: true,
        order: 'popularity_1year',
        nextCursor: 'legacy-next',
        seen: ['legacy-previous'],
      }),
    ],
  );
  await scheduleCatalogBackfill(database, ['de'], day);
  const calls: unknown[][] = [];
  await handleCatalogBackfill(
    await claim(81),
    database,
    {
      catalog: async (...args) => {
        calls.push(args);
        return { shows: [], hasMore: false };
      },
    },
    ['de'],
    day,
  );
  assert.deepEqual(calls, [['de', 'tv', 'legacy-next', 'popularity_1year']]);
  assert.equal((await state()).discoveryComplete, true);
});

test('A genuinely finished legacy catalog walk does not start another full discovery', async () => {
  await d.query(
    "INSERT INTO operations(key,data) VALUES('catalog:finished:de:tv',$1)",
    [JSON.stringify({ page: 500, maxPages: 500, hasMore: false })],
  );
  await scheduleCatalogBackfill(database, ['de'], day);
  assert.equal((await state()).discoveryComplete, true);
  assert.equal(
    (
      await d.query(
        "SELECT id FROM jobs WHERE kind='catalog-backfill' AND payload->>'type'='tv'",
      )
    ).rows.length,
    0,
  );
});

test('A full import queue pauses additional discovery', async () => {
  await d.query(
    "INSERT INTO jobs(key,kind,payload) SELECT 'pending:'||n,'catalog-title','{}' FROM generate_series(1,$1) n",
    [BACKFILL_MAX_PENDING_TITLES],
  );
  await scheduleCatalogBackfill(database, ['de'], day);
  assert.equal(
    (await d.query("SELECT id FROM jobs WHERE kind='catalog-backfill'")).rows
      .length,
    0,
  );
  await d.query("UPDATE jobs SET state='done' WHERE key='pending:1'");
  await scheduleCatalogBackfill(database, ['de'], day);
  assert.equal(
    (await d.query("SELECT id FROM jobs WHERE kind='catalog-backfill'")).rows
      .length,
    2,
  );
});

test('Provider budget deferral, repeated cursors and lost leases cannot advance the checkpoint', async () => {
  await scheduleCatalogBackfill(database, ['de'], day);
  const first = await claim(1);
  await assert.rejects(
    handleCatalogBackfill(
      first,
      database,
      {
        catalog: async () => {
          throw new ProviderError('budget');
        },
      },
      ['de'],
      day,
    ),
    { code: 'budget' },
  );
  assert.equal((await state()).page, 0);
  await d.query("UPDATE jobs SET lock_token='replacement' WHERE id=$1", [
    first.id,
  ]);
  await assert.rejects(
    handleCatalogBackfill(
      first,
      database,
      {
        catalog: async () => ({
          shows: [show],
          hasMore: true,
          nextCursor: 'cursor',
        }),
      },
      ['de'],
      day,
    ),
    /Lost job lease/,
  );
  assert.equal((await state()).page, 0);
  assert.equal(
    (await d.query("SELECT id FROM jobs WHERE kind='catalog-title'")).rows
      .length,
    0,
  );
  await handleCatalogBackfill(
    { ...first, lock_token: 'replacement' },
    database,
    {
      catalog: async () => ({
        shows: [show],
        hasMore: true,
        nextCursor: 'cursor',
      }),
    },
    ['de'],
    day,
  );
  await scheduleCatalogBackfill(database, ['de'], day);
  await assert.rejects(
    handleCatalogBackfill(
      await claim(2),
      database,
      {
        catalog: async () => ({
          shows: [show],
          hasMore: true,
          nextCursor: 'cursor',
        }),
      },
      ['de'],
      day,
    ),
    { code: 'schema' },
  );
  assert.equal((await state()).page, 1);
  assert.equal((await state()).discoveryComplete, false);
});

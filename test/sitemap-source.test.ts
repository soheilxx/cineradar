import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { sitemapSourceRows } from '../seo/sitemap-source';
import type { Database } from '../data/db';
import { fixtureCatalog } from './fixtures/catalog';

const asOf = new Date('2026-09-27T12:00:00Z');
async function setup() {
  const database = new PGlite();
  await database.exec(`CREATE TABLE titles(id text PRIMARY KEY,data jsonb,updated_at timestamptz);
    CREATE TABLE snapshots(title_id text,market text,availability text,checked_at timestamptz,
      changed_at timestamptz NOT NULL,PRIMARY KEY(title_id,market));
    CREATE TABLE offers(id text PRIMARY KEY,title_id text,market text,provider_id text,data jsonb,expires_at timestamptz);
    CREATE INDEX ON offers(title_id,market);`);
  const migration = await readFile(
    'db/migrations/003_search_translations.sql',
    'utf8',
  );
  // Exercise the real material-content trigger, without unrelated extensions.
  await database.exec(
    migration.slice(
      migration.indexOf('CREATE FUNCTION mark_offer_content_changed'),
    ),
  );
  await database.exec(
    await readFile('db/migrations/015_sitemap_offer_revisions.sql', 'utf8'),
  );
  const title = structuredClone(fixtureCatalog()[0].title);
  title.fixture = false;
  await database.query('INSERT INTO titles VALUES($1,$2,$3)', [
    title.id,
    JSON.stringify(title),
    asOf,
  ]);
  for (const market of ['de', 'us'])
    await database.query(
      "INSERT INTO snapshots VALUES($1,$2,'available',$3,$3)",
      [title.id, market, asOf],
    );
  for (const [id, market, provider, expiry] of [
    ['b', 'de', 'prime', '2026-09-28T12:00:00Z'],
    ['a', 'de', 'netflix', null],
    ['c', 'us', 'netflix', null],
  ])
    await database.query('INSERT INTO offers VALUES($1,$2,$3,$4,$5,$6)', [
      id,
      title.id,
      market,
      provider,
      JSON.stringify({ id, market, provider, price: 5, observedAt: 'first' }),
      expiry,
    ]);
  return {
    database,
    title,
    adapter: {
      query: async <T>(sql: string, params?: unknown[]) => ({
        rows: (await database.query<T>(sql, params)).rows,
      }),
    } satisfies Database,
  };
}

test('sitemap fingerprint cache preserves legacy hashes, ignores observedAt and invalidates material edits and deletions', async () => {
  const { database, adapter, title } = await setup();
  try {
    const first = (await sitemapSourceRows(adapter, ['de', 'us'], asOf))[0];
    const legacy = await database.query<{ market: string; revision: string }>(
      "SELECT market,md5(string_agg((data-'observedAt')::text,'|' ORDER BY id)) revision FROM offers WHERE expires_at IS NULL OR expires_at>=$1 GROUP BY market",
      [asOf],
    );
    for (const row of legacy.rows)
      assert.equal(
        first.snapshots.find((s) => s.market === row.market)!.revision,
        row.revision,
      );
    assert.deepEqual(first.snapshots[0].providers, ['netflix', 'prime']);
    const cached = (
      await database.query(
        'SELECT *,xmin::text FROM seo_sitemap_offer_revisions ORDER BY market',
      )
    ).rows;
    await database.query(
      "UPDATE offers SET data=jsonb_set(data,'{observedAt}','\"refreshed\"')",
    );
    const refreshed = (await sitemapSourceRows(adapter, ['de', 'us'], asOf))[0];
    assert.deepEqual(refreshed.snapshots, first.snapshots);
    assert.deepEqual(
      (
        await database.query(
          'SELECT *,xmin::text FROM seo_sitemap_offer_revisions ORDER BY market',
        )
      ).rows,
      cached,
    );
    await database.query(
      "UPDATE offers SET data=jsonb_set(data,'{price}','7') WHERE id='a'",
    );
    const edited = (await sitemapSourceRows(adapter, ['de', 'us'], asOf))[0];
    assert.notEqual(edited.snapshots[0].revision, first.snapshots[0].revision);
    assert.equal(edited.snapshots[1].revision, first.snapshots[1].revision);
    await database.query("DELETE FROM offers WHERE market='de'");
    const removed = (await sitemapSourceRows(adapter, ['de', 'us'], asOf))[0];
    assert.equal(removed.snapshots[0].revision, '');
    assert.equal(removed.snapshots[0].hasOffers, false);
    assert.deepEqual(removed.snapshots[0].providers, []);
    await database.query(
      'DELETE FROM snapshots WHERE title_id=$1 AND market=$2',
      [title.id, 'de'],
    );
    assert.equal(
      (
        await database.query(
          "SELECT 1 FROM seo_sitemap_offer_revisions WHERE market='de'",
        )
      ).rows.length,
      0,
    );
  } finally {
    await database.close();
  }
});

test('offer expiry invalidates its fingerprint without requiring an import or changed_at mutation', async () => {
  const { database, adapter } = await setup();
  try {
    const first = (await sitemapSourceRows(adapter, ['de'], asOf))[0]
      .snapshots[0];
    const expired = (
      await sitemapSourceRows(adapter, ['de'], new Date('2026-09-29T12:00:00Z'))
    )[0].snapshots[0];
    assert.equal(expired.changedAt, first.changedAt);
    assert.notEqual(expired.revision, first.revision);
    assert.deepEqual(expired.providers, ['netflix']);
    assert.equal(expired.hasOffers, true);
  } finally {
    await database.close();
  }
});

test('warm fingerprints avoid executing the offer-JSON aggregation subplan', async () => {
  const { database, adapter } = await setup();
  try {
    let statement = '';
    let parameters: unknown[] | undefined;
    await sitemapSourceRows(
      {
        query: async <T>(sql: string, params?: unknown[]) => {
          statement = sql;
          parameters = params;
          return adapter.query<T>(sql, params);
        },
      },
      ['de', 'us'],
      asOf,
    );
    const explained = await database.query<Record<string, unknown>>(
      'EXPLAIN (ANALYZE, VERBOSE, FORMAT JSON) ' + statement,
      parameters,
    );
    type Plan = { Output?: string[]; Plans?: Plan[]; 'Actual Loops'?: number };
    const plan = (explained.rows[0]['QUERY PLAN'] as { Plan: Plan }[])[0].Plan;
    const all = (node: Plan): Plan[] => [
      node,
      ...(node.Plans || []).flatMap(all),
    ];
    const contentHashes = all(plan).filter((node) =>
      node.Output?.some((value) => value.includes("data - 'observedAt'")),
    );
    assert.ok(
      contentHashes.length > 0,
      'the actual source SQL must retain its legacy-compatible hash subplan',
    );
    for (const node of contentHashes)
      assert.equal(
        node['Actual Loops'],
        0,
        'cache hits must not read or aggregate offer JSON',
      );
  } finally {
    await database.close();
  }
});

test('bounded keyset reads warm reusable progress while a failed export leaves later batches for retry', async () => {
  const { database, adapter, title } = await setup();
  try {
    await database.query(
      `INSERT INTO titles SELECT 'tv:'||lpad(n::text,5,'0'),jsonb_set($1::jsonb,'{id}',to_jsonb('tv:'||lpad(n::text,5,'0'))),$2 FROM generate_series(1,205) n`,
      [JSON.stringify(title), asOf],
    );
    await database.query(
      "INSERT INTO snapshots SELECT id,'de','empty',$1,$1 FROM titles WHERE id LIKE 'tv:%'",
      [asOf],
    );
    let calls = 0;
    const limited: Database = {
      query: async <T>(sql: string, params?: unknown[]) => {
        if (++calls === 2) throw new Error('injected deadline');
        return adapter.query<T>(sql, params);
      },
    };
    await assert.rejects(
      sitemapSourceRows(limited, ['de'], asOf),
      /injected deadline/,
    );
    assert.equal(
      (await database.query('SELECT 1 FROM seo_sitemap_offer_revisions')).rows
        .length,
      100,
    );
    const reads: number[] = [];
    const resumed: Database = {
      query: async <T>(sql: string, params?: unknown[]) => {
        const result = await adapter.query<T>(sql, params);
        reads.push(result.rows.length);
        return result;
      },
    };
    const rows = await sitemapSourceRows(resumed, ['de'], asOf);
    assert.deepEqual(reads, [100, 100, 6]);
    assert.equal(rows.length, 206);
    assert.equal(new Set(rows.map((r) => r.data.id)).size, rows.length);
  } finally {
    await database.close();
  }
});

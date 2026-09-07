import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import type { Database } from '../data/db';
import {
  normalizeTitleQuery,
  requestTitleSearch,
  titleSearchStatus,
} from '../jobs/search';

let d: PGlite;
let database: Database;
const due = '2026-09-07T12:00:00.000Z';

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
  await d.exec('TRUNCATE jobs,titles CASCADE');
});

after(async () => {
  await d.close();
});

async function addJob(
  key: string,
  options: {
    kind?: string;
    state?: string;
    priority?: number;
    payload?: Record<string, unknown>;
    error?: string;
    runAt?: string;
    attempts?: number;
    lockUntil?: string;
  } = {},
) {
  await d.query(
    `INSERT INTO jobs(key,kind,payload,state,priority,error_code,run_at,attempts,lock_until)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      key,
      options.kind || 'search',
      JSON.stringify(options.payload || {}),
      options.state || 'queued',
      options.priority ?? 0,
      options.error || null,
      options.runAt || due,
      options.attempts || 0,
      options.lockUntil || null,
    ],
  );
}

test('Equivalent searches share one prioritized job; locale and country remain distinct', async () => {
  assert.equal(normalizeTitleQuery('  Ｆóur—BLOCKS! '), 'four blocks');
  const requests = await Promise.all([
    requestTitleSearch('  4 BLOCKS ', 'de', 'de', database),
    requestTitleSearch('4-Blocks', 'de', 'de', database),
    requestTitleSearch('4 Blocks', 'de', 'de', database),
  ]);
  assert.equal(new Set(requests.map((result) => result?.statusKey)).size, 1);
  assert.ok(requests.every((result) => result?.state === 'queued'));
  const first = requests[0]!;
  assert.equal(first.resultsAvailable, false);
  const sameLanguage = await requestTitleSearch(
    '4 Blocks',
    'de',
    'us',
    database,
  );
  const sameMarket = await requestTitleSearch('4 Blocks', 'en', 'de', database);
  assert.notEqual(first.statusKey, sameLanguage?.statusKey);
  assert.notEqual(first.statusKey, sameMarket?.statusKey);
  const jobs = await d.query<{ priority: number }>('SELECT priority FROM jobs');
  assert.equal(jobs.rows.length, 3);
  assert.ok(jobs.rows.every((job) => job.priority === 100));
});

test('Repeated requests preserve completed work and promote an existing search without resetting it', async () => {
  const requested = await requestTitleSearch('4 Blocks', 'de', 'de', database);
  assert.ok(requested);
  await d.query(
    "UPDATE jobs SET priority=0,state='done',attempts=2,payload=payload||$2::jsonb WHERE key=$1",
    [requested.statusKey, JSON.stringify({ imports: [], titleIds: [] })],
  );
  const repeated = await requestTitleSearch('4 BLOCKS', 'de', 'de', database);
  assert.equal(repeated?.statusKey, requested.statusKey);
  assert.equal(repeated?.state, 'complete');
  const saved = (
    await d.query<{ state: string; attempts: number; priority: number }>(
      'SELECT state,attempts,priority FROM jobs WHERE key=$1',
      [requested.statusKey],
    )
  ).rows[0];
  assert.deepEqual(saved, { state: 'done', attempts: 2, priority: 100 });
});

test('General worker prioritizes interactive search and imports ahead of older background work', async () => {
  await addJob('background', { kind: 'catalog-page', runAt: '2020-01-01Z' });
  await addJob('interactive-import', { kind: 'import', priority: 90 });
  await addJob('interactive-search', { priority: 100 });
  const claimed: string[] = [];
  for (let worker = 0; worker < 3; worker++) {
    const result = await d.query<{ key: string; attempts: number }>(
      'SELECT * FROM claim_job($1,$2)',
      [`worker-${worker}`, due],
    );
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].attempts, 1);
    claimed.push(result.rows[0].key);
  }
  assert.deepEqual(claimed, [
    'interactive-search',
    'interactive-import',
    'background',
  ]);
});

test('Search worker claims only its root and listed imports, leaving unrelated due jobs untouched', async () => {
  await addJob('foreign-search', { priority: 100, runAt: '2020-01-01Z' });
  await addJob('foreign-import', { kind: 'import', priority: 100 });
  await addJob('foreign-background', { kind: 'catalog-page' });
  await addJob('requested', {
    priority: 100,
    payload: { imports: ['requested-import'] },
  });
  await addJob('requested-import', { kind: 'import', priority: 90 });
  const claim = async (token: string) =>
    (
      await d.query<{ key: string }>(
        'SELECT * FROM claim_search_job($1,$2,$3)',
        ['requested', token, due],
      )
    ).rows;
  assert.deepEqual(
    (await claim('root-worker')).map((job) => job.key),
    ['requested'],
  );
  await d.query("UPDATE jobs SET state='done' WHERE key='requested'");
  assert.deepEqual(
    (await claim('import-worker')).map((job) => job.key),
    ['requested-import'],
  );
  assert.deepEqual(await claim('second-import-worker'), []);
  const foreign = await d.query<{ state: string; attempts: number }>(
    "SELECT state,attempts FROM jobs WHERE key LIKE 'foreign-%'",
  );
  assert.equal(foreign.rows.length, 3);
  assert.ok(
    foreign.rows.every((job) => job.state === 'queued' && job.attempts === 0),
  );
  assert.deepEqual(
    (
      await d.query('SELECT * FROM claim_search_job($1,$2,$3)', [
        'missing-search',
        'missing-worker',
        due,
      ])
    ).rows,
    [],
  );
});

test('Search claims respect scheduled retry, live leases and attempt limits while recovering expired leases', async () => {
  const imports = ['deferred', 'leased', 'exhausted', 'expired'];
  await addJob('requested', { state: 'done', payload: { imports } });
  await addJob('deferred', {
    kind: 'import',
    runAt: '2026-09-07T13:00:00Z',
    error: 'quota',
  });
  await addJob('leased', {
    kind: 'import',
    state: 'running',
    attempts: 1,
    lockUntil: '2026-09-07T12:01:00Z',
  });
  await addJob('exhausted', { kind: 'import', attempts: 6 });
  await addJob('expired', {
    kind: 'import',
    state: 'running',
    attempts: 1,
    lockUntil: '2026-09-07T11:59:59Z',
  });
  const recovered = await d.query<{
    key: string;
    attempts: number;
    lock_token: string;
  }>('SELECT * FROM claim_search_job($1,$2,$3)', [
    'requested',
    'recovery',
    due,
  ]);
  assert.equal(recovered.rows.length, 1);
  assert.equal(recovered.rows[0].key, 'expired');
  assert.equal(recovered.rows[0].attempts, 2);
  assert.equal(recovered.rows[0].lock_token, 'recovery');
  assert.equal(
    (
      await d.query('SELECT * FROM claim_search_job($1,$2,$3)', [
        'requested',
        'another-worker',
        due,
      ])
    ).rows.length,
    0,
  );
});

test('Search worker rejects a non-search root even when it has an imports payload', async () => {
  await addJob('not-a-search', {
    kind: 'catalog-page',
    priority: 100,
    payload: { imports: ['foreign-import'] },
  });
  await addJob('foreign-import', { kind: 'import', priority: 90 });
  const claimed = await d.query('SELECT * FROM claim_search_job($1,$2,$3)', [
    'not-a-search',
    'search-worker',
    due,
  ]);
  assert.deepEqual(claimed.rows, []);
  const saved = await d.query<{ state: string; attempts: number }>(
    'SELECT state,attempts FROM jobs',
  );
  assert.equal(saved.rows.length, 2);
  assert.ok(
    saved.rows.every((job) => job.state === 'queued' && job.attempts === 0),
  );
});

test('Search status distinguishes queued, running, complete, failed, missing and non-search jobs', async () => {
  for (const [stored, expected] of [
    ['queued', 'queued'],
    ['running', 'running'],
    ['done', 'complete'],
    ['dead', 'failed'],
  ]) {
    await addJob(stored, { state: stored });
    assert.deepEqual(await titleSearchStatus(stored, database), {
      statusKey: stored,
      resultsAvailable: false,
      state: expected,
    });
  }
  await addJob('not-search', { kind: 'import' });
  assert.equal(await titleSearchStatus('not-search', database), null);
  assert.equal(await titleSearchStatus('missing', database), null);
});

test('Paused searches and dependent imports stay deferred instead of reporting completion', async () => {
  await addJob('paused-root', { state: 'paused' });
  assert.deepEqual(await titleSearchStatus('paused-root', database), {
    statusKey: 'paused-root',
    resultsAvailable: false,
    state: 'deferred',
    retryAt: undefined,
  });
  await addJob('requested', {
    state: 'done',
    payload: { imports: ['paused-import', 'finished-import'] },
  });
  await addJob('paused-import', { kind: 'import', state: 'paused' });
  await addJob('finished-import', { kind: 'import', state: 'done' });
  assert.deepEqual(await titleSearchStatus('requested', database), {
    statusKey: 'requested',
    resultsAvailable: false,
    state: 'deferred',
    retryAt: undefined,
  });
});

test('Quota and budget deferrals expose the earliest retry only when every pending dependency is deferred', async () => {
  const soon = new Date(Date.now() + 3_600_000).toISOString();
  const later = new Date(Date.now() + 7_200_000).toISOString();
  await addJob('root-deferred', { error: 'budget', runAt: later });
  assert.equal(
    (await titleSearchStatus('root-deferred', database))?.state,
    'deferred',
  );
  await addJob('requested', {
    state: 'done',
    payload: { imports: ['quota-import', 'budget-import', 'finished-import'] },
  });
  await addJob('quota-import', { kind: 'import', error: 'quota', runAt: soon });
  await addJob('budget-import', {
    kind: 'import',
    error: 'budget',
    runAt: later,
  });
  await addJob('finished-import', { kind: 'import', state: 'done' });
  assert.deepEqual(await titleSearchStatus('requested', database), {
    statusKey: 'requested',
    resultsAvailable: false,
    state: 'deferred',
    retryAt: soon,
  });
  await d.query(
    "UPDATE jobs SET error_code='network' WHERE key='quota-import'",
  );
  assert.equal(
    (await titleSearchStatus('requested', database))?.state,
    'queued',
  );
  await d.query("UPDATE jobs SET state='running' WHERE key='quota-import'");
  assert.equal(
    (await titleSearchStatus('requested', database))?.state,
    'running',
  );
  await d.query(
    "UPDATE jobs SET state='queued',error_code='quota',run_at=now()-interval '1 second' WHERE key='quota-import'",
  );
  assert.equal(
    (await titleSearchStatus('requested', database))?.state,
    'queued',
  );
});

test('Completed lookup waits for its imports and reports total import failure without claiming results', async () => {
  await addJob('requested', {
    state: 'done',
    payload: {
      imports: ['first-import', 'second-import'],
      titleIds: ['tv:71641'],
    },
  });
  await addJob('first-import', { kind: 'import', state: 'dead' });
  await addJob('second-import', { kind: 'import' });
  assert.equal(
    (await titleSearchStatus('requested', database))?.state,
    'queued',
  );
  await d.query("UPDATE jobs SET state='running' WHERE key='second-import'");
  assert.equal(
    (await titleSearchStatus('requested', database))?.state,
    'running',
  );
  await d.query("UPDATE jobs SET state='dead' WHERE key='second-import'");
  assert.deepEqual(await titleSearchStatus('requested', database), {
    state: 'failed',
    statusKey: 'requested',
    resultsAvailable: false,
  });
});

test('Results become available only after a matching title is stored, including when offers are deferred', async () => {
  await addJob('requested', {
    state: 'done',
    payload: { imports: ['matched-import'], titleIds: ['tv:71641'] },
  });
  await addJob('matched-import', {
    kind: 'import',
    error: 'budget',
    runAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
  await d.query(
    "INSERT INTO titles(id,media_type,tmdb_id,data,revision) VALUES('tv:999','tv',999,'{}','test')",
  );
  assert.equal(
    (await titleSearchStatus('requested', database))?.resultsAvailable,
    false,
  );
  await d.query(
    "INSERT INTO titles(id,media_type,tmdb_id,data,revision) VALUES('tv:71641','tv',71641,'{}','test')",
  );
  const deferred = await titleSearchStatus('requested', database);
  assert.equal(deferred?.resultsAvailable, true);
  assert.equal(deferred?.state, 'deferred');
  await d.query("UPDATE jobs SET state='done' WHERE key='matched-import'");
  assert.deepEqual(await titleSearchStatus('requested', database), {
    statusKey: 'requested',
    state: 'complete',
    resultsAvailable: true,
  });
  await d.query("UPDATE jobs SET state='dead' WHERE key='matched-import'");
  assert.equal(
    (await titleSearchStatus('requested', database))?.state,
    'complete',
  );
});

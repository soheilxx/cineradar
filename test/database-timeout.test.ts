import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neonConfig } from '@neondatabase/serverless';
import { PGlite } from '@electric-sql/pglite';
import { db, queryWithStatementTimeout } from '../data/db';

test('Pooled PG timeout is transaction-local, cancelled writes roll back, and the borrowed connection is released', async () => {
  const local = new PGlite();
  const releases: boolean[] = [];
  const cancelled = Object.assign(
    new Error('canceling statement due to statement timeout'),
    { code: '57014' },
  );
  const connection = {
    async query(sql: string, params: unknown[] = []) {
      if (sql.startsWith('BEGIN; SET LOCAL')) {
        await local.exec(sql);
        return { rows: [] };
      }
      const result = await local.query(sql, params);
      if (sql.startsWith('INSERT INTO timeout_test')) throw cancelled;
      return { rows: result.rows };
    },
    release(destroy = false) {
      releases.push(destroy);
    },
  };
  try {
    await local.exec('CREATE TABLE timeout_test(id integer PRIMARY KEY)');
    const checked = await queryWithStatementTimeout<{
      timeout: string;
      value: number;
    }>(
      connection,
      "SELECT current_setting('statement_timeout') AS timeout,$1::int AS value",
      [42],
    );
    assert.deepEqual(checked.rows, [{ timeout: '30s', value: 42 }]);
    assert.equal(
      (
        await local.query<{ timeout: string }>(
          "SELECT current_setting('statement_timeout') AS timeout",
        )
      ).rows[0].timeout,
      '0',
    );
    await assert.rejects(
      () =>
        queryWithStatementTimeout(
          connection,
          'INSERT INTO timeout_test VALUES($1)',
          [1],
        ),
      (error: unknown) => error === cancelled,
    );
    assert.equal(
      (await local.query('SELECT * FROM timeout_test')).rows.length,
      0,
    );
    assert.equal(
      (
        await local.query<{ timeout: string }>(
          "SELECT current_setting('statement_timeout') AS timeout",
        )
      ).rows[0].timeout,
      '0',
    );
    assert.deepEqual(releases, [false, false]);
  } finally {
    await local.close();
  }
});

test('A failed rollback destroys the pooled connection and preserves the original SQL error', async () => {
  const cancelled = Object.assign(new Error('cancelled'), { code: '57014' });
  const releases: boolean[] = [];
  const connection = {
    async query(sql: string) {
      if (sql === 'ROLLBACK') throw new Error('connection lost');
      if (sql === 'SELECT expensive_work()') throw cancelled;
      return { rows: [] };
    },
    release(destroy = false) {
      releases.push(destroy);
    },
  };
  await assert.rejects(
    () => queryWithStatementTimeout(connection, 'SELECT expensive_work()'),
    (error: unknown) => error === cancelled,
  );
  assert.deepEqual(releases, [true]);
});

test('Neon sets a server timeout before each statement in one transaction and recovers after cancellation', async () => {
  const previous = { ...process.env },
    previousFetch = neonConfig.fetchFunction;
  Object.assign(process.env, {
    APP_MODE: 'live',
    DEPLOYMENT_ENV: 'local',
    DATABASE_DRIVER: 'neon',
    DATABASE_URL: 'postgres://unused:unused@database-timeout.invalid/test',
    TMDB_READ_ACCESS_TOKEN: 'test',
    SAA_API_KEY: 'test',
    SESSION_SECRET: 's'.repeat(32),
  });
  let requests = 0,
    cancelNext = false;
  neonConfig.fetchFunction = async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    requests++;
    const body = JSON.parse(init?.body as string) as {
      queries: { query: string; params: unknown[] }[];
    };
    assert.equal(
      body.queries.length,
      2,
      'Timeout setup and the real statement share a backend transaction',
    );
    assert.equal(
      body.queries[0].query,
      "SELECT set_config('statement_timeout',$1,true)",
    );
    assert.deepEqual(body.queries[0].params, ['30000']);
    assert.equal(body.queries[1].query, 'SELECT $1::int AS value');
    assert.ok(init?.signal instanceof AbortSignal);
    if (cancelNext) {
      cancelNext = false;
      return Response.json(
        {
          message: 'canceling statement due to statement timeout',
          severity: 'ERROR',
          code: '57014',
        },
        { status: 400 },
      );
    }
    return Response.json({
      results: [
        {
          fields: [{ name: 'set_config', dataTypeID: 25 }],
          rows: [['30000']],
          command: 'SELECT',
          rowCount: 1,
        },
        {
          fields: [{ name: 'value', dataTypeID: 23 }],
          rows: [[String(body.queries[1].params[0])]],
          command: 'SELECT',
          rowCount: 1,
        },
      ],
    });
  };
  try {
    const database = await db();
    assert.deepEqual(
      (await database.query('SELECT $1::int AS value', [42])).rows,
      [{ value: 42 }],
    );
    assert.equal(requests, 1);
    cancelNext = true;
    await assert.rejects(
      () => database.query('SELECT $1::int AS value', [43]),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '57014',
    );
    assert.deepEqual(
      (await database.query('SELECT $1::int AS value', [44])).rows,
      [{ value: 44 }],
    );
    assert.equal(requests, 3);
  } finally {
    process.env = previous;
    neonConfig.fetchFunction = previousFetch;
  }
});

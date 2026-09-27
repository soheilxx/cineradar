import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { withCronLease } from '../jobs/cron-lease';
import type { Database } from '../data/db';

test('cron excludes overlapping workers, releases failures and recovers dead owners', async () => {
  const pg = new PGlite();
  await pg.exec('CREATE TABLE operations(key text PRIMARY KEY,data jsonb NOT NULL,updated_at timestamptz DEFAULT now())');
  const database: Database = { query: async <T>(sql: string, params: unknown[] = []) => ({ rows: (await pg.query<T>(sql, params)).rows }) };
  try {
    let done!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { done = resolve; });
    const ready = new Promise<void>((resolve) => { entered = resolve; });
    const first = withCronLease(database, async () => { entered(); await gate; return 'first'; });
    await ready;
    assert.equal(await withCronLease(database, async () => { throw new Error('overlapping task ran'); }), null);
    done();
    assert.equal(await first, 'first');
    await assert.rejects(withCronLease(database, async () => { throw new Error('worker failed'); }), /worker failed/);
    assert.equal(await withCronLease(database, async () => 'recovered'), 'recovered');
    await pg.exec(`INSERT INTO operations VALUES('cron-lease',jsonb_build_object('token','dead','until',now()-interval '1 second'),now())`);
    assert.equal(await withCronLease(database, async () => 'expired'), 'expired');
    await withCronLease(database, async () => {
      // A late completion must never delete a newer owner's lease.
      await pg.exec(`UPDATE operations SET data=jsonb_build_object('token','newer','until',now()+interval '330 seconds') WHERE key='cron-lease'`);
    });
    assert.equal((await pg.query<{ token: string }>("SELECT data->>'token' AS token FROM operations")).rows[0].token, 'newer');
  } finally {
    await pg.close();
  }
});

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { readdir, readFile } from 'node:fs/promises';
import { fixtureCatalog } from './fixtures/catalog';
import { importMarkets } from '../jobs/handlers';
let d: PGlite;
before(async () => {
  d = new PGlite({ extensions: { pg_trgm, unaccent } });
  for (const f of (await readdir('db/migrations')).sort())
    await d.exec(await readFile('db/migrations/' + f, 'utf8'));
});
after(async () => {
  await d.close();
});
test('All PostgreSQL migrations apply; same numeric ID supports movie and TV', async () => {
  const title = fixtureCatalog()[0].title;
  await d.query('SELECT save_title($1)', [JSON.stringify(title)]);
  await d.query('SELECT save_title($1)', [
    JSON.stringify({ ...title, id: 'tv:' + title.tmdbId, type: 'tv' }),
  ]);
  assert.equal((await d.query('SELECT id FROM titles')).rows.length, 2);
  assert.equal((await d.query('SELECT * FROM localizations')).rows.length, 10);
});
test('Atomic budget prevents overspend and resets UTC day/month independently', async () => {
  const calls = await Promise.all(
    Array.from({ length: 20 }, () =>
      d.query<{ ok: boolean }>(
        "SELECT reserve_budget('saa',1,5,8,'2026-09-06T23:59:59Z') ok",
      ),
    ),
  );
  assert.equal(calls.filter((r) => r.rows[0].ok).length, 5);
  assert.equal(
    (
      await d.query<{ ok: boolean }>(
        "SELECT reserve_budget('saa',3,5,8,'2026-09-07T00:00:01Z') ok",
      )
    ).rows[0].ok,
    true,
  );
  assert.equal(
    (
      await d.query<{ ok: boolean }>(
        "SELECT reserve_budget('saa',1,5,8,'2026-09-07T00:00:02Z') ok",
      )
    ).rows[0].ok,
    false,
  );
  assert.equal(
    (
      await d.query<{ ok: boolean }>(
        "SELECT reserve_budget('saa',1,5,8,'2026-10-01T00:00:00Z') ok",
      )
    ).rows[0].ok,
    true,
  );
});
test('Reconciliation is idempotent and incomplete responses cannot delete offers', async () => {
  const x = fixtureCatalog()[0];
  await d.query('SELECT reconcile_offers($1,$2,$3,$4,true,true)', [
    x.title.id,
    'de',
    JSON.stringify(x.snapshot.offers),
    'run-1',
  ]);
  const before = (await d.query('SELECT * FROM changes')).rows.length;
  await d.query('SELECT reconcile_offers($1,$2,$3,$4,true,true)', [
    x.title.id,
    'de',
    JSON.stringify(x.snapshot.offers),
    'run-1',
  ]);
  assert.equal((await d.query('SELECT * FROM changes')).rows.length, before);
  await assert.rejects(
    d.query('SELECT reconcile_offers($1,$2,$3,$4,false,true)', [
      x.title.id,
      'de',
      '[]',
      'run-2',
    ]),
  );
  assert.equal(
    (await d.query('SELECT * FROM offers')).rows.length,
    x.snapshot.offers.length,
  );
  await d.query('SELECT reconcile_offers($1,$2,$3,$4,true,true)', [
    x.title.id,
    'de',
    '[]',
    'run-3',
  ]);
  assert.equal((await d.query('SELECT * FROM offers')).rows.length, 0);
  assert.equal(
    (
      await d.query<{ availability: string }>(
        'SELECT availability FROM snapshots',
      )
    ).rows[0].availability,
    'empty',
  );
});
test('Expired leases recover; concurrent claims do not claim same job', async () => {
  await d.exec(
    "INSERT INTO jobs(key,kind,payload,run_at) VALUES('job-a','import','{}','2026-09-01'),('job-b','import','{}','2026-09-01')",
  );
  const a = await d.query<{ id: number }>(
    "SELECT * FROM claim_job('worker-a','2026-09-06T00:00:00Z')",
  );
  const b = await d.query<{ id: number }>(
    "SELECT * FROM claim_job('worker-b','2026-09-06T00:00:00Z')",
  );
  assert.notEqual(a.rows[0].id, b.rows[0].id);
  assert.equal(
    (
      await d.query(
        "SELECT * FROM claim_job('worker-c','2026-09-06T00:00:10Z')",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await d.query(
        "SELECT * FROM claim_job('worker-c','2026-09-06T00:02:01Z')",
      )
    ).rows.length,
    1,
  );
});
test('Rate limit, contact durability, editorial preservation and slug history', async () => {
  for (let i = 0; i < 3; i++)
    assert.equal(
      (
        await d.query<{ ok: boolean }>(
          "SELECT rate_limit('report-test',3,60) ok",
        )
      ).rows[0].ok,
      true,
    );
  assert.equal(
    (await d.query<{ ok: boolean }>("SELECT rate_limit('report-test',3,60) ok"))
      .rows[0].ok,
    false,
  );
  await d.query(
    "INSERT INTO reports(locale,market,message) VALUES('en','de','This is a persisted test report')",
  );
  assert.equal((await d.query('SELECT * FROM reports')).rows.length, 1);
  const title = fixtureCatalog()[0].title;
  await d.query(
    "UPDATE localizations SET source='editorial',overview='Reviewed copy' WHERE title_id=$1 AND locale='de'",
    [title.id],
  );
  const altered = structuredClone(title);
  altered.localizations.de.slug = 'new-title-' + title.tmdbId;
  await d.query('SELECT save_title($1)', [JSON.stringify(altered)]);
  assert.equal(
    (
      await d.query<{ overview: string }>(
        "SELECT overview FROM localizations WHERE title_id=$1 AND locale='de'",
        [title.id],
      )
    ).rows[0].overview,
    'Reviewed copy',
  );
  assert.equal((await d.query('SELECT * FROM slug_history')).rows.length, 1);
});
test('Database dump restores into isolated PostgreSQL WASM instance', async () => {
  const dump = await d.dumpDataDir();
  const restored = new PGlite({
    loadDataDir: dump,
    extensions: { pg_trgm, unaccent },
  });
  await restored.waitReady;
  assert.equal((await restored.query('SELECT * FROM reports')).rows.length, 1);
  assert.equal(
    (await restored.query('SELECT * FROM budgets')).rows.length,
    (await d.query('SELECT * FROM budgets')).rows.length,
  );
  await restored.close();
});

test('Lease fencing rejects former worker and allows only current owner to commit', async () => {
  await d.exec(
    "INSERT INTO jobs(key,kind,payload) VALUES('fenced-job','reconcile','{}')",
  );
  const job = (
    await d.query<{ id: number }>(
      "UPDATE jobs SET state='running',lock_token='old',lock_until=now()+interval '2 minutes' WHERE key='fenced-job' RETURNING id",
    )
  ).rows[0];
  await d.query("UPDATE jobs SET lock_token='new' WHERE id=$1", [job.id]);
  const x = fixtureCatalog()[0];
  await assert.rejects(
    d.query('SELECT reconcile_job_offers($1,$2,$3,$4,true,$5,$6)', [
      x.title.id,
      'de',
      '[]',
      'fenced-run',
      job.id,
      'old',
    ]),
  );
  assert.equal(
    (
      await d.query<{ state: string }>(
        'SELECT reconcile_job_offers($1,$2,$3,$4,true,$5,$6) AS state',
        [x.title.id, 'de', '[]', 'fenced-run', job.id, 'new'],
      )
    ).rows[0].state,
    'committed',
  );
  const title = (
    await d.query<{ data: { localizations: { de: { overview: string } } } }>(
      'SELECT data FROM titles WHERE id=$1',
      [x.title.id],
    )
  ).rows[0].data;
  assert.equal(title.localizations.de.overview, 'Reviewed copy');
});

test('Country catalog refresh preserves offers and snapshot in other countries', async () => {
  const x = fixtureCatalog()[0];
  const french = x.snapshot.offers.map((offer) => ({
    ...offer,
    id: 'fr-' + offer.id,
    market: 'fr',
  }));
  await d.query('SELECT reconcile_offers($1,$2,$3,$4,true,true)', [
    x.title.id,
    'fr',
    JSON.stringify(french),
    'fr-existing',
  ]);
  const before = (
    await d.query('SELECT * FROM snapshots WHERE title_id=$1 AND market=$2', [
      x.title.id,
      'fr',
    ])
  ).rows;
  for (const market of importMarkets(
    { kind: 'catalog-title', payload: { market: 'de' } },
    ['de', 'fr', 'it', 'es'],
  )) {
    await d.query('SELECT reconcile_offers($1,$2,$3,$4,true,true)', [
      x.title.id,
      market,
      '[]',
      'de-catalog-empty',
    ]);
  }
  assert.equal(
    (await d.query('SELECT id FROM offers WHERE market=$1', ['fr'])).rows
      .length,
    french.length,
  );
  assert.deepEqual(
    (
      await d.query('SELECT * FROM snapshots WHERE title_id=$1 AND market=$2', [
        x.title.id,
        'fr',
      ])
    ).rows,
    before,
  );
  assert.throws(() =>
    importMarkets({ kind: 'catalog-title', payload: {} }, ['de', 'fr']),
  );
  assert.throws(() =>
    importMarkets({ kind: 'catalog-title', payload: { market: 'us' } }, [
      'de',
      'fr',
    ]),
  );
});

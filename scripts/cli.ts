import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';
import { db } from '../data/db';
import { config } from '../lib/config';
import { run, tick } from '../jobs/worker';
import { enqueue } from '../jobs/queue';
const command = process.argv[2];
if (command === 'worker') await run();
else if (command === 'migrate') {
  const c = config();
  const d = new Client({
    connectionString: c.DATABASE_URL_UNPOOLED || c.DATABASE_URL,
  });
  await d.connect();
  await d.query("SELECT pg_advisory_lock(hashtext('cineradar:migrations'))");
  await d.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of (await readdir('db/migrations'))
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    if (
      (
        await d.query('SELECT 1 FROM schema_migrations WHERE version=$1', [
          name,
        ])
      ).rows.length
    )
      continue;
    const sql = await readFile('db/migrations/' + name, 'utf8');
    await d.query('BEGIN');
    try {
      await d.query(sql);
      await d.query('INSERT INTO schema_migrations(version) VALUES($1)', [
        name,
      ]);
      await d.query('COMMIT');
      console.log('Applied', name);
    } catch (e) {
      await d.query('ROLLBACK');
      throw e;
    }
  }
  await d.query("SELECT pg_advisory_unlock(hashtext('cineradar:migrations'))");
  await d.end();
} else if (command === 'bootstrap') {
  const c = config();
  const dry = process.argv.includes('--dry-run');
  console.log(
    JSON.stringify({
      dryRun: dry,
      markets: c.markets,
      maxTitles: 10,
      tmdbRequests: 61,
      saaRequests: 11,
      estimatedSaaUnits: 11 * c.SAA_ENDPOINT_WEIGHT,
    }),
  );
  if (!dry) {
    await enqueue('manual-countries:' + Date.now(), 'countries', {});
    await enqueue('manual-bootstrap:' + Date.now(), 'bootstrap', {});
    await (await db()).close?.();
  }
} else if (command === 'catalog') {
  const c = config();
  const dry = process.argv.includes('--dry-run');
  const at = process.argv.indexOf('--pages');
  const pages = at < 0 ? 25 : Number(process.argv[at + 1]);
  if (!Number.isInteger(pages) || pages < 1 || pages > 500)
    throw Error('--pages must be between 1 and 500');
  const orderAt = process.argv.indexOf('--order');
  const order = orderAt < 0 ? 'popularity_1year' : process.argv[orderAt + 1];
  if (!['popularity_1year', 'popularity_1week', 'release_date'].includes(order))
    throw Error('Invalid catalog order');
  const batch =
    new Date().toISOString().slice(0, 10) + ':' + order + ':' + pages;
  console.log(
    JSON.stringify({
      dryRun: dry,
      markets: c.markets,
      pagesPerType: pages,
      order,
      maxSaaRequests: c.markets.length * 2 * pages,
      maxTitleMarketPairs: c.markets.length * 30 * pages,
      metadataLanguages: 5,
    }),
  );
  if (!dry) {
    for (const market of c.markets)
      for (const type of ['movie', 'tv']) {
        await enqueue(
          `catalog-page:${batch}:${market}:${type}:1`,
          'catalog-page',
          { market, type, page: 1, maxPages: pages, batch, order },
        );
      }
    await (await db()).close?.();
  }
} else if (command === 'budget') {
  const c = config();
  console.log(
    JSON.stringify(
      {
        unit: 'plan-weighted units',
        buffer: c.BUDGET_BUFFER,
        configured: {
          daily: c.SAA_DAILY_BUDGET,
          monthly: c.SAA_MONTHLY_BUDGET,
        },
        monthlyAssumption: {
          countries: 30,
          discovery: 30,
          reconciliations: 50 * 30,
          changePages: 4 * 3 * 4 * 30,
        },
        saaTotal: (30 + 30 + 1500 + 1440) * c.SAA_ENDPOINT_WEIGHT,
        tmdbMonthlyAssumption: 30 + 50 * 5 * 4 + 30 * 10 * 5,
        warning:
          'Estimate assumes one page per change query. Actual plan and pagination must be verified.',
      },
      null,
      2,
    ),
  );
} else if (command === 'tick') {
  await tick();
  await (await db()).close?.();
} else
  throw new Error(
    'Expected migrate, worker, bootstrap, catalog, budget or tick',
  );

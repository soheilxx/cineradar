import { db } from '../data/db';
import { config } from '../lib/config';
import { tick } from '../jobs/worker';

// An explicit, bounded import process. It never starts the recurring scheduler.
const c = config();
if (c.APP_MODE !== 'live')
  throw Error('A configured live database is required');
const index = process.argv.indexOf('--seconds');
const seconds = index < 0 ? 1800 : Number(process.argv[index + 1]);
if (!Number.isInteger(seconds) || seconds < 1 || seconds > 7200)
  throw Error('--seconds must be between 1 and 7200');
process.env.SYNC_ENABLED = 'true';
config();
const deadline = Date.now() + seconds * 1000;
let stop = false;
process.on('SIGTERM', () => {
  stop = true;
});
process.on('SIGINT', () => {
  stop = true;
});
const database = await db();
async function drain() {
  while (!stop && Date.now() < deadline) {
    try {
      if (await tick()) continue;
      const pending = await database.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM jobs WHERE state IN ('queued','running') AND kind IN ('catalog-page','catalog-title')",
      );
      if (!pending.rows[0].count) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch {
      console.log(JSON.stringify({ event: 'worker_retry', code: 'database' }));
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
try {
  await Promise.all(Array.from({ length: 4 }, () => drain()));
  console.log(
    JSON.stringify({
      finished: !stop && Date.now() < deadline,
      jobs: (
        await database.query(
          'SELECT state,kind,error_code,count(*)::int AS count FROM jobs GROUP BY state,kind,error_code ORDER BY state,kind',
        )
      ).rows,
      data: (
        await database.query(
          'SELECT (SELECT count(*)::int FROM titles) AS titles,(SELECT count(*)::int FROM offers) AS offers',
        )
      ).rows,
    }),
  );
} finally {
  await database.close?.();
}

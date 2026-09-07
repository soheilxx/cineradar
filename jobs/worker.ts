import { db } from '../data/db';
import { config } from '../lib/config';
import { handle } from './handlers';
import { schedule } from './scheduler';
import { backoff, type Job } from './queue';
import { ProviderError } from '../data/providers/http';
import { log } from '../observability/log';
export async function tick() {
  const c = config();
  if (c.SYNC_ENABLED !== 'true') return false;
  const database = await db();
  const paused = (
    await database.query<{ data: { paused: boolean } }>(
      "SELECT data FROM operations WHERE key='sync'",
    )
  ).rows[0]?.data.paused;
  if (paused) return false;
  const token = crypto.randomUUID();
  const job = (
    await database.query<Job>('SELECT * FROM claim_job($1)', [token])
  ).rows[0];
  if (!job) return false;
  const start = Date.now();
  const interval = setInterval(() => {
    void database
      .query(
        "UPDATE jobs SET heartbeat=now(),lock_until=now()+interval '2 minutes' WHERE id=$1 AND lock_token=$2 AND state='running'",
        [job.id, token],
      )
      .catch(() => {});
  }, 30000);
  try {
    await handle(job);
    await database.query(
      "UPDATE jobs SET state='done',lock_until=null WHERE id=$1 AND lock_token=$2 AND state='running'",
      [job.id, token],
    );
    log('job_completed', {
      kind: job.kind,
      id: job.id,
      durationMs: Date.now() - start,
    });
  } catch (e) {
    const code = e instanceof ProviderError ? e.code : 'internal';
    const deferred = code === 'budget' || code === 'quota';
    const dead =
      !deferred &&
      (job.attempts >= 6 || ['auth', 'schema', 'missing'].includes(code));
    let wait = backoff(
      job.attempts,
      e instanceof ProviderError ? e.retryAfter : 0,
    );
    if (code === 'budget') {
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 1, 0, 0);
      wait = tomorrow.getTime() - Date.now();
    } else if (code === 'quota') wait = Math.max(wait, 3600000);
    await database.query(
      'UPDATE jobs SET state=$3,error_code=$4,run_at=$5,lock_until=null,attempts=GREATEST(0,attempts-$6) WHERE id=$1 AND lock_token=$2',
      [
        job.id,
        token,
        dead ? 'dead' : 'queued',
        code,
        new Date(Date.now() + wait).toISOString(),
        deferred ? 1 : 0,
      ],
    );
    log('job_failed', { kind: job.kind, id: job.id, code });
  } finally {
    clearInterval(interval);
  }
  return true;
}
export async function run() {
  config();
  let stop = false;
  process.on('SIGTERM', () => {
    stop = true;
  });
  process.on('SIGINT', () => {
    stop = true;
  });
  let scheduled = 0;
  while (!stop) {
    try {
      if (Date.now() - scheduled > 60000) {
        await schedule();
        scheduled = Date.now();
      }
      const busy = await tick();
      if (!busy) await new Promise((r) => setTimeout(r, 1000));
    } catch {
      log('worker_error', { code: 'database' });
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  await (await db()).close?.();
}

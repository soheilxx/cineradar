import { config } from '../lib/config';
import { db, type Database } from '../data/db';
import { OMDb } from '../data/providers/omdb';
import { OmdbError } from '../domain/enrichment';
import {
  claimOmdb,
  failOmdb,
  finishOmdb,
  registerOmdbTitles,
  reserveOmdbRequest,
} from '../data/repositories/enrichment';

export async function runOmdbBatch(
  options: {
    database?: Database;
    maxDurationMs?: number;
    maxJobs?: number;
    registerLimit?: number;
    fetcher?: typeof fetch;
  } = {},
) {
  const c = config();
  const result = {
    enabled: c.omdbEnabled,
    registered: 0,
    completed: 0,
    failed: 0,
    lost: 0,
    deferred: 0,
  };
  if (!c.omdbEnabled) return result;
  const duration = Math.max(
    0,
    Math.min(120000, options.maxDurationMs ?? 45000),
  );
  const maxJobs = Math.max(0, Math.min(100, Math.floor(options.maxJobs ?? 25)));
  if (duration < 11000 || !maxJobs) return result;
  const deadline = Date.now() + duration;
  const database = options.database ?? (await db());
  result.registered = await registerOmdbTitles(
    database,
    Math.min(1000, options.registerLimit ?? 250),
  );
  const provider = new OMDb(
    () => reserveOmdbRequest(database, c.OMDB_DAILY_BUDGET),
    options.fetcher,
  );
  // Each request has a ten-second timeout; leave room for it and its durable commit.
  for (
    let started = 0;
    started < maxJobs && Date.now() + 11000 < deadline;
    started++
  ) {
    const job = await claimOmdb(database);
    if (!job) break;
    try {
      const data = await provider.title(job.imdb_id, job.media_type);
      if (await finishOmdb(job, data, database)) result.completed++;
      else result.lost++;
    } catch (error) {
      const known =
        error instanceof OmdbError ? error : new OmdbError('upstream');
      if (!(await failOmdb(job, known.code, known.retryAfter, database)))
        result.lost++;
      else if (known.code === 'budget') result.deferred++;
      else result.failed++;
      if (['budget', 'quota', 'auth', 'disabled'].includes(known.code)) break;
    }
  }
  return result;
}

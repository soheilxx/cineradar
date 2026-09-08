import { config } from '../lib/config';
import type { Database } from '../data/db';
import {
  claimMedia,
  failMedia,
  finishMedia,
  mediaStats,
  registerMediaSources,
  renewMedia,
} from '../data/media/repository';
import { processMedia } from '../data/media/process';
import { MediaError } from '../data/media/source';

export async function runMediaBatch(
  options: {
    maxJobs?: number;
    maxDurationMs?: number;
    registerLimit?: number;
    database?: Database;
  } = {},
) {
  const c = config();
  if (!c.mediaEnabled)
    return { enabled: false, registered: 0, completed: 0, failed: 0, lost: 0 };
  const { database } = options;
  const registered = await registerMediaSources(
    database,
    Math.min(1000, options.registerLimit ?? 250),
  );
  const deadline =
    Date.now() + Math.min(120000, options.maxDurationMs ?? 40000);
  const maxJobs = Math.min(c.MEDIA_DOWNLOADS_PER_MINUTE, options.maxJobs ?? 40);
  let started = 0,
    completed = 0,
    failed = 0,
    lost = 0;
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (Date.now() < deadline && started < maxJobs) {
        started++;
        const job = await claimMedia(database);
        if (!job) break;
        const heartbeat = setInterval(() => {
          void renewMedia(job, database).catch(() => {});
        }, 30000);
        try {
          const result = await processMedia(job);
          if (await finishMedia(job, result, database)) completed++;
          else lost++;
        } catch (error) {
          const known = error instanceof MediaError;
          await failMedia(
            job,
            known ? error.code : 'processing_failed',
            known && error.permanent,
            database,
          );
          failed++;
        } finally {
          clearInterval(heartbeat);
        }
      }
    }),
  );
  return {
    enabled: true,
    registered,
    completed,
    failed,
    lost,
    states: await mediaStats(database),
  };
}

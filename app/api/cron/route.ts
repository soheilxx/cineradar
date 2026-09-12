import { schedule } from '@/jobs/scheduler';
import { config } from '@/lib/config';
import { equal, json } from '@/lib/security';
import { db } from '@/data/db';
import { tick } from '@/jobs/worker';
import { publishSitemaps } from '@/seo/sitemap-publish';
import { runMediaBatch } from '@/jobs/media';
import { runTvmazeBatch } from '@/jobs/tvmaze';
import { runOmdbBatch } from '@/jobs/omdb';
import { runProviderDiscovery } from '@/jobs/provider-discovery';
export const maxDuration = 300;
export async function POST(req: Request) {
  const key = config().CRON_SECRET;
  if (!key || !equal(req.headers.get('authorization') || '', 'Bearer ' + key))
    return json({}, 401);
  let sitemap:
    | Awaited<ReturnType<typeof publishSitemaps>>
    | { state: 'failed' };
  try {
    sitemap = await publishSitemaps();
  } catch {
    // A sitemap export failure retains the published generation and must not
    // prevent the independent catalog worker or retention cleanup from running.
    sitemap = { state: 'failed' };
  }
  if (config().DATABASE_URL) {
    const database = await db();
    await database.query(
      "DELETE FROM reports WHERE created_at<now()-interval '89 days'",
    );
    await database.query('DELETE FROM rate_limits WHERE expires_at<now()');
  }
  await schedule();
  let completed = 0;
  let failed = 0;
  const extras = await Promise.allSettled([
    runMediaBatch(),
    runTvmazeBatch({ maxDurationMs: 35000, maxRequests: 25, maxPages: 4 }),
    runOmdbBatch({ maxDurationMs: 30000, maxJobs: 20 }),
    runProviderDiscovery({ maxDurationMs: 25000 }),
  ]);
  const media = extras[0].status === 'fulfilled' ? extras[0].value : { error: true };
  const supplemental = extras.slice(1).map((result, index) => ({
    source: ['tvmaze', 'omdb', 'discovery'][index],
    result:
      result.status === 'fulfilled' ? result.value : { error: 'worker_failed' },
  }));
  if (config().SYNC_ENABLED === 'true') {
    const deadline = Date.now() + 45000;
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, async () => {
        while (Date.now() < deadline) {
          if (!(await tick())) break;
          completed++;
        }
      }),
    );
    failed = results.filter((result) => result.status === 'rejected').length;
    await (
      await db()
    ).query(
      "INSERT INTO operations(key,data) VALUES('hosted-worker',$1) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data,updated_at=now()",
      [
        JSON.stringify({
          heartbeat: new Date().toISOString(),
          completed,
          failed,
        }),
      ],
    );
  }
  return json(
    {
      scheduled: config().SYNC_ENABLED === 'true',
      completed,
      failed,
      sitemap,
      media,
      supplemental,
    },
    failed || sitemap.state === 'failed' || 'error' in media ? 503 : 200,
  );
}
export const GET = POST;

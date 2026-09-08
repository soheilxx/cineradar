import { schedule } from '@/jobs/scheduler';
import { config } from '@/lib/config';
import { equal, json } from '@/lib/security';
import { db } from '@/data/db';
import { tick } from '@/jobs/worker';
import { publishSitemaps } from '@/seo/sitemap-publish';
import { runMediaBatch } from '@/jobs/media';
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
  let media: Awaited<ReturnType<typeof runMediaBatch>> | { error: true };
  try {
    media = await runMediaBatch();
  } catch {
    media = { error: true };
  }
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
    },
    failed || sitemap.state === 'failed' || 'error' in media ? 503 : 200,
  );
}
export const GET = POST;

import { schedule } from '@/jobs/scheduler';
import { config } from '@/lib/config';
import { equal, json } from '@/lib/security';
import { db } from '@/data/db';
import { tick } from '@/jobs/worker';
export const maxDuration = 300;
export async function POST(req: Request) {
  const key = config().CRON_SECRET;
  if (!key || !equal(req.headers.get('authorization') || '', 'Bearer ' + key))
    return json({}, 401);
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
    { scheduled: config().SYNC_ENABLED === 'true', completed, failed },
    failed ? 503 : 200,
  );
}
export const GET = POST;

import { schedule } from '@/jobs/scheduler';
import { config } from '@/lib/config';
import { equal, json } from '@/lib/security';
import { db } from '@/data/db';
export const maxDuration = 120;
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
  return json({ scheduled: config().SYNC_ENABLED === 'true' });
}
export const GET = POST;

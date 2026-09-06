import { schedule } from '@/jobs/scheduler';
import { config } from '@/lib/config';
import { equal, json } from '@/lib/security';
export async function POST(req: Request) {
  const key = config().CRON_SECRET;
  if (!key || !equal(req.headers.get('authorization') || '', 'Bearer ' + key))
    return json({}, 401);
  await schedule();
  return json({ scheduled: config().SYNC_ENABLED === 'true' });
}

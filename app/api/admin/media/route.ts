import { config } from '@/lib/config';
import { equal, json } from '@/lib/security';
import { runMediaBatch } from '@/jobs/media';
import { mediaStats } from '@/data/media/repository';
export const runtime = 'nodejs';
export const maxDuration = 180;
function authorized(request: Request) {
  const key = config().CRON_SECRET;
  return (
    !!key && equal(request.headers.get('authorization') || '', 'Bearer ' + key)
  );
}
export async function GET(request: Request) {
  if (!authorized(request)) return json({}, 401);
  return json({ enabled: config().mediaEnabled, states: await mediaStats() });
}
export async function POST(request: Request) {
  if (!authorized(request)) return json({}, 401);
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({}, 400);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return json({}, 400);
  const maxJobs = ('maxJobs' in input ? input.maxJobs : undefined) ?? 10;
  if (
    typeof maxJobs !== 'number' ||
    !Number.isInteger(maxJobs) ||
    maxJobs < 1 ||
    maxJobs > 60
  )
    return json({}, 400);
  const result = await runMediaBatch({
    maxJobs,
    maxDurationMs: 60000,
    registerLimit: 1000,
  });
  return json(result);
}

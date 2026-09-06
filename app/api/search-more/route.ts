import { z } from 'zod';
import { json, rate, sameOrigin } from '@/lib/security';
import { config } from '@/lib/config';
import { enqueue } from '@/jobs/queue';
import { hash } from '@/data/providers/tmdb';
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({}, 403);
  const c = config();
  if (c.APP_MODE !== 'live' || c.SYNC_ENABLED !== 'true') return json({}, 503);
  const p = z
    .object({
      query: z.string().trim().min(2).max(120),
      locale: z.enum(['de', 'fr', 'it', 'es', 'en']),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return json({}, 400);
  if (!(await rate(req, 'external_search', 10, 3600))) return json({}, 429);
  await enqueue(
    'search:' +
      (await hash(p.data.locale + ':' + p.data.query.toLowerCase())) +
      ':' +
      new Date().toISOString().slice(0, 10),
    'search',
    p.data,
  );
  return json({ queued: true }, 202);
}

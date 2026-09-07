import { z } from 'zod';
import { after } from 'next/server';
import { json, rate, sameOrigin } from '@/lib/security';
import { config } from '@/lib/config';
import { requestTitleSearch, titleSearchStatus } from '@/jobs/search';
import { tick } from '@/jobs/worker';
import { defaultMarkets } from '@/i18n/config';
export const maxDuration = 60;
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') || '';
  if (!/^search:[a-f0-9]{64}:\d{4}-\d{2}-\d{2}$/.test(key))
    return json({}, 400);
  if (!(await rate(req, 'external_search_status', 90))) return json({}, 429);
  const status = await titleSearchStatus(key);
  return status ? json(status) : json({}, 404);
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({}, 403);
  const c = config();
  if (c.APP_MODE !== 'live' || c.SYNC_ENABLED !== 'true') return json({}, 503);
  const p = z
    .object({
      query: z.string().trim().min(2).max(120),
      locale: z.enum(['de', 'fr', 'it', 'es', 'en']),
      market: z
        .string()
        .regex(/^[a-z]{2}$/)
        .optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return json({}, 400);
  const market = p.data.market || defaultMarkets[p.data.locale];
  if (!c.markets.includes(market)) return json({}, 400);
  if (!(await rate(req, 'external_search', 10, 3600))) return json({}, 429);
  const status = await requestTitleSearch(p.data.query, p.data.locale, market);
  if (!status) return json({}, 503);
  if (status.state === 'queued' || status.state === 'running')
    after(async () => {
      const deadline = Date.now() + 45000;
      try {
        while (Date.now() < deadline && (await tick(status.statusKey))) {
          /* Bounded work for this submitted query only. */
        }
      } catch {
        console.error('Title search worker could not complete');
      }
    });
  return json(status, status.state === 'complete' ? 200 : 202);
}

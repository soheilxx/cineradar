import { z } from 'zod';
import { getTitle, changes } from '@/data/repositories/catalog';
import { config } from '@/lib/config';
import { json, sameOrigin, rate } from '@/lib/security';
const schema = z.object({
  locale: z.enum(['de', 'fr', 'it', 'es', 'en']),
  market: z.string().regex(/^[a-z]{2}$/),
  items: z
    .array(
      z.object({
        id: z.string().regex(/^(movie|tv):\d+$/),
        market: z.string().regex(/^[a-z]{2}$/),
        at: z.iso.datetime(),
        providers: z.array(z.string()).optional(),
      }),
    )
    .max(100),
});
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({}, 403);
  if (Number(request.headers.get('content-length') || 0) > 50000)
    return json({}, 413);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !config().markets.includes(parsed.data.market))
    return json({}, 400);
  if (!(await rate(request, 'watchlist', 30))) return json({}, 429);
  const { items, market } = parsed.data;
  const found = [];
  const events = [];
  for (const item of items) {
    if (item.market !== market) continue;
    const title = await getTitle(item.id, market);
    if (title) found.push(title);
    events.push(...(await changes(item.id, market, item.at)));
  }
  return json({ items: found, changes: events });
}

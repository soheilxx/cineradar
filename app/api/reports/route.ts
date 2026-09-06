import { z } from 'zod';
import { db } from '@/data/db';
import { config } from '@/lib/config';
import { json, sameOrigin, rate } from '@/lib/security';
const schema = z.object({
  locale: z.enum(['de', 'fr', 'it', 'es', 'en']),
  market: z.string().regex(/^[a-z]{2}$/),
  titleId: z
    .string()
    .regex(/^(movie|tv):\d+$/)
    .optional(),
  message: z.string().trim().min(10).max(3000),
  email: z.email().max(254).optional(),
  website: z.literal('').optional(),
});
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({}, 403);
  if (!config().DATABASE_URL) return json({ error: 'not_configured' }, 503);
  if (Number(req.headers.get('content-length') || 0) > 20000)
    return json({}, 413);
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success || !config().markets.includes(p.data.market))
    return json({}, 400);
  if (!(await rate(req, 'reports', 5, 3600))) return json({}, 429);
  try {
    const v = p.data;
    const r = await (
      await db()
    ).query(
      'INSERT INTO reports(locale,market,title_id,message,email) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [v.locale, v.market, v.titleId || null, v.message, v.email || null],
    );
    return json({ saved: !!r.rows[0] }, 201);
  } catch {
    return json({ error: 'storage' }, 503);
  }
}

import { contactSchema } from '@/lib/contact-schema';
import { db } from '@/data/db';
import { config } from '@/lib/config';
import { json, sameOrigin, rate } from '@/lib/security';
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({}, 403);
  if (!config().DATABASE_URL) return json({ error: 'not_configured' }, 503);
  if (Number(req.headers.get('content-length') || 0) > 20000)
    return json({}, 413);
  const p = contactSchema.safeParse(await req.json().catch(() => null));
  if (!p.success || !config().markets.includes(p.data.market))
    return json({}, 400);
  if (!(await rate(req, 'reports', 5, 3600))) return json({}, 429);
  try {
    const v = p.data;
    const r = await (
      await db()
    ).query(
      'INSERT INTO reports(locale,market,title_id,message,email,name,subject) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [
        v.locale,
        v.market,
        v.titleId || null,
        v.message,
        v.email,
        v.name,
        v.subject,
      ],
    );
    return json({ saved: !!r.rows[0] }, 201);
  } catch {
    return json({ error: 'storage' }, 503);
  }
}

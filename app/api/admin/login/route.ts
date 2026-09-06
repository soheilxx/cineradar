import { formText } from '@/lib/security';
import { config } from '@/lib/config';
import { sameOrigin, rate, equal, issueSession, json } from '@/lib/security';
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({}, 403);
  const c = config();
  if (!c.ADMIN_KEY || !c.DATABASE_URL) return json({}, 503);
  if (!(await rate(req, 'admin_login', 5, 900))) return json({}, 429);
  const f = await req.formData();
  const key = formText(f, 'key');
  if (!equal(key, c.ADMIN_KEY)) return json({ error: 'unauthorized' }, 401);
  const raw = formText(f, 'returnTo', '/');
  const target = /^\/(de|fr|it|es|en)\/[a-z]{2}\/[a-z-]+\/$/.test(raw)
    ? raw
    : '/';
  return new Response(null, {
    status: 303,
    headers: {
      Location: target,
      'Set-Cookie': `cr_admin=${await issueSession()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${new URL(c.SITE_URL).protocol === 'https:' ? '; Secure' : ''}`,
      'Cache-Control': 'private, no-store',
    },
  });
}

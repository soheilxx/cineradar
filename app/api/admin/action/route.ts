import { formText } from '@/lib/security';
import { db } from '@/data/db';
import { admin, sameOrigin, json } from '@/lib/security';
export async function POST(req: Request) {
  if (!sameOrigin(req) || !(await admin())) return json({}, 403);
  const f = await req.formData();
  const action = formText(f, 'action');
  const id = Number(f.get('id'));
  const d = await db();
  if (action === 'pause' || action === 'resume')
    await d.query(
      "INSERT INTO operations(key,data) VALUES('sync',$1) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data,updated_at=now()",
      [JSON.stringify({ paused: action === 'pause' })],
    );
  else if (action === 'retry' && Number.isSafeInteger(id) && id > 0)
    await d.query(
      "UPDATE jobs SET state='queued',attempts=0,run_at=now(),error_code=null WHERE id=$1 AND state IN('dead','paused')",
      [id],
    );
  else if (action === 'resolve' && Number.isSafeInteger(id) && id > 0)
    await d.query('UPDATE reports SET resolved=true WHERE id=$1', [id]);
  else if (action !== 'logout') return json({}, 400);
  await d.query('INSERT INTO audit_events(event,subject) VALUES($1,$2)', [
    action,
    String(id || 'sync'),
  ]);
  const raw = formText(f, 'returnTo', '/');
  const target = /^\/(de|fr|it|es|en)\/[a-z]{2}\/[a-z-]+\/$/.test(raw)
    ? raw
    : '/';
  return new Response(null, {
    status: 303,
    headers: {
      Location: target,
      'Cache-Control': 'private, no-store',
      ...(action === 'logout'
        ? {
            'Set-Cookie':
              'cr_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
          }
        : {}),
    },
  });
}

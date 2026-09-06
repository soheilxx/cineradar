import { config } from './config';
import { db } from '@/data/db';
import { cookies } from 'next/headers';
const enc = new TextEncoder();
async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(config().SESSION_SECRET || ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload))),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export function equal(a: string, b: string) {
  let n = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    n |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return n === 0;
}
export async function issueSession() {
  const payload = String(Date.now() + 8 * 3600000) + '.' + crypto.randomUUID();
  return payload + '.' + (await sign(payload));
}
export async function admin() {
  if (!config().ADMIN_KEY || !config().SESSION_SECRET) return false;
  const cookie = (await cookies()).get('cr_admin')?.value;
  if (!cookie) return false;
  const parts = cookie.split('.');
  return (
    parts.length === 3 &&
    Number(parts[0]) > Date.now() &&
    equal(parts[2], await sign(parts.slice(0, 2).join('.')))
  );
}
export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(config().SITE_URL).origin;
}
export async function rate(
  request: Request,
  scope: string,
  limit = 30,
  seconds = 60,
) {
  if (!config().DATABASE_URL) return config().APP_MODE === 'fixture';
  const ip = request.headers.get('cf-connecting-ip') || 'shared';
  const key = await sign(scope + ':' + ip);
  return (
    await (
      await db()
    ).query<{ ok: boolean }>('SELECT rate_limit($1,$2,$3) AS ok', [
      key,
      limit,
      seconds,
    ])
  ).rows[0].ok;
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export function formText(form: FormData, key: string, fallback = '') {
  const value = form.get(key);
  return typeof value === 'string' ? value : fallback;
}

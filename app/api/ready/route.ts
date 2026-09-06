import { db } from '@/data/db';
import { config } from '@/lib/config';
import { json } from '@/lib/security';
export async function GET() {
  const c = config();
  if (c.APP_MODE !== 'live' || !c.DATABASE_URL)
    return json({ ready: false }, 503);
  try {
    await (await db()).query('SELECT 1');
    return json({ ready: true });
  } catch {
    return json({ ready: false }, 503);
  }
}

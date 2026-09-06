import { config } from '@/lib/config';
import { db } from '@/data/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  const c = config();
  let maps = '';
  if (c.DEPLOYMENT_ENV === 'production' && c.APP_MODE === 'live') {
    const result = await (
      await db()
    ).query<{ count: string }>(
      "SELECT count(*) FROM titles t JOIN snapshots s ON s.title_id=t.id WHERE t.data->>'indexable'='true' AND s.availability IN('available','empty') AND s.checked_at>now()-interval '36 hours'",
    );
    maps = Array.from(
      { length: Math.ceil(Number(result.rows[0].count) / 2000) },
      (_, i) =>
        `<sitemap><loc>${c.SITE_URL}/sitemaps/titles.xml?page=${i + 1}</loc></sitemap>`,
    ).join('');
  }
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${maps}</sitemapindex>`,
    {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}

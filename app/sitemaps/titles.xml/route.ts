import { config } from '@/lib/config';
import { db } from '@/data/db';
import { locales } from '@/i18n/config';
import { path } from '@/i18n/routes';
import type { Title } from '@/domain/types';
import { readableTitle } from '@/seo/content';
export const dynamic = 'force-dynamic';
const escape = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export async function GET(request: Request) {
  const c = config();
  const page = Number(new URL(request.url).searchParams.get('page') || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    return new Response('Invalid page', { status: 400 });
  let urls = '';
  if (
    c.DEPLOYMENT_ENV === 'production' &&
    c.APP_MODE === 'live' &&
    c.LEGAL_APPROVED === 'true' &&
    c.LICENSES_CONFIRMED === 'true'
  ) {
    const rows = (
      await (
        await db()
      ).query<{
        data: Title;
        market: string;
        updated_at: string;
        has_offers: boolean;
      }>(
        "SELECT t.data,s.market,GREATEST(t.updated_at,s.changed_at) updated_at,EXISTS(SELECT 1 FROM offers o WHERE o.title_id=t.id AND o.market=s.market AND (o.expires_at IS NULL OR o.expires_at>=now())) has_offers FROM titles t JOIN snapshots s ON s.title_id=t.id WHERE t.data->>'year' IS NOT NULL AND s.availability IN('available','empty') AND s.checked_at IS NOT NULL ORDER BY t.id,s.market LIMIT 2000 OFFSET $1",
        [(page - 1) * 2000],
      )
    ).rows;
    urls = rows
      .flatMap((r) =>
        locales
          .filter((l) => readableTitle(r.data, l, r.has_offers))
          .map(
            (l) =>
              `<url><loc>${escape(c.SITE_URL + path(l, r.market, r.data.type, r.data.localizations[l].slug))}</loc><lastmod>${new Date(r.updated_at).toISOString()}</lastmod></url>`,
          ),
      )
      .join('');
  }
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}

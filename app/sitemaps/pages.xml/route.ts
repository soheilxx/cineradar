import { config } from '@/lib/config';
import { db } from '@/data/db';
import { locales } from '@/i18n/config';
import { path } from '@/i18n/routes';
export const dynamic = 'force-dynamic';
export async function GET() {
  const c = config();
  const paths: string[] = [];
  if (
    c.DEPLOYMENT_ENV === 'production' &&
    c.APP_MODE === 'live' &&
    c.LEGAL_APPROVED === 'true' &&
    c.LICENSES_CONFIRMED === 'true'
  ) {
    const providers = (
      await (
        await db()
      ).query<{ market: string; id: string }>(
        'SELECT market,id FROM providers ORDER BY market,id',
      )
    ).rows;
    for (const locale of locales)
      for (const market of c.markets) {
        for (const route of ['home', 'movies', 'series', 'providers'] as const)
          paths.push(path(locale, market, route));
        for (const genre of ['scifi', 'thriller', 'comedy', 'drama'])
          paths.push(path(locale, market, 'topics', genre));
        for (const provider of providers.filter(
          (provider) => provider.market === market,
        ))
          paths.push(path(locale, market, 'providers', provider.id));
      }
  }
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${new URL(p, c.SITE_URL).href.replace(/&/g, '&amp;')}</loc></url>`).join('')}</urlset>`,
    {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}

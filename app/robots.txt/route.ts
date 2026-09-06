import { config } from '@/lib/config';
export const dynamic = 'force-dynamic';
export async function GET() {
  const c = config();
  return new Response(
    `User-agent: *\nAllow: /\nSitemap: ${c.SITE_URL}/sitemap.xml\n`,
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}

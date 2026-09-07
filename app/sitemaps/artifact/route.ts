import { serveSitemap } from '@/seo/sitemap-response';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const file = new URL(request.url).searchParams.get('file');
  if (!file) return new Response('Not found', { status: 404 });
  return serveSitemap(request, 'sitemap-' + file + '.xml');
}

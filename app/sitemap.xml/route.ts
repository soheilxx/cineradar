import { serveSitemap } from '@/seo/sitemap-response';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return serveSitemap(request);
}

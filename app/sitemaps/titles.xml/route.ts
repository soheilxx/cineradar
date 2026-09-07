import { serveLegacySitemap } from '@/seo/sitemap-response';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return serveLegacySitemap(request, true);
}

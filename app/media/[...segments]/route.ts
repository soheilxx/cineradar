import { config } from '@/lib/config';
import { serveMedia } from '@/data/media/serve';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ segments: string[] }> },
) {
  if (!config().mediaEnabled)
    return new Response(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  const { segments } = await params;
  return serveMedia(request, '/media/' + segments.join('/'));
}
export const HEAD = GET;

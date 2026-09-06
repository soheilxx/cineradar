import { db } from '@/data/db';
import { config } from '@/lib/config';
import { safeHttps } from '@/domain/offers';
import { json } from '@/lib/security';
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (id.length > 2000) return json({}, 400);
  let link: string | undefined;
  if (config().APP_MODE === 'fixture') {
    const { fixtureCatalog } = await import('@/test/fixtures/catalog');
    link = fixtureCatalog()
      .flatMap((x) => x.snapshot.offers)
      .find((o) => o.id === id)?.link;
  } else if (config().DATABASE_URL) {
    link = (
      await (
        await db()
      ).query<{ link: string }>(
        "SELECT data->>'link' AS link FROM offers WHERE id=$1 AND (expires_at IS NULL OR expires_at>=now())",
        [id],
      )
    ).rows[0]?.link;
  }
  const safe = link && safeHttps(link);
  return safe
    ? new Response(null, {
        status: 302,
        headers: {
          Location: safe,
          'Cache-Control': 'private, no-store',
          'Referrer-Policy': 'no-referrer',
        },
      })
    : json({}, 404);
}

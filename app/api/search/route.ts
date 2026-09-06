import { catalog } from '@/data/repositories/catalog';
import { isLocale } from '@/i18n/config';
import { config } from '@/lib/config';
import { path } from '@/i18n/routes';
import { json, rate } from '@/lib/security';
export async function GET(req: Request) {
  const l = new URL(req.url).searchParams.get('locale') || '';
  const m = new URL(req.url).searchParams.get('market') || '';
  const q = new URL(req.url).searchParams.get('q')?.trim() || '';
  if (
    !isLocale(l) ||
    !config().markets.includes(m) ||
    q.length < 2 ||
    q.length > 120
  )
    return json({ items: [] }, 400);
  if (!(await rate(req, 'autocomplete', 90))) return json({ items: [] }, 429);
  const result = await catalog(l, m, { q }, 8);
  return json({
    items: result.items.map(({ title }) => ({
      id: title.id,
      label: title.localizations[l].title,
      href: path(l, m, title.type, title.localizations[l].slug),
      year: title.year,
      type: title.type,
    })),
    unavailable: result.unavailable,
  });
}

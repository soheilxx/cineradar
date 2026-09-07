import { catalog } from '@/data/repositories/catalog';
import { catalogCard } from '@/domain/cards';
import { filterSchema } from '@/lib/catalog-filters';
import { isLocale } from '@/i18n/config';
import { config } from '@/lib/config';
import { json, rate } from '@/lib/security';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const locale = params.get('locale') || '';
  const market = params.get('market') || '';
  const filters = filterSchema.safeParse(Object.fromEntries(params));
  if (
    !isLocale(locale) ||
    !config().markets.includes(market) ||
    !filters.success
  )
    return json({ error: 'invalid' }, 400);
  if (!(await rate(request, 'catalog', 60)))
    return json({ error: 'rate' }, 429);
  const { mine, ...rest } = filters.data;
  const result = await catalog(
    locale,
    market,
    { ...rest, mine: mine?.split(',') },
    24,
  );
  if (result.unavailable) return json({ error: 'unavailable' }, 503);
  return json({
    items: result.items.map((item) => catalogCard(item, locale)),
    total: result.total,
    page: rest.page,
  });
}

import { notFound, permanentRedirect } from 'next/navigation';
import { z } from 'zod';
import { isLocale, locales } from '@/i18n/config';
import { path, routeFor } from '@/i18n/routes';
import { t } from '@/i18n/messages';
import { config } from '@/lib/config';
import {
  catalog,
  getTitle,
  providers,
  knownSlug,
} from '@/data/repositories/catalog';
import { Header } from '@/ui/header';
import { Footer } from '@/ui/footer';
import {
  HomePage,
  ListingPage,
  DetailPage,
  ProviderPage,
  InfoPage,
  PageHeading,
} from '@/ui/pages';
import { Watchlist } from '@/ui/watchlist';
import { ProviderSelection } from '@/ui/provider-selection';
import { metadata } from '@/seo/metadata';
import type { CatalogItem, Filters } from '@/domain/types';
export const dynamic = 'force-dynamic';
type Props = {
  params: Promise<{ locale: string; market: string; segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const filterSchema = z.object({
  q: z.string().max(120).optional(),
  type: z.enum(['movie', 'tv']).optional(),
  genre: z.string().max(30).optional(),
  provider: z.string().max(100).optional(),
  offerType: z
    .enum(['subscription', 'addon', 'free', 'rent', 'buy'])
    .optional(),
  quality: z.enum(['sd', 'hd', 'qhd', 'uhd']).optional(),
  audio: z.string().max(3).optional(),
  subtitles: z.string().max(3).optional(),
  maxMinutes: z.coerce.number().int().min(1).max(600).optional(),
  year: z.coerce.number().int().min(1880).max(2200).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  sort: z.enum(['relevance', 'title', 'year']).optional(),
  mine: z.string().max(2000).optional(),
});
async function resolve(params: Props['params']) {
  const p = await params;
  if (!isLocale(p.locale) || !config().markets.includes(p.market)) notFound();
  const route = routeFor(p.locale, p.segments?.[0] || '');
  if (!route || (p.segments && p.segments.length > 2)) notFound();
  const tail = p.segments?.[1] || '';
  let item: CatalogItem | null = null;
  if (route === 'movie' || route === 'tv') {
    const match = tail.match(/-(\d+)$/);
    if (!match) notFound();
    item = await getTitle(route + ':' + match[1], p.market);
    if (!item) notFound();
    const slug = item.title.localizations[p.locale].slug;
    if (tail !== slug) {
      if (await knownSlug(item.title.id, p.locale, tail))
        permanentRedirect(path(p.locale, p.market, route, slug));
      notFound();
    }
  } else if (tail && !['providers', 'topics'].includes(route)) notFound();
  return { locale: p.locale, market: p.market, route, tail, item };
}
export async function generateMetadata({ params, searchParams }: Props) {
  const r = await resolve(params);
  return metadata(
    r.locale,
    r.market,
    r.route,
    r.item,
    Object.keys(await searchParams).length > 0,
    r.tail,
  );
}
export default async function Page({ params, searchParams }: Props) {
  const { locale, market, route, tail, item } = await resolve(params);
  const raw = await searchParams;
  const filtered = filterSchema.safeParse(
    Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
    ),
  );
  if (!filtered.success) notFound();
  const { mine, ...rest } = filtered.data;
  const filters: Filters = { ...rest, mine: mine?.split(',') };
  const ps = await providers(market);
  if (route === 'movies') filters.type = 'movie';
  if (route === 'series') filters.type = 'tv';
  if (['new', 'leaving', 'free', 'finder'].includes(route))
    filters.scope = route as Filters['scope'];
  if (route === 'providers' && tail) {
    if (!ps.some((p) => p.id === tail)) notFound();
    filters.provider = tail;
  }
  if (route === 'topics' && tail) {
    if (
      ![
        'action',
        'adventure',
        'animation',
        'comedy',
        'crime',
        'documentary',
        'drama',
        'family',
        'fantasy',
        'horror',
        'mystery',
        'romance',
        'scifi',
        'thriller',
      ].includes(tail)
    )
      notFound();
    filters.genre = tail;
  }
  const languageLinks = Object.fromEntries(
    locales.map((l) => [
      l,
      path(l, market, route, item?.title.localizations[l].slug || tail),
    ]),
  );
  const countryLinks = Object.fromEntries(
    config().markets.map((m) => [
      m,
      path(locale, m, route, item?.title.localizations[locale].slug || tail),
    ]),
  );
  let body: React.ReactNode;
  if (item) body = <DetailPage {...{ item, locale, market }} />;
  else if (route === 'home') {
    const data = await catalog(locale, market, { scope: 'finder' }, 12);
    body = <HomePage {...{ locale, market, providers: ps, ...data }} />;
  } else if (route === 'watchlist')
    body = (
      <>
        <PageHeading locale={locale} title={t(locale, 'watchlist')} />
        <Watchlist {...{ locale, market }} />
      </>
    );
  else if (route === 'myProviders')
    body = (
      <>
        <PageHeading locale={locale} title={t(locale, 'myProviders')} />
        <ProviderSelection {...{ locale, market, providers: ps }} full />
      </>
    );
  else if (route === 'providers' && !tail)
    body = <ProviderPage {...{ locale, market, providers: ps }} />;
  else if (
    [
      'movies',
      'series',
      'search',
      'new',
      'leaving',
      'free',
      'finder',
      'topics',
      'providers',
    ].includes(route)
  ) {
    const data = await catalog(locale, market, filters);
    body = (
      <ListingPage
        {...{ locale, market, route, filters, providers: ps, ...data }}
        titleOverride={
          route === 'providers'
            ? ps.find((p) => p.id === tail)?.name
            : route === 'topics' && tail
              ? t(locale, tail as 'drama')
              : undefined
        }
      />
    );
  } else if (route === 'ops') {
    const { OperationsPage } = await import('@/ui/operations');
    body = <OperationsPage {...{ locale, market }} />;
  } else
    body = (
      <InfoPage
        {...{ locale, market, route }}
        titleId={typeof raw.titleId === 'string' ? raw.titleId : undefined}
      />
    );
  return (
    <>
      <Header
        {...{
          locale,
          market,
          route,
          languageLinks,
          countryLinks,
          markets: config().markets,
        }}
      />
      {config().APP_MODE === 'fixture' && (
        <div className="fixture-banner">{t(locale, 'fixture')}</div>
      )}
      <main id="main" className="container main-content">
        {body}
      </main>
      <Footer {...{ locale, market }} />
    </>
  );
}

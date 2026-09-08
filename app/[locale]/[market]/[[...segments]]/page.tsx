import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { comparisonRoute } from '@/content/comparisons/routes';
import { ComparisonPage } from '@/ui/comparison-page';
import { comparisonMetadata } from '@/seo/comparisons';
import { isLocale, locales, type Locale } from '@/i18n/config';
import { path, routeFor } from '@/i18n/routes';
import { t } from '@/i18n/messages';
import { config } from '@/lib/config';
import {
  catalog,
  getTitle,
  providerStatus,
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
import { jsonLd } from '@/seo/metadata';
import { identifyMetadata, identifySchema } from '@/seo/identify';
import { TitleIdentify } from '@/ui/title-identify';
import type { CatalogItem, Filters } from '@/domain/types';
import {
  routeQuery,
  isPaginatedRoute,
  missingCatalogPage,
  topicGenres,
} from '@/seo/routing';
export const dynamic = 'force-dynamic';
type Props = {
  params: Promise<{ locale: string; market: string; segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const routeCatalog = cache((locale: Locale, market: string, filters: string) =>
  catalog(locale, market, JSON.parse(filters) as Filters),
);
const routeProviders = cache(providerStatus);
async function resolve(params: Props['params']) {
  const p = await params;
  if (!isLocale(p.locale) || !config().markets.includes(p.market)) notFound();
  const route = routeFor(p.locale, p.segments?.[0] || '', !!p.segments?.[1]);
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
  let label: string | undefined;
  let providerUnavailable = false;
  if (route === 'providers') {
    const providerResult = await routeProviders(p.market);
    providerUnavailable = providerResult.unavailable;
    label = providerResult.items.find((provider) => provider.id === tail)?.name;
    if (tail && !label && !providerUnavailable) notFound();
  }
  if (tail && route === 'topics') {
    if (!topicGenres.some((genre) => genre === tail)) notFound();
    label = t(p.locale, tail as 'drama');
  }
  return {
    locale: p.locale,
    market: p.market,
    route,
    tail,
    item,
    label,
    providerUnavailable,
  };
}
export async function generateMetadata({ params, searchParams }: Props) {
  const p = await params;
  const editorial =
    !p.segments?.length && comparisonRoute(`/${p.locale}/${p.market}`);
  if (editorial)
    return comparisonMetadata(
      editorial.locale,
      editorial.id,
      Object.keys(await searchParams).length > 0,
    );
  const r = await resolve(params);
  const search = await searchParams;
  const query = routeQuery(r.route, r.tail, search);
  if (!query) notFound();
  if (r.route === 'identify') return identifyMetadata(r.locale, query.filtered);
  const listing = isPaginatedRoute(r.route, r.tail)
    ? await routeCatalog(r.locale, r.market, JSON.stringify(query.filters))
    : undefined;
  if (
    listing &&
    !r.providerUnavailable &&
    missingCatalogPage(query.page, listing)
  )
    notFound();
  return metadata(
    r.locale,
    r.market,
    r.route,
    r.item,
    query.filtered,
    r.tail,
    query.page,
    r.label,
    { unavailable: listing?.unavailable || r.providerUnavailable },
  );
}
export default async function Page({ params, searchParams }: Props) {
  const p = await params;
  const editorial =
    !p.segments?.length && comparisonRoute(`/${p.locale}/${p.market}`);
  if (editorial) return <ComparisonPage {...editorial} />;
  const { locale, market, route, tail, item, providerUnavailable } =
    await resolve(params);
  const raw = await searchParams;
  const query = routeQuery(route, tail, raw);
  if (!query) notFound();
  const filters = query.filters;
  const ps = (await routeProviders(market)).items;
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
  if (item) {
    const related = await catalog(
      locale,
      market,
      { type: item.title.type, genre: item.title.genres[0], scope: 'finder' },
      7,
    );
    body = (
      <DetailPage
        {...{ item, locale, market }}
        similar={related.items
          .filter((entry) => entry.title.id !== item.title.id)
          .slice(0, 6)}
      />
    );
  } else if (route === 'identify') {
    body = (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(identifySchema(locale)) }}
        />
        <TitleIdentify
          locale={locale}
          market={market}
          aiEnabled={config().identifyAiEnabled}
        />
      </>
    );
  } else if (route === 'home') {
    const [data, latestMovies, latestSeries, recent, free, ...providerRows] =
      await Promise.all([
        catalog(locale, market, { scope: 'finder', sort: 'trending' }, 12),
        catalog(
          locale,
          market,
          { scope: 'finder', type: 'movie', sort: 'latest' },
          12,
        ),
        catalog(
          locale,
          market,
          { scope: 'finder', type: 'tv', sort: 'latest' },
          12,
        ),
        catalog(locale, market, { scope: 'new', sort: 'latest' }, 12),
        catalog(
          locale,
          market,
          { scope: 'free', type: 'movie', sort: 'latest' },
          12,
        ),
        ...['netflix', 'prime', 'disney'].map((provider) =>
          catalog(
            locale,
            market,
            { provider, scope: 'finder', sort: 'trending' },
            12,
          ),
        ),
      ]);
    const collections = {
      latestMovies: latestMovies.items,
      latestSeries: latestSeries.items,
      recent: recent.items,
      free: free.items,
      providers: providerRows.map((row, index) => ({
        id: ['netflix', 'prime', 'disney'][index],
        name:
          ps.find((p) => p.id === ['netflix', 'prime', 'disney'][index])
            ?.name || ['Netflix', 'Prime Video', 'Disney+'][index],
        items: row.items,
      })),
    };
    body = (
      <HomePage {...{ locale, market, providers: ps, ...data, collections }} />
    );
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
    const data = await routeCatalog(locale, market, JSON.stringify(filters));
    if (!providerUnavailable && missingCatalogPage(query.page, data))
      notFound();
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

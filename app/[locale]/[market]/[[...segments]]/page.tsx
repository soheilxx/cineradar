import { notFound, permanentRedirect } from 'next/navigation';
import { cache, Suspense } from 'react';
import { comparisonRoute } from '@/content/comparisons/routes';
import { ComparisonPage } from '@/ui/comparison-page';
import { comparisonMetadata } from '@/seo/comparisons';
import { isLocale, locales, countryName, type Locale } from '@/i18n/config';
import { path, routeFor } from '@/i18n/routes';
import { t } from '@/i18n/messages';
import { config } from '@/lib/config';
import {
  catalog,
  catalogShelves,
  getTitle,
  providerStatus,
  knownSlug,
} from '@/data/repositories/catalog';
import { Header } from '@/ui/header';
import { Footer } from '@/ui/footer';
import {
  HomePage,
  HomeFeatured,
  ListingPage,
  DetailPage,
  ProviderPage,
  InfoPage,
  PageHeading,
} from '@/ui/pages';
import { Watchlist } from '@/ui/watchlist';
import { ProviderSelection } from '@/ui/provider-selection';
import { CatalogPending } from '@/ui/loading-feedback';
import { PosterGrid } from '@/ui/cards';
import { HomeShelf } from '@/ui/home-shelf';
import { metadata } from '@/seo/metadata';
import { jsonLd } from '@/seo/metadata';
import { identifyMetadata, identifySchema } from '@/seo/identify';
import { calendarMetadata } from '@/seo/calendar';
import { TitleIdentify } from '@/ui/title-identify';
import { EpisodeCalendar } from '@/ui/episode-calendar';
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
type ShelfResult = Awaited<ReturnType<typeof catalogShelves>>;
async function HomeProviders({
  locale,
  market,
  data,
}: {
  locale: Locale;
  market: string;
  data: ReturnType<typeof routeProviders>;
}) {
  return (
    <ProviderSelection
      locale={locale}
      market={market}
      providers={(await data).items}
    />
  );
}
async function HomeSpotlight({
  locale,
  market,
  data,
}: {
  locale: Locale;
  market: string;
  data: Promise<ShelfResult>;
}) {
  const [featured] = await data;
  return <HomeFeatured locale={locale} market={market} {...featured} />;
}
async function HomeRow({
  locale,
  market,
  data,
  title,
  intro,
  href,
  keepEmpty = false,
}: {
  locale: Locale;
  market: string;
  data: Promise<ShelfResult>;
  title: string;
  intro?: string;
  href: string;
  keepEmpty?: boolean;
}) {
  const [row] = await data;
  if (!keepEmpty && !row.items.length) return null;
  return (
    <HomeShelf locale={locale} title={title} intro={intro} href={href}>
      <PosterGrid items={row.items} locale={locale} market={market} />
    </HomeShelf>
  );
}
async function SimilarTitles({
  item,
  locale,
  market,
}: {
  item: CatalogItem;
  locale: Locale;
  market: string;
}) {
  const [related] = await catalogShelves(
    locale,
    market,
    [{ type: item.title.type, genre: item.title.genres[0], scope: 'finder' }],
    7,
  );
  const items = related.items
    .filter((entry) => entry.title.id !== item.title.id)
    .slice(0, 6);
  return items.length ? (
    <section className="section">
      <h2>{t(locale, 'similarTitles')}</h2>
      <PosterGrid items={items} locale={locale} market={market} />
    </section>
  ) : null;
}
async function resolve(params: Props['params']) {
  const p = await params;
  return resolveRoute(p.locale, p.market, JSON.stringify(p.segments || []));
}
// Metadata and the page share a title/provider lookup even when Next supplies
// separate params promises for the same route.
const resolveRoute = cache(
  async (locale: string, market: string, segments: string) => {
    const p = { locale, market, segments: JSON.parse(segments) as string[] };
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
      label = providerResult.items.find(
        (provider) => provider.id === tail,
      )?.name;
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
  },
);
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
  if (r.route === 'calendar')
    return calendarMetadata(r.locale, r.market, query.filtered);
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
    body = (
      <DetailPage
        {...{ item, locale, market }}
        similar={
          <Suspense fallback={<CatalogPending locale={locale} />}>
            <SimilarTitles {...{ item, locale, market }} />
          </Suspense>
        }
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
    // Start all reads together, but let navigation and search stream immediately.
    // A slower secondary shelf must not hold back the first featured titles.
    const providerResult = routeProviders(market);
    const featured = catalogShelves(locale, market, [
      { scope: 'finder', sort: 'trending' },
    ]);
    const rows: {
      key: string;
      title: string;
      intro?: string;
      href: string;
      keepEmpty?: boolean;
      filters: Filters;
    }[] = [
      {
        key: 'movies',
        title: t(locale, 'latestMovies'),
        intro: t(locale, 'latestMoviesIntro', {
          country: countryName(locale, market),
        }),
        href: path(locale, market, 'movies'),
        keepEmpty: true,
        filters: { scope: 'finder', type: 'movie', sort: 'latest' },
      },
      {
        key: 'series',
        title: t(locale, 'latestSeries'),
        intro: t(locale, 'latestSeriesIntro', {
          country: countryName(locale, market),
        }),
        href: path(locale, market, 'series'),
        keepEmpty: true,
        filters: { scope: 'finder', type: 'tv', sort: 'latest' },
      },
      {
        key: 'new',
        title: t(locale, 'new'),
        intro: t(locale, 'newDefinition'),
        href: path(locale, market, 'new'),
        filters: { scope: 'new', sort: 'latest' },
      },
      ...(['netflix', 'prime', 'disney'] as const).map((provider, index) => ({
        key: provider,
        title: t(locale, 'providerPicks', {
          provider: ['Netflix', 'Prime Video', 'Disney+'][index],
        }),
        href: path(locale, market, 'providers', provider),
        filters: {
          provider,
          scope: 'finder' as const,
          sort: 'trending' as const,
        },
      })),
      {
        key: 'free',
        title: t(locale, 'free'),
        intro: t(locale, 'freeDefinition'),
        href: path(locale, market, 'free'),
        filters: { scope: 'free', type: 'movie', sort: 'latest' },
      },
    ];
    const shelves = rows.map(({ filters, ...row }) => ({
      ...row,
      data: catalogShelves(locale, market, [filters]),
    }));
    body = (
      <HomePage
        {...{ locale, market }}
        providers={
          <Suspense
            fallback={<CatalogPending locale={locale} variant="providers" />}
          >
            <HomeProviders
              locale={locale}
              market={market}
              data={providerResult}
            />
          </Suspense>
        }
        featured={
          <Suspense
            fallback={<CatalogPending locale={locale} variant="feature" />}
          >
            <HomeSpotlight locale={locale} market={market} data={featured} />
          </Suspense>
        }
        collections={shelves.map(({ key, ...row }) => (
          <Suspense key={key} fallback={<CatalogPending locale={locale} />}>
            <HomeRow locale={locale} market={market} {...row} />
          </Suspense>
        ))}
      />
    );
  } else if (route === 'calendar')
    body = <EpisodeCalendar {...{ locale, market }} />;
  else if (route === 'watchlist')
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
        <ProviderSelection
          {...{
            locale,
            market,
            providers: (await routeProviders(market)).items,
          }}
          full
        />
      </>
    );
  else if (route === 'providers' && !tail)
    body = (
      <ProviderPage
        {...{ locale, market, providers: (await routeProviders(market)).items }}
      />
    );
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
    const [providerResult, data] = await Promise.all([
      routeProviders(market),
      routeCatalog(locale, market, JSON.stringify(filters)),
    ]);
    const ps = providerResult.items;
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

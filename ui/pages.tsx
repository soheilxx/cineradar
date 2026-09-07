import { infoDescriptions, infoHeadings } from '@/content/info';
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Compass,
  Film,
  Info,
  Sparkles,
} from 'lucide-react';
import type { CatalogItem, Filters, Provider } from '@/domain/types';
import type { Locale } from '@/i18n/config';
import { countryName } from '@/i18n/config';
import { t, type MessageKey } from '@/i18n/messages';
import { path, type RouteKey } from '@/i18n/routes';
import { PosterGrid, titlePath } from './cards';
import { Search } from './search';
import { SearchMore } from './search-more';
import { ProviderSelection } from './provider-selection';
import { FilterControls } from './filters';
import { SaveButton } from './save-button';
import { OfferList } from './offer-list';
import { ContactPage } from './contact-page';
import { config } from '@/lib/config';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import {
  titleSchema,
  jsonLd,
  breadcrumbSchema,
  siteSchema,
} from '@/seo/metadata';
import { streamingContent } from '@/seo/content';
import { LazyCatalog } from './lazy-catalog';
import { catalogCard } from '@/domain/cards';
import { HomeShelf } from './home-shelf';
import { FeaturedSpotlight } from './featured-spotlight';
import { imageVariant, imageSet } from '@/domain/artwork';
export function PageHeading({
  locale: _locale,
  title,
  description,
}: {
  locale: Locale;
  title: string;
  description?: string;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow gold">Cineradar</p>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}
export function Empty({
  locale,
  unavailable = false,
}: {
  locale: Locale;
  unavailable?: boolean;
}) {
  return (
    <div className="empty-state">
      <Film size={38} />
      <p>{t(locale, unavailable ? 'setup' : 'noResults')}</p>
    </div>
  );
}
export interface HomeCollections {
  latestMovies: CatalogItem[];
  latestSeries: CatalogItem[];
  recent: CatalogItem[];
  free: CatalogItem[];
  providers: { id: string; name: string; items: CatalogItem[] }[];
}
export function HomePage({
  locale,
  market,
  items,
  providers,
  unavailable,
  collections,
}: {
  locale: Locale;
  market: string;
  items: CatalogItem[];
  providers: Provider[];
  unavailable: boolean;
  collections: HomeCollections;
}) {
  const feature = items[0];
  const second = items[6] || items[1];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(siteSchema(locale, market)) }}
      />
      <section className="search-hero">
        <div className="hero-title">
          <div>
            <p className="eyebrow">
              <span className="live-dot" />
              {countryName(locale, market)} · {t(locale, 'offers')}
            </p>
            <h1>{t(locale, 'headline')}</h1>
            <p>{t(locale, 'subheadline')}</p>
          </div>
          <span className="hero-edition" aria-hidden="true">
            CINE
            <br />
            <b>RADAR</b>
            <br />
            {market.toUpperCase()}
          </span>
        </div>
        <Search locale={locale} market={market} />
      </section>
      <ProviderSelection {...{ locale, market, providers }} />
      {feature ? (
        <section className="feature-grid">
          <FeaturedSpotlight
            locale={locale}
            market={market}
            items={items.slice(0, 5).map((entry) => ({
              id: entry.title.id,
              title: entry.title.localizations[locale].title,
              image:
                entry.title.backdrop || entry.title.poster || '/cinema.webp',
              href: titlePath(entry, locale, market),
              year: entry.title.year,
              type: entry.title.type,
              genres: entry.title.genres
                .slice(0, 2)
                .map((genre) => t(locale, genre))
                .join(' / '),
              overview: entry.title.localizations[locale].overview,
            }))}
          />
          <div className="feature-side">
            {second && (
              <a
                href={titlePath(second, locale, market)}
                className="side-spotlight"
                aria-label={second.title.localizations[locale].title}
              >
                <img
                  src={
                    second.title.backdrop ||
                    second.title.poster ||
                    '/cinema.webp'
                  }
                  alt=""
                  width="600"
                  height="350"
                  loading="lazy"
                />
                <div>
                  <span className="eyebrow">
                    {t(locale, second.title.type)}
                  </span>
                  <h2>{second.title.localizations[locale].title}</h2>
                  <span>
                    {t(locale, 'offers')}
                    <ArrowUpRight size={19} />
                  </span>
                </div>
              </a>
            )}
            <a href={path(locale, market, 'finder')} className="finder-teaser">
              <Compass size={28} />
              <div>
                <p className="eyebrow">{t(locale, 'finder')}</p>
                <h3>{t(locale, 'finderIntro')}</h3>
              </div>
              <ArrowUpRight size={24} />
            </a>
          </div>
        </section>
      ) : (
        <section className="empty-cinema">
          <img src="/cinema.webp" alt="" width="1536" height="1024" />
          <Empty locale={locale} unavailable={unavailable} />
        </section>
      )}
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow gold">02 — {t(locale, 'home')}</span>
            <h2>{t(locale, 'trendingNow')}</h2>
          </div>
          <a className="text-link" href={path(locale, market, 'movies')}>
            {t(locale, 'browseAll')}
            <ArrowRight size={18} />
          </a>
        </div>
        <div className="category-nav">
          {(['movies', 'series', 'new', 'leaving', 'free'] as const).map(
            (key) => (
              <a key={key} href={path(locale, market, key)}>
                {t(locale, key)}
                <ArrowUpRight size={15} />
              </a>
            ),
          )}
        </div>
        {items.length ? (
          <PosterGrid items={items.slice(0, 6)} {...{ locale, market }} />
        ) : (
          <Empty locale={locale} unavailable />
        )}
      </section>
      <section className="discovery-band">
        <div>
          <Sparkles size={22} />
          <h2>{t(locale, 'topics')}</h2>
        </div>
        <div className="genre-links">
          {(['scifi', 'thriller', 'comedy', 'drama'] as const).map((g, i) => (
            <a key={g} href={path(locale, market, 'topics', g)}>
              <span>0{i + 1}</span>
              {t(locale, g)}
              <ArrowUpRight size={20} />
            </a>
          ))}
        </div>
      </section>
      <HomeShelf
        locale={locale}
        title={t(locale, 'latestMovies')}
        intro={t(locale, 'latestMoviesIntro', {
          country: countryName(locale, market),
        })}
        href={path(locale, market, 'movies')}
      >
        <PosterGrid
          items={collections.latestMovies}
          locale={locale}
          market={market}
        />
      </HomeShelf>
      <HomeShelf
        locale={locale}
        title={t(locale, 'latestSeries')}
        intro={t(locale, 'latestSeriesIntro', {
          country: countryName(locale, market),
        })}
        href={path(locale, market, 'series')}
      >
        <PosterGrid
          items={collections.latestSeries}
          locale={locale}
          market={market}
        />
      </HomeShelf>
      {!!collections.recent.length && (
        <HomeShelf
          locale={locale}
          title={t(locale, 'new')}
          intro={t(locale, 'newDefinition')}
          href={path(locale, market, 'new')}
        >
          <PosterGrid
            items={collections.recent}
            locale={locale}
            market={market}
          />
        </HomeShelf>
      )}
      {collections.providers
        .filter((provider) => provider.items.length)
        .map((provider) => (
          <HomeShelf
            key={provider.id}
            locale={locale}
            title={t(locale, 'providerPicks', { provider: provider.name })}
            href={path(locale, market, 'providers', provider.id)}
          >
            <PosterGrid
              items={provider.items}
              locale={locale}
              market={market}
            />
          </HomeShelf>
        ))}
      {!!collections.free.length && (
        <HomeShelf
          locale={locale}
          title={t(locale, 'free')}
          intro={t(locale, 'freeDefinition')}
          href={path(locale, market, 'free')}
        >
          <PosterGrid
            items={collections.free}
            locale={locale}
            market={market}
          />
        </HomeShelf>
      )}
      <section className="section home-guide">
        <p className="eyebrow gold">Cineradar</p>
        <h2>
          {t(locale, 'streamingGuide', {
            country: countryName(locale, market),
          })}
        </h2>
        <p>{t(locale, 'guideIntro')}</p>
        <p>
          {t(locale, 'guideCountry', { country: countryName(locale, market) })}
        </p>
        <nav className="context-links">
          <a className="button" href={path(locale, market, 'finder')}>
            {t(locale, 'finder')}
            <ArrowRight size={18} />
          </a>
          <a className="text-link" href={path(locale, market, 'myProviders')}>
            {t(locale, 'myProviders')}
            <ArrowRight size={18} />
          </a>
        </nav>
      </section>
    </>
  );
}
export function ListingPage({
  locale,
  market,
  route,
  items,
  providers,
  filters,
  total,
  unavailable,
  titleOverride,
}: {
  locale: Locale;
  market: string;
  route: RouteKey;
  items: CatalogItem[];
  providers: Provider[];
  filters: Filters;
  total: number;
  unavailable: boolean;
  titleOverride?: string;
}) {
  const title = titleOverride || t(locale, route as MessageKey);
  const description =
    route === 'finder'
      ? t(locale, 'finderIntro')
      : route === 'new'
        ? t(locale, 'newDefinition')
        : route === 'leaving'
          ? t(locale, 'leavingDefinition')
          : route === 'free'
            ? t(locale, 'freeDefinition')
            : t(locale, 'catalogIntro', {
                title,
                country: countryName(locale, market),
              });
  const page = filters.page || 1;
  const pages = Math.max(1, Math.ceil(total / 24));
  const link = (n: number) => {
    const p = new URLSearchParams();
    for (const [key, v] of Object.entries(filters))
      if (
        v &&
        key !== 'scope' &&
        key !== 'page' &&
        !(
          key === 'type' &&
          ((route === 'movies' && v === 'movie') ||
            (route === 'series' && v === 'tv'))
        ) &&
        !(
          key === 'sort' &&
          v === 'latest' &&
          ['movies', 'series'].includes(route)
        ) &&
        !(key === 'provider' && route === 'providers') &&
        !(key === 'genre' && route === 'topics')
      )
        p.set(key, Array.isArray(v) ? v.join(',') : String(v));
    p.set('page', String(n));
    return '?' + p.toString();
  };
  return (
    <>
      <PageHeading {...{ locale, title, description }} />
      {route === 'search' && (
        <Search {...{ locale, market }} initial={filters.q} />
      )}
      <div className="catalog-layout">
        <FilterControls
          {...{ locale, providers }}
          initial={filters}
          finder={route === 'finder'}
        />
        <section>
          <div className="results-heading">
            <span>{t(locale, 'results', { count: total })}</span>
            {route === 'finder' && (
              <p className="hint">{t(locale, 'finderReason')}</p>
            )}
          </div>
          {items.length ? (
            <LazyCatalog
              key={JSON.stringify(filters)}
              initialItems={items.map((item) => catalogCard(item, locale))}
              {...{ locale, market, filters, total }}
            />
          ) : (
            <Empty locale={locale} unavailable={unavailable} />
          )}
          <Pagination aria-label={t(locale, 'next')}>
            <PaginationContent>
              {page > 1 && (
                <PaginationItem>
                  <PaginationLink href={link(page - 1)} className="button">
                    {t(locale, 'previous')}
                  </PaginationLink>
                </PaginationItem>
              )}
              {pages > 1 && (
                <PaginationItem>
                  <span>
                    {page} / {pages}
                  </span>
                </PaginationItem>
              )}
              {page < pages && (
                <PaginationItem>
                  <PaginationLink href={link(page + 1)} className="button">
                    {t(locale, 'next')}
                  </PaginationLink>
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
          {route === 'search' && total === 0 && (
            <SearchMore
              locale={locale}
              query={filters.q || ''}
              enabled={
                config().APP_MODE === 'live' && config().SYNC_ENABLED === 'true'
              }
            />
          )}
        </section>
      </div>
    </>
  );
}
export function DetailPage({
  item,
  locale,
  market,
  similar = [],
}: {
  item: CatalogItem;
  locale: Locale;
  market: string;
  similar?: CatalogItem[];
}) {
  const d = item.title;
  const l = d.localizations[locale];
  const s = item.snapshot;
  const content = streamingContent(item, locale, market);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            titleSchema(item, locale, market),
            breadcrumbSchema(item, locale, market),
          ]),
        }}
      />
      <nav className="breadcrumbs">
        <a href={path(locale, market)}>{t(locale, 'home')}</a>
        <span>/</span>
        <a
          href={path(locale, market, d.type === 'movie' ? 'movies' : 'series')}
        >
          {t(locale, d.type === 'movie' ? 'movies' : 'series')}
        </a>
        <span>/</span>
        <span>{l.title}</span>
      </nav>
      <section className="detail-hero">
        {d.backdrop && (
          <img
            className="detail-backdrop"
            src={imageVariant(d.backdrop, 780)}
            srcSet={imageSet(d.backdrop, [300, 780, 1280])}
            sizes="100vw"
            fetchPriority="high"
            alt=""
            width="1280"
            height="720"
          />
        )}
        <div className="detail-gradient" />
        <div className="detail-poster">
          {d.poster ? (
            <img
              src={imageVariant(d.poster, 342)}
              srcSet={imageSet(d.poster, [185, 342, 500])}
              sizes="(max-width:700px) 90px, 200px"
              alt={l.title}
              width="500"
              height="750"
            />
          ) : (
            <Film size={60} />
          )}
        </div>
        <div className="detail-heading">
          <p className="eyebrow gold">
            {t(locale, d.type)} · {countryName(locale, market)}
          </p>
          <h1>{l.title}</h1>
          <div className="detail-meta">
            <span>{d.year}</span>
            {d.runtime && (
              <span>
                <Clock size={15} />
                {t(locale, 'minutes', { count: d.runtime })}
              </span>
            )}
            <span>{d.genres.map((g) => t(locale, g)).join(' · ')}</span>
          </div>
          {d.rating !== null && (
            <p className="rating-line">
              ★{' '}
              {new Intl.NumberFormat(locale, {
                maximumFractionDigits: 1,
              }).format(d.rating)}{' '}
              / 10{' '}
              <span>
                {t(locale, 'rating')} · {t(locale, 'votes', { count: d.votes })}
              </span>
            </p>
          )}
          <SaveButton id={d.id} {...{ locale, market }} />
          <nav className="detail-anchors">
            <a href="#offers">{t(locale, 'offers')}</a>
            {d.type === 'tv' && <a href="#seasons">{t(locale, 'seasons')}</a>}
            <a href="#info">{t(locale, 'info')}</a>
          </nav>
        </div>
      </section>
      <section id="offers" className="section offer-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow gold">{countryName(locale, market)}</p>
            <h2>{content.heading}</h2>
          </div>
          {s.checkedAt && (
            <span className="freshness">
              <span className={'status-dot ' + s.freshness} />
              {t(locale, 'checked', {
                date: new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'UTC',
                }).format(new Date(s.checkedAt)),
              })}{' '}
              UTC
            </span>
          )}
        </div>
        <div className="streaming-answer">
          <p>{content.intro}</p>
          <p>{content.answer}</p>
        </div>
        {s.freshness === 'stale' || s.freshness === 'overdue' ? (
          <p className="notice warning">
            <Info size={18} />
            {t(locale, 'stale')}
          </p>
        ) : null}
        {s.availability !== 'available' && (
          <p className="notice">
            <Info size={18} />
            {t(
              locale,
              s.availability === 'empty'
                ? 'noOffers'
                : s.availability === 'error'
                  ? 'failed'
                  : s.availability === 'unsupported'
                    ? 'unsupported'
                    : 'unchecked',
            )}
          </p>
        )}
        {s.offers.length > 0 && (
          <OfferList
            offers={s.offers}
            locale={locale}
            seasonMode={d.type === 'tv'}
          />
        )}
      </section>
      {d.type === 'tv' && (
        <section id="seasons" className="section">
          <h2>{t(locale, 'seasons')}</h2>
          <p className="muted">{t(locale, 'partial')}</p>
          <div className="season-list">
            {d.seasons.map((se) => (
              <details key={se.number}>
                <summary>
                  {t(locale, 'season', { number: se.number })}
                  <span>+</span>
                </summary>
                {s.offers.some((o) => o.season === se.number) ? (
                  <OfferList
                    locale={locale}
                    offers={s.offers.filter((o) => o.season === se.number)}
                    fixedSeason={se.number}
                  />
                ) : (
                  <p className="muted">{t(locale, 'noSeasonData')}</p>
                )}
              </details>
            ))}
          </div>
        </section>
      )}
      <section id="info" className="section info-grid">
        <div>
          <h2>{t(locale, 'aboutTitle', { title: l.title })}</h2>
          <p>
            {l.overview ||
              t(locale, 'facts', {
                title: l.title,
                type: t(locale, d.type),
                year: d.year || t(locale, 'unknown'),
              })}
          </p>
          {!l.overview && <p className="hint">{t(locale, 'factsFallback')}</p>}
          {d.cast.length > 0 && (
            <>
              <h3>{t(locale, 'cast')}</h3>
              <p>{d.cast.join(', ')}</p>
            </>
          )}
        </div>
        <aside>
          <span className="eyebrow">{t(locale, 'originalTitle')}</span>
          <p>{d.originalTitle}</p>
          <a
            className="text-link"
            href={
              path(locale, market, 'report') +
              '?titleId=' +
              encodeURIComponent(d.id)
            }
          >
            {t(locale, 'report')}
            <ArrowUpRight size={16} />
          </a>
        </aside>
      </section>
      <section className="section title-questions">
        <h2>{t(locale, 'titleQuestions', { title: l.title })}</h2>
        <div className="question-grid">
          {content.questions.map((question) => (
            <article key={question.heading}>
              <h3>{question.heading}</h3>
              <p>{question.body}</p>
            </article>
          ))}
        </div>
        <nav className="context-links">
          {content.providers.map((provider) => (
            <a
              className="text-link"
              key={provider.id}
              href={path(locale, market, 'providers', provider.id)}
            >
              {t(locale, 'providerPicks', { provider: provider.name })}
              <ArrowUpRight size={15} />
            </a>
          ))}
        </nav>
      </section>
      {!!similar.length && (
        <section className="section">
          <h2>{t(locale, 'similarTitles')}</h2>
          <PosterGrid items={similar} locale={locale} market={market} />
        </section>
      )}
    </>
  );
}
export function ProviderPage({
  locale,
  market,
  providers,
}: {
  locale: Locale;
  market: string;
  providers: Provider[];
}) {
  return (
    <>
      <PageHeading
        locale={locale}
        title={t(locale, 'providers')}
        description={countryName(locale, market)}
      />
      <div className="provider-grid">
        {providers.map((p) => (
          <a
            key={p.id}
            className="provider-tile"
            href={path(locale, market, 'providers', p.id)}
          >
            {p.logo ? (
              <img src={p.logo} width="180" height="80" alt="" />
            ) : (
              <span className={'provider-word provider-' + p.id}>{p.name}</span>
            )}
            <h2>{p.name}</h2>
            <p>{p.types.map((type) => t(locale, type)).join(' · ')}</p>
            <ArrowUpRight size={22} />
          </a>
        ))}
      </div>
      {!providers.length && <Empty locale={locale} unavailable />}
    </>
  );
}
export function InfoPage({
  locale,
  market,
  route,
  titleId,
}: {
  locale: Locale;
  market: string;
  route: RouteKey;
  titleId?: string;
}) {
  const c = config();
  const paragraphs: Partial<Record<RouteKey, MessageKey[]>> = {
    about: ['aboutText', 'helpIntro'],
    data: ['dataText', 'newDefinition', 'leavingDefinition', 'freeDefinition'],
    help: ['helpIntro', 'addonHelp', 'deviceOnly', 'dataText'],
    privacy: [
      'privacyText',
      'privacyHosting',
      'privacyContact',
      'privacyRights',
      'contextPrivacy',
    ],
    legal: ['legalIntro'],
    credits: ['aboutText'],
    contact: [],
    report: [],
  };
  if (route === 'contact' || route === 'report')
    return (
      <ContactPage
        locale={locale}
        market={market}
        titleId={titleId}
        report={route === 'report'}
      />
    );
  return (
    <>
      <div className="info-page-head">
        <p className="eyebrow">Cineradar</p>
        <h1>{t(locale, route as MessageKey)}</h1>
        <p className="editorial-lead">
          {route in infoDescriptions
            ? infoDescriptions[route as keyof typeof infoDescriptions][locale]
            : ''}
        </p>
      </div>
      <div className="info-page-layout">
        <aside className="info-page-aside">
          <nav>
            {(paragraphs[route] || []).map((k) => (
              <a key={k} href={'#' + k}>
                {infoHeadings[k as keyof typeof infoHeadings]?.[locale] ||
                  t(locale, route as MessageKey)}
              </a>
            ))}
          </nav>
          <nav>
            {(['about', 'help', 'data', 'contact', 'legal', 'privacy'] as const)
              .filter((k) => k !== route)
              .map((k) => (
                <a key={k} href={path(locale, market, k)}>
                  {t(locale, k)}
                </a>
              ))}
          </nav>
        </aside>
        <div className="info-page-body">
          {(paragraphs[route] || []).map((k) => (
            <section className="info-section" id={k} key={k}>
              <h2>
                {infoHeadings[k as keyof typeof infoHeadings]?.[locale] ||
                  t(locale, route as MessageKey)}
              </h2>
              <p>{t(locale, k)}</p>
            </section>
          ))}
          {['legal', 'privacy'].includes(route) && c.OPERATOR_NAME && (
            <address className="operator-address">
              {c.OPERATOR_NAME}
              <br />
              {c.OPERATOR_ADDRESS}
              <br />
              <a href={'mailto:' + c.CONTACT_EMAIL}>{c.CONTACT_EMAIL}</a>
            </address>
          )}
          {route === 'legal' && c.OPERATOR_NAME === 'Wiresoft AG' && (
            <div className="legal-register">
              <dl>
                <div>
                  <dt>UID</dt>
                  <dd>CHE-112.097.691</dd>
                </div>
                <div>
                  <dt>
                    {locale === 'de'
                      ? 'Handelsregister'
                      : locale === 'fr'
                        ? 'Registre du commerce'
                        : locale === 'it'
                          ? 'Registro di commercio'
                          : locale === 'es'
                            ? 'Registro mercantil'
                            : 'Commercial register'}
                  </dt>
                  <dd>CH-170.3.027.782-3</dd>
                </div>
              </dl>
              <a
                href="https://www.uid.admin.ch/Detail.aspx?uid_id=CHE112097691"
                className="text-link"
              >
                {locale === 'de'
                  ? 'Eintrag im Schweizer UID-Register'
                  : locale === 'fr'
                    ? 'Registre IDE suisse'
                    : locale === 'it'
                      ? 'Registro IDI svizzero'
                      : locale === 'es'
                        ? 'Registro UID suizo'
                        : 'Swiss UID register'}{' '}
                <ArrowUpRight size={16} />
              </a>
            </div>
          )}
          {['legal', 'privacy'].includes(route) &&
            c.LEGAL_APPROVED !== 'true' && (
              <p className="notice">{t(locale, 'legalPending')}</p>
            )}
          {route === 'credits' && (
            <>
              <a href="https://www.themoviedb.org/">
                <img
                  className="tmdb-logo"
                  src="https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
                  width="150"
                  height="50"
                  alt="TMDb"
                />
              </a>
              <p lang="en">
                This product uses the TMDB API but is not endorsed or certified
                by TMDB.
              </p>
              <a className="text-link" href="https://docs.movieofthenight.com/">
                Streaming Availability API by Movie of the Night{' '}
                <ArrowUpRight size={18} />
              </a>
            </>
          )}
        </div>
      </div>
    </>
  );
}

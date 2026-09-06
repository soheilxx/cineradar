import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Compass,
  Film,
  Info,
  Play,
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
import { ContactForm } from './contact';
import { config } from '@/lib/config';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { titleSchema, jsonLd } from '@/seo/metadata';
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
export function HomePage({
  locale,
  market,
  items,
  providers,
  unavailable,
}: {
  locale: Locale;
  market: string;
  items: CatalogItem[];
  providers: Provider[];
  unavailable: boolean;
}) {
  const feature = items[0];
  const second = items[6] || items[1];
  return (
    <>
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
          <article className="spotlight">
            <img
              className="feature-image"
              src={
                feature.title.backdrop || feature.title.poster || '/cinema.webp'
              }
              alt=""
              width="1280"
              height="720"
              fetchPriority="high"
              srcSet={imageSet(
                feature.title.backdrop ||
                  feature.title.poster ||
                  '/cinema.webp',
                [300, 780, 1280],
              )}
              sizes="(max-width:700px) 100vw, 65vw"
            />
            <div className="feature-gradient" />
            <div className="spotlight-top">
              <span className="film-label">
                <Play size={13} />
                {t(locale, 'picks')}
              </span>
              <span className="feature-number">
                01 / {String(items.length).padStart(2, '0')}
              </span>
            </div>
            <div className="spotlight-copy">
              <p className="eyebrow">
                {feature.title.genres
                  .map((g) => t(locale, g))
                  .slice(0, 2)
                  .join(' / ')}
              </p>
              <h2>{feature.title.localizations[locale].title}</h2>
              <p>
                {feature.title.year} <span>·</span>{' '}
                {feature.title.runtime
                  ? t(locale, 'minutes', { count: feature.title.runtime })
                  : t(locale, feature.title.type)}
              </p>
              <div className="feature-actions">
                <a
                  className="button primary"
                  href={titlePath(feature, locale, market)}
                >
                  {t(locale, 'offers')}
                  <ArrowUpRight size={18} />
                </a>
                <SaveButton id={feature.title.id} {...{ locale, market }} />
              </div>
            </div>
          </article>
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
            <h2>{t(locale, 'picks')}</h2>
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
            : undefined;
  const page = filters.page || 1;
  const pages = Math.max(1, Math.ceil(total / 24));
  const link = (n: number) => {
    const p = new URLSearchParams();
    for (const [key, v] of Object.entries(filters))
      if (v && key !== 'scope' && key !== 'page')
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
            <PosterGrid {...{ items, locale, market }} />
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
}: {
  item: CatalogItem;
  locale: Locale;
  market: string;
}) {
  const d = item.title;
  const l = d.localizations[locale];
  const s = item.snapshot;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(titleSchema(item, locale, market)),
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
            <h2>{t(locale, 'offers')}</h2>
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
          <h2>{t(locale, 'info')}</h2>
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
    privacy: ['privacyText'],
    legal: ['legalPending'],
    credits: ['aboutText'],
    contact: [],
    report: [],
  };
  return (
    <>
      <PageHeading locale={locale} title={t(locale, route as MessageKey)} />
      <div className="prose">
        {(paragraphs[route] || []).map((k) => (
          <p key={k}>{t(locale, k)}</p>
        ))}
        {route === 'legal' && c.OPERATOR_NAME && (
          <address>
            {c.OPERATOR_NAME}
            <br />
            {c.OPERATOR_ADDRESS}
            <br />
            {c.CONTACT_EMAIL}
          </address>
        )}
        {route === 'privacy' && c.LEGAL_APPROVED !== 'true' && (
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
              This product uses the TMDB API but is not endorsed or certified by
              TMDB.
            </p>
            <a
              className="text-link"
              href="https://www.movieofthenight.com/about/api"
            >
              Streaming Availability API by Movie of the Night{' '}
              <ArrowUpRight size={18} />
            </a>
          </>
        )}
        {['contact', 'report'].includes(route) && (
          <>
            <ContactForm
              {...{ locale, market, titleId }}
              enabled={!!c.DATABASE_URL}
            />
            {c.CONTACT_EMAIL && (
              <a className="text-link" href={'mailto:' + c.CONTACT_EMAIL}>
                {c.CONTACT_EMAIL}
              </a>
            )}
          </>
        )}
      </div>
    </>
  );
}

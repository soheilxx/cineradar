import { AppLink } from './app-link';
import { headers } from 'next/headers';
import {
  ArrowRight,
  ArrowUpRight,
  Globe2,
  ListFilter,
  Bookmark,
} from 'lucide-react';
import { comparisons, getComparison } from '@/content/comparisons';
import { copy } from '@/content/comparisons/copy';
import { features } from '@/content/comparisons/features';
import {
  comparisonPath,
  type ComparisonId,
} from '@/content/comparisons/routes';
import { defaultMarkets, countryName, type Locale } from '@/i18n/config';
import { path } from '@/i18n/routes';
import { t } from '@/i18n/messages';
import { config } from '@/lib/config';
import { jsonLd } from '@/seo/metadata';
import { ComparisonHeader, ComparisonSearch } from './comparison-search';
import { Footer } from './footer';

export async function ComparisonPage({
  locale,
  id,
}: {
  locale: Locale;
  id?: ComparisonId;
}) {
  const c = config();
  const item = id ? getComparison(id) : undefined;
  const market = defaultMarkets[locale];
  const date = item?.updatedAt || '2026-09-07';
  const url = new URL(comparisonPath(locale, id), c.SITE_URL).href;
  const crumbs = [
    { name: 'Cineradar', url: new URL(path(locale, market), c.SITE_URL).href },
    {
      name: copy.hub[locale],
      url: new URL(comparisonPath(locale), c.SITE_URL).href,
    },
    ...(item ? [{ name: item.brand, url }] : []),
  ];
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': url,
      url,
      name: item ? `${item.brand} ${copy.versus[locale]}` : copy.hub[locale],
      description: item?.intro[locale] || copy.hubIntro[locale],
      inLanguage: locale,
      datePublished: item?.publishedAt || date,
      dateModified: date,
      publisher: {
        '@type': 'Organization',
        name: 'Cineradar',
        url: c.SITE_URL,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((x, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: x.name,
        item: x.url,
      })),
    },
  ];
  return (
    <>
      <ComparisonHeader locale={locale} id={id} markets={c.markets} />
      <main id="main" className="container editorial-page">
        <script
          type="application/ld+json"
          nonce={(await headers()).get('x-nonce') || undefined}
          dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
        />
        <nav
          className="editorial-breadcrumb"
          aria-label={copy.breadcrumb[locale]}
        >
          {crumbs.map((x, i) => (
            <span key={x.url}>
              {i > 0 && <span aria-hidden="true">/</span>}
              <AppLink
                href={x.url}
                aria-current={i === crumbs.length - 1 ? 'page' : undefined}
              >
                {x.name}
              </AppLink>
            </span>
          ))}
        </nav>
        <section className="comparison-hero">
          <div className="comparison-hero-copy">
            <p className="eyebrow">{copy.eyebrow[locale]}</p>
            <h1>
              {item ? (
                <>
                  {item.brand}
                  <br />
                  <span>{copy.versus[locale]}</span>
                </>
              ) : (
                copy.hub[locale]
              )}
            </h1>
            <p className="editorial-lead">
              {item?.intro[locale] || copy.hubIntro[locale]}
            </p>
            <div className="comparison-byline">
              <span>Cineradar / Wiresoft AG</span>
              <span>
                {copy.checked[locale]}:{' '}
                <time dateTime={date}>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeZone: 'UTC',
                  }).format(new Date(date))}
                </time>
              </span>
            </div>
          </div>
          <aside className="comparison-search-card">
            <ComparisonSearch locale={locale} id={id} markets={c.markets} />
            <AppLink
              className="text-link"
              href={item ? '#comparison' : '#guides'}
            >
              {copy.compare[locale]} <ArrowRight size={18} />
            </AppLink>
          </aside>
        </section>
        {item ? (
          <>
            <section className="comparison-section" id="comparison">
              <div className="editorial-section-head">
                <p className="eyebrow">01 / {copy.overview[locale]}</p>
                <h2>{item.brand} & Cineradar</h2>
                <p>{copy.scope[locale]}</p>
              </div>
              {/* The overflow region must be focusable for keyboard scrolling. */}
              {/* oxlint-disable jsx-a11y/no-noninteractive-tabindex */}
              <div
                className="comparison-table-wrap"
                role="region"
                aria-label={copy.compare[locale]}
                tabIndex={0}
              >
                <table className="comparison-table">
                  <caption className="sr-only">
                    {item.brand} / Cineradar · {copy.checked[locale]} {date}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{copy.criteria[locale]}</th>
                      <th scope="col">{item.brand}</th>
                      <th scope="col">Cineradar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.claims.map((claim, i) => (
                      <tr key={i}>
                        <th scope="row">
                          {features[claim.feature].label[locale]}
                        </th>
                        <td>
                          <p>{claim.text[locale]}</p>
                          <small>{claim.scope[locale]}</small>
                          <AppLink
                            className="claim-source"
                            href={claim.source}
                            rel="noopener"
                          >
                            {copy.status[claim.status][locale]} ·{' '}
                            {copy.source[locale]} <ArrowUpRight size={12} />
                          </AppLink>
                        </td>
                        <td>
                          <p>{features[claim.feature].value[locale]}</p>
                          <small>{features[claim.feature].scope[locale]}</small>
                          <AppLink
                            className="claim-source"
                            href={path(
                              locale,
                              market,
                              claim.feature === 'watchlist' ||
                                claim.feature === 'tracking'
                                ? 'watchlist'
                                : claim.feature === 'data'
                                  ? 'data'
                                  : 'help',
                            )}
                          >
                            {t(locale, 'help')} <ArrowUpRight size={12} />
                          </AppLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* oxlint-enable jsx-a11y/no-noninteractive-tabindex */}
            </section>
            <section className="comparison-section comparison-decision">
              <div>
                <p className="eyebrow">02 / {copy.decision[locale]}</p>
                <h2>{item.focus[locale]}</h2>
              </div>
              <p>{item.decision[locale]}</p>
            </section>
            <section className="comparison-section">
              <div className="editorial-section-head">
                <p className="eyebrow">03 / Cineradar</p>
                <h2>{copy.workflow[locale]}</h2>
              </div>
              <ol className="comparison-steps">
                {(
                  [
                    ['step1', 'step1Text', Globe2],
                    ['step2', 'step2Text', ListFilter],
                    ['step3', 'step3Text', Bookmark],
                  ] as const
                ).map(([h, p, Icon], i) => (
                  <li key={h}>
                    <div>
                      <Icon size={23} />
                      <span>0{i + 1}</span>
                    </div>
                    <h3>{copy[h][locale]}</h3>
                    <p>{copy[p][locale]}</p>
                  </li>
                ))}
              </ol>
              <AppLink
                className="button"
                href={
                  path(locale, market, 'search') +
                  '?q=' +
                  encodeURIComponent(item.example)
                }
              >
                {copy.example[locale]} ({countryName(locale, market)}):{' '}
                {item.example} <ArrowRight size={18} />
              </AppLink>
            </section>
            <section className="comparison-section comparison-faq">
              <div>
                <p className="eyebrow">04 / FAQ</p>
                <h2>{copy.faq[locale]}</h2>
              </div>
              <div>
                {[
                  [item.question[locale], item.answer[locale]],
                  [copy.accountQ[locale], copy.accountA[locale]],
                ].map(([q, a]) => (
                  <details key={q} open>
                    <summary>{q}</summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </section>
            <section className="comparison-country-note">
              <h2>{features.countries.label[locale]} · Cineradar</h2>
              <p>{features.countries.value[locale]}</p>
            </section>
            <section className="comparison-method">
              <h2>{copy.sources[locale]}</h2>
              <p>{copy.method[locale]}</p>
              <ul>
                {Array.from(new Set(item.claims.map((x) => x.source))).map(
                  (source, i) => (
                    <li key={source}>
                      <AppLink href={source} rel="noopener">
                        {item.brand} · {copy.source[locale]} {i + 1}{' '}
                        <ArrowUpRight size={14} />
                      </AppLink>
                      <time dateTime={date}>{date}</time>
                    </li>
                  ),
                )}
              </ul>
              <AppLink
                className="text-link"
                href={path(locale, market, 'data')}
              >
                {t(locale, 'data')} <ArrowRight size={16} />
              </AppLink>
            </section>
            <section className="comparison-section">
              <div className="editorial-section-head">
                <h2>{copy.next[locale]}</h2>
                <AppLink href={comparisonPath(locale)}>
                  {copy.hub[locale]} <ArrowRight size={16} />
                </AppLink>
              </div>
              <div className="comparison-grid">
                {comparisons
                  .filter((x) => item.related.includes(x.id))
                  .map((x) => (
                    <AppLink
                      className="comparison-card"
                      href={comparisonPath(locale, x.id)}
                      key={x.id}
                    >
                      <span>{x.focus[locale]}</span>
                      <h3>{x.brand}</h3>
                      <p>{x.intro[locale]}</p>
                      <ArrowUpRight size={22} />
                    </AppLink>
                  ))}
              </div>
              <AppLink className="button primary" href="#title-search">
                {copy.searchButton[locale]} <ArrowRight size={18} />
              </AppLink>
            </section>
          </>
        ) : (
          <section className="comparison-section" id="guides">
            <div className="editorial-section-head">
              <h2>{copy.compare[locale]}</h2>
              <p>{copy.method[locale]}</p>
            </div>
            <div className="comparison-grid">
              {comparisons.map((x, i) => (
                <AppLink
                  className="comparison-card"
                  href={comparisonPath(locale, x.id)}
                  key={x.id}
                >
                  <span>
                    {String(i + 1).padStart(2, '0')} / {x.focus[locale]}
                  </span>
                  <h2>{x.brand}</h2>
                  <p>{x.intro[locale]}</p>
                  <ArrowUpRight size={24} />
                </AppLink>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer locale={locale} market={market} />
    </>
  );
}

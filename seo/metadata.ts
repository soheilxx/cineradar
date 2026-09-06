import type { Metadata } from 'next';
import type { CatalogItem } from '../domain/types';
import { t, type MessageKey } from '../i18n/messages';
import { locales, type Locale, countryName } from '../i18n/config';
import { path, type RouteKey } from '../i18n/routes';
import { config } from '../lib/config';
export function jsonLd(data: unknown) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
export function indexable(
  item: CatalogItem | null,
  key: RouteKey,
  filtered: boolean,
) {
  const c = config();
  return (
    c.APP_MODE === 'live' &&
    c.DEPLOYMENT_ENV === 'production' &&
    c.LEGAL_APPROVED === 'true' &&
    c.LICENSES_CONFIRMED === 'true' &&
    !filtered &&
    !!item?.title.indexable &&
    ['available', 'empty'].includes(item.snapshot.availability) &&
    item.snapshot.freshness === 'fresh' &&
    ['movie', 'tv'].includes(key)
  );
}
export function metadata(
  locale: Locale,
  market: string,
  key: RouteKey,
  item: CatalogItem | null = null,
  filtered = false,
  tail = '',
): Metadata {
  const c = config();
  const name = item?.title.localizations[locale].title;
  const title = name
    ? `${name}${item.title.year ? ' (' + item.title.year + ')' : ''} · ${t(locale, 'offers')} · ${countryName(locale, market)} | Cineradar`
    : `${t(locale, key as MessageKey)} · ${countryName(locale, market)} | Cineradar`;
  const description = name
    ? `${name} · ${countryName(locale, market)}. ${t(locale, 'subheadline')}`
    : t(locale, 'subheadline');
  const canonical = new URL(
    path(locale, market, key, item?.title.localizations[locale].slug || tail),
    c.SITE_URL,
  ).href;
  const imageUrl = new URL(
    `/api/og?locale=${locale}&market=${market}${item ? '&id=' + encodeURIComponent(item.title.id) : ''}&revision=${item?.title.revision || 'brand-1'}`,
    c.SITE_URL,
  ).href;
  const canIndex = indexable(item, key, filtered);
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: canIndex
        ? Object.fromEntries(
            locales.map((l) => [
              l + '-' + market.toUpperCase(),
              new URL(
                path(l, market, key, item?.title.localizations[l].slug || tail),
                c.SITE_URL,
              ).href,
            ]),
          )
        : undefined,
    },
    robots: { index: canIndex, follow: !['watchlist', 'ops'].includes(key) },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
      siteName: 'Cineradar',
      locale: locale + '_' + market.toUpperCase(),
      alternateLocale: locales
        .filter((l) => l !== locale)
        .map((l) => l + '_' + market.toUpperCase()),
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: imageUrl, alt: title }],
    },
  };
}
export function titleSchema(item: CatalogItem, locale: Locale, market: string) {
  const c = config();
  const d = item.title;
  const url = new URL(
    path(locale, market, d.type, d.localizations[locale].slug),
    c.SITE_URL,
  ).href;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url,
    url,
    inLanguage: locale,
    name: d.localizations[locale].title,
    mainEntity: {
      '@type': d.type === 'movie' ? 'Movie' : 'TVSeries',
      '@id': url + '#title',
      name: d.localizations[locale].title,
      ...(d.localizations[locale].overview
        ? { description: d.localizations[locale].overview }
        : {}),
      ...(d.poster ? { image: d.poster } : {}),
      ...(d.runtime ? { duration: `PT${d.runtime}M` } : {}),
      genre: d.genres.map((g) => t(locale, g)),
      actor: d.cast.map((name) => ({ '@type': 'Person', name })),
    },
  };
}

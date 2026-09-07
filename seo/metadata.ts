import type { Metadata } from 'next';
import type { CatalogItem } from '../domain/types';
import { t, type MessageKey } from '../i18n/messages';
import { locales, type Locale, countryName } from '../i18n/config';
import { path, type RouteKey } from '../i18n/routes';
import { config } from '../lib/config';
import { meaningfulTitle, streamingContent } from './content';
import { infoDescriptions } from '../content/info';
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
  locale: Locale = 'en',
) {
  const c = config();
  return (
    c.APP_MODE === 'live' &&
    c.DEPLOYMENT_ENV === 'production' &&
    c.LEGAL_APPROVED === 'true' &&
    c.LICENSES_CONFIRMED === 'true' &&
    !filtered &&
    !!item &&
    meaningfulTitle(item, locale) &&
    ['available', 'empty'].includes(item.snapshot.availability) &&
    !!item.snapshot.checkedAt &&
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
  page = 1,
  label?: string,
): Metadata {
  const c = config();
  const name = item?.title.localizations[locale].title;
  const title = name
    ? `${t(locale, 'watchTitle', { title: name })}${item.title.year ? ' (' + item.title.year + ')' : ''} · ${countryName(locale, market)} | Cineradar`
    : `${label || t(locale, key as MessageKey)} · ${countryName(locale, market)} | Cineradar`;
  const description = name
    ? streamingContent(item, locale, market).description
    : key in infoDescriptions
      ? infoDescriptions[key as keyof typeof infoDescriptions][locale]
      : t(locale, 'catalogIntro', {
          title: label || t(locale, key as MessageKey),
          country: countryName(locale, market),
        });
  const canonical = new URL(
    path(locale, market, key, item?.title.localizations[locale].slug || tail) +
      (page > 1 ? `?page=${page}` : ''),
    c.SITE_URL,
  ).href;
  const imageUrl = new URL(
    `/api/og?locale=${locale}&market=${market}&page=${key}${tail ? '&tail=' + encodeURIComponent(tail) : ''}${item ? '&id=' + encodeURIComponent(item.title.id) : ''}&revision=${item?.title.revision || 'editorial-2'}`,
    c.SITE_URL,
  ).href;
  const landing =
    ['home', 'movies', 'series', 'providers'].includes(key) ||
    (key === 'topics' &&
      ['scifi', 'thriller', 'comedy', 'drama'].includes(tail));
  const published =
    c.APP_MODE === 'live' &&
    c.DEPLOYMENT_ENV === 'production' &&
    c.LEGAL_APPROVED === 'true' &&
    c.LICENSES_CONFIRMED === 'true';
  const canIndex =
    indexable(item, key, filtered, locale) ||
    (published && landing && !filtered);
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: canIndex
        ? {
            ...(key === 'home' ? { 'x-default': c.SITE_URL + '/' } : {}),
            ...Object.fromEntries(
              locales
                .filter((l) => !item || indexable(item, key, filtered, l))
                .map((l) => [
                  l + '-' + market.toUpperCase(),
                  new URL(
                    path(
                      l,
                      market,
                      key,
                      item?.title.localizations[l].slug || tail,
                    ) + (page > 1 ? `?page=${page}` : ''),
                    c.SITE_URL,
                  ).href,
                ]),
            ),
          }
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

export function breadcrumbSchema(
  item: CatalogItem,
  locale: Locale,
  market: string,
) {
  const origin = config().SITE_URL;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        name: t(locale, 'home'),
        item: new URL(path(locale, market), origin).href,
      },
      {
        name: t(locale, item.title.type === 'movie' ? 'movies' : 'series'),
        item: new URL(
          path(
            locale,
            market,
            item.title.type === 'movie' ? 'movies' : 'series',
          ),
          origin,
        ).href,
      },
      {
        name: item.title.localizations[locale].title,
        item: new URL(
          path(
            locale,
            market,
            item.title.type,
            item.title.localizations[locale].slug,
          ),
          origin,
        ).href,
      },
    ].map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      ...item,
    })),
  };
}

export function siteSchema(locale: Locale, market: string) {
  const c = config();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': c.SITE_URL + '/#website',
    url: new URL(path(locale, market), c.SITE_URL).href,
    name: 'Cineradar',
    inLanguage: locale,
    description: t(locale, 'guideIntro'),
    publisher: {
      '@type': 'Organization',
      name: c.OPERATOR_NAME || 'Cineradar',
      url: c.SITE_URL,
    },
  };
}

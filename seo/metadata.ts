import type { Metadata } from 'next';
import type { CatalogItem } from '../domain/types';
import { t, type MessageKey } from '../i18n/messages';
import {
  locales,
  defaultMarkets,
  type Locale,
  countryName,
} from '../i18n/config';
import { path, type RouteKey } from '../i18n/routes';
import { config } from '../lib/config';
import { streamingDescription } from './content';
import { infoDescriptions } from '../content/info';
import { db, type Database } from '../data/db';
import { pageCopy, pageLabel, conciseDescription } from './copy';
import { isPaginatedRoute } from './routing';
import { isIndexableLanding, landingAlternates } from './landings';
import { OG_IMAGE_VERSION } from './og';
import {
  titleAlternates,
  titleEligibility,
  type IndexingSnapshot,
} from './indexing';
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
    titleEligibility(item.title, locale, {
      ...item.snapshot,
      hasOffers: item.snapshot.offers.some(
        (o) =>
          o.market === item.snapshot.market &&
          (!o.expiresOn || new Date(o.expiresOn).getTime() >= Date.now()),
      ),
    }).indexable &&
    ['movie', 'tv'].includes(key)
  );
}
export async function metadata(
  locale: Locale,
  market: string,
  key: RouteKey,
  item: CatalogItem | null = null,
  filtered = false,
  tail = '',
  page = 1,
  label?: string,
  options: { database?: Database; unavailable?: boolean } = {},
): Promise<Metadata> {
  const c = config();
  page =
    isPaginatedRoute(key, tail) && Number.isInteger(page) && page > 1
      ? page
      : 1;
  const country = countryName(locale, market);
  const copy = pageCopy(locale, country, key, label);
  const info = Object.hasOwn(infoDescriptions, key);
  const canonicalMarket = info ? defaultMarkets[locale] : market;
  const name = item?.title.localizations[locale].title;
  const baseTitle = name
    ? `${t(locale, 'watchTitle', { title: name })}${item.title.year ? ' (' + item.title.year + ')' : ''} · ${country}`
    : `${copy.title}${key === 'home' || info || key === 'ops' ? '' : ` · ${country}`}`;
  const title = `${baseTitle}${page > 1 ? ` · ${pageLabel(locale, page)}` : ''} | Cineradar`;
  const baseDescription = name
    ? streamingDescription(item, locale, market)
    : conciseDescription(
        info
          ? infoDescriptions[key as keyof typeof infoDescriptions][locale]
          : copy.description ||
              t(locale, 'catalogIntro', {
                title: label || t(locale, key as MessageKey),
                country,
              }),
      );
  const description =
    page > 1
      ? `${pageLabel(locale, page)}. ${baseDescription}`
      : baseDescription;
  const canonical = new URL(
    path(
      locale,
      canonicalMarket,
      key,
      item?.title.localizations[locale].slug || tail,
    ) + (page > 1 ? `?page=${page}` : ''),
    c.SITE_URL,
  ).href;
  const imageUrl = new URL(
    `/api/og?locale=${locale}&market=${canonicalMarket}&page=${key}${tail ? '&tail=' + encodeURIComponent(tail) : ''}${item ? '&id=' + encodeURIComponent(item.title.id) : ''}&revision=${encodeURIComponent(item?.title.revision || 'editorial')}${item?.title.artworkRevision ? '&artwork=' + encodeURIComponent(item.title.artworkRevision) : ''}&v=${OG_IMAGE_VERSION}`,
    c.SITE_URL,
  ).href;
  const landing = isIndexableLanding(key, tail);
  const published =
    c.APP_MODE === 'live' &&
    c.DEPLOYMENT_ENV === 'production' &&
    c.LEGAL_APPROVED === 'true' &&
    c.LICENSES_CONFIRMED === 'true';
  let canIndex =
    !options.unavailable &&
    (indexable(item, key, filtered, locale) ||
      (published && landing && !filtered));
  let allTitleAlternates: Record<string, string> | undefined;
  try {
    if (item && canIndex && c.DATABASE_URL) {
      const snapshots = await (
        options.database || (await db())
      ).query<IndexingSnapshot>(
        `SELECT s.market,s.availability,s.checked_at AS "checkedAt",EXISTS(SELECT 1 FROM offers o WHERE o.title_id=s.title_id AND o.market=s.market AND (o.expires_at IS NULL OR o.expires_at>=now())) AS "hasOffers" FROM snapshots s WHERE s.title_id=$1 AND s.market=ANY($2::text[])`,
        [item.title.id, c.markets],
      );
      allTitleAlternates = titleAlternates(
        item.title,
        snapshots.rows,
        c.SITE_URL,
      );
      canIndex = Object.hasOwn(
        allTitleAlternates,
        `${locale}-${market.toUpperCase()}`,
      );
    }
    if (canIndex && !item && landing && c.DATABASE_URL) {
      allTitleAlternates = await landingAlternates(
        options.database || (await db()),
        c.SITE_URL,
        c.markets,
        key,
        tail,
        page,
      );
      canIndex = Object.hasOwn(
        allTitleAlternates,
        `${locale}-${market.toUpperCase()}`,
      );
    }
  } catch {
    // An unavailable registry must not turn an incomplete page into an indexed one.
    canIndex = false;
    allTitleAlternates = undefined;
  }
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: canIndex
        ? allTitleAlternates || {
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
    robots: {
      index: canIndex,
      follow: !['watchlist', 'myProviders', 'ops'].includes(key),
      ...(canIndex ? { 'max-image-preview': 'large' as const } : {}),
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
      siteName: 'Cineradar',
      locale: locale + '_' + canonicalMarket.toUpperCase(),
      alternateLocale:
        allTitleAlternates && canIndex
          ? Object.keys(allTitleAlternates)
              .filter(
                (tag) => tag !== `${locale}-${canonicalMarket.toUpperCase()}`,
              )
              .map((tag) => tag.replace('-', '_'))
          : undefined,
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

import type { Metadata } from 'next';
import { locales, defaultMarkets, type Locale } from '../i18n/config';
import { path } from '../i18n/routes';
import { config } from '../lib/config';
import {
  identifyEditorial,
  IDENTIFY_EDITORIAL_UPDATED,
} from '../content/identify-editorial';
import { sitemapHash, type SitemapEntry } from './sitemap-xml';

export function identifyAlternates(origin: string, markets: string[]) {
  return Object.fromEntries(
    locales
      .filter((locale) => markets.includes(defaultMarkets[locale]))
      .map((locale) => [
        locale,
        new URL(path(locale, defaultMarkets[locale], 'identify'), origin).href,
      ]),
  );
}
export function identifyMetadata(locale: Locale, filtered = false): Metadata {
  const c = config();
  const text = identifyEditorial[locale];
  const canonical = new URL(
    path(locale, defaultMarkets[locale], 'identify'),
    c.SITE_URL,
  ).href;
  const image = new URL(
    `/api/og?locale=${locale}&market=${defaultMarkets[locale]}&page=identify&revision=${IDENTIFY_EDITORIAL_UPDATED}`,
    c.SITE_URL,
  ).href;
  const published =
    c.APP_MODE === 'live' &&
    c.DEPLOYMENT_ENV === 'production' &&
    c.LEGAL_APPROVED === 'true' &&
    c.LICENSES_CONFIRMED === 'true';
  return {
    title: text.seoTitle,
    description: text.metaDescription,
    alternates: {
      canonical,
      languages: filtered
        ? undefined
        : identifyAlternates(c.SITE_URL, c.markets),
    },
    robots: {
      index: published && !filtered,
      follow: true,
      'max-image-preview': 'large',
    },
    openGraph: {
      type: 'website',
      siteName: 'Cineradar',
      title: text.seoTitle,
      description: text.metaDescription,
      url: canonical,
      locale,
      alternateLocale: locales.filter((l) => l !== locale),
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: text.headline,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: text.seoTitle,
      description: text.metaDescription,
      images: [{ url: image, alt: text.headline }],
    },
  };
}
export function identifySchema(locale: Locale) {
  const text = identifyEditorial[locale];
  const url = new URL(
    path(locale, defaultMarkets[locale], 'identify'),
    config().SITE_URL,
  ).href;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url,
    url,
    inLanguage: locale,
    name: text.headline,
    description: text.metaDescription,
    isPartOf: {
      '@type': 'WebSite',
      '@id': config().SITE_URL + '/#website',
      name: 'Cineradar',
    },
  };
}
export function identifySitemapEntries(
  origin: string,
  markets: string[],
): SitemapEntry[] {
  const alternates = identifyAlternates(origin, markets);
  return locales
    .filter((locale) => Object.hasOwn(alternates, locale))
    .map((locale) => ({
      url: alternates[locale],
      entity: 'feature:identify',
      segment: `landings-${locale}-${defaultMarkets[locale]}`,
      locale,
      market: defaultMarkets[locale],
      revision: sitemapHash(JSON.stringify(identifyEditorial[locale])),
      lastmod: IDENTIFY_EDITORIAL_UPDATED + 'T00:00:00.000Z',
      indexable: true,
      sitemapEligible: true,
      reason: null,
      alternates,
      images: [],
    }));
}

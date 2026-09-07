import type { Metadata } from 'next';
import { locales, defaultMarkets, type Locale } from '../i18n/config';
import {
  comparisonPath,
  type ComparisonId,
} from '../content/comparisons/routes';
import { getComparison } from '../content/comparisons';
import { copy } from '../content/comparisons/copy';
import { config } from '../lib/config';
export function comparisonMetadata(
  locale: Locale,
  id?: ComparisonId,
): Metadata {
  const c = config();
  const item = id ? getComparison(id) : undefined;
  const title = item
    ? `${item.brand} ${copy.alternative[locale]}: ${item.focus[locale]} | Cineradar`
    : `${copy.hub[locale]} | Cineradar`;
  const description = item
    ? `${item.brand} & Cineradar: ${item.focus[locale]}. ${item.intro[locale]}`
    : copy.hubIntro[locale];
  const url = new URL(comparisonPath(locale, id), c.SITE_URL).href;
  const image = new URL(
    `/api/og?locale=${locale}&market=${defaultMarkets[locale]}&comparison=${id || 'hub'}&revision=${item?.updatedAt || '2026-09-07'}`,
    c.SITE_URL,
  ).href;
  const languages = Object.fromEntries(
    locales.map((l) => [l, new URL(comparisonPath(l, id), c.SITE_URL).href]),
  );
  return {
    title,
    description,
    alternates: { canonical: url, languages },
    robots: {
      index:
        c.DEPLOYMENT_ENV === 'production' &&
        c.APP_MODE === 'live' &&
        c.LEGAL_APPROVED === 'true' &&
        c.LICENSES_CONFIRMED === 'true',
      follow: true,
    },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'Cineradar',
      locale,
      alternateLocale: locales.filter((l) => l !== locale),
      images: [
        { url: image, width: 1200, height: 630, type: 'image/png', alt: title },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: image, alt: title }],
    },
  };
}

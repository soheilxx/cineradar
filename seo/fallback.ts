import type { Metadata } from 'next';
import { defaultMarkets, countryName, type Locale } from '../i18n/config';
import { t } from '../i18n/messages';
import { config } from '../lib/config';
import { pageCopy } from './copy';
import { OG_IMAGE_VERSION } from './og';

export function fallbackMetadata(locale: Locale, missing = false): Metadata {
  const origin = config().SITE_URL;
  const market = defaultMarkets[locale];
  const copy = pageCopy(locale, countryName(locale, market), 'home');
  const title = `${missing ? t(locale, 'notFound') : copy.title} | Cineradar`;
  const description = missing ? t(locale, 'notFoundText') : copy.description;
  const image = new URL(
    `/api/og?locale=${locale}&market=${market}&page=${missing ? 'notFound' : 'home'}&v=${OG_IMAGE_VERSION}`,
    origin,
  ).href;
  return {
    metadataBase: new URL(origin),
    title,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: null, languages: undefined },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Cineradar',
      locale: `${locale}_${market.toUpperCase()}`,
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

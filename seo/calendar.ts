import { metadata } from './metadata';
import { calendarView } from '../data/repositories/calendar-view';
import { config } from '../lib/config';
import { defaultMarkets, locales, type Locale } from '../i18n/config';
import { path } from '../i18n/routes';
import { getUpcomingEpisodes } from '../data/repositories/episodes';
import type { Database } from '../data/db';
import { sitemapHash, type SitemapEntry } from './sitemap-xml';

const calendarUrl = (origin: string, locale: Locale) =>
  new URL(path(locale, defaultMarkets[locale], 'calendar'), origin).href;
const published = (c: ReturnType<typeof config>) =>
  c.tvmazeEnabled &&
  c.DEPLOYMENT_ENV === 'production' &&
  c.LEGAL_APPROVED === 'true' &&
  c.LICENSES_CONFIRMED === 'true';
export async function calendarMetadata(
  locale: Locale,
  market: string,
  filtered: boolean,
  options: { database?: Database } = {},
) {
  const c = config();
  const canonicalMarket = defaultMarkets[locale];
  const [base, data] = await Promise.all([
    metadata(
      locale,
      canonicalMarket,
      'calendar',
      null,
      filtered,
      '',
      1,
      undefined,
      options,
    ),
    options.database
      ? calendarView(canonicalMarket, options.database)
      : calendarView(canonicalMarket),
  ]);
  const index =
    published(c) &&
    c.markets.includes(canonicalMarket) &&
    !filtered &&
    market === canonicalMarket &&
    Boolean(data?.episodes.length);
  const canonical = calendarUrl(c.SITE_URL, locale);
  return {
    ...base,
    alternates: {
      canonical,
      languages: index
        ? Object.fromEntries(
            locales
              .filter((l) => c.markets.includes(defaultMarkets[l]))
              .map((l) => [l, calendarUrl(c.SITE_URL, l)]),
          )
        : undefined,
    },
    robots: {
      index,
      follow: true,
      googleBot: { index, follow: true, 'max-image-preview': 'large' as const },
    },
  };
}
export async function calendarSitemapEntries(
  database: Database,
  origin: string,
): Promise<SitemapEntry[]> {
  const c = config();
  if (!published(c)) return [];
  const rows = await Promise.all(
    locales
      .filter((locale) => c.markets.includes(defaultMarkets[locale]))
      .map(async (locale) => ({
        locale,
        data: await getUpcomingEpisodes(
          defaultMarkets[locale],
          14,
          150,
          database,
        ),
      })),
  );
  const eligible = rows.filter((row) => row.data.episodes.length > 0);
  const alternates = Object.fromEntries(
    eligible.map((row) => [row.locale, calendarUrl(origin, row.locale)]),
  );
  return eligible.map(({ locale, data }) => ({
    url: calendarUrl(origin, locale),
    entity: 'calendar:' + locale,
    segment: 'calendars-' + locale,
    locale,
    market: defaultMarkets[locale],
    revision: sitemapHash(
      JSON.stringify([
        data.truncated,
        data.episodes.map(({ episode, show, title }) => [
          episode.id,
          episode.name,
          episode.season,
          episode.number,
          episode.airStamp,
          episode.airDate,
          episode.airTime,
          show.id,
          show.name,
          show.url,
          show.networkName,
          show.country,
          show.distribution,
          title?.id,
          title?.localizations[locale].title,
          title?.localizations[locale].slug,
        ]),
      ]),
    ),
    lastmod: null,
    indexable: true,
    sitemapEligible: true,
    reason: null,
    alternates,
    images: [],
  }));
}

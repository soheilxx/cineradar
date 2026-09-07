import { defaultMarkets, isLocale, type Locale } from '../i18n/config';

export function visitorCountry(
  headers: Pick<Headers, 'get'>,
  platform: 'vercel' | 'cloudflare' | 'other',
) {
  const country =
    platform === 'vercel'
      ? headers.get('x-vercel-ip-country')
      : platform === 'cloudflare'
        ? headers.get('cf-ipcountry')
        : null;
  const normalized = country?.trim().toLowerCase();
  return normalized && /^[a-z]{2}$/.test(normalized) ? normalized : null;
}

export function visitorContext(input: {
  saved?: string;
  languages?: string | null;
  country?: string | null;
  markets: string[];
  locale?: Locale;
}) {
  const saved = (input.saved || '').match(/^([a-z]{2})\.([a-z]{2})$/);
  const [, savedLocale = '', savedMarket = ''] = saved || [];
  const validSaved =
    isLocale(savedLocale) && input.markets.includes(savedMarket);
  const choices = (input.languages || '')
    .split(',')
    .map((value, index) => {
      const [tag, ...params] = value.trim().split(';');
      const quality = params.find((p) => p.trim().startsWith('q='));
      return {
        tag: tag.toLowerCase(),
        quality: quality ? Number(quality.trim().slice(2)) : 1,
        index,
      };
    })
    .filter((x) => x.quality > 0 && x.quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  const browserLocale = choices.map((x) => x.tag.split('-')[0]).find(isLocale);
  const country = input.country?.trim().toLowerCase();
  const geo = country && input.markets.includes(country) ? country : undefined;
  const geoLocale =
    geo === 'us' ? 'en' : geo && isLocale(geo) ? geo : undefined;
  const fallbackMarket = (locale: Locale) =>
    input.markets.includes(defaultMarkets[locale])
      ? defaultMarkets[locale]
      : input.markets[0] || 'de';

  // A locale-only URL is an explicit language choice. Its matching saved market
  // remains authoritative; choosing English explicitly retains the US default.
  if (input.locale)
    return {
      locale: input.locale,
      market:
        validSaved && savedLocale === input.locale
          ? savedMarket
          : input.locale === 'en' && input.markets.includes('us')
            ? 'us'
            : geo || fallbackMarket(input.locale),
    };
  if (validSaved) return { locale: savedLocale, market: savedMarket };

  // A new visitor's verified country chooses the local catalogue and language.
  // Browser language is only a fallback when geography is unavailable/unsupported.
  if (geo) return { locale: geoLocale || browserLocale || 'en', market: geo };
  const locale = browserLocale || 'en';
  const languageRegion = choices
    .filter((x) => x.tag.split('-')[0] === locale)
    .map((x) => x.tag.split('-')[1])
    .find((x) => input.markets.includes(x));
  const market =
    locale === 'en' && input.markets.includes('us')
      ? 'us'
      : languageRegion || fallbackMarket(locale);
  return { locale, market };
}

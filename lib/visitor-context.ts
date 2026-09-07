import { defaultMarkets, isLocale, type Locale } from '../i18n/config';

export function visitorContext(input: {
  saved?: string;
  languages?: string | null;
  country?: string | null;
  markets: string[];
  locale?: Locale;
}) {
  const [savedLocale, savedMarket] = (input.saved || '').split('.');
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
  const geo = input.country?.toLowerCase();
  const locale =
    input.locale ||
    (isLocale(savedLocale)
      ? savedLocale
      : browserLocale || (geo && isLocale(geo) ? geo : 'en'));
  const languageRegion = choices
    .map((x) => x.tag.split('-')[1])
    .find((x) => input.markets.includes(x));
  const market =
    savedLocale === locale && input.markets.includes(savedMarket)
      ? savedMarket
      : locale === 'en' && input.markets.includes('us')
        ? 'us'
        : geo && input.markets.includes(geo)
          ? geo
          : languageRegion ||
            (input.markets.includes(defaultMarkets[locale])
              ? defaultMarkets[locale]
              : input.markets[0] || 'de');
  return { locale, market };
}

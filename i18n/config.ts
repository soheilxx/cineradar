export const locales = ['de', 'fr', 'it', 'es', 'en'] as const;
export type Locale = (typeof locales)[number];
export const markets = ['de', 'fr', 'it', 'es', 'us'] as const;
export type Market = string;
export const languageNames: Record<Locale, string> = {
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  es: 'Español',
  en: 'English',
};
export const defaultMarkets: Record<Locale, string> = {
  de: 'de',
  fr: 'fr',
  it: 'it',
  es: 'es',
  en: 'us',
};
export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
export function countryName(locale: Locale, market: string) {
  return (
    new Intl.DisplayNames([locale], { type: 'region' }).of(
      market.toUpperCase(),
    ) || market.toUpperCase()
  );
}

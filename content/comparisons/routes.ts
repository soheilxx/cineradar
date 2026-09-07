import { isLocale, type Locale } from '../../i18n/config';

export const comparisonIds = [
  'wer-streamt-es',
  'justwatch',
  'playpilot',
  'moviepilot',
  'tv-movie',
  'movie-of-the-night',
  'reelgood',
  'yidio',
  'plex',
  'trakt',
] as const;
export type ComparisonId = (typeof comparisonIds)[number];
export const hubSlugs: Record<Locale, string> = {
  de: 'vergleiche',
  fr: 'comparatifs',
  it: 'confronti',
  es: 'comparativas',
  en: 'comparisons',
};
export function isComparisonId(value: string): value is ComparisonId {
  return comparisonIds.includes(value as ComparisonId);
}
export function comparisonPath(locale: Locale, id?: ComparisonId) {
  return `${locale === 'de' ? '' : '/' + locale}/${id || hubSlugs[locale]}`;
}
export function comparisonRoute(
  pathname: string,
): { locale: Locale; id?: ComparisonId } | null {
  const p = pathname.replace(/\/$/, '').split('/').slice(1);
  const locale =
    p.length === 1
      ? 'de'
      : p.length === 2 && isLocale(p[0]) && p[0] !== 'de'
        ? p[0]
        : null;
  const slug = p.at(-1) || '';
  if (!locale) return null;
  if (isComparisonId(slug)) return { locale, id: slug };
  if (slug === hubSlugs[locale]) return { locale };
  return null;
}

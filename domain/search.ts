import type { CatalogItem, Filters, Title } from './types';
import type { Locale } from '../i18n/config';
import { activeOffers, inSubscriptions } from './offers';
export function fold(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function parseSearchQuery(query: string) {
  const q = query.trim();
  // Infer a release year only after a title: "1917" is a title, while
  // "1917 2019" and "Inception (2010)" include a separate release year.
  const match = q.match(/^(.*\S)\s+(?:\(((?:19|20)\d{2})\)|((?:19|20)\d{2}))$/);
  return match
    ? { q: match[1].trim(), year: Number(match[2] || match[3]) }
    : { q, year: null };
}
function trigrams(value: string) {
  return new Set(
    value.split(' ').flatMap((word) => {
      const padded = `  ${word} `;
      return Array.from({ length: padded.length - 2 }, (_, i) =>
        padded.slice(i, i + 3),
      );
    }),
  );
}
function similarity(a: string, b: string) {
  const left = trigrams(a),
    right = trigrams(b);
  const common = [...left].filter((part) => right.has(part)).length;
  return common / (left.size + right.size - common || 1);
}
export function searchScore(query: string, item: CatalogItem, locale: Locale) {
  const q = fold(parseSearchQuery(query).q);
  if (!q) return 1;
  const names = [
    item.title.localizations[locale].title,
    item.title.originalTitle,
    ...Object.values(item.title.localizations).map((x) => x.title),
  ];
  return Math.max(
    ...names.map((n) => {
      const f = fold(n);
      return f === q
        ? 4
        : f.startsWith(q)
          ? 3
          : f.includes(q) ||
              q.split(' ').every((word) => f.split(' ').includes(word))
            ? 2
            : similarity(f, q) > 0.35
              ? 1
              : 0;
    }),
  );
}
// TMDB popularity and provider trends express interest, not verified stream counts.
// Votes keep older imports useful; a bounded trend bonus cannot swamp title relevance.
export function prominenceScore(
  title: Title,
  trendIndex = -1,
  now = Date.now(),
) {
  const updated = Date.parse(title.popularityUpdatedAt || '');
  const popularity =
    Number.isFinite(updated) && updated <= now && updated > now - 7 * 86400000
      ? Math.max(0, title.popularity || 0)
      : 0;
  return (
    Math.log1p(Math.max(0, title.votes || 0)) +
    0.5 * Math.log1p(popularity) +
    (trendIndex >= 0 ? 2 / (trendIndex + 1) : 0)
  );
}
export function compareCatalog(
  a: CatalogItem,
  b: CatalogItem,
  locale: Locale,
  f: Filters,
  discoveryIds: string[] = [],
  now = Date.now(),
) {
  const stable = () => a.title.id.localeCompare(b.title.id);
  const year = () => (b.title.year || 0) - (a.title.year || 0);
  const rank = (item: CatalogItem) => {
    const index = discoveryIds.indexOf(item.title.id);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  if (f.sort === 'title')
    return (
      a.title.localizations[locale].title.localeCompare(
        b.title.localizations[locale].title,
        locale,
      ) || stable()
    );
  if (f.sort === 'year') return year() || stable();
  if (f.sort === 'latest')
    return (
      rank(a) - rank(b) || year() || b.title.votes - a.title.votes || stable()
    );
  const relevance = f.q
    ? searchScore(f.q, b, locale) - searchScore(f.q, a, locale)
    : 0;
  if (relevance) return relevance;
  if (f.sort === 'trending') {
    const trend = rank(a) - rank(b);
    if (trend) return trend;
  }
  if (f.q || f.sort === 'trending')
    return (
      prominenceScore(b.title, discoveryIds.indexOf(b.title.id), now) -
        prominenceScore(a.title, discoveryIds.indexOf(a.title.id), now) ||
      b.title.votes - a.title.votes ||
      stable()
    );
  const available = (item: CatalogItem) =>
    Number(activeOffers(item.snapshot.offers, now).length > 0);
  const rating = (item: CatalogItem) =>
    ((item.title.rating || 0) * item.title.votes) / (item.title.votes + 500);
  return available(b) - available(a) || rating(b) - rating(a) || stable();
}
export function filterCatalog(
  items: CatalogItem[],
  locale: Locale,
  f: Filters,
  now = Date.now(),
  discoveryIds: string[] = [],
) {
  const year = f.year || parseSearchQuery(f.q || '').year;
  return items
    .filter((item) => {
      const a = activeOffers(item.snapshot.offers, now);
      const offers = a.filter(
        (o) =>
          (!f.provider || o.provider.id === f.provider) &&
          (!f.offerType || o.type === f.offerType) &&
          (!f.quality || o.quality === f.quality) &&
          (!f.audio || o.audio?.includes(f.audio)) &&
          (!f.subtitles || o.subtitles?.includes(f.subtitles)) &&
          (!f.mine?.length || inSubscriptions(o, f.mine)) &&
          (f.scope !== 'new' ||
            (!!o.availableSince &&
              Date.parse(o.availableSince) > now - 7 * 86400000)) &&
          (f.scope !== 'leaving' ||
            (!!o.expiresOn &&
              Date.parse(o.expiresOn) <= now + 30 * 86400000)) &&
          (f.scope !== 'free' || o.type === 'free'),
      );
      const requires = !!(
        f.provider ||
        f.offerType ||
        f.quality ||
        f.audio ||
        f.subtitles ||
        f.mine?.length ||
        f.scope
      );
      return (
        (!f.q || searchScore(f.q, item, locale) > 0) &&
        (!year || item.title.year === year) &&
        (!f.type || item.title.type === f.type) &&
        (!f.genre || item.title.genres.includes(f.genre as never)) &&
        (!f.maxMinutes ||
          (item.title.type === 'movie' &&
            item.title.runtime !== null &&
            item.title.runtime <= f.maxMinutes)) &&
        (!requires || offers.length > 0)
      );
    })
    .sort((a, b) => compareCatalog(a, b, locale, f, discoveryIds, now));
}

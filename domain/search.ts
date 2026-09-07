import type { CatalogItem, Filters } from './types';
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
function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
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
    ...names.map((n, i) => {
      const f = fold(n);
      return f === q
        ? 100 - i
        : f.startsWith(q)
          ? 80 - i
          : f.includes(q)
            ? 60 - i
            : distance(f, q) <= Math.max(1, Math.floor(q.length * 0.18))
              ? 30
              : 0;
    }),
  );
}
export function filterCatalog(
  items: CatalogItem[],
  locale: Locale,
  f: Filters,
  now = Date.now(),
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
    .sort((a, b) =>
      f.sort === 'title'
        ? a.title.localizations[locale].title.localeCompare(
            b.title.localizations[locale].title,
            locale,
          )
        : f.sort === 'year'
          ? (b.title.year || 0) - (a.title.year || 0)
          : f.q
            ? searchScore(f.q, b, locale) - searchScore(f.q, a, locale)
            : 0,
    );
}

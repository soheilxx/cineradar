import type { Database } from '../data/db';
import { locales, type Locale } from '../i18n/config';
import { path, type RouteKey } from '../i18n/routes';
import { isPaginatedRoute } from './routing';
import { sharedPublicCache } from '../data/shared-cache';

export function isIndexableLanding(key: RouteKey, tail: string) {
  return (
    ['home', 'movies', 'series', 'providers'].includes(key) ||
    (key === 'topics' &&
      ['scifi', 'thriller', 'comedy', 'drama'].includes(tail))
  );
}

type AlternateLinks = Record<string, string>;
type CacheEntry = {
  expires: number;
  value?: AlternateLinks;
  pending?: Promise<AlternateLinks>;
};
const TTL_MS = 20000;
const MAX_ENTRIES = 128;
const databaseIds = new WeakMap<Database, number>();
let nextDatabaseId = 0;
const alternateCache = new Map<string, CacheEntry>();

export async function landingAlternates(
  database: Database,
  origin: string,
  markets: string[],
  key: RouteKey,
  tail: string,
  page: number,
) {
  // Metadata calls this only for public, unfiltered indexable landings. One
  // query already covers every enabled language/market, so context switches
  // can reuse it without putting the visitor's current context in the key.
  let databaseId = databaseIds.get(database);
  if (databaseId === undefined) {
    databaseId = ++nextDatabaseId;
    databaseIds.set(database, databaseId);
  }
  const marketSnapshot = [...markets];
  const cacheKey = JSON.stringify([
    databaseId,
    origin,
    [...marketSnapshot].sort(),
    key,
    tail,
    page,
  ]);
  const cached = alternateCache.get(cacheKey);
  if (cached && (cached.pending || cached.expires > Date.now())) {
    // Refresh LRU order; callers receive their own map, never the cached map.
    alternateCache.delete(cacheKey);
    alternateCache.set(cacheKey, cached);
    return { ...(cached.pending ? await cached.pending : cached.value) };
  }
  const entry: CacheEntry = { expires: 0 };
  entry.pending = sharedPublicCache(
    'landing:' + JSON.stringify([origin, [...marketSnapshot].sort(), key, tail, page]),
    () => loadLandingAlternates(database, origin, marketSnapshot, key, tail, page),
    300,
    600,
  ).then(
    (value) => {
      // An evicted in-flight request must not repopulate the bounded cache.
      if (alternateCache.get(cacheKey) === entry) {
        entry.value = value;
        entry.expires = Date.now() + TTL_MS;
        entry.pending = undefined;
      }
      return value;
    },
    (error: unknown) => {
      if (alternateCache.get(cacheKey) === entry)
        alternateCache.delete(cacheKey);
      throw error;
    },
  );
  alternateCache.delete(cacheKey);
  alternateCache.set(cacheKey, entry);
  if (alternateCache.size > MAX_ENTRIES)
    alternateCache.delete(alternateCache.keys().next().value!);
  // No stale fallback: failed/expired eligibility is recomputed or fails closed
  // through metadata's existing error handling.
  return { ...(await entry.pending) };
}

export async function loadLandingAlternates(
  database: Database,
  origin: string,
  markets: string[],
  key: RouteKey,
  tail: string,
  page: number,
) {
  // Pagination only needs to know whether the first row of this page exists.
  // Stop there instead of counting and joining the entire catalog 25 times.
  // Editorial eligibility is a separate EXISTS: it may be satisfied by a title
  // outside the displayed page, as with the previous count/bool_or semantics.
  const provider = key === 'providers';
  const source = provider
    ? 'provider_titles p JOIN titles t ON t.id=p.title_id'
    : 'titles t';
  const providerFilter = provider ? 'AND p.market=m.market' : '';
  const result = await database.query<{
    locale: Locale;
    market: string;
    total: number | string;
  }>(
    `${provider ? `WITH provider_titles AS NOT MATERIALIZED (
      SELECT DISTINCT o.title_id,o.market FROM offers o
      WHERE o.market=ANY($1::text[]) AND ($3='' OR o.provider_id=$3)
        AND (o.expires_at IS NULL OR o.expires_at>=now())
    )` : ''}
    SELECT lang.locale,m.market
    FROM unnest($5::text[]) AS lang(locale)
    CROSS JOIN unnest($1::text[]) AS m(market)
    WHERE EXISTS (
      SELECT 1 FROM ${source} JOIN localizations l ON l.title_id=t.id AND l.locale=lang.locale
      WHERE ($2 NOT IN('movies','series') OR t.media_type=CASE WHEN $2='movies' THEN 'movie' ELSE 'tv' END)
        AND ($2<>'topics' OR t.data->'genres' ? $3)
        ${providerFilter}
      OFFSET $4 LIMIT 1
    ) AND EXISTS (
      SELECT 1 FROM ${source} JOIN localizations l ON l.title_id=t.id AND l.locale=lang.locale
      JOIN snapshots s ON s.title_id=t.id AND s.market=m.market
      WHERE ($2 NOT IN('movies','series') OR t.media_type=CASE WHEN $2='movies' THEN 'movie' ELSE 'tv' END)
      AND ($2<>'topics' OR t.data->'genres' ? $3)
      ${providerFilter}
      AND
      COALESCE((t.data->>'year')::int,0)>0
      AND COALESCE((t.data->>'fixture')::boolean,false)=false
      AND length(trim(l.title))>0 AND length(trim(l.slug))>0
      AND s.checked_at IS NOT NULL AND s.availability IN('available','empty','error')
      AND (length(trim(l.overview))>0 OR (jsonb_array_length(t.data->'cast')>0 AND EXISTS(SELECT 1 FROM offers o WHERE o.title_id=t.id AND o.market=m.market AND (o.expires_at IS NULL OR o.expires_at>=now()))))
      LIMIT 1)`,
    [
      markets,
      key,
      tail,
      isPaginatedRoute(key, tail) ? (page - 1) * 24 : 0,
      [...locales],
    ],
  );
  return Object.fromEntries(
    result.rows.map((variant) => [
      `${variant.locale}-${variant.market.toUpperCase()}`,
      new URL(
        path(variant.locale, variant.market, key, tail) +
          (page > 1 ? `?page=${page}` : ''),
        origin,
      ).href,
    ]),
  );
}

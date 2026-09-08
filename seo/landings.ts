import type { Database } from '../data/db';
import { locales, type Locale } from '../i18n/config';
import { path, type RouteKey } from '../i18n/routes';
import { isPaginatedRoute } from './routing';

export function isIndexableLanding(key: RouteKey, tail: string) {
  return (
    ['home', 'movies', 'series', 'providers'].includes(key) ||
    (key === 'topics' &&
      ['scifi', 'thriller', 'comedy', 'drama'].includes(tail))
  );
}

export async function landingAlternates(
  database: Database,
  origin: string,
  markets: string[],
  key: RouteKey,
  tail: string,
  page: number,
) {
  // Count the same catalogue rows that a user can browse, while requiring at
  // least one editorially eligible title before indexing the landing itself.
  const result = await database.query<{
    locale: Locale;
    market: string;
    total: number | string;
  }>(
    `SELECT l.locale,m.market,count(*) AS total
    FROM titles t JOIN localizations l ON l.title_id=t.id
    CROSS JOIN unnest($1::text[]) AS m(market)
    LEFT JOIN snapshots s ON s.title_id=t.id AND s.market=m.market
    WHERE l.locale=ANY($5::text[])
      AND ($2 NOT IN('movies','series') OR t.media_type=CASE WHEN $2='movies' THEN 'movie' ELSE 'tv' END)
      AND ($2<>'topics' OR t.data->'genres' ? $3)
      AND ($2<>'providers' OR EXISTS(SELECT 1 FROM offers o WHERE o.title_id=t.id AND o.market=m.market AND (o.expires_at IS NULL OR o.expires_at>=now()) AND ($3='' OR o.provider_id=$3)))
    GROUP BY l.locale,m.market
    HAVING count(*)>$4 AND bool_or(
      COALESCE((t.data->>'year')::int,0)>0
      AND COALESCE((t.data->>'fixture')::boolean,false)=false
      AND length(trim(l.title))>0 AND length(trim(l.slug))>0
      AND s.checked_at IS NOT NULL AND s.availability IN('available','empty','error')
      AND (length(trim(l.overview))>0 OR (jsonb_array_length(t.data->'cast')>0 AND EXISTS(SELECT 1 FROM offers o WHERE o.title_id=t.id AND o.market=m.market AND (o.expires_at IS NULL OR o.expires_at>=now())))))`,
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

import {
  sql,
  Kysely,
  DummyDriver,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import type {
  CatalogItem,
  Title,
  Provider,
  Filters,
  Snapshot,
  Change,
} from '../../domain/types';
import { db, type Database } from '../db';
import { publicCache } from '../cache';
import { withTitleArtwork } from '../media/project';
import { config } from '../../lib/config';
import { emptySnapshot, freshness } from '../../domain/offers';
import { filterCatalog, fold, parseSearchQuery } from '../../domain/search';
import type { Locale } from '../../i18n/config';
const compiler = new Kysely<Record<string, never>>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (db) => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});
async function fixture() {
  return (await import('../../test/fixtures/catalog')).fixtureCatalog();
}
type CatalogRow = {
  data: Title;
  snapshot: Snapshot | null;
  offers: Snapshot['offers'];
  checked_at: string | null;
  availability: Snapshot['availability'];
  revision: string;
  error_code: string | null;
  attempt_at: string | null;
  total?: number;
};
function mapRow(row: CatalogRow, market: string): CatalogItem {
  return {
    title: row.data,
    snapshot: {
      ...emptySnapshot(row.data.id, market),
      availability: row.availability || 'unchecked',
      checkedAt: row.checked_at,
      attemptAt: row.attempt_at,
      errorCode: row.error_code,
      freshness: freshness(
        row.checked_at,
        Date.now(),
        36,
        config().STALE_HOURS,
      ),
      offers: row.offers || [],
      revision: String(row.revision || 0),
    },
  };
}
type CatalogResult = {
  items: CatalogItem[];
  total: number;
  unavailable: boolean;
};
async function catalogData(
  locale: Locale,
  market: string,
  filters: Filters,
  limit: number,
  countTotal = true,
): Promise<CatalogResult> {
  if (config().APP_MODE !== 'live' || filters.mine?.length || filters.q?.trim())
    return loadCatalog(locale, market, filters, limit, undefined, countTotal);
  try {
    return await publicCache(
      'catalog:' + JSON.stringify([locale, market, filters, limit, countTotal]),
      async () => {
        const result = await loadCatalog(
          locale,
          market,
          filters,
          limit,
          undefined,
          countTotal,
        );
        // A transient outage must not replace a usable public cache entry.
        if (result.unavailable) throw new Error('Catalog unavailable');
        return result;
      },
    );
  } catch {
    return { items: [], total: 0, unavailable: true };
  }
}
export async function catalog(
  locale: Locale,
  market: string,
  f: Filters = {},
  limit = 24,
): Promise<CatalogResult> {
  const result = await catalogData(locale, market, f, limit);
  // Resolve after the public cache so withdrawal is not delayed by cached cards.
  const titles = await withTitleArtwork(result.items.map((item) => item.title));
  return {
    ...result,
    items: result.items.map((item, index) => ({
      ...item,
      title: titles[index],
    })),
  };
}
// Keep independent shelf loads parallel, then check artwork once for all cards.
export async function catalogShelves(
  locale: Locale,
  market: string,
  filters: Filters[],
  limit = 12,
): Promise<{ items: CatalogItem[]; unavailable: boolean }[]> {
  const results = await Promise.all(
    // Shelves never show a total. ID selection now precedes enrichment, so they
    // no longer need WindowAgg to keep a selective offer-filtering plan.
    filters.map((filter) => catalogData(locale, market, filter, limit, false)),
  );
  const titles = await withTitleArtwork(
    results.flatMap((result) => result.items.map((item) => item.title)),
  );
  let titleIndex = 0;
  return results.map((result) => ({
    unavailable: result.unavailable,
    items: result.items.map((item) => ({
      ...item,
      title: titles[titleIndex++],
    })),
  }));
}
export async function loadCatalog(
  locale: Locale,
  market: string,
  f: Filters = {},
  limit = 24,
  database?: Database,
  countTotal = true,
): Promise<CatalogResult> {
  const c = config();
  if (c.APP_MODE === 'fixture') {
    const rows = filterCatalog(
      (await fixture()).filter((x) => x.snapshot.market === market),
      locale,
      f,
    );
    return {
      items: rows.slice(((f.page || 1) - 1) * limit, (f.page || 1) * limit),
      total: countTotal ? rows.length : 0,
      unavailable: false,
    };
  }
  if (!c.DATABASE_URL) return { items: [], total: 0, unavailable: true };
  try {
    const rawQuery = (f.q || '').trim().slice(0, 120);
    const parsedSearch = parseSearchQuery(rawQuery);
    const year = f.year || parsedSearch.year;
    const q = fold(parsedSearch.q);
    const connection = database || (await db());
    // Find names using the expression indexes first. Relevance is then computed
    // once per matching name, rather than for every title and every translation.
    const candidateName = (name: ReturnType<typeof sql>) =>
      sql`(${name} LIKE ${'%' + q + '%'}
        OR to_tsvector('simple',${name}) @@ plainto_tsquery('simple',${q})
        OR ${name} % ${q})`;
    const search = q
      ? sql`search_matches AS MATERIALIZED (
        SELECT title_id,max(CASE WHEN name=${q} THEN 4
          WHEN starts_with(name,${q}) THEN 3
          WHEN strpos(name,${q})>0 OR to_tsvector('simple',name) @@ plainto_tsquery('simple',${q}) THEN 2
          WHEN similarity(name,${q})>0.35 THEN 1 ELSE 0 END) AS match_rank
        FROM (
          SELECT alt.title_id,catalog_search_name(alt.title) AS name FROM localizations alt
            WHERE ${candidateName(sql`catalog_search_name(alt.title)`)}
          UNION ALL
          SELECT original.id,catalog_search_name(original.data->>'originalTitle') AS name FROM titles original
            WHERE ${candidateName(sql`catalog_search_name(original.data->>'originalTitle')`)}
        ) names GROUP BY title_id
      ),`
      : sql``;
    const matchRank = q ? sql`sm.match_rank` : sql`0::integer`;
    const conditions = [sql`true`];
    if (f.type) conditions.push(sql`t.media_type=${f.type}`);
    if (f.genre) conditions.push(sql`t.catalog_genres ? ${f.genre}`);
    if (f.maxMinutes)
      conditions.push(
        sql`t.media_type='movie' AND t.catalog_runtime <= ${f.maxMinutes}`,
      );
    if (year) conditions.push(sql`t.catalog_year=${year}`);
    if (q) conditions.push(sql`${matchRank}>0`);
    const oc = [
      sql`o.title_id=t.id`,
      sql`o.market=${market}`,
      sql`(o.expires_at IS NULL OR o.expires_at>=now())`,
    ];
    if (f.provider) oc.push(sql`o.provider_id=${f.provider}`);
    if (f.offerType) oc.push(sql`o.data->>'type'=${f.offerType}`);
    if (f.quality) oc.push(sql`o.data->>'quality'=${f.quality}`);
    if (f.audio) oc.push(sql`o.data->'audio' ? ${f.audio}`);
    if (f.subtitles) oc.push(sql`o.data->'subtitles' ? ${f.subtitles}`);
    if (f.scope === 'new')
      oc.push(
        // Provider ingestion stores canonical UTC milliseconds, so this range
        // can use offers_market_started_title without a per-offer date cast.
        sql`o.data->>'availableSince'>to_char((now()-interval '7 days') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
      );
    if (f.scope === 'leaving')
      oc.push(sql`o.expires_at<=now()+interval '30 days'`);
    if (f.scope === 'free') oc.push(sql`o.data->>'type'='free'`);
    if (f.mine?.length)
      oc.push(
        sql`((o.data->>'type'='subscription' AND o.provider_id=ANY(${f.mine}::text[])) OR (o.data->>'type'='addon' AND o.provider_id||':'||(o.data->'addon'->>'id')=ANY(${f.mine}::text[])))`,
      );
    if (oc.length > 3 || f.scope)
      conditions.push(
        sql`EXISTS(SELECT 1 FROM offers o WHERE ${sql.join(oc, sql` AND `)})`,
      );
    let discoveryIds: string[] = [];
    if (q || f.sort === 'latest' || f.sort === 'trending') {
      const rankingKey = `ranking:${market}:${f.type || '%'}:${f.sort === 'latest' ? 'release_date' : 'popularity_1week'}:%`;
      const loadRanking = () =>
        connection.query<{ data: { ids: string[] } }>(
          "SELECT data FROM operations WHERE key LIKE $1 AND updated_at>now()-interval '7 days' ORDER BY (data->>'page')::int,key",
          [rankingKey],
        );
      // Different home shelves and languages reuse the same public rankings.
      // An explicitly supplied database stays isolated for transactions/tests.
      const ranking = database
        ? await loadRanking()
        : await publicCache(rankingKey, loadRanking);
      discoveryIds = [
        ...new Set(ranking.rows.flatMap((row) => row.data.ids || [])),
      ];
      if (!f.type) {
        const movies = discoveryIds.filter((id) => id.startsWith('movie:'));
        const shows = discoveryIds.filter((id) => id.startsWith('tv:'));
        discoveryIds = Array.from(
          { length: Math.max(movies.length, shows.length) },
          (_, i) => [movies[i], shows[i]].filter(Boolean),
        ).flat();
      }
    }
    const trendRank = sql`array_position(${discoveryIds}::text[],t.id)`;
    const votes = sql`t.catalog_votes`;
    const popularity = sql`CASE WHEN t.catalog_popularity_updated::timestamptz>now()-interval '7 days' AND t.catalog_popularity_updated::timestamptz<=now() THEN t.catalog_popularity ELSE 0 END`;
    const prominence = sql`ln(1+${votes})+0.5*ln(1+${popularity})+COALESCE(2.0/${trendRank},0)`;
    const order =
      f.sort === 'title'
        ? sql`localized_title ASC,id ASC`
        : f.sort === 'latest'
          ? sql`trend_rank ASC NULLS LAST,release_year DESC NULLS LAST,votes DESC,id`
          : f.sort === 'trending'
            ? sql`match_rank DESC,trend_rank ASC NULLS LAST,prominence DESC,votes DESC,id`
            : f.sort === 'year'
              ? sql`release_year DESC NULLS LAST,id ASC`
              : q
                ? sql`match_rank DESC,prominence DESC,votes DESC,id ASC`
                : sql`availability_rank,rating_score DESC,id ASC`;
    const defaultOrder =
      !q && !['title', 'latest', 'trending', 'year'].includes(f.sort || '');
    // An offer-filtered candidate is already known to be available. Avoid a
    // second correlated existence lookup just to sort those same candidates.
    const availabilityRank =
      defaultOrder && !(oc.length > 3 || f.scope)
        ? sql`CASE WHEN EXISTS(SELECT 1 FROM offers available WHERE available.title_id=t.id AND available.market=${market} AND (available.expires_at IS NULL OR available.expires_at>=now())) THEN 0 ELSE 1 END`
        : sql`0::integer`;
    const candidate = sql`SELECT t.id,${matchRank} AS match_rank,
      ${trendRank} AS trend_rank,${q || f.sort === 'trending' ? prominence : sql`0::numeric`} AS prominence,
      t.catalog_year AS release_year,${votes} AS votes,t.catalog_score AS rating_score,
      ${availabilityRank} AS availability_rank,${f.sort === 'title' ? sql`l.title` : sql`NULL::text`} AS localized_title
      FROM titles t JOIN localizations l ON l.title_id=t.id AND l.locale=${locale}
      ${q ? sql`JOIN search_matches sm ON sm.title_id=t.id` : sql``}
      WHERE ${sql.join(conditions, sql` AND `)}`;
    const offset = ((f.page || 1) - 1) * limit;
    // For a shelf, every qualifying provider-ranked title precedes every
    // unranked title. When that prefix fills the page, no full scan is needed.
    // If it does not, include all remaining candidates before sorting/paging.
    const rankedShelf =
      !countTotal &&
      !q &&
      discoveryIds.length > 0 &&
      (f.sort === 'latest' || f.sort === 'trending');
    const candidates = rankedShelf
      ? sql`ranked_candidates AS MATERIALIZED (
          ${candidate} AND t.id=ANY(${discoveryIds}::text[])
        ), candidates AS MATERIALIZED (
          SELECT * FROM ranked_candidates
          UNION ALL
          ${candidate} AND NOT(t.id=ANY(${discoveryIds}::text[]))
            AND (SELECT count(*) FROM ranked_candidates)<${offset + limit}
        )`
      : sql`candidates AS MATERIALIZED (${candidate})`;
    // Home/related shelves show provider badges, never episode-level offers.
    // Keep one active offer per provider/type, preferring the longest validity
    // so a short-lived episode offer cannot hide an otherwise available badge.
    // Full listings and title details retain their complete offer collections.
    const selectedOffers = countTotal
      ? sql`SELECT o.data FROM offers o WHERE o.title_id=t.id AND o.market=${market} AND(o.expires_at IS NULL OR o.expires_at>=now())`
      : sql`SELECT DISTINCT ON(o.provider_id,o.data->>'type') o.data
          FROM offers o WHERE o.title_id=t.id AND o.market=${market} AND(o.expires_at IS NULL OR o.expires_at>=now())
          ORDER BY o.provider_id,o.data->>'type',o.expires_at DESC NULLS FIRST,o.id`;
    const query = sql`WITH ${search}${candidates}, selected AS MATERIALIZED (
        SELECT id,${countTotal ? sql`count(*) OVER()` : sql`0::integer`} AS total,
          row_number() OVER(ORDER BY ${order}) AS ordinal
        FROM candidates ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}
      )
      SELECT t.data,s.availability,s.checked_at,s.attempt_at,s.error_code,s.revision,
        COALESCE((SELECT jsonb_agg(selected_offer.data) FROM (${selectedOffers}) selected_offer),'[]'::jsonb) AS offers,selected.total
      FROM selected JOIN titles t ON t.id=selected.id
      LEFT JOIN snapshots s ON s.title_id=t.id AND s.market=${market}
      ORDER BY selected.ordinal`.compile(compiler);
    const { rows } = await connection.query<CatalogRow>(query.sql, [
      ...query.parameters,
    ]);
    return {
      items: rows.map((r) => mapRow(r, market)),
      total: Number(rows[0]?.total || 0),
      unavailable: false,
    };
  } catch {
    return { items: [], total: 0, unavailable: true };
  }
}
export async function getTitle(
  id: string,
  market: string,
): Promise<CatalogItem | null> {
  if (config().APP_MODE === 'fixture')
    return (
      (await fixture()).find(
        (x) => x.title.id === id && x.snapshot.market === market,
      ) || null
    );
  if (!config().DATABASE_URL) return null;
  const connection = await db();
  const { rows } = await connection.query<CatalogRow>(
    "SELECT t.data,s.availability,s.checked_at,s.attempt_at,s.error_code,s.revision,COALESCE((SELECT jsonb_agg(o.data) FROM offers o WHERE o.title_id=t.id AND o.market=$2 AND(o.expires_at IS NULL OR o.expires_at>=now())),'[]'::jsonb) offers FROM titles t LEFT JOIN snapshots s ON s.title_id=t.id AND s.market=$2 WHERE t.id=$1",
    [id, market],
  );
  if (!rows[0]) return null;
  const [title] = await withTitleArtwork([rows[0].data], connection);
  return mapRow({ ...rows[0], data: title }, market);
}
export async function providers(market: string): Promise<Provider[]> {
  return (await providerStatus(market)).items;
}
export async function providerStatus(
  market: string,
  database?: Database,
): Promise<{ items: Provider[]; unavailable: boolean }> {
  if (config().APP_MODE === 'fixture')
    return {
      items: (await import('../../test/fixtures/catalog')).fixtureProviders,
      unavailable: false,
    };
  if (!config().DATABASE_URL) return { items: [], unavailable: true };
  try {
    const load = async () =>
      (
        await (database || (await db())).query<{ data: Provider }>(
          "SELECT data FROM providers WHERE market=$1 ORDER BY data->>'name'",
          [market],
        )
      ).rows.map((x) => x.data);
    const rows = database
      ? await load()
      : await publicCache(`providers:${market}`, load);
    return { items: rows, unavailable: false };
  } catch {
    return { items: [], unavailable: true };
  }
}
export async function changes(
  id: string,
  market: string,
  since: string,
): Promise<Change[]> {
  if (!config().DATABASE_URL) return [];
  return (
    await (
      await db()
    ).query<Change>(
      'SELECT id,title_id AS "titleId",market,kind,provider,at FROM changes WHERE title_id=$1 AND market=$2 AND at>$3 ORDER BY at DESC LIMIT 30',
      [id, market, since],
    )
  ).rows;
}
export async function knownSlug(id: string, locale: Locale, slug: string) {
  if (!config().DATABASE_URL) return false;
  return (
    (
      await (
        await db()
      ).query(
        'SELECT 1 FROM slug_history WHERE title_id=$1 AND locale=$2 AND slug=$3',
        [id, locale, slug],
      )
    ).rows.length > 0
  );
}

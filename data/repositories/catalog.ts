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
export async function catalog(
  locale: Locale,
  market: string,
  f: Filters = {},
  limit = 24,
): Promise<{ items: CatalogItem[]; total: number; unavailable: boolean }> {
  if (config().APP_MODE !== 'live' || f.mine?.length || f.q?.trim())
    return loadCatalog(locale, market, f, limit);
  return publicCache(
    'catalog:' + JSON.stringify([locale, market, f, limit]),
    () => loadCatalog(locale, market, f, limit),
  );
}
export async function loadCatalog(
  locale: Locale,
  market: string,
  f: Filters = {},
  limit = 24,
  database?: Database,
): Promise<{ items: CatalogItem[]; total: number; unavailable: boolean }> {
  const c = config();
  if (c.APP_MODE === 'fixture') {
    const rows = filterCatalog(
      (await fixture()).filter((x) => x.snapshot.market === market),
      locale,
      f,
    );
    return {
      items: rows.slice(((f.page || 1) - 1) * limit, (f.page || 1) * limit),
      total: rows.length,
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
    const matchRank = q
      ? sql`COALESCE((SELECT max(CASE
      WHEN name=${q} THEN 4
      WHEN starts_with(name,${q}) THEN 3
      WHEN strpos(name,${q})>0 OR to_tsvector('simple',name) @@ plainto_tsquery('simple',${q}) THEN 2
      WHEN similarity(name,${q})>0.35 THEN 1 ELSE 0 END)
      FROM (SELECT trim(regexp_replace(unaccent(lower(alt.title)),'[^[:alnum:]]+',' ','g')) AS name FROM localizations alt WHERE alt.title_id=t.id
        UNION ALL SELECT trim(regexp_replace(unaccent(lower(t.data->>'originalTitle')),'[^[:alnum:]]+',' ','g'))) names),0)`
      : sql`0::integer`;
    const conditions = [sql`true`];
    if (f.type) conditions.push(sql`t.media_type=${f.type}`);
    if (f.genre) conditions.push(sql`t.data->'genres' ? ${f.genre}`);
    if (f.maxMinutes)
      conditions.push(
        sql`t.media_type='movie' AND (t.data->>'runtime')::int <= ${f.maxMinutes}`,
      );
    if (year) conditions.push(sql`(t.data->>'year')::int=${year}`);
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
        sql`(o.data->>'availableSince')::timestamptz>now()-interval '7 days'`,
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
      const ranking = await connection.query<{ data: { ids: string[] } }>(
        "SELECT data FROM operations WHERE key LIKE $1 AND updated_at>now()-interval '7 days' ORDER BY (data->>'page')::int,key",
        [
          `ranking:${market}:${f.type || '%'}:${f.sort === 'latest' ? 'release_date' : 'popularity_1week'}:%`,
        ],
      );
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
    const votes = sql`greatest(COALESCE((t.data->>'votes')::numeric,0),0)`;
    const popularity = sql`CASE WHEN (t.data->>'popularityUpdatedAt')::timestamptz>now()-interval '7 days' AND (t.data->>'popularityUpdatedAt')::timestamptz<=now() THEN greatest(COALESCE((t.data->>'popularity')::numeric,0),0) ELSE 0 END`;
    const prominence = sql`ln(1+${votes})+0.5*ln(1+${popularity})+COALESCE(2.0/${trendRank},0)`;
    const order =
      f.sort === 'title'
        ? sql`l.title ASC,t.id ASC`
        : f.sort === 'latest'
          ? sql`${trendRank} ASC NULLS LAST,(t.data->>'year')::int DESC NULLS LAST,${votes} DESC,t.id`
          : f.sort === 'trending'
            ? sql`${matchRank} DESC,${trendRank} ASC NULLS LAST,${prominence} DESC,${votes} DESC,t.id`
            : f.sort === 'year'
              ? sql`(t.data->>'year')::int DESC NULLS LAST,t.id ASC`
              : q
                ? sql`${matchRank} DESC,${prominence} DESC,${votes} DESC,t.id ASC`
                : sql`CASE WHEN EXISTS(SELECT 1 FROM offers available WHERE available.title_id=t.id AND available.market=${market} AND (available.expires_at IS NULL OR available.expires_at>=now())) THEN 0 ELSE 1 END,COALESCE((t.data->>'rating')::numeric,0)*COALESCE((t.data->>'votes')::numeric,0)/(COALESCE((t.data->>'votes')::numeric,0)+500) DESC,t.id ASC`;
    const query =
      sql`SELECT t.data,s.availability,s.checked_at,s.attempt_at,s.error_code,s.revision,COALESCE((SELECT jsonb_agg(o.data) FROM offers o WHERE o.title_id=t.id AND o.market=${market} AND(o.expires_at IS NULL OR o.expires_at>=now())),'[]'::jsonb) AS offers,count(*) OVER() AS total FROM titles t JOIN localizations l ON l.title_id=t.id AND l.locale=${locale} LEFT JOIN snapshots s ON s.title_id=t.id AND s.market=${market} WHERE ${sql.join(conditions, sql` AND `)} ORDER BY ${order} LIMIT ${limit} OFFSET ${((f.page || 1) - 1) * limit}`.compile(
        compiler,
      );
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
  const { rows } = await (
    await db()
  ).query<CatalogRow>(
    "SELECT t.data,s.availability,s.checked_at,s.attempt_at,s.error_code,s.revision,COALESCE((SELECT jsonb_agg(o.data) FROM offers o WHERE o.title_id=t.id AND o.market=$2 AND(o.expires_at IS NULL OR o.expires_at>=now())),'[]'::jsonb) offers FROM titles t LEFT JOIN snapshots s ON s.title_id=t.id AND s.market=$2 WHERE t.id=$1",
    [id, market],
  );
  return rows[0] ? mapRow(rows[0], market) : null;
}
export async function providers(market: string): Promise<Provider[]> {
  if (config().APP_MODE === 'fixture')
    return (await import('../../test/fixtures/catalog')).fixtureProviders;
  if (!config().DATABASE_URL) return [];
  try {
    return (
      await (
        await db()
      ).query<{ data: Provider }>(
        "SELECT data FROM providers WHERE market=$1 ORDER BY data->>'name'",
        [market],
      )
    ).rows.map((x) => x.data);
  } catch {
    return [];
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

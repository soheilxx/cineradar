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
import { db } from '../db';
import { publicCache } from '../cache';
import { config } from '../../lib/config';
import { emptySnapshot, freshness } from '../../domain/offers';
import { filterCatalog } from '../../domain/search';
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
  if (config().APP_MODE !== 'live' || f.mine?.length)
    return loadCatalog(locale, market, f, limit);
  return publicCache(
    'catalog:' + JSON.stringify([locale, market, f, limit]),
    () => loadCatalog(locale, market, f, limit),
  );
}
async function loadCatalog(
  locale: Locale,
  market: string,
  f: Filters = {},
  limit = 24,
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
    const year =
      f.year || Number(rawQuery.match(/\b((?:19|20)\d{2})\b/)?.[1]) || null;
    const q = rawQuery.replace(/\b(?:19|20)\d{2}\b/g, '').trim();
    const conditions = [sql`true`];
    if (f.type) conditions.push(sql`t.media_type=${f.type}`);
    if (f.genre) conditions.push(sql`t.data->'genres' ? ${f.genre}`);
    if (f.maxMinutes)
      conditions.push(
        sql`t.media_type='movie' AND (t.data->>'runtime')::int <= ${f.maxMinutes}`,
      );
    if (year) conditions.push(sql`(t.data->>'year')::int=${year}`);
    if (q)
      conditions.push(
        sql`(l.search_document @@ websearch_to_tsquery('simple',${q}) OR unaccent(lower(l.title)) LIKE '%'||unaccent(lower(${q}))||'%' OR similarity(unaccent(lower(l.title)),unaccent(lower(${q})))>0.35 OR unaccent(lower(t.data->>'originalTitle')) LIKE '%'||unaccent(lower(${q}))||'%' OR EXISTS(SELECT 1 FROM localizations alt WHERE alt.title_id=t.id AND unaccent(lower(alt.title))=unaccent(lower(${q}))))`,
      );
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
    const order =
      f.sort === 'title'
        ? sql`l.title ASC`
        : f.sort === 'year'
          ? sql`(t.data->>'year')::int DESC NULLS LAST`
          : q
            ? sql`CASE WHEN lower(l.title)=lower(${q}) THEN 0 ELSE 1 END,t.updated_at DESC`
            : sql`CASE WHEN EXISTS(SELECT 1 FROM offers available WHERE available.title_id=t.id AND available.market=${market} AND (available.expires_at IS NULL OR available.expires_at>=now())) THEN 0 ELSE 1 END,COALESCE((t.data->>'rating')::numeric,0)*COALESCE((t.data->>'votes')::numeric,0)/(COALESCE((t.data->>'votes')::numeric,0)+500) DESC,t.id ASC`;
    const query =
      sql`SELECT t.data,s.availability,s.checked_at,s.attempt_at,s.error_code,s.revision,COALESCE((SELECT jsonb_agg(o.data) FROM offers o WHERE o.title_id=t.id AND o.market=${market} AND(o.expires_at IS NULL OR o.expires_at>=now())),'[]'::jsonb) AS offers,count(*) OVER() AS total FROM titles t JOIN localizations l ON l.title_id=t.id AND l.locale=${locale} LEFT JOIN snapshots s ON s.title_id=t.id AND s.market=${market} WHERE ${sql.join(conditions, sql` AND `)} ORDER BY ${order} LIMIT ${limit} OFFSET ${((f.page || 1) - 1) * limit}`.compile(
        compiler,
      );
    const { rows } = await (
      await db()
    ).query<CatalogRow>(query.sql, [...query.parameters]);
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

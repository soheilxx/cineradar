import type { Database } from '../data/db';
import type { SitemapTitleRow } from './sitemap-publish';

const TITLE_BATCH_SIZE = 100;

// Cache misses hash only one bounded title batch, using exactly the original
// ordered JSON digest. Cache hits never read offer JSON/TOAST at all. Timestamp
// changes invalidate material edits; the active-ID digest detects expiry even
// when no import ran. Each batch observes one consistent database snapshot.
const sourceBatch = `WITH batch AS MATERIALIZED (
  SELECT id,data,updated_at FROM titles WHERE id>$1 ORDER BY id LIMIT $2
), active AS MATERIALIZED (
  SELECT s.*,a.active_revision,a.providers FROM batch b
  JOIN snapshots s ON s.title_id=b.id AND s.market=ANY($3::text[])
  CROSS JOIN LATERAL (
    SELECT md5(string_agg(o.id,'|' ORDER BY o.id)) active_revision,
      array_agg(DISTINCT o.provider_id ORDER BY o.provider_id) providers
    FROM offers o WHERE o.title_id=s.title_id AND o.market=s.market
      AND (o.expires_at IS NULL OR o.expires_at>=$4::timestamptz)
  ) a
), states AS MATERIALIZED (
  SELECT s.title_id,s.market,s.availability,s.checked_at,s.changed_at,
    s.active_revision IS NOT NULL AS has_offers,COALESCE(s.active_revision,'') active_revision,
    COALESCE(s.providers,ARRAY[]::text[]) providers,
    CASE WHEN s.active_revision IS NULL THEN ''
      WHEN r.changed_at=s.changed_at AND r.active_revision=s.active_revision THEN r.content_revision
      ELSE (SELECT md5(string_agg((o.data-'observedAt')::text,'|' ORDER BY o.id))
        FROM offers o WHERE o.title_id=s.title_id AND o.market=s.market
        AND (o.expires_at IS NULL OR o.expires_at>=$4::timestamptz)) END revision
  FROM active s
  LEFT JOIN seo_sitemap_offer_revisions r ON r.title_id=s.title_id AND r.market=s.market
), warmed AS (
  INSERT INTO seo_sitemap_offer_revisions(title_id,market,changed_at,active_revision,content_revision)
  SELECT title_id,market,changed_at,active_revision,revision FROM states
  ON CONFLICT(title_id,market) DO UPDATE SET changed_at=EXCLUDED.changed_at,
    active_revision=EXCLUDED.active_revision,content_revision=EXCLUDED.content_revision
  WHERE (seo_sitemap_offer_revisions.changed_at,seo_sitemap_offer_revisions.active_revision,seo_sitemap_offer_revisions.content_revision)
    IS DISTINCT FROM (EXCLUDED.changed_at,EXCLUDED.active_revision,EXCLUDED.content_revision)
  RETURNING title_id
)
SELECT b.id AS source_id,b.data,b.updated_at,COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'market',s.market,'availability',s.availability,'checkedAt',s.checked_at,'changedAt',s.changed_at,
  'hasOffers',s.has_offers,'revision',s.revision,'providers',s.providers) ORDER BY s.market)
  FROM states s WHERE s.title_id=b.id),'[]'::jsonb) snapshots FROM batch b ORDER BY b.id`;

export async function sitemapSourceRows(
  database: Database,
  markets: string[],
  asOf: Date,
): Promise<SitemapTitleRow[]> {
  const rows: SitemapTitleRow[] = [];
  let cursor = '';
  for (;;) {
    const batch = await database.query<SitemapTitleRow & { source_id: string }>(
      sourceBatch,
      [cursor, TITLE_BATCH_SIZE, markets, asOf.toISOString()],
    );
    rows.push(...batch.rows);
    if (batch.rows.length < TITLE_BATCH_SIZE) return rows;
    const next = batch.rows.at(-1)!.source_id;
    if (next === cursor) throw new Error('Sitemap source cursor stalled');
    cursor = next;
  }
}

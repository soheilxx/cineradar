-- Derived, rebuildable sitemap fingerprints. Keep the existing content digest
-- format so a cache rollout never invents a content change or advances lastmod.
-- 003_search_translations.sql updates snapshots.changed_at for material offer
-- INSERT/UPDATE/DELETE operations; the active-ID digest also detects expiry.
CREATE TABLE seo_sitemap_offer_revisions (
 title_id text NOT NULL,
 market text NOT NULL,
 changed_at timestamptz NOT NULL,
 active_revision text NOT NULL,
 content_revision text NOT NULL,
 PRIMARY KEY(title_id,market),
 FOREIGN KEY(title_id,market) REFERENCES snapshots(title_id,market) ON DELETE CASCADE
);

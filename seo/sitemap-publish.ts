import { createHash, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { db, type Database } from '../data/db';
import { config } from '../lib/config';
import type { Title } from '../domain/types';
import { locales } from '../i18n/config';
import { path } from '../i18n/routes';
import { comparisons } from '../content/comparisons';
import { comparisonPath } from '../content/comparisons/routes';
import { identifySitemapEntries } from './identify';
import {
  titleAlternates,
  titleEligibility,
  type IndexingSnapshot,
} from './indexing';
import {
  sitemapHash,
  sitemapIndex,
  urlset,
  SITEMAP_SHARD_SIZE,
  type SitemapEntry,
} from './sitemap-xml';

export interface SitemapTitleRow {
  data: Title;
  updated_at: string;
  snapshots: (IndexingSnapshot & {
    changedAt: string;
    revision: string;
    providers: string[];
  })[];
}
const supportedTopics = ['scifi', 'thriller', 'comedy', 'drama'];
function validDate(value: string | null | undefined, now: Date) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) && date <= now
    ? date.toISOString()
    : null;
}
function realImage(value: string | null) {
  if (!value) return [];
  try {
    return new URL(value).protocol === 'https:' ? [value] : [];
  } catch {
    return [];
  }
}

export function buildSitemapEntries(
  rows: SitemapTitleRow[],
  origin: string,
  markets: string[],
  now = new Date(),
): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const landings = new Map<
    string,
    {
      market: string;
      locale: (typeof locales)[number];
      route: 'home' | 'movies' | 'series' | 'providers' | 'topics';
      tail: string;
      ids: string[];
    }
  >();
  for (const row of rows) {
    const title = row.data;
    const snapshots = row.snapshots.filter((s) => markets.includes(s.market));
    const alternates = titleAlternates(title, snapshots, origin);
    for (const market of markets) {
      const snapshot = snapshots.find((s) => s.market === market) || {
        market,
        availability: 'unchecked' as const,
        checkedAt: null,
        hasOffers: false,
        changedAt: '',
        revision: '',
        providers: [],
      };
      for (const locale of locales) {
        const localized = title.localizations[locale];
        if (!localized?.slug) continue;
        const decision = titleEligibility(title, locale, snapshot);
        const significant = JSON.stringify({
          type: title.type,
          originalTitle: title.originalTitle,
          year: title.year,
          runtime: title.runtime,
          poster: title.poster,
          backdrop: title.backdrop,
          genres: title.genres,
          cast: title.cast,
          seasons: title.seasons,
          localized: {
            title: localized.title,
            overview: localized.overview,
            slug: localized.slug,
          },
          offers: snapshot.revision,
          hasOffers: snapshot.hasOffers,
        });
        const dates = [
          validDate(row.updated_at, now),
          validDate(snapshot.changedAt, now),
        ]
          .filter((d): d is string => !!d)
          .sort();
        entries.push({
          url: new URL(path(locale, market, title.type, localized.slug), origin)
            .href,
          entity: title.id,
          segment: `${title.type === 'movie' ? 'movies' : 'series'}-${locale}-${market}`,
          locale,
          market,
          revision: sitemapHash(significant),
          lastmod: dates.at(-1) || null,
          ...decision,
          alternates,
          images: [
            ...new Set([
              ...realImage(title.poster),
              ...realImage(title.backdrop),
            ]),
          ],
        });
        if (!decision.sitemapEligible) continue;
        const options: [
          'home' | 'movies' | 'series' | 'providers' | 'topics',
          string,
        ][] = [
          ['home', ''],
          [title.type === 'movie' ? 'movies' : 'series', ''],
        ];
        if (snapshot.providers.length) options.push(['providers', '']);
        for (const provider of snapshot.providers)
          options.push(['providers', provider]);
        for (const genre of title.genres.filter((g) =>
          supportedTopics.includes(g),
        ))
          options.push(['topics', genre]);
        for (const [route, tail] of options) {
          const key = path(locale, market, route, tail);
          const landing = landings.get(key) || {
            market,
            locale,
            route,
            tail,
            ids: [],
          };
          landing.ids.push(title.id);
          landings.set(key, landing);
        }
      }
    }
  }
  for (const [pathname, landing] of landings) {
    const alternatives = Object.fromEntries(
      [...landings.entries()]
        .filter(
          ([, other]) =>
            other.route === landing.route && other.tail === landing.tail,
        )
        .map(([p, other]) => [
          `${other.locale}-${other.market.toUpperCase()}`,
          new URL(p, origin).href,
        ]),
    );
    entries.push({
      url: new URL(pathname, origin).href,
      entity: `${landing.route}:${landing.tail}`,
      segment: `${landing.route === 'topics' ? 'topics' : landing.route === 'providers' ? 'providers' : 'landings'}-${landing.locale}-${landing.market}`,
      locale: landing.locale,
      market: landing.market,
      revision: sitemapHash(JSON.stringify(landing.ids.sort())),
      lastmod: null,
      indexable: true,
      sitemapEligible: true,
      reason: null,
      alternates: alternatives,
      images: [],
    });
  }
  for (const item of [null, ...comparisons]) {
    const alternates = Object.fromEntries(
      locales.map((locale) => [
        locale,
        new URL(comparisonPath(locale, item?.id), origin).href,
      ]),
    );
    for (const locale of locales)
      entries.push({
        url: alternates[locale],
        entity: 'comparison:' + (item?.id || 'hub'),
        segment: `comparisons-${locale}`,
        locale,
        market: null,
        revision: sitemapHash(
          JSON.stringify(item || comparisons.map((c) => [c.id, c.updatedAt])),
        ),
        lastmod: validDate(item?.updatedAt || '2026-09-07', now),
        indexable: true,
        sitemapEligible: true,
        reason: null,
        alternates,
        images: [],
      });
  }
  entries.push(...identifySitemapEntries(origin, markets));
  return entries;
}

interface RegistryRow {
  url: string;
  segment: string;
  ordinal: string | number;
  revision: string;
  lastmod: string | null;
  alternate_hash?: string;
  indexable?: boolean;
  sitemap_eligible?: boolean;
  exclusion_reason?: string | null;
}
function alternateHash(alternates: Record<string, string>) {
  return createHash('md5')
    .update(
      Object.entries(alternates)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n'),
    )
    .digest('hex');
}
export function assignSitemapRevisions(
  entries: SitemapEntry[],
  previous: RegistryRow[],
  now: Date,
) {
  const old = new Map(previous.map((row) => [row.url, row]));
  const nextOrdinal = new Map<string, number>();
  for (const row of previous)
    nextOrdinal.set(
      row.segment,
      Math.max(nextOrdinal.get(row.segment) || 0, Number(row.ordinal) + 1),
    );
  for (const entry of [...entries].sort((a, b) => a.url.localeCompare(b.url))) {
    const prior = old.get(entry.url);
    entry.ordinal =
      prior && prior.segment === entry.segment
        ? Number(prior.ordinal)
        : nextOrdinal.get(entry.segment) || 0;
    if (!prior || prior.segment !== entry.segment)
      nextOrdinal.set(entry.segment, entry.ordinal + 1);
    entry.lastmod = prior
      ? prior.revision === entry.revision
        ? validDate(prior.lastmod, now)
        : now.toISOString()
      : entry.lastmod;
  }
  return entries;
}

export async function publishSitemaps(
  options: { force?: boolean } = {},
  injected?: Database,
) {
  const c = config();
  if (
    c.APP_MODE !== 'live' ||
    c.DEPLOYMENT_ENV !== 'production' ||
    c.LEGAL_APPROVED !== 'true' ||
    c.LICENSES_CONFIRMED !== 'true'
  )
    return { state: 'disabled' };
  const database = injected || (await db());
  const token = randomUUID();
  const claimed = await database.query(
    `UPDATE seo_sitemap_state SET lock_token=$1,locked_until=now()+interval '10 minutes',last_attempt=now() WHERE id=1 AND (locked_until IS NULL OR locked_until<now()) AND ($2::boolean OR last_success IS NULL OR last_success<now()-interval '15 minutes') RETURNING id`,
    [token, !!options.force],
  );
  if (!claimed.rows.length) return { state: 'current' };
  const generation = randomUUID();
  const now = new Date();
  try {
    // One statement gives all candidates a single PostgreSQL snapshot, including
    // expiry-sensitive offer revisions. No provider API participates in export.
    const source =
      await database.query<SitemapTitleRow>(`WITH active AS MATERIALIZED (
      SELECT title_id,market,md5(string_agg((data-'observedAt')::text,'|' ORDER BY id)) revision,array_agg(DISTINCT provider_id) providers
      FROM offers WHERE expires_at IS NULL OR expires_at>=now() GROUP BY title_id,market
    ), states AS (
      SELECT s.title_id,jsonb_agg(jsonb_build_object('market',s.market,'availability',s.availability,'checkedAt',s.checked_at,'changedAt',s.changed_at,'hasOffers',a.title_id IS NOT NULL,'revision',COALESCE(a.revision,''),'providers',COALESCE(a.providers,ARRAY[]::text[])) ORDER BY s.market) snapshots
      FROM snapshots s LEFT JOIN active a ON a.title_id=s.title_id AND a.market=s.market GROUP BY s.title_id
    ) SELECT t.data,t.updated_at,COALESCE(s.snapshots,'[]'::jsonb) snapshots FROM titles t LEFT JOIN states s ON s.title_id=t.id ORDER BY t.id`);
    const previous = await database.query<RegistryRow>(
      `SELECT url,segment,ordinal,revision,lastmod,indexable,sitemap_eligible,exclusion_reason,md5(COALESCE((SELECT string_agg(key||'='||value,E'\\n' ORDER BY key COLLATE "C") FROM jsonb_each_text(alternates)),'')) alternate_hash FROM seo_url_registry`,
    );
    const existingArtifacts = await database.query<{
      name: string;
      lastmod: string;
    }>('SELECT name,lastmod FROM seo_sitemap_artifacts');
    const artifactsByName = new Map(
      existingArtifacts.rows.map((a) => [a.name, a]),
    );
    const origin = new URL(c.SITE_URL).origin;
    const entries = assignSitemapRevisions(
      buildSitemapEntries(source.rows, origin, c.markets, now),
      previous.rows,
      now,
    );
    const eligible = entries.filter((e) => e.sitemapEligible);
    const allowed = new Set(eligible.map((e) => e.url));
    if (
      !eligible.some(
        (e) => e.entity.startsWith('movie:') || e.entity.startsWith('tv:'),
      )
    )
      throw new Error('No eligible catalog');
    for (const entry of eligible)
      for (const alternate of Object.values(entry.alternates))
        if (!allowed.has(alternate)) throw new Error('Unpublished alternate');
    const groups = new Map<string, SitemapEntry[]>();
    for (const entry of eligible) {
      const key = `${entry.segment}-${String(Math.floor(entry.ordinal! / SITEMAP_SHARD_SIZE) + 1).padStart(4, '0')}`;
      const group = groups.get(key) || [];
      group.push(entry);
      groups.set(key, group);
    }
    const manifest: {
      name: string;
      lastmod: string;
      urls: number;
      bytes: number;
    }[] = [];
    for (const [group, values] of [...groups.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const xml = urlset(
        values.sort((a, b) => a.ordinal! - b.ordinal!),
        origin,
      );
      const hash = sitemapHash(xml);
      const name = `sitemap-${group}-${hash.slice(0, 20)}.xml`;
      const priorArtifact = artifactsByName.get(name);
      const artifact = priorArtifact
        ? { rows: [priorArtifact] }
        : await database.query<{ lastmod: string }>(
            `INSERT INTO seo_sitemap_artifacts(name,segment,shard,hash,xml_gzip_base64,uncompressed_bytes,url_count,lastmod) SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE EXISTS(SELECT 1 FROM seo_sitemap_state WHERE lock_token=$9 AND locked_until>now()) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING lastmod`,
            [
              name,
              values[0].segment,
              Math.floor(values[0].ordinal! / SITEMAP_SHARD_SIZE) + 1,
              hash,
              gzipSync(xml).toString('base64'),
              Buffer.byteLength(xml),
              values.length,
              now.toISOString(),
              token,
            ],
          );
      if (!artifact.rows.length) throw new Error('Sitemap lease lost');
      manifest.push({
        name,
        lastmod: new Date(artifact.rows[0].lastmod).toISOString(),
        urls: values.length,
        bytes: Buffer.byteLength(xml),
      });
    }
    const previousByUrl = new Map(
      previous.rows.map((entry) => [entry.url, entry]),
    );
    const changed: SitemapEntry[] = [];
    const unchanged: string[] = [];
    for (const entry of entries) {
      const prior = previousByUrl.get(entry.url);
      if (
        prior &&
        prior.revision === entry.revision &&
        prior.indexable === entry.indexable &&
        prior.sitemap_eligible === entry.sitemapEligible &&
        prior.exclusion_reason === entry.reason &&
        prior.alternate_hash === alternateHash(entry.alternates)
      )
        unchanged.push(entry.url);
      else changed.push(entry);
    }
    // Keep unchanged TOAST documents in PostgreSQL. Only a URL list and the
    // publication marker travel over the connection during subsequent scans.
    for (let index = 0; index < unchanged.length; index += 5000) {
      const batch = unchanged.slice(index, index + 5000);
      const stamped = await database.query<{ count: string }>(
        `WITH lease AS (UPDATE seo_sitemap_state SET locked_until=now()+interval '10 minutes' WHERE lock_token=$3 AND locked_until>now() RETURNING id), stamped AS (UPDATE seo_url_registry SET generation=$1 WHERE url=ANY($2::text[]) AND EXISTS(SELECT 1 FROM lease) RETURNING 1) SELECT count(*) FROM stamped`,
        [generation, batch, token],
      );
      if (Number(stamped.rows[0].count) !== batch.length)
        throw new Error('Sitemap lease lost');
    }
    for (let index = 0; index < changed.length; index += 500) {
      const batch = changed.slice(index, index + 500).map((e) => ({
        ...e,
        sitemap_eligible: e.sitemapEligible,
        exclusion_reason: e.reason,
      }));
      const written = await database.query(
        `WITH lease AS (UPDATE seo_sitemap_state SET locked_until=now()+interval '10 minutes' WHERE lock_token=$3 AND locked_until>now() RETURNING id)
        INSERT INTO seo_url_registry(url,entity,segment,ordinal,locale,market,revision,lastmod,indexable,sitemap_eligible,exclusion_reason,alternates,images,generation)
        SELECT url,entity,segment,ordinal,locale,market,revision,lastmod,indexable,sitemap_eligible,exclusion_reason,alternates,images,$2 FROM jsonb_to_recordset($1::jsonb) AS e(url text,entity text,segment text,ordinal bigint,locale text,market text,revision text,lastmod timestamptz,indexable boolean,sitemap_eligible boolean,exclusion_reason text,alternates jsonb,images jsonb) WHERE EXISTS(SELECT 1 FROM lease)
        ON CONFLICT(url) DO UPDATE SET revision=EXCLUDED.revision,lastmod=EXCLUDED.lastmod,indexable=EXCLUDED.indexable,sitemap_eligible=EXCLUDED.sitemap_eligible,exclusion_reason=EXCLUDED.exclusion_reason,alternates=EXCLUDED.alternates,images=EXCLUDED.images,generation=EXCLUDED.generation,updated_at=now() RETURNING url`,
        [JSON.stringify(batch), generation, token],
      );
      if (written.rows.length !== batch.length)
        throw new Error('Sitemap lease lost');
    }
    const published = await database.query<{ generation: string }>(
      'SELECT publish_sitemap_generation($1,$2,$3,$4,$5) AS generation',
      [
        token,
        generation,
        JSON.stringify(manifest),
        sitemapIndex(manifest, origin),
        eligible.length,
      ],
    );
    return {
      state: 'published',
      generation: published.rows[0].generation,
      urls: eligible.length,
      files: manifest.length,
      registryChanged: changed.length,
      registryUnchanged: unchanged.length,
    };
  } catch (error) {
    await database.query(
      `UPDATE seo_sitemap_state SET lock_token=null,locked_until=null,last_error='sitemap_export_failed' WHERE lock_token=$1`,
      [token],
    );
    throw error;
  }
}

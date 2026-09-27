import { createHash } from 'node:crypto';

import { db, type Database } from '../data/db';

import { config } from '../lib/config';
import type { Title } from '../domain/types';
import { locales } from '../i18n/config';
import { path } from '../i18n/routes';
import { comparisons } from '../content/comparisons';
import { comparisonPath } from '../content/comparisons/routes';
import { identifySitemapEntries } from './identify';

import { runSitemapBuild, type SitemapBuildOptions } from './sitemap-build';
import {
  titleAlternates,
  titleEligibility,
  type IndexingSnapshot,
} from './indexing';
import { sitemapHash, type SitemapEntry } from './sitemap-xml';

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
export interface SitemapLanding {
  market: string;
  locale: (typeof locales)[number];
  route: 'home' | 'movies' | 'series' | 'providers' | 'topics';
  tail: string;
  ids: string[];
}
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
  titleBatch?: { landings: Map<string, SitemapLanding> },
): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const landings = titleBatch?.landings || new Map<string, SitemapLanding>();
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
          artworkRevision: title.artworkRevision,
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
  if (titleBatch) return entries;
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

export interface RegistryRow {
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
export function alternateHash(alternates: Record<string, string>) {
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
  options: SitemapBuildOptions = {},
  injected?: Database,
) {
  const c = config();
  if (
    c.APP_MODE !== 'live' ||
    c.DEPLOYMENT_ENV !== 'production' ||
    c.LEGAL_APPROVED !== 'true' ||
    c.LICENSES_CONFIRMED !== 'true'
  )
    return { state: 'disabled' as const };
  return runSitemapBuild(options, injected || (await db()));
}

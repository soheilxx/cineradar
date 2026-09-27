import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import type { Database } from '../data/db';
import { withTitleArtwork } from '../data/media/project';
import { config } from '../lib/config';
import { calendarSitemapEntries } from './calendar';
import { sitemapSourceBatch } from './sitemap-source';
import { cleanupSitemapStorage } from './sitemap-cleanup';
import {
  buildSitemapEntries,
  alternateHash,
  type SitemapLanding,
  type RegistryRow,
} from './sitemap-publish';
import {
  sitemapHash,
  sitemapIndex,
  urlset,
  SITEMAP_SHARD_SIZE,
  type SitemapEntry,
} from './sitemap-xml';

export interface SitemapBuildOptions {
  force?: boolean;
  maxDurationMs?: number;
  /** A deterministic work bound for operational tooling and recovery tests. */
  maxSteps?: number;
}
interface Build {
  id: string;
  config_hash: string;
  origin: string;
  markets: string[];
  as_of: string | Date;
  upper_title_id: string;
  phase: string;
  cursor: string;
  artifact_segment: string;
  artifact_ordinal: string | number;
  next_ordinals: Record<string, number>;
  total_entries: number;
  total_urls: number;
  registry_changed: number;
  registry_unchanged: number;
}
const lease = `UPDATE seo_sitemap_state SET locked_until=now()+interval '10 minutes'
  WHERE id=1 AND lock_token=$1 AND locked_until>now() RETURNING id`;
const savedColumns = `url,segment,ordinal,revision,lastmod,indexable,sitemap_eligible,exclusion_reason,
  md5(COALESCE((SELECT string_agg(key||'='||value,E'\\n' ORDER BY key COLLATE "C") FROM jsonb_each_text(alternates)),'')) alternate_hash`;
class SitemapBuildYield extends Error {}

function failureCode(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    /^[0-9A-Z]{5}$/.test(String(error.code))
  )
    return 'sql_' + error.code;
  if (error instanceof Error && error.name === 'TimeoutError') return 'timeout';
  if (error instanceof Error && error.name === 'AbortError') return 'aborted';
  return 'failed';
}
function localAlternates(entries: SitemapEntry[]) {
  const allowed = new Set(
    entries.filter((e) => e.sitemapEligible).map((e) => e.url),
  );
  for (const entry of entries.filter((e) => e.sitemapEligible))
    for (const target of Object.values(entry.alternates))
      if (!allowed.has(target))
        throw new Error('Unpublished sitemap alternate');
}
function lastmod(value: string | Date | null, asOf: Date) {
  const date = value && new Date(value);
  return date && Number.isFinite(date.getTime()) && date <= asOf
    ? date.toISOString()
    : null;
}

async function checkpoint(database: Database, token: string, build: Build) {
  const result = await database.query(
    `WITH lease AS (${lease})
    UPDATE seo_sitemap_builds SET phase=$3,cursor=$4,artifact_segment=$5,artifact_ordinal=$6,
      next_ordinals=$7::jsonb,total_entries=$8,total_urls=$9,registry_changed=$10,registry_unchanged=$11,updated_at=now()
    WHERE id=$2 AND EXISTS(SELECT 1 FROM lease) RETURNING id`,
    [
      token,
      build.id,
      build.phase,
      build.cursor,
      build.artifact_segment,
      build.artifact_ordinal,
      JSON.stringify(build.next_ordinals),
      build.total_entries,
      build.total_urls,
      build.registry_changed,
      build.registry_unchanged,
    ],
  );
  if (!result.rows.length) throw new Error('Sitemap lease lost');
}

async function storeEntries(
  database: Database,
  token: string,
  build: Build,
  entries: SitemapEntry[],
  previous: RegistryRow[],
) {
  const prior = new Map(previous.map((row) => [row.url, row]));
  const asOf = new Date(build.as_of);
  let changedCount = 0,
    unchangedCount = 0;
  const sorted = [...entries].sort((a, b) => a.url.localeCompare(b.url));
  // One source step contains at most 100 titles and their regional variants.
  // Keep writes bounded while avoiding a network round trip per 250 URLs.
  for (let offset = 0; offset < sorted.length; offset += 1000) {
    const batch = sorted.slice(offset, offset + 1000);
    const changed: SitemapEntry[] = [],
      unchanged: string[] = [];
    for (const entry of batch) {
      const old = prior.get(entry.url);
      if (old && old.segment === entry.segment)
        entry.ordinal = Number(old.ordinal);
      else {
        entry.ordinal = build.next_ordinals[entry.segment] || 0;
        build.next_ordinals[entry.segment] = entry.ordinal + 1;
      }
      entry.lastmod = old
        ? old.revision === entry.revision
          ? lastmod(old.lastmod, asOf)
          : asOf.toISOString()
        : entry.lastmod;
      if (
        old &&
        old.segment === entry.segment &&
        old.revision === entry.revision &&
        old.indexable === entry.indexable &&
        old.sitemap_eligible === entry.sitemapEligible &&
        old.exclusion_reason === entry.reason &&
        old.alternate_hash === alternateHash(entry.alternates)
      )
        unchanged.push(entry.url);
      else changed.push(entry);
    }
    const result = await database.query<{ count: number }>(
      `WITH lease AS (${lease}),
      stamped AS (UPDATE seo_url_registry SET generation=$2 WHERE url=ANY($3::text[]) AND EXISTS(SELECT 1 FROM lease) RETURNING url),
      written AS (INSERT INTO seo_url_registry(url,entity,segment,ordinal,locale,market,revision,lastmod,indexable,sitemap_eligible,exclusion_reason,alternates,images,generation)
        SELECT url,entity,segment,ordinal,locale,market,revision,lastmod,indexable,sitemap_eligible,exclusion_reason,alternates,images,$2
        FROM jsonb_to_recordset($4::jsonb) AS e(url text,entity text,segment text,ordinal bigint,locale text,market text,revision text,lastmod timestamptz,indexable boolean,sitemap_eligible boolean,exclusion_reason text,alternates jsonb,images jsonb)
        WHERE EXISTS(SELECT 1 FROM lease)
        ON CONFLICT(url) DO UPDATE SET entity=EXCLUDED.entity,segment=EXCLUDED.segment,ordinal=EXCLUDED.ordinal,locale=EXCLUDED.locale,market=EXCLUDED.market,
          revision=EXCLUDED.revision,lastmod=EXCLUDED.lastmod,indexable=EXCLUDED.indexable,sitemap_eligible=EXCLUDED.sitemap_eligible,
          exclusion_reason=EXCLUDED.exclusion_reason,alternates=EXCLUDED.alternates,images=EXCLUDED.images,generation=EXCLUDED.generation,updated_at=now() RETURNING url),
      reserved AS (UPDATE seo_sitemap_builds SET next_ordinals=$5::jsonb WHERE id=$2 AND EXISTS(SELECT 1 FROM lease) RETURNING id)
      SELECT ((SELECT count(*) FROM stamped)+(SELECT count(*) FROM written))::int AS count FROM reserved`,
      [
        token,
        build.id,
        unchanged,
        JSON.stringify(
          changed.map((e) => ({
            ...e,
            sitemap_eligible: e.sitemapEligible,
            exclusion_reason: e.reason,
          })),
        ),
        JSON.stringify(build.next_ordinals),
      ],
    );
    if (result.rows[0]?.count !== batch.length)
      throw new Error('Sitemap lease lost');
    changedCount += changed.length;
    unchangedCount += unchanged.length;
  }
  build.total_entries += entries.length;
  build.total_urls += entries.filter((entry) => entry.sitemapEligible).length;
  build.registry_changed += changedCount;
  build.registry_unchanged += unchangedCount;
}

async function sourceStep(database: Database, token: string, build: Build) {
  const rows = await sitemapSourceBatch(
    database,
    build.markets,
    new Date(build.as_of),
    build.cursor,
    build.upper_title_id,
  );
  if (!rows.length) {
    if (!build.total_urls) throw new Error('No eligible catalog');
    await database.query(
      `WITH lease AS (${lease}) UPDATE seo_url_registry SET generation='superseded:'||$2
      WHERE generation=$2 AND entity>$3 AND entity<=$4 AND (entity LIKE 'movie:%' OR entity LIKE 'tv:%')
      AND EXISTS(SELECT 1 FROM lease)`,
      [token, build.id, build.cursor, build.upper_title_id],
    );
    await database.query(
      `WITH lease AS (${lease}) DELETE FROM seo_sitemap_build_members
      WHERE build_id=$2 AND batch_key=$3 AND EXISTS(SELECT 1 FROM lease)`,
      [token, build.id, build.cursor],
    );
    build.phase = 'landings';
    build.cursor = '';
    await checkpoint(database, token, build);
    return;
  }
  const titles = await withTitleArtwork(
    rows.map((row) => row.data),
    database,
  );
  const landings = new Map<string, SitemapLanding>();
  const entries = buildSitemapEntries(
    rows.map((row, index) => ({ ...row, data: titles[index] })),
    build.origin,
    build.markets,
    new Date(build.as_of),
    { landings },
  );
  localAlternates(entries);
  const previous = await database.query<RegistryRow>(
    `SELECT ${savedColumns} FROM seo_url_registry WHERE entity=ANY($1::text[])`,
    [titles.map((title) => title.id)],
  );
  await storeEntries(database, token, build, entries, previous.rows);
  const finalBatch =
    rows.length < 100 || rows.at(-1)!.source_id === build.upper_title_id;
  // A failed batch can be replayed after an importer changed a slug. Retire
  // only this build's obsolete partial writes, never another generation's URLs.
  await database.query(
    `WITH lease AS (${lease}) UPDATE seo_url_registry SET generation='superseded:'||$2
    WHERE generation=$2 AND entity>$3 AND entity<=$4 AND (entity LIKE 'movie:%' OR entity LIKE 'tv:%')
      AND NOT(url=ANY($5::text[])) AND EXISTS(SELECT 1 FROM lease)`,
    [
      token,
      build.id,
      build.cursor,
      finalBatch ? build.upper_title_id : rows.at(-1)!.source_id,
      entries.map((entry) => entry.url),
    ],
  );
  const membership = [...landings].map(([pathname, l]) => ({
    url: new URL(pathname, build.origin).href,
    entity: l.route + ':' + l.tail,
    ...l,
  }));
  const stored = await database.query<{ count: number }>(
    `WITH lease AS (${lease}), input AS MATERIALIZED (
      SELECT * FROM jsonb_to_recordset($3::jsonb) AS l(url text,entity text,locale text,market text,route text,tail text,ids jsonb)),
    pages AS (INSERT INTO seo_sitemap_build_landings(build_id,url,entity,locale,market,route,tail)
      SELECT $2,url,entity,locale,market,route,tail FROM input WHERE EXISTS(SELECT 1 FROM lease)
      ON CONFLICT(build_id,url) DO UPDATE SET entity=EXCLUDED.entity RETURNING url),
    obsolete AS (DELETE FROM seo_sitemap_build_members WHERE build_id=$2 AND batch_key=$4
      AND url NOT IN(SELECT url FROM input) AND EXISTS(SELECT 1 FROM lease) RETURNING url),
    members AS (INSERT INTO seo_sitemap_build_members(build_id,url,batch_key,title_ids)
      SELECT $2,url,$4,ids FROM input WHERE url IN(SELECT url FROM pages)
      ON CONFLICT(build_id,url,batch_key) DO UPDATE SET title_ids=EXCLUDED.title_ids RETURNING url)
    SELECT count(*)::int AS count FROM members`,
    [token, build.id, JSON.stringify(membership), build.cursor],
  );
  if (stored.rows[0]?.count !== membership.length)
    throw new Error('Sitemap lease lost');
  build.cursor = rows.at(-1)!.source_id;
  if (finalBatch) {
    if (!build.total_urls) throw new Error('No eligible catalog');
    build.phase = 'landings';
    build.cursor = '';
  }
  await checkpoint(database, token, build);
}

async function landingStep(database: Database, token: string, build: Build) {
  const rows = await database.query<{
    url: string;
    entity: string;
    locale: SitemapEntry['locale'];
    market: string;
    route: string;
    tail: string;
    ids: string[];
    alternates: Record<string, string>;
  }>(
    `SELECT l.*,(SELECT jsonb_agg(id ORDER BY id COLLATE "C") FROM seo_sitemap_build_members m
       CROSS JOIN LATERAL jsonb_array_elements_text(m.title_ids) AS ids(id) WHERE m.build_id=l.build_id AND m.url=l.url) ids,
      (SELECT jsonb_object_agg(locale||'-'||upper(market),url) FROM seo_sitemap_build_landings a WHERE a.build_id=l.build_id AND a.entity=l.entity
        AND EXISTS(SELECT 1 FROM seo_sitemap_build_members m WHERE m.build_id=a.build_id AND m.url=a.url)) alternates
      FROM seo_sitemap_build_landings l WHERE build_id=$1 AND url>$2
        AND EXISTS(SELECT 1 FROM seo_sitemap_build_members m WHERE m.build_id=l.build_id AND m.url=l.url) ORDER BY url LIMIT 5`,
    [build.id, build.cursor],
  );
  if (!rows.rows.length) {
    build.phase = 'editorial';
    build.cursor = '';
    await checkpoint(database, token, build);
    return;
  }
  const entries: SitemapEntry[] = rows.rows.map((row) => ({
    url: row.url,
    entity: row.entity,
    segment: `${row.route === 'topics' ? 'topics' : row.route === 'providers' ? 'providers' : 'landings'}-${row.locale}-${row.market}`,
    locale: row.locale,
    market: row.market,
    revision: sitemapHash(JSON.stringify(row.ids || [])),
    lastmod: null,
    indexable: true,
    sitemapEligible: true,
    reason: null,
    alternates: row.alternates,
    images: [],
  }));
  const previous = await database.query<RegistryRow>(
    `SELECT ${savedColumns} FROM seo_url_registry WHERE url=ANY($1::text[])`,
    [entries.map((e) => e.url)],
  );
  await storeEntries(database, token, build, entries, previous.rows);
  build.cursor = rows.rows.at(-1)!.url;
  await checkpoint(database, token, build);
}

async function editorialStep(database: Database, token: string, build: Build) {
  const entries = [
    ...buildSitemapEntries(
      [],
      build.origin,
      build.markets,
      new Date(build.as_of),
    ),
    ...(await calendarSitemapEntries(database, build.origin)),
  ];
  localAlternates(entries);
  const previous = await database.query<RegistryRow>(
    `SELECT ${savedColumns} FROM seo_url_registry WHERE url=ANY($1::text[])`,
    [entries.map((e) => e.url)],
  );
  await storeEntries(database, token, build, entries, previous.rows);
  await database.query(
    `WITH lease AS (${lease}) UPDATE seo_url_registry SET generation='superseded:'||$2
    WHERE generation=$2 AND (entity LIKE 'comparison:%' OR entity LIKE 'calendar:%' OR entity='feature:identify')
      AND NOT(url=ANY($3::text[])) AND EXISTS(SELECT 1 FROM lease)`,
    [token, build.id, entries.map((entry) => entry.url)],
  );
  build.phase = 'validate';
  build.cursor = '';
  await checkpoint(database, token, build);
}

async function validateStep(database: Database, token: string, build: Build) {
  // Title and editorial alternates were validated as complete disjoint batches,
  // with write counts checked before advancing their checkpoint. Only landings
  // reference pages built in other batches, so verify those targets in SQL.
  const result = await database.query<{
    cursor: string | null;
    invalid: boolean;
  }>(
    `WITH batch AS MATERIALIZED (
      SELECT url FROM seo_sitemap_build_landings l WHERE build_id=$1 AND url>$2
        AND EXISTS(SELECT 1 FROM seo_sitemap_build_members m WHERE m.build_id=l.build_id AND m.url=l.url)
      ORDER BY url LIMIT 100)
    SELECT (SELECT max(url) FROM batch) cursor,
      (EXISTS(SELECT 1 FROM batch b LEFT JOIN seo_url_registry r ON r.url=b.url
        WHERE r.url IS NULL OR r.generation<>$1 OR NOT r.sitemap_eligible)
       OR EXISTS(SELECT 1 FROM batch b JOIN seo_url_registry r ON r.url=b.url
        CROSS JOIN LATERAL jsonb_each_text(r.alternates) a LEFT JOIN seo_url_registry target ON target.url=a.value
        WHERE target.url IS NULL OR target.generation<>$1 OR NOT target.sitemap_eligible)) invalid`,
    [build.id, build.cursor],
  );
  if (result.rows[0]?.invalid) throw new Error('Unpublished sitemap alternate');
  if (result.rows[0]?.cursor) build.cursor = result.rows[0].cursor;
  else {
    build.phase = 'artifacts';
    build.cursor = '';
  }
  await checkpoint(database, token, build);
}

async function artifactStep(database: Database, token: string, build: Build) {
  const first = (
    await database.query<{ segment: string; ordinal: string }>(
      `SELECT segment,ordinal FROM seo_url_registry
    WHERE generation=$1 AND sitemap_eligible AND (segment,ordinal)>($2,$3::bigint) ORDER BY segment,ordinal LIMIT 1`,
      [build.id, build.artifact_segment, build.artifact_ordinal],
    )
  ).rows[0];
  if (!first) {
    build.phase = 'retire';
    build.cursor = '';
    await checkpoint(database, token, build);
    return;
  }
  const shard = Math.floor(Number(first.ordinal) / SITEMAP_SHARD_SIZE) + 1;
  const lower = (shard - 1) * SITEMAP_SHARD_SIZE,
    upper = shard * SITEMAP_SHARD_SIZE;
  const signature = (
    await database.query<{ revision: string; count: number; last: string }>(
      `SELECT
    md5(string_agg(url||':'||ordinal||':'||updated_at::text,'|' ORDER BY ordinal)) revision,count(*)::int count,max(ordinal)::text last
    FROM seo_url_registry WHERE generation=$1 AND sitemap_eligible AND segment=$2 AND ordinal>=$3 AND ordinal<$4`,
      [build.id, first.segment, lower, upper],
    )
  ).rows[0];
  const cached = (
    await database.query<{
      name: string;
      lastmod: string;
      urls: number;
      bytes: number;
    }>(
      `SELECT a.name,a.lastmod,a.url_count AS urls,a.uncompressed_bytes AS bytes
    FROM seo_sitemap_shard_cache c JOIN seo_sitemap_artifacts a ON a.name=c.name WHERE c.segment=$1 AND c.shard=$2 AND c.revision=$3`,
      [first.segment, shard, signature.revision],
    )
  ).rows[0];
  let artifact = cached;
  if (!artifact) {
    const rows = await database.query<
      SitemapEntry & {
        sitemap_eligible: boolean;
        exclusion_reason: string | null;
      }
    >(
      `SELECT url,entity,segment,ordinal,locale,market,revision,lastmod,indexable,sitemap_eligible,exclusion_reason,alternates,images
      FROM seo_url_registry WHERE generation=$1 AND sitemap_eligible AND segment=$2 AND ordinal>=$3 AND ordinal<$4 ORDER BY ordinal`,
      [build.id, first.segment, lower, upper],
    );
    const xml = urlset(
      rows.rows.map((row) => ({
        ...row,
        lastmod: lastmod(row.lastmod, new Date(build.as_of)),
        sitemapEligible: row.sitemap_eligible,
        reason: row.exclusion_reason,
      })),
      build.origin,
    );
    const hash = sitemapHash(xml),
      name = `sitemap-${first.segment}-${String(shard).padStart(4, '0')}-${hash.slice(0, 20)}.xml`;
    const existing = (
      await database.query<{ lastmod: string; urls: number; bytes: number }>(
        'SELECT lastmod,url_count AS urls,uncompressed_bytes AS bytes FROM seo_sitemap_artifacts WHERE name=$1',
        [name],
      )
    ).rows[0];
    if (existing) artifact = { name, ...existing };
    else {
      const inserted = await database.query<{ lastmod: string }>(
        `WITH lease AS (${lease})
        INSERT INTO seo_sitemap_artifacts(name,segment,shard,hash,xml_gzip_base64,uncompressed_bytes,url_count,lastmod)
        SELECT $2,$3,$4,$5,$6,$7,$8,$9 WHERE EXISTS(SELECT 1 FROM lease)
        ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING lastmod`,
        [
          token,
          name,
          first.segment,
          shard,
          hash,
          gzipSync(xml).toString('base64'),
          Buffer.byteLength(xml),
          rows.rows.length,
          new Date(build.as_of).toISOString(),
        ],
      );
      if (!inserted.rows.length) throw new Error('Sitemap lease lost');
      artifact = {
        name,
        lastmod: inserted.rows[0].lastmod,
        urls: rows.rows.length,
        bytes: Buffer.byteLength(xml),
      };
    }
  }
  if (artifact.urls !== signature.count)
    throw new Error('Inconsistent sitemap shard');
  const saved = await database.query(
    `WITH lease AS (${lease}),
    recorded AS (INSERT INTO seo_sitemap_build_artifacts(build_id,name,segment,shard,lastmod,urls,bytes)
      SELECT $2,$3,$4,$5,$6,$7,$8 WHERE EXISTS(SELECT 1 FROM lease)
      ON CONFLICT(build_id,segment,shard) DO UPDATE SET name=EXCLUDED.name,lastmod=EXCLUDED.lastmod,urls=EXCLUDED.urls,bytes=EXCLUDED.bytes RETURNING name),
    cached AS (INSERT INTO seo_sitemap_shard_cache(segment,shard,revision,name)
      SELECT $4,$5,$9,$3 WHERE EXISTS(SELECT 1 FROM recorded)
      ON CONFLICT(segment,shard) DO UPDATE SET revision=EXCLUDED.revision,name=EXCLUDED.name RETURNING name)
    UPDATE seo_sitemap_builds SET artifact_segment=$4,artifact_ordinal=$10,updated_at=now()
      WHERE id=$2 AND EXISTS(SELECT 1 FROM cached) RETURNING id`,
    [
      token,
      build.id,
      artifact.name,
      first.segment,
      shard,
      artifact.lastmod,
      artifact.urls,
      artifact.bytes,
      signature.revision,
      signature.last,
    ],
  );
  if (!saved.rows.length) throw new Error('Sitemap lease lost');
  build.artifact_segment = first.segment;
  build.artifact_ordinal = signature.last;
}

async function retireStep(database: Database, token: string, build: Build) {
  const result = await database.query<{ cursor: string | null }>(
    `WITH lease AS (${lease}), batch AS MATERIALIZED (
      SELECT url,generation,indexable,sitemap_eligible,exclusion_reason FROM seo_url_registry WHERE url>$3 ORDER BY url LIMIT 2000),
    retired AS (UPDATE seo_url_registry r SET indexable=false,sitemap_eligible=false,exclusion_reason='removed_variant',updated_at=now()
      FROM batch b WHERE r.url=b.url AND b.generation<>$2
      AND (b.indexable OR b.sitemap_eligible OR b.exclusion_reason IS DISTINCT FROM 'removed_variant') AND EXISTS(SELECT 1 FROM lease) RETURNING r.url)
    SELECT max(url) cursor FROM batch WHERE EXISTS(SELECT 1 FROM lease)`,
    [token, build.id, build.cursor],
  );
  const cursor = result.rows[0]?.cursor;
  if (cursor) build.cursor = cursor;
  else {
    build.phase = 'publish';
    build.cursor = '';
  }
  await checkpoint(database, token, build);
}

async function loadBuild(
  database: Database,
  token: string,
  c: ReturnType<typeof config>,
) {
  const origin = new URL(c.SITE_URL).origin;
  const hash = sitemapHash(
    JSON.stringify({
      version: 'resumable-2026-09-27-v1',
      origin,
      markets: c.markets,
      media: c.mediaEnabled,
      tvmaze: c.tvmazeEnabled,
      editorial: buildSitemapEntries([], origin, c.markets).map((entry) => [
        entry.url,
        entry.revision,
      ]),
    }),
  );
  const prior = (
    await database.query<Build>(
      `SELECT b.* FROM seo_sitemap_state s JOIN seo_sitemap_builds b ON b.id=s.building_generation WHERE s.id=1`,
    )
  ).rows[0];
  if (prior && prior.config_hash === hash) return prior;
  const id = randomUUID();
  const result = await database.query<Build>(
    `WITH lease AS (SELECT id FROM seo_sitemap_state WHERE id=1 AND lock_token=$1 AND locked_until>now() FOR UPDATE),
    abandoned AS (UPDATE seo_sitemap_builds SET phase='abandoned',updated_at=now() WHERE id=$2 AND EXISTS(SELECT 1 FROM lease) RETURNING id),
    created AS (INSERT INTO seo_sitemap_builds(id,config_hash,origin,markets,as_of,upper_title_id,next_ordinals)
      SELECT $3,$4,$5,$6::text[],now(),COALESCE((SELECT max(id) FROM titles),''),
        COALESCE((SELECT jsonb_object_agg(segment,next) FROM (SELECT segment,max(ordinal)+1 AS next FROM seo_url_registry GROUP BY segment) ordinals),'{}'::jsonb)
      WHERE EXISTS(SELECT 1 FROM lease) RETURNING *),
    linked AS (UPDATE seo_sitemap_state SET building_generation=$3,locked_until=now()+interval '10 minutes' WHERE id=1 AND EXISTS(SELECT 1 FROM created) RETURNING id)
    SELECT created.* FROM created WHERE EXISTS(SELECT 1 FROM linked)`,
    [token, prior?.id || null, id, hash, origin, c.markets],
  );
  if (!result.rows.length) throw new Error('Sitemap lease lost');
  return result.rows[0];
}

export async function runSitemapBuild(
  options: SitemapBuildOptions,
  connection: Database,
) {
  const c = config(),
    token = randomUUID();
  const claim = await connection.query(
    `UPDATE seo_sitemap_state SET lock_token=$1,locked_until=now()+interval '10 minutes',last_attempt=now()
    WHERE id=1 AND (locked_until IS NULL OR locked_until<now()) AND ($2::boolean OR (
      (last_error IS NULL OR last_attempt IS NULL OR last_attempt<now()-interval '15 minutes') AND
      (building_generation IS NOT NULL OR last_success IS NULL OR last_success<now()-interval '15 minutes'))) RETURNING id`,
    [token, !!options.force],
  );
  if (!claim.rows.length) {
    // Retention is separate from publication and never competes with a pending
    // build. A cleanup failure cannot turn a healthy public sitemap into an error.
    const cleanupDeadline = Date.now() + 5000;
    await cleanupSitemapStorage({
      query: <T>(sql: string, params?: unknown[]) => {
        if (Date.now() >= cleanupDeadline) throw new SitemapBuildYield();
        return connection.query<T>(sql, params);
      },
    }).catch(() => {});
    return { state: 'current' as const };
  }
  const deadline =
    Date.now() + Math.min(120000, Math.max(1, options.maxDurationMs || 45000));
  const database: Database = {
    query: <T>(sql: string, params?: unknown[]) => {
      if (Date.now() >= deadline) throw new SitemapBuildYield();
      return connection.query<T>(sql, params);
    },
  };
  const maxSteps = Math.max(
    1,
    Math.floor(options.maxSteps || Number.MAX_SAFE_INTEGER),
  );
  let stage = 'initialize';
  try {
    const build = await loadBuild(connection, token, c);
    let steps = 0;
    while (Date.now() < deadline && steps < maxSteps) {
      stage = build.phase;
      if (stage === 'source') await sourceStep(database, token, build);
      else if (stage === 'landings') await landingStep(database, token, build);
      else if (stage === 'editorial')
        await editorialStep(database, token, build);
      else if (stage === 'validate') await validateStep(database, token, build);
      else if (stage === 'artifacts')
        await artifactStep(database, token, build);
      else if (stage === 'retire') await retireStep(database, token, build);
      else if (stage === 'publish') {
        const manifest = (
          await database.query<{
            name: string;
            lastmod: string;
            urls: number;
            bytes: number;
          }>(
            'SELECT name,lastmod,urls,bytes FROM seo_sitemap_build_artifacts WHERE build_id=$1 ORDER BY segment,shard',
            [build.id],
          )
        ).rows.map((row) => ({
          ...row,
          lastmod: new Date(row.lastmod).toISOString(),
        }));
        if (
          !build.total_urls ||
          manifest.reduce((sum, row) => sum + row.urls, 0) !== build.total_urls
        )
          throw new Error('Incomplete sitemap artifacts');
        const published = await database.query<{ generation: string }>(
          'SELECT publish_resumable_sitemap($1,$2,$3,$4) AS generation',
          [
            token,
            build.id,
            JSON.stringify(manifest),
            sitemapIndex(manifest, build.origin),
          ],
        );
        return {
          state: 'published' as const,
          generation: published.rows[0].generation,
          urls: build.total_urls,
          files: manifest.length,
          registryChanged: build.registry_changed,
          registryUnchanged: build.registry_unchanged,
        };
      } else throw new Error('Invalid sitemap build phase');
      steps++;
      // A large run never monopolizes Node's event loop between bounded units.
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    const released = await connection.query(
      `UPDATE seo_sitemap_state SET lock_token=null,locked_until=null,last_error=null
      WHERE id=1 AND lock_token=$1 RETURNING id`,
      [token],
    );
    if (!released.rows.length) throw new Error('Sitemap lease lost');
    return {
      state: 'building' as const,
      build: build.id,
      phase: build.phase,
      cursor: build.cursor,
      urls: build.total_urls,
    };
  } catch (error) {
    if (error instanceof SitemapBuildYield) {
      const build = (
        await connection.query<Build>(
          'SELECT b.* FROM seo_sitemap_state s JOIN seo_sitemap_builds b ON b.id=s.building_generation WHERE s.id=1 AND s.lock_token=$1',
          [token],
        )
      ).rows[0];
      const released = await connection.query(
        `UPDATE seo_sitemap_state SET lock_token=null,locked_until=null,last_error=null WHERE id=1 AND lock_token=$1 RETURNING id`,
        [token],
      );
      if (!build || !released.rows.length)
        throw new Error('Sitemap lease lost');
      return {
        state: 'building' as const,
        build: build.id,
        phase: build.phase,
        cursor: build.cursor,
        urls: build.total_urls,
      };
    }
    await connection
      .query(
        `UPDATE seo_sitemap_state SET lock_token=null,locked_until=null,last_error=$2 WHERE id=1 AND lock_token=$1`,
        [token, `sitemap_export_failed:${stage}:${failureCode(error)}`],
      )
      .catch(() => {});
    throw error;
  }
}

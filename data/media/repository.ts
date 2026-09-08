import { createHash, randomUUID } from 'node:crypto';
import { db, type Database } from '../db';
import {
  MEDIA_PROFILE,
  type MediaJob,
  type MediaKind,
  type MediaVariant,
  type ProcessedMedia,
} from '../../domain/media';
import { slugify } from '../../i18n/routes';
import { config } from '../../lib/config';
import { normalizeMediaSource } from './source';
export { normalizeMediaSource } from './source';

export type MediaState =
  | 'queued'
  | 'running'
  | 'ready'
  | 'failed'
  | 'withdrawn';
export interface TitleMediaRow {
  titleId: string;
  kind: MediaKind;
  source: string;
  state: MediaState;
  revision: string | null;
  variants: MediaVariant[];
  expiresAt: string | null;
}
type SourceRow = {
  title_id: string;
  kind: MediaKind;
  source: string | null;
  title: string;
  original_title: string | null;
  year: string | null;
};
const iso = (value: string | Date | null) =>
  value ? new Date(value).toISOString() : null;

export async function registerMediaSources(
  database?: Database,
  limit = 250,
): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000)
    throw new Error('Invalid media registration limit');
  const connection = database || (await db());
  // Revocation is permanent across transformation profiles; a routine scan never grants it again.
  await connection.query(`UPDATE media_assets a SET state='withdrawn',lock_token=null,lock_until=null,updated_at=now()
    WHERE a.state<>'withdrawn' AND EXISTS(SELECT 1 FROM media_assets blocked WHERE blocked.kind=a.kind AND blocked.source_url=a.source_url AND blocked.state='withdrawn')`);
  const refreshed = await connection.query<{ id: string }>(
    `UPDATE media_assets SET state='queued',attempts=0,run_at=now(),error_code=null,updated_at=now()
    WHERE id IN (SELECT a.id FROM media_assets a WHERE a.state='ready' AND a.expires_at<=now()+interval '7 days'
      AND EXISTS(SELECT 1 FROM title_media m WHERE m.asset_id=a.id AND m.profile=$1)
      ORDER BY a.expires_at,a.id LIMIT $2) RETURNING id`,
    [MEDIA_PROFILE, limit],
  );
  const sources = await connection.query<SourceRow>(
    `SELECT t.id AS title_id,k.kind,t.data->>k.kind AS source,
      COALESCE(NULLIF(btrim(t.data->'localizations'->'en'->>'title'),''),t.data->>'originalTitle',t.id) AS title,
      t.data->>'originalTitle' AS original_title,t.data->>'year' AS year
    FROM titles t CROSS JOIN (VALUES('poster'),('backdrop')) AS k(kind)
    LEFT JOIN title_media m ON m.title_id=t.id AND m.kind=k.kind
    WHERE ((t.data->>k.kind) IS NULL AND m.title_id IS NOT NULL)
      OR ((t.data->>k.kind) IS NOT NULL AND (m.title_id IS NULL OR m.source IS DISTINCT FROM t.data->>k.kind OR m.profile<>$1))
    ORDER BY t.id,k.kind LIMIT $2`,
    [MEDIA_PROFILE, limit],
  );
  if (!sources.rows.length) return refreshed.rows.length;
  const planned = sources.rows.map((source) => {
    const normalized = source.source
      ? normalizeMediaSource(source.source)
      : null;
    const id = normalized
      ? createHash('sha256')
          .update(`${source.kind}\n${normalized}\n${MEDIA_PROFILE}`)
          .digest('hex')
          .slice(0, 24)
      : null;
    const year =
      source.year && /^\d{4}$/.test(source.year) ? `-${source.year}` : '';
    // Prefer a readable English title, then the original title. A stable catalogue
    // identifier is more useful than a shared "title" slug if neither is Latin.
    const filenameTitle =
      [source.title, source.original_title, source.title_id].find(
        (value) => value && /[a-z0-9]/i.test(value.normalize('NFKD')),
      ) || source.title_id;
    return {
      ...source,
      source_url: normalized,
      id,
      profile: MEDIA_PROFILE,
      filename: `${slugify(filenameTitle).slice(0, 90).replace(/-+$/, '')}${year}-${source.kind}`,
    };
  });
  // Recheck source values while locking the titles. A concurrent import cannot bind an obsolete download.
  const changed = await connection.query<{ count: number | string }>(
    `WITH incoming AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS i(title_id text,kind text,source text,source_url text,id text,profile text,filename text)
    ), current_sources AS MATERIALIZED (
      SELECT i.* FROM incoming i JOIN titles t ON t.id=i.title_id AND (t.data->>i.kind) IS NOT DISTINCT FROM i.source FOR UPDATE OF t
    ), inserted AS (
      INSERT INTO media_assets(id,kind,source_url,profile,filename,state)
      SELECT DISTINCT ON(i.id) i.id,i.kind,i.source_url,i.profile,i.filename,
        CASE WHEN EXISTS(SELECT 1 FROM media_assets blocked WHERE blocked.kind=i.kind AND blocked.source_url=i.source_url AND blocked.state='withdrawn') THEN 'withdrawn' ELSE 'queued' END
      FROM current_sources i WHERE i.id IS NOT NULL ORDER BY i.id,i.title_id
      ON CONFLICT(id) DO NOTHING RETURNING id
    ), linked AS (
      INSERT INTO title_media(title_id,kind,source,profile,asset_id)
      SELECT title_id,kind,source,profile,id FROM current_sources WHERE source IS NOT NULL
      ON CONFLICT(title_id,kind) DO UPDATE SET source=EXCLUDED.source,profile=EXCLUDED.profile,asset_id=EXCLUDED.asset_id,updated_at=now()
      RETURNING title_id
    ), removed AS (
      DELETE FROM title_media m USING current_sources i WHERE m.title_id=i.title_id AND m.kind=i.kind AND i.source IS NULL RETURNING m.title_id
    ) SELECT (SELECT count(*) FROM linked)+(SELECT count(*) FROM removed) AS count`,
    [JSON.stringify(planned)],
  );
  return Number(changed.rows[0]?.count || 0) + refreshed.rows.length;
}

export async function claimMedia(
  database?: Database,
): Promise<MediaJob | null> {
  return (
    (
      await (database || (await db())).query<MediaJob>(
        'SELECT id,source_url,kind,filename,profile,attempts,lock_token FROM claim_media($1,$2)',
        [randomUUID(), config().MEDIA_DOWNLOADS_PER_MINUTE],
      )
    ).rows[0] || null
  );
}

export async function renewMedia(
  job: MediaJob,
  database?: Database,
): Promise<boolean> {
  const result = await (database || (await db())).query(
    `UPDATE media_assets SET heartbeat=now(),lock_until=now()+interval '2 minutes'
    WHERE id=$1 AND lock_token=$2 AND state='running' AND lock_until>now() RETURNING id`,
    [job.id, job.lock_token],
  );
  return result.rows.length === 1;
}

function validProcessed(job: MediaJob, media: ProcessedMedia) {
  const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
  if (
    !/^[a-f0-9]{24,64}$/.test(media.revision) ||
    !/^[a-f0-9]{64}$/.test(media.originalHash) ||
    !/^cineradar\/originals\/[a-f0-9]{64}\.(?:jpe?g|png|webp|avif)$/.test(
      media.originalPathname,
    ) ||
    !/^image\/(?:jpe?g|png|webp|avif)$/.test(media.originalMime) ||
    !positive(media.originalBytes) ||
    !positive(media.width) ||
    !positive(media.height) ||
    media.width * media.height > config().MEDIA_MAX_PIXELS ||
    !media.variants.length ||
    media.variants.length > 4
  )
    return false;
  const paths = new Set<string>();
  for (const variant of media.variants) {
    const expected = `/media/${job.id}/${media.revision.slice(0, 24)}/${job.filename}-${variant.width}.webp`;
    if (
      !positive(variant.width) ||
      !positive(variant.height) ||
      !positive(variant.bytes) ||
      variant.width > 1920 ||
      !/^[a-f0-9]{64}$/.test(variant.hash) ||
      variant.publicPath !== expected ||
      variant.pathname !== `cineradar${expected}` ||
      paths.has(expected)
    )
      return false;
    paths.add(expected);
  }
  return true;
}

export async function finishMedia(
  job: MediaJob,
  media: ProcessedMedia,
  database?: Database,
): Promise<boolean> {
  if (!validProcessed(job, media)) throw new Error('Invalid processed media');
  // Revalidated identical files may renew their URL; other revisions keep their original expiry.
  // The registry insertion and lease-fenced manifest replacement commit together.
  const result = await (database || (await db())).query(
    `WITH finished AS (
      UPDATE media_assets a SET state='ready',revision=$3,variants=$4::jsonb,
      original_pathname=$5,original_hash=$6,original_mime=$7,original_bytes=$8,width=$9,height=$10,
      verified_at=now(),expires_at=now()+interval '180 days',error_code=null,lock_token=null,lock_until=null,updated_at=now()
      WHERE a.id=$1 AND a.lock_token=$2 AND a.state='running' AND a.lock_until>now()
        AND NOT EXISTS(SELECT 1 FROM media_assets blocked WHERE blocked.kind=a.kind AND blocked.source_url=a.source_url AND blocked.state='withdrawn')
      RETURNING a.id,a.variants,a.expires_at
    ), published AS (
      INSERT INTO media_variants(public_path,asset_id,variant,expires_at)
      SELECT v->>'publicPath',f.id,v,f.expires_at FROM finished f CROSS JOIN LATERAL jsonb_array_elements(f.variants) v
      ON CONFLICT(public_path) DO UPDATE SET expires_at=EXCLUDED.expires_at
        WHERE media_variants.asset_id=EXCLUDED.asset_id AND media_variants.variant=EXCLUDED.variant
      RETURNING public_path
    ) SELECT id FROM finished`,
    [
      job.id,
      job.lock_token,
      media.revision,
      JSON.stringify(media.variants),
      media.originalPathname,
      media.originalHash,
      media.originalMime,
      media.originalBytes,
      media.width,
      media.height,
    ],
  );
  return result.rows.length === 1;
}

export async function failMedia(
  job: MediaJob,
  code: string,
  permanent: boolean,
  database?: Database,
): Promise<boolean> {
  const safeCode = /^[a-zA-Z0-9_:-]{1,80}$/.test(code) ? code : 'internal';
  const state: MediaState =
    safeCode === 'withdrawn'
      ? 'withdrawn'
      : permanent || job.attempts >= 6
        ? 'failed'
        : 'queued';
  const seconds = Math.ceil(
    Math.min(21600, 30 * 2 ** Math.max(0, job.attempts - 1)) *
      (0.8 + Math.random() * 0.4),
  );
  const result = await (database || (await db())).query(
    `UPDATE media_assets SET state=$3,error_code=$4,run_at=now()+make_interval(secs=>$5),
      lock_token=null,lock_until=null,updated_at=now()
    WHERE id=$1 AND lock_token=$2 AND state='running' AND lock_until>now() RETURNING id`,
    [job.id, job.lock_token, state, safeCode, seconds],
  );
  return result.rows.length === 1;
}

export async function getMediaForTitles(
  ids: string[],
  database?: Database,
): Promise<TitleMediaRow[]> {
  if (!ids.length) return [];
  const result = await (database || (await db())).query<
    Omit<TitleMediaRow, 'expiresAt'> & { expiresAt: string | Date | null }
  >(
    `SELECT m.title_id AS "titleId",m.kind,m.source,
      CASE WHEN EXISTS(SELECT 1 FROM media_assets blocked WHERE blocked.kind=a.kind AND blocked.source_url=a.source_url AND blocked.state='withdrawn') THEN 'withdrawn'
        WHEN a.expires_at>now() AND a.revision IS NOT NULL AND jsonb_array_length(a.variants)>0 THEN 'ready'
        ELSE COALESCE(a.state,'failed') END AS state,
      a.revision,a.variants,a.expires_at AS "expiresAt"
    FROM title_media m LEFT JOIN media_assets a ON a.id=m.asset_id WHERE m.title_id=ANY($1::text[])`,
    [[...new Set(ids)]],
  );
  return result.rows.map((row) => ({
    ...row,
    expiresAt: iso(row.expiresAt),
    variants:
      row.state === 'ready' &&
      row.expiresAt &&
      new Date(row.expiresAt).getTime() > Date.now()
        ? row.variants
        : [],
  }));
}

export async function findMediaVariant(
  publicPath: string,
  database?: Database,
): Promise<{ variant: MediaVariant; expiresAt: string } | null> {
  if (
    !/^\/media\/[a-f0-9]{24}\/[a-f0-9]{24}\/[a-z0-9-]{1,120}-\d+\.webp$/.test(
      publicPath,
    )
  )
    return null;
  const rows = await (database || (await db())).query<{
    variant: MediaVariant;
    expiresAt: string | Date;
  }>(
    `SELECT v.variant,v.expires_at AS "expiresAt"
    FROM media_variants v JOIN media_assets a ON a.id=v.asset_id
    WHERE v.public_path=$1 AND v.expires_at>now()
      AND NOT EXISTS(SELECT 1 FROM media_assets blocked WHERE blocked.kind=a.kind AND blocked.source_url=a.source_url AND blocked.state='withdrawn') LIMIT 1`,
    [publicPath],
  );
  const row = rows.rows[0];
  return row ? { variant: row.variant, expiresAt: iso(row.expiresAt)! } : null;
}

export async function mediaStats(database?: Database) {
  const result = await (database || (await db())).query<{
    state: MediaState;
    count: number | string;
    bytes: number | string;
    nextRun: string | Date | null;
  }>(`SELECT state,count(*) AS count,
      COALESCE(sum(COALESCE(original_bytes,0)+(SELECT COALESCE(sum((v->>'bytes')::bigint),0) FROM jsonb_array_elements(variants) v)),0) AS bytes,
      min(run_at) FILTER(WHERE state='queued') AS "nextRun" FROM media_assets GROUP BY state ORDER BY state`);
  return result.rows.map((row) => ({
    ...row,
    count: Number(row.count),
    bytes: Number(row.bytes),
    nextRun: iso(row.nextRun),
  }));
}

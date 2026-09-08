import { createHash } from 'node:crypto';
import type { Title } from '../../domain/types';
import type { MediaKind, StoredArtwork } from '../../domain/media';
import { config } from '../../lib/config';
import type { Database } from '../db';
import {
  getMediaForTitles,
  normalizeMediaSource,
  type TitleMediaRow,
} from './repository';

const publicMediaPath =
  /^\/media\/[a-f0-9]{24}\/[a-f0-9]{24}\/[a-z0-9-]{1,120}-[1-9]\d*\.webp$/;

// A read projection only: source metadata remains unchanged in the database.
export function projectTitleMedia(
  titles: Title[],
  rows: TitleMediaRow[],
  origin: string,
  now = Date.now(),
): Title[] {
  const byTitle = new Map<string, TitleMediaRow[]>();
  for (const row of rows) {
    const current = byTitle.get(row.titleId) || [];
    current.push(row);
    byTitle.set(row.titleId, current);
  }
  return titles.map((title) => {
    const projected: Title = {
      ...title,
      poster: title.artwork?.poster?.source || title.poster,
      backdrop: title.artwork?.backdrop?.source || title.backdrop,
    };
    delete projected.artwork;
    delete projected.artworkRevision;
    const artwork: Partial<Record<MediaKind, StoredArtwork>> = {};
    const revisions: unknown[] = [projected.poster, projected.backdrop];
    for (const kind of ['poster', 'backdrop'] as const) {
      const source = projected[kind];
      if (!source) continue;
      const normalized = normalizeMediaSource(source) || source;
      const matching = (byTitle.get(title.id) || []).filter(
        (row) =>
          row.kind === kind &&
          (normalizeMediaSource(row.source) || row.source) === normalized,
      );
      if (matching.some((row) => row.state === 'withdrawn')) {
        projected[kind] = null;
        revisions.push([kind, 'withdrawn']);
        continue;
      }
      const row = matching.find(
        (entry) =>
          entry.state === 'ready' &&
          entry.revision &&
          entry.expiresAt &&
          Date.parse(entry.expiresAt) > now,
      );
      if (!row) continue;
      const variants = [
        ...new Map(
          row.variants
            .filter(
              (variant) =>
                Number.isInteger(variant.width) &&
                variant.width > 0 &&
                Number.isInteger(variant.height) &&
                variant.height > 0 &&
                variant.bytes > 0 &&
                publicMediaPath.test(variant.publicPath) &&
                variant.publicPath.split('/')[3] === row.revision &&
                variant.publicPath.endsWith(`-${variant.width}.webp`),
            )
            .map((variant) => [
              variant.width,
              {
                url: new URL(variant.publicPath, origin).href,
                width: variant.width,
                height: variant.height,
              },
            ]),
        ).values(),
      ].sort((a, b) => a.width - b.width);
      if (!variants.length || variants.length !== row.variants.length) continue;
      artwork[kind] = { source, revision: row.revision!, variants };
      const preferred = kind === 'poster' ? 500 : 1280;
      projected[kind] = (
        variants.find((variant) => variant.width >= preferred) ||
        variants.at(-1)!
      ).url;
      revisions.push([kind, row.revision, variants]);
    }
    if (Object.keys(artwork).length) projected.artwork = artwork;
    projected.artworkRevision = createHash('sha256')
      .update(JSON.stringify(revisions))
      .digest('hex')
      .slice(0, 20);
    return projected;
  });
}

export async function withTitleArtwork(
  titles: Title[],
  database?: Database,
): Promise<Title[]> {
  const c = config();
  if (!c.mediaEnabled || !titles.length) return titles;
  try {
    const rows = await getMediaForTitles(
      [...new Set(titles.map((title) => title.id))],
      database,
    );
    return projectTitleMedia(titles, rows, c.SITE_URL);
  } catch {
    // A media registry outage must not hide otherwise available catalogue data.
    return projectTitleMedia(titles, [], c.SITE_URL);
  }
}

import { createHash } from 'node:crypto';
import sharp, { type Metadata as SharpMetadata } from 'sharp';
import {
  MEDIA_PROFILE,
  MEDIA_WIDTHS,
  type MediaJob,
  type ProcessedMedia,
} from '../../domain/media';
import { downloadMedia, MediaError } from './source';
import { mediaStorage, storageFailure, type MediaStorage } from './storage';
import { config } from '../../lib/config';
import { posterBranding, POSTER_BRANDING_REVISION } from './branding';

const hash = (data: Buffer | string) =>
  createHash('sha256').update(data).digest('hex');

export async function processMedia(
  job: MediaJob,
  options: {
    storage?: MediaStorage;
    download?: (url: string, maxBytes: number) => Promise<Buffer>;
  } = {},
): Promise<ProcessedMedia> {
  if (
    job.profile !== MEDIA_PROFILE ||
    !/^[a-f0-9]{24}$/.test(job.id) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(job.filename)
  )
    throw new MediaError('invalid_media_job', true);
  const c = config();
  const bytes = await (options.download || downloadMedia)(
    job.source_url,
    c.MEDIA_MAX_BYTES,
  );
  if (bytes.length === 0 || bytes.length > c.MEDIA_MAX_BYTES)
    throw new MediaError('source_too_large', true);
  let meta: SharpMetadata;
  try {
    meta = await sharp(bytes, {
      limitInputPixels: c.MEDIA_MAX_PIXELS,
      failOn: 'warning',
    }).metadata();
  } catch {
    throw new MediaError('invalid_image', true);
  }
  if (
    !meta.width ||
    !meta.height ||
    (meta.pages || 1) !== 1 ||
    !['jpeg', 'png', 'webp', 'avif', 'heif'].includes(meta.format || '') ||
    (meta.format === 'heif' && meta.compression !== 'av1') ||
    meta.width * meta.height > c.MEDIA_MAX_PIXELS
  )
    throw new MediaError('invalid_image', true);
  const rotated = meta.orientation && meta.orientation >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;
  const originalHash = hash(bytes);
  const brandingRevision =
    job.kind === 'poster' ? POSTER_BRANDING_REVISION : 'unbranded';
  const revision = hash(
    `${originalHash}:${job.profile}:${job.kind}:${job.filename}:${brandingRevision}`,
  ).slice(0, 24);
  const format =
    meta.format === 'heif'
      ? 'avif'
      : meta.format === 'jpeg'
        ? 'jpg'
        : meta.format;
  const originalMime =
    meta.format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
  const originalPathname = `cineradar/originals/${originalHash}.${format}`;
  const widths = [
    ...new Set(MEDIA_WIDTHS[job.kind].map((size) => Math.min(size, width))),
  ];
  const storage = options.storage || mediaStorage;
  const variants: ProcessedMedia['variants'] = [];
  // Decode and encode first; an invalid image never creates a published partial manifest.
  const outputs: { pathname: string; data: Buffer }[] = [];
  for (const target of widths) {
    let pipeline = sharp(bytes, {
      limitInputPixels: c.MEDIA_MAX_PIXELS,
      failOn: 'warning',
    })
      .rotate()
      .resize({ width: target, withoutEnlargement: true });
    if (job.kind === 'poster') {
      const outputHeight = Math.round((height * target) / width);
      const branding = await posterBranding(target, outputHeight);
      if (branding) pipeline = pipeline.composite([branding]);
    }
    const output = await pipeline
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    const publicPath = `/media/${job.id}/${revision}/${job.filename}-${output.info.width}.webp`;
    const pathname = 'cineradar' + publicPath;
    variants.push({
      pathname,
      publicPath,
      width: output.info.width,
      height: output.info.height,
      bytes: output.data.length,
      hash: hash(output.data),
    });
    outputs.push({ pathname, data: output.data });
  }
  try {
    await storage.put(originalPathname, bytes, originalMime);
    // Two uploads at a time keep memory and connections bounded independently of the worker count.
    for (let index = 0; index < outputs.length; index += 2)
      await Promise.all(
        outputs
          .slice(index, index + 2)
          .map((output) =>
            storage.put(output.pathname, output.data, 'image/webp'),
          ),
      );
  } catch (error) {
    throw storageFailure(error);
  }
  return {
    revision,
    originalPathname,
    originalHash,
    originalMime,
    originalBytes: bytes.length,
    width,
    height,
    variants,
  };
}

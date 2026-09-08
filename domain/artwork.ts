import type { StoredArtwork } from './media';

const tmdbImage =
  /^https:\/\/(image\.tmdb\.org|media\.themoviedb\.org)\/t\/p\/[^/]+\/[A-Za-z0-9._-]+$/;

export function imageManifest(src: string, artwork?: StoredArtwork) {
  if (
    !artwork ||
    (artwork.source !== src && !artwork.variants.some((v) => v.url === src))
  )
    return [];
  return [
    ...new Map(
      artwork.variants
        .filter(
          (v) =>
            Number.isInteger(v.width) &&
            v.width > 0 &&
            Number.isInteger(v.height) &&
            v.height > 0 &&
            Boolean(v.url),
        )
        .map((v) => [v.width, v]),
    ).values(),
  ].sort((a, b) => a.width - b.width);
}

export function imageVariant(
  src: string,
  width: number,
  artwork?: StoredArtwork,
) {
  const variants = imageManifest(src, artwork);
  if (variants.length)
    return (variants.find((v) => v.width >= width) || variants.at(-1)!).url;
  if (!tmdbImage.test(src)) return src;
  return src
    .replace('media.themoviedb.org', 'image.tmdb.org')
    .replace(/\/t\/p\/[^/]+\//, `/t/p/w${width}/`);
}
export function imageSet(
  src: string,
  widths: number[],
  artwork?: StoredArtwork,
) {
  const variants = imageManifest(src, artwork);
  if (variants.length) {
    const selected = widths.map(
      (width) => variants.find((v) => v.width >= width) || variants.at(-1)!,
    );
    return (
      [...new Map(selected.map((v) => [v.width, v])).values()]
        .sort((a, b) => a.width - b.width)
        .map((v) => `${v.url} ${v.width}w`)
        .join(', ') || undefined
    );
  }
  if (!tmdbImage.test(src)) return undefined;
  return widths.map((w) => `${imageVariant(src, w)} ${w}w`).join(', ');
}

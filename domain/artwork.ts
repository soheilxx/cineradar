export function imageVariant(src: string, width: number) {
  if (
    !/^https:\/\/(image\.tmdb\.org|media\.themoviedb\.org)\/t\/p\/[^/]+\/[A-Za-z0-9._-]+$/.test(
      src,
    )
  )
    return src;
  return src
    .replace('media.themoviedb.org', 'image.tmdb.org')
    .replace(/\/t\/p\/[^/]+\//, `/t/p/w${width}/`);
}
export function imageSet(src: string, widths: number[]) {
  return widths.map((w) => `${imageVariant(src, w)} ${w}w`).join(', ');
}

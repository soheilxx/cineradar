// Template and wording changes invalidate share-image caches independently of catalogue revisions.
export const OG_IMAGE_VERSION = '2026-09-12-calendar';

export function ogTitleFontSize(title: string) {
  if (title.length <= 60) return 72;
  // Keep the complete source title; reserve a bounded text area between brand and footer.
  return Math.max(
    18,
    Math.min(
      48,
      Math.floor(Math.sqrt((1050 * 240) / (title.length * 0.7 * 1.15))),
    ),
  );
}

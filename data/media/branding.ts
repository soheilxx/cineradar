import sharp, { type OverlayOptions } from 'sharp';
import { CINERADAR_WORDMARK_WHITE_SVG } from './wordmark';

// Bump the media profile when a new design should replace already published variants.
export const POSTER_BRANDING_REVISION = 'wordmark-white-compact-v2';

export async function posterBranding(
  width: number,
  height: number,
): Promise<OverlayOptions | null> {
  const margin = Math.max(3, Math.round(width * 0.025));
  const paddingX = Math.max(1, Math.round(width * 0.017));
  const paddingY = Math.max(1, Math.round(width * 0.009));
  const wordmark = await sharp(Buffer.from(CINERADAR_WORDMARK_WHITE_SVG))
    .resize({ width: Math.max(1, Math.round(width * 0.34)) })
    .png()
    .toBuffer({ resolveWithObject: true });
  const badgeWidth = wordmark.info.width + paddingX * 2;
  const badgeHeight = wordmark.info.height + paddingY * 2;
  if (badgeWidth + margin * 2 >= width || badgeHeight + margin * 2 >= height)
    return null;
  const radius = Math.max(2, Math.round(width * 0.012));
  const plate = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${badgeWidth}" height="${badgeHeight}"><rect x=".5" y=".5" width="${badgeWidth - 1}" height="${badgeHeight - 1}" rx="${radius}" fill="#090b10" fill-opacity=".74" stroke="#ffffff" stroke-opacity=".15"/></svg>`,
  );
  const input = await sharp(plate)
    .composite([{ input: wordmark.data, left: paddingX, top: paddingY }])
    .png()
    .toBuffer();
  return {
    input,
    left: width - badgeWidth - margin,
    top: height - badgeHeight - margin,
  };
}

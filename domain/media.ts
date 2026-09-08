export const MEDIA_PROFILE = 'webp-v1';
export const MEDIA_WIDTHS = {
  poster: [185, 342, 500, 780],
  backdrop: [300, 780, 1280, 1920],
} as const;
export type MediaKind = keyof typeof MEDIA_WIDTHS;
export interface MediaVariant {
  pathname: string;
  publicPath: string;
  width: number;
  height: number;
  bytes: number;
  hash: string;
}
export interface StoredArtwork {
  source: string;
  revision: string;
  variants: { url: string; width: number; height: number }[];
}
export interface MediaJob {
  id: string;
  source_url: string;
  kind: MediaKind;
  filename: string;
  profile: string;
  attempts: number;
  lock_token: string;
}
export interface ProcessedMedia {
  revision: string;
  originalPathname: string;
  originalHash: string;
  originalMime: string;
  originalBytes: number;
  width: number;
  height: number;
  variants: MediaVariant[];
}

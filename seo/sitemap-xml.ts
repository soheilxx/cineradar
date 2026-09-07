import { createHash } from 'node:crypto';

export const MAX_SITEMAP_URLS = 5000;
export const MAX_SITEMAP_BYTES = 20 * 1024 * 1024;
export const SITEMAP_SHARD_SIZE = 1000;
export interface SitemapEntry {
  url: string;
  entity: string;
  segment: string;
  locale: string;
  market: string | null;
  revision: string;
  lastmod: string | null;
  indexable: boolean;
  sitemapEligible: boolean;
  reason: string | null;
  alternates: Record<string, string>;
  images: string[];
  ordinal?: number;
}
export const sitemapHash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const xmlEscape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
const declaration = '<?xml version="1.0" encoding="UTF-8"?>';

export function urlset(entries: SitemapEntry[], origin: string) {
  if (!entries.length || entries.length > MAX_SITEMAP_URLS)
    throw new Error('Invalid sitemap URL count');
  const seen = new Set<string>();
  const content = entries
    .map((entry) => {
      const url = new URL(entry.url);
      if (
        url.origin !== origin ||
        url.protocol !== 'https:' ||
        url.search ||
        url.hash ||
        entry.url.length > 2048 ||
        !entry.sitemapEligible ||
        !entry.indexable ||
        seen.has(entry.url)
      )
        throw new Error('Invalid sitemap URL');
      seen.add(entry.url);
      const modified = entry.lastmod
        ? `<lastmod>${xmlEscape(entry.lastmod)}</lastmod>`
        : '';
      const alternates = Object.entries(entry.alternates)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([lang, href]) => {
          const alt = new URL(href);
          if (alt.origin !== origin || alt.search || alt.hash)
            throw new Error('Invalid alternate');
          return `<xhtml:link rel="alternate" hreflang="${xmlEscape(lang)}" href="${xmlEscape(href)}"/>`;
        })
        .join('');
      const images = entry.images
        .map(
          (src) =>
            `<image:image><image:loc>${xmlEscape(src)}</image:loc></image:image>`,
        )
        .join('');
      return `<url><loc>${xmlEscape(entry.url)}</loc>${modified}${alternates}${images}</url>`;
    })
    .join('');
  const xml = `${declaration}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${content}</urlset>`;
  if (Buffer.byteLength(xml, 'utf8') > MAX_SITEMAP_BYTES)
    throw new Error('Sitemap byte limit exceeded');
  return xml;
}

export function sitemapIndex(
  artifacts: { name: string; lastmod: string }[],
  origin: string,
) {
  if (!artifacts.length || artifacts.length > 50000)
    throw new Error('Invalid sitemap index count');
  return `${declaration}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${artifacts.map((a) => `<sitemap><loc>${xmlEscape(new URL('/' + a.name, origin).href)}</loc><lastmod>${xmlEscape(a.lastmod)}</lastmod></sitemap>`).join('')}</sitemapindex>`;
}

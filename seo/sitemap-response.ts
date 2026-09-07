import { gunzipSync } from 'node:zlib';
import { db, type Database } from '../data/db';
import { config } from '../lib/config';
import { sitemapHash } from './sitemap-xml';

function unavailable() {
  return new Response('Sitemap publication temporarily unavailable', {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Retry-After': '900',
      'X-Robots-Tag': 'noindex',
    },
  });
}
export async function serveSitemap(
  request: Request,
  name?: string,
  injected?: Database,
) {
  const c = config();
  if (
    c.DEPLOYMENT_ENV !== 'production' ||
    c.APP_MODE !== 'live' ||
    c.LEGAL_APPROVED !== 'true' ||
    c.LICENSES_CONFIRMED !== 'true'
  )
    return unavailable();
  if (
    name &&
    !/^sitemap-(?:movies|series|landings|providers|topics|comparisons)-[a-z]{2}(?:-[a-z]{2})?-\d{4,}-[a-f0-9]{20}\.xml$/.test(
      name,
    )
  )
    return new Response('Not found', { status: 404 });
  try {
    const database = injected || (await db());
    let bytes: Uint8Array;
    let modified: string;
    let etag: string;
    let compressed = false;
    if (name) {
      const result = await database.query<{
        xml_gzip_base64: string;
        hash: string;
        lastmod: string;
      }>(
        `SELECT a.xml_gzip_base64,a.hash,a.lastmod FROM seo_sitemap_artifacts a WHERE name=$1 AND EXISTS(SELECT 1 FROM seo_sitemap_generation_artifacts r WHERE r.name=a.name)`,
        [name],
      );
      if (!result.rows[0])
        return new Response('Not found', {
          status: 404,
          headers: { 'Cache-Control': 'no-store' },
        });
      const row = result.rows[0];
      compressed = /(?:^|,)\s*gzip\s*(?:,|$|;\s*q=(?!0(?:\D|$)))/i.test(
        request.headers.get('accept-encoding') || '',
      );
      const stored = Buffer.from(row.xml_gzip_base64, 'base64');
      bytes = compressed ? stored : gunzipSync(stored);
      modified = row.lastmod;
      etag = `"${row.hash}${compressed ? '-gz' : ''}"`;
    } else {
      const result = await database.query<{
        index_xml: string;
        created_at: string;
      }>(
        `SELECT g.index_xml,g.created_at FROM seo_sitemap_generations g JOIN seo_sitemap_state s ON s.current_generation=g.id WHERE s.id=1`,
      );
      if (!result.rows[0]) return unavailable();
      bytes = Buffer.from(result.rows[0].index_xml);
      etag = `"${sitemapHash(result.rows[0].index_xml)}"`;
      modified = result.rows[0].created_at;
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': name
        ? 'public, max-age=604800, immutable'
        : 'public, max-age=300, stale-if-error=3600',
      ETag: etag,
      'Last-Modified': new Date(modified).toUTCString(),
      Vary: 'Accept-Encoding',
      'X-Content-Type-Options': 'nosniff',
    };
    if (compressed) headers['Content-Encoding'] = 'gzip';
    const noneMatch = request.headers.get('if-none-match');
    if (
      noneMatch === etag ||
      (!noneMatch &&
        request.headers.get('if-modified-since') &&
        new Date(request.headers.get('if-modified-since')!).getTime() >=
          Math.floor(new Date(modified).getTime() / 1000) * 1000)
    )
      return new Response(null, { status: 304, headers });
    return new Response(bytes as BodyInit, { headers });
  } catch {
    return unavailable();
  }
}

// Compatibility URLs read the same published artifacts as the new root index.
// They remain usable during migration without a second live catalog export.
export async function serveLegacySitemap(
  request: Request,
  titles: boolean,
  injected?: Database,
) {
  const c = config();
  if (c.DEPLOYMENT_ENV !== 'production' || c.APP_MODE !== 'live')
    return unavailable();
  const page = Number(new URL(request.url).searchParams.get('page') || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    return new Response('Invalid page', { status: 400 });
  try {
    const database = injected || (await db());
    if (titles) {
      const selected = await database.query<{ name: string }>(
        `SELECT a.name FROM seo_sitemap_state s JOIN seo_sitemap_generation_artifacts r ON r.generation=s.current_generation JOIN seo_sitemap_artifacts a ON a.name=r.name WHERE s.id=1 AND (a.segment LIKE 'movies-%' OR a.segment LIKE 'series-%') ORDER BY a.name LIMIT 1 OFFSET $1`,
        [page - 1],
      );
      if (!selected.rows[0])
        return new Response('Not found', {
          status: 404,
          headers: { 'Cache-Control': 'no-store' },
        });
      const response = await serveSitemap(
        request,
        selected.rows[0].name,
        database,
      );
      const headers = new Headers(response.headers);
      // The alias can select another immutable artifact after publication.
      headers.set('Cache-Control', 'public, max-age=300');
      return new Response(response.body, { status: response.status, headers });
    }
    const rows = await database.query<{ xml_gzip_base64: string }>(
      `SELECT a.xml_gzip_base64 FROM seo_sitemap_state s JOIN seo_sitemap_generation_artifacts r ON r.generation=s.current_generation JOIN seo_sitemap_artifacts a ON a.name=r.name WHERE s.id=1 AND ((a.segment LIKE 'movies-%' OR a.segment LIKE 'series-%')=$1) ORDER BY a.name`,
      [false],
    );
    if (!rows.rows.length) return unavailable();
    const limit = 5000;
    const entries: string[] = [];
    for (const row of rows.rows) {
      const xml = gunzipSync(
        Buffer.from(row.xml_gzip_base64, 'base64'),
      ).toString('utf8');
      for (const match of xml.matchAll(/<url>[\s\S]*?<\/url>/g)) {
        if (entries.length === limit) break;
        entries.push(match[0]);
      }
      if (entries.length === limit) break;
    }
    if (!entries.length) return new Response('Not found', { status: 404 });
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries.join('')}</urlset>`;
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        ETag: `"${sitemapHash(xml)}"`,
      },
    });
  } catch {
    return unavailable();
  }
}

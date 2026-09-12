import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import { NextRequest } from 'next/server';
import {
  getRewrittenUrl,
  unstable_getResponseFromNextConfig,
} from 'next/experimental/testing/server';
import nextConfig from '../next.config';
import { middleware } from '../middleware';
import { serveSitemap } from '../seo/sitemap-response';
import { sitemapHash } from '../seo/sitemap-xml';
import type { Database } from '../data/db';

const saved = { ...process.env };
const origin = 'https://cineradar.test';
const xml =
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://cineradar.test/de/de/serienkalender/</loc></url></urlset>';
const hash = sitemapHash(xml);
const modified = '2026-09-12T18:00:00.000Z';
const artifact = (segment: string) =>
  `sitemap-${segment}-0001-${hash.slice(0, 20)}.xml`;
const published = new Set([
  ...['de', 'fr', 'it', 'es', 'en'].map((locale) =>
    artifact(`calendars-${locale}`),
  ),
  ...[
    'movies-de-de',
    'series-fr-us',
    'landings-it-it',
    'providers-es-es',
    'topics-en-us',
    'comparisons-en',
  ].map(artifact),
]);
const reads: string[] = [];
const database: Database = {
  query: async <T>(sql: string, params: unknown[] = []) => {
    assert.match(sql, /FROM seo_sitemap_artifacts/);
    assert.match(sql, /seo_sitemap_generation_artifacts/);
    const name = String(params[0]);
    reads.push(name);
    return {
      rows: published.has(name)
        ? ([
            {
              xml_gzip_base64: gzipSync(xml).toString('base64'),
              hash,
              lastmod: modified,
            },
          ] as T[])
        : [],
    };
  },
};
function restoreEnv() {
  for (const key of Object.keys(process.env))
    if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
}
beforeEach(() => {
  restoreEnv();
  Object.assign(process.env, {
    APP_MODE: 'live',
    DEPLOYMENT_ENV: 'production',
    SITE_URL: origin,
    DATABASE_URL: 'postgres://must-not-connect',
    TMDB_READ_ACCESS_TOKEN: 'test',
    SAA_ACCESS_MODE: 'direct',
    SAA_API_KEY: 'test',
    SESSION_SECRET: 's'.repeat(32),
    ADMIN_KEY: 'a'.repeat(32),
    OPERATOR_NAME: 'Test',
    OPERATOR_ADDRESS: 'Test',
    CONTACT_EMAIL: 'test@example.com',
    LEGAL_APPROVED: 'true',
    LICENSES_CONFIRMED: 'true',
    SYNC_ENABLED: 'false',
  });
  reads.length = 0;
});
after(restoreEnv);

test('Every published calendar and existing sitemap segment passes middleware, the actual rewrite and artifact validation', async () => {
  for (const name of published) {
    const url = `${origin}/${name}`;
    const passed = middleware(new NextRequest(url));
    assert.equal(passed.status, 200, name);
    assert.equal(passed.headers.get('location'), null, name);
    assert.equal(passed.headers.get('x-middleware-next'), '1', name);
    const rewritten = await unstable_getResponseFromNextConfig({
      url,
      nextConfig,
    });
    const destination = new URL(getRewrittenUrl(rewritten)!);
    assert.equal(destination.pathname, '/sitemaps/artifact', name);
    assert.equal(
      destination.searchParams.get('file'),
      name.slice('sitemap-'.length, -'.xml'.length),
      name,
    );
    const response = await serveSitemap(new Request(url), name, database);
    assert.equal(response.status, 200, name);
    assert.equal(
      response.headers.get('content-type'),
      'application/xml; charset=utf-8',
    );
    assert.equal(
      response.headers.get('cache-control'),
      'public, max-age=604800, immutable',
    );
    assert.equal(await response.text(), xml);
  }
  assert.equal(reads.length, published.size);
});

test('Calendar artifacts preserve gzip delivery and conditional 304 responses', async () => {
  const name = artifact('calendars-de');
  const response = await serveSitemap(
    new Request(`${origin}/${name}`, {
      headers: { 'accept-encoding': 'gzip' },
    }),
    name,
    database,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-encoding'), 'gzip');
  assert.equal(
    gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8'),
    xml,
  );
  const etag = response.headers.get('etag')!;
  const unchanged = await serveSitemap(
    new Request(`${origin}/${name}`, {
      headers: { 'accept-encoding': 'gzip', 'if-none-match': etag },
    }),
    name,
    database,
  );
  assert.equal(unchanged.status, 304);
  assert.equal(await unchanged.text(), '');
  assert.equal(unchanged.headers.get('etag'), etag);
});

test('Adding calendar artifacts does not relax malformed name or unpublished artifact protection', async () => {
  const invalid = [
    '../' + artifact('calendars-de'),
    artifact('unknown-de'),
    artifact('calendars-de').replace('.xml', '.html'),
    artifact('calendars-de').replace('-0001-', '-1-'),
    'sitemap-calendars-de-0001-invalidhash.xml',
    artifact('calendars-de') + '?file=other',
  ];
  for (const name of invalid)
    assert.equal(
      (
        await serveSitemap(
          new Request(origin + '/sitemaps/artifact'),
          name,
          database,
        )
      ).status,
      404,
      name,
    );
  assert.equal(reads.length, 0, 'Malformed names must not reach the registry');
  const missing = artifact('calendars-zz');
  const response = await serveSitemap(
    new Request(`${origin}/${missing}`),
    missing,
    database,
  );
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(reads, [missing]);
});

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { projectTitleMedia, withTitleArtwork } from '../data/media/project';
import type { TitleMediaRow } from '../data/media/repository';
import type { Database } from '../data/db';
import type { MediaKind } from '../domain/media';
import { imageSet, imageVariant } from '../domain/artwork';
import { catalogCard } from '../domain/cards';
import { metadata, titleSchema } from '../seo/metadata';
import { buildSitemapEntries } from '../seo/sitemap-publish';
import { fixtureCatalog } from './fixtures/catalog';

const now = Date.parse('2026-09-08T12:00:00Z');
const origin = 'https://cineradar.tv';
const assetId = 'a'.repeat(24);
const revision = 'b'.repeat(24);
const originalEnv = { ...process.env };
before(() => {
  Object.assign(process.env, {
    APP_MODE: 'live',
    DEPLOYMENT_ENV: 'local',
    SITE_URL: origin,
    DATABASE_URL: 'postgres://unused',
    TMDB_READ_ACCESS_TOKEN: 'unused',
    SAA_ACCESS_MODE: 'direct',
    SAA_API_KEY: 'unused',
    SESSION_SECRET: 'a'.repeat(40),
    SYNC_ENABLED: 'false',
    MEDIA_ENABLED: 'false',
  });
});
after(() => {
  process.env = originalEnv;
});

function sample() {
  const item = structuredClone(fixtureCatalog()[0]);
  item.title.fixture = false;
  item.title.poster = 'https://image.tmdb.org/t/p/w500/poster.jpg';
  item.title.backdrop = 'https://image.tmdb.org/t/p/w1280/backdrop.jpg';
  for (const localized of Object.values(item.title.localizations))
    localized.overview = 'A complete, verified plot description.';
  return item;
}
function media(kind: MediaKind = 'poster'): TitleMediaRow {
  const title = sample().title;
  return {
    titleId: title.id,
    kind,
    source: title[kind]!,
    state: 'ready',
    revision,
    expiresAt: new Date(now + 86400000).toISOString(),
    variants: [185, 342, 500].map((width) => ({
      pathname: `private/asset/${width}.webp`,
      publicPath: `/media/${assetId}/${revision}/interstellar-2014-${kind}-${width}.webp`,
      width,
      height: Math.round(width * 1.5),
      bytes: width * 20,
      hash: `hash${width}`,
    })),
  };
}

test('ready matching media projects published URLs and real variants without mutating source metadata', () => {
  const title = sample().title;
  const original = structuredClone(title);
  const row = media();
  row.source = 'https://media.themoviedb.org/t/p/original/poster.jpg';
  const [projected] = projectTitleMedia([title], [row], origin, now);
  assert.deepEqual(title, original);
  assert.equal(projected.poster, origin + row.variants[2].publicPath);
  assert.equal(projected.backdrop, title.backdrop);
  assert.equal(projected.artwork?.poster?.source, title.poster);
  assert.equal(projected.artwork?.poster?.variants.length, 3);
  assert.ok(projected.artworkRevision);
  assert.equal(projected.revision, title.revision);
  assert.doesNotMatch(
    JSON.stringify(projected.artwork),
    /private\/asset|pathname|hash185/,
  );
  const [again] = projectTitleMedia([projected], [row], origin, now);
  assert.deepEqual(again, projected);
});

test('unfinished, expired, mismatched or invalid manifests preserve the external fallback', () => {
  const title = sample().title;
  for (const change of [
    { state: 'queued' as const },
    { state: 'running' as const },
    { state: 'failed' as const },
    { expiresAt: null },
    { expiresAt: new Date(now).toISOString() },
    { expiresAt: 'invalid' },
    { source: 'https://image.tmdb.org/t/p/w500/another.jpg' },
    { variants: [] },
    {
      variants: [
        {
          ...media().variants[0],
          publicPath: 'https://foreign.test/image.webp',
        },
      ],
    },
    {
      variants: [
        media().variants[0],
        {
          ...media().variants[1],
          publicPath: `/media/${assetId}/${revision}/wrong-width-500.webp`,
        },
      ],
    },
  ]) {
    const [projected] = projectTitleMedia(
      [title],
      [{ ...media(), ...change }],
      origin,
      now,
    );
    assert.equal(projected.poster, title.poster, JSON.stringify(change));
    assert.equal(projected.artwork?.poster, undefined);
  }
});

test('withdrawn matching sources block both stored and external artwork, including width aliases', () => {
  const item = sample();
  const blocked = {
    ...media(),
    source: 'https://image.tmdb.org/t/p/original/poster.jpg',
    state: 'withdrawn' as const,
    revision: null,
    expiresAt: null,
    variants: [],
  };
  const [projected] = projectTitleMedia(
    [item.title],
    [media(), blocked, { ...media('backdrop'), state: 'withdrawn' }],
    origin,
    now,
  );
  assert.equal(projected.poster, null);
  assert.equal(projected.backdrop, null);
  assert.equal(projected.artwork, undefined);
  assert.equal(
    titleSchema({ ...item, title: projected }, 'en', 'us').mainEntity.image,
    undefined,
  );
  const [replacement] = projectTitleMedia(
    [
      {
        ...item.title,
        poster: 'https://image.tmdb.org/t/p/w500/new-source.jpg',
      },
    ],
    [blocked],
    origin,
    now,
  );
  assert.equal(
    replacement.poster,
    'https://image.tmdb.org/t/p/w500/new-source.jpg',
  );
});

test('responsive image candidates use actual available widths and never invent local variants', () => {
  const row = media();
  row.variants = [185, 300].map((width) => ({
    ...row.variants[0],
    width,
    height: width * 2,
    publicPath: `/media/${assetId}/${revision}/title-poster-${width}.webp`,
  }));
  const [projected] = projectTitleMedia([sample().title], [row], origin, now);
  const art = projected.artwork!.poster!;
  assert.equal(imageVariant(projected.poster!, 500, art), art.variants[1].url);
  assert.equal(
    imageSet(projected.poster!, [185, 342, 500], art),
    `${art.variants[0].url} 185w, ${art.variants[1].url} 300w`,
  );
  assert.equal(imageSet(projected.poster!, [185, 342, 500]), undefined);
  assert.equal(imageSet('/cinema.webp', [300, 780, 1280]), undefined);
  const source = 'https://image.tmdb.org/t/p/w500/other.jpg';
  assert.equal(
    imageVariant(source, 342, art),
    'https://image.tmdb.org/t/p/w342/other.jpg',
  );
});

test('card DTO, schema, sitemap images and the OG key share the projected asset revision', async () => {
  const item = sample();
  const [title] = projectTitleMedia(
    [item.title],
    [media(), media('backdrop')],
    origin,
    now,
  );
  const projected = { ...item, title };
  const card = catalogCard(projected, 'en');
  assert.equal(card.poster, title.poster);
  assert.deepEqual(card.posterArtwork, title.artwork?.poster);
  assert.equal(
    titleSchema(projected, 'en', 'us').mainEntity.image,
    title.poster,
  );
  const meta = await metadata('en', 'us', 'movie', projected);
  assert.ok(meta.openGraph?.images);
  const image = (meta.openGraph.images as { url: string }[])[0];
  assert.equal(
    new URL(image.url).searchParams.get('artwork'),
    title.artworkRevision,
  );
  const snapshots = [
    {
      market: 'us',
      availability: 'empty' as const,
      checkedAt: new Date(now).toISOString(),
      hasOffers: false,
      changedAt: new Date(now).toISOString(),
      revision: '',
      providers: [],
    },
  ];
  const rows = (data: typeof title) => [
    { data, updated_at: new Date(now).toISOString(), snapshots },
  ];
  const before = buildSitemapEntries(
    rows(item.title),
    origin,
    ['us'],
    new Date(now),
  ).find((entry) => entry.entity === title.id)!;
  const after = buildSitemapEntries(
    rows(title),
    origin,
    ['us'],
    new Date(now),
  ).find((entry) => entry.entity === title.id)!;
  assert.deepEqual(after.images, [title.poster, title.backdrop]);
  assert.ok(after.images.every((url) => url.startsWith(origin + '/media/')));
  assert.notEqual(after.revision, before.revision);
});

test('disabled media makes no registry query and a registry failure preserves the entire title batch', async () => {
  let calls = 0;
  const failing: Database = {
    async query() {
      calls++;
      throw new Error('simulated registry outage');
    },
  };
  const titles = [sample().title, { ...sample().title, id: 'movie:999' }];
  process.env.MEDIA_ENABLED = 'false';
  assert.equal(await withTitleArtwork(titles, failing), titles);
  assert.equal(calls, 0);
  process.env.MEDIA_ENABLED = 'true';
  try {
    const result = await withTitleArtwork(titles, failing);
    assert.equal(calls, 1);
    assert.equal(result.length, titles.length);
    assert.deepEqual(
      result.map((title) => title.poster),
      titles.map((title) => title.poster),
    );
    await withTitleArtwork([], failing);
    assert.equal(calls, 1);
  } finally {
    process.env.MEDIA_ENABLED = 'false';
  }
});

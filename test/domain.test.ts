import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countrySchema,
  catalogPageSchema,
  SAA,
  normalizeShow,
  showSchema,
} from '../data/providers/saa';
import { ProviderError, request } from '../data/providers/http';
import {
  freshness,
  inSubscriptions,
  lowestPrices,
  activeOffers,
} from '../domain/offers';
import { filterCatalog } from '../domain/search';
import { fixtureCatalog } from './fixtures/catalog';
import { jsonLd } from '../seo/metadata';
import { config } from '../lib/config';
import { paginate } from '../jobs/pagination';
import { backoff } from '../jobs/queue';
const service = {
  id: 'stream',
  name: 'Test Stream',
  homePage: 'https://example.com/',
  imageSet: {
    darkThemeImage: 'https://example.com/logo.png',
    lightThemeImage: 'https://example.com/logo.png',
    whiteImage: 'https://example.com/logo.png',
  },
};
const offer = {
  service,
  type: 'subscription',
  link: 'https://example.com/watch/1',
};
const raw = (type = 'movie', offers: unknown[] = [offer]) => ({
  itemType: 'show',
  id: 'saa-1',
  showType: type,
  tmdbId: '1',
  streamingOptions: { de: offers },
});

test('Change requests include required item type and preserve cursor/time window', async () => {
  const original = globalThis.fetch;
  const calls: URL[] = [];
  try {
    globalThis.fetch = async (input) => {
      calls.push(new URL(input instanceof Request ? input.url : input));
      return Response.json({ changes: [], shows: {}, hasMore: false });
    };
    const api = new SAA(async () => true);
    for (const type of ['show', 'season', 'episode'] as const)
      await api.changes('us', 100, 200, 'updated', 'opaque-token', type);
    assert.deepEqual(
      calls.map((u) => u.searchParams.get('item_type')),
      ['show', 'season', 'episode'],
    );
    for (const u of calls) {
      assert.equal(u.searchParams.get('from'), '100');
      assert.equal(u.searchParams.get('to'), '200');
      assert.equal(u.searchParams.get('cursor'), 'opaque-token');
      assert.equal(u.searchParams.get('country'), 'us');
    }
  } finally {
    globalThis.fetch = original;
  }
});
test('Catalog discovery preserves country, episode scope and opaque pagination cursor', async () => {
  const original = globalThis.fetch;
  const calls: URL[] = [];
  let units = 0;
  try {
    globalThis.fetch = async (input) => {
      calls.push(new URL(input instanceof Request ? input.url : input));
      return Response.json({ shows: [raw('series')], hasMore: false });
    };
    const api = new SAA(async (_service, count) => {
      units += count;
      return true;
    });
    const result = await api.catalog('fr', 'tv', 'next+/=cursor');
    assert.equal(result.shows.length, 1);
    assert.equal(calls[0].pathname, '/v4/shows/search/filters');
    assert.equal(calls[0].searchParams.get('country'), 'fr');
    assert.equal(calls[0].searchParams.get('show_type'), 'series');
    assert.equal(calls[0].searchParams.get('series_granularity'), 'episode');
    assert.equal(calls[0].searchParams.get('cursor'), 'next+/=cursor');
    assert.equal(units, 1);
    assert.equal(
      catalogPageSchema.safeParse({ shows: [], hasMore: true }).success,
      false,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test('Missing provider artwork does not discard valid countries or offers', () => {
  const withoutArtwork = {
    ...service,
    imageSet: { darkThemeImage: '', lightThemeImage: '', whiteImage: '' },
  };
  const country = countrySchema.parse({
    countryCode: 'fr',
    name: 'France',
    services: [
      {
        ...service,
        streamingOptionTypes: {
          subscription: true,
          addon: true,
          free: false,
          rent: false,
          buy: false,
        },
        addons: [withoutArtwork],
      },
    ],
  });
  assert.equal(country.services[0].addons[0].imageSet.darkThemeImage, null);
  const normalized = normalizeShow(
    raw('movie', [{ ...offer, service: withoutArtwork }]),
    'movie',
    1,
    'de',
  );
  assert.equal(normalized.offers[0].provider.logo, null);
  assert.equal(normalized.offers[0].link, offer.link);
  assert.throws(
    () =>
      normalizeShow(
        raw('movie', [
          {
            ...offer,
            service: {
              ...withoutArtwork,
              imageSet: {
                ...withoutArtwork.imageSet,
                darkThemeImage: 'javascript:alert(1)',
              },
            },
          },
        ]),
        'movie',
        1,
        'de',
      ),
    ProviderError,
  );
});
test('Media type is part of stable identity; mismatched external mapping rejected', () => {
  assert.equal(
    normalizeShow(raw(), 'movie', 1, 'de').offers[0].titleId,
    'movie:1',
  );
  assert.equal(
    normalizeShow(raw('series'), 'tv', 1, 'de').offers[0].titleId,
    'tv:1',
  );
  assert.throws(() => normalizeShow(raw(), 'tv', 1, 'de'), ProviderError);
});
test('Subscription does not become zero-price or imply audio/subtitles', () => {
  const o = normalizeShow(raw(), 'movie', 1, 'de').offers[0];
  assert.equal(o.price, null);
  assert.equal(o.currency, null);
  assert.equal(o.audio, null);
  assert.equal(o.subtitles, null);
});
test('Add-ons require explicit selection; rental prices remain exact decimals', () => {
  const addon = {
    ...offer,
    type: 'addon',
    addon: { ...service, id: 'extra', name: 'Extra' },
  };
  const rent = {
    ...offer,
    type: 'rent',
    price: { amount: '3.99', currency: 'EUR' },
  };
  const o = normalizeShow(raw('movie', [addon, rent]), 'movie', 1, 'de').offers;
  assert.equal(inSubscriptions(o[0], ['stream']), false);
  assert.equal(inSubscriptions(o[0], ['stream:extra']), true);
  assert.equal(o[1].price, '3.99');
  assert.equal(o[1].unit, 'film');
});
test('Partial series stores unit-specific prices and only evidence-backed languages', () => {
  const o = normalizeShow(
    {
      ...raw('series'),
      seasons: [
        {
          itemType: 'season',
          title: 'Season 1',
          streamingOptions: {
            de: [
              { ...offer, type: 'buy', price: null, audios: [], subtitles: [] },
            ],
          },
          episodes: [
            {
              itemType: 'episode',
              title: 'Episode 1',
              streamingOptions: {
                de: [
                  {
                    ...offer,
                    type: 'buy',
                    price: { amount: '1.99', currency: 'EUR' },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    'tv',
    1,
    'de',
  ).offers;
  assert.deepEqual(
    o.map((x) => x.unit),
    ['series', 'season', 'episode'],
  );
  assert.equal(o[1].price, null);
  assert.equal(o[2].price, '1.99');
  assert.equal(o[2].episode, 1);
});
test('Price ranking groups by country, quality, currency, type and scope', () => {
  const base = fixtureCatalog()[0].snapshot.offers.find(
    (o) => o.type === 'rent',
  )!;
  const all = [
    base,
    { ...base, id: 'cheap-sd', quality: 'sd', price: '1.99' },
    { ...base, id: 'expensive-hd', price: '5.99' },
    { ...base, id: 'dollar', currency: 'USD', price: '1.49' },
  ];
  const best = lowestPrices(all);
  assert(best.has(base.id));
  assert(!best.has('expensive-hd'));
  assert(best.has('dollar'));
});
test('Expiry is UTC-stable around daylight-saving transition', () => {
  const o = fixtureCatalog()[0].snapshot.offers[0];
  const exp = { ...o, expiresOn: '2026-10-25T01:00:00Z' };
  assert.equal(
    activeOffers([exp], Date.parse('2026-10-25T00:59:59Z')).length,
    1,
  );
  assert.equal(
    activeOffers([exp], Date.parse('2026-10-25T01:00:01Z')).length,
    0,
  );
  assert.equal(freshness(null), 'unknown');
  assert.equal(
    freshness('2026-10-20T00:00:00Z', Date.parse('2026-10-25T01:00:01Z')),
    'stale',
  );
});
test('Accent-tolerant and typo-tolerant title search, year and duration filters', () => {
  const rows = fixtureCatalog().filter((x) => x.snapshot.market === 'de');
  assert.equal(
    filterCatalog(rows, 'de', { q: 'Interstelar' })[0].title.tmdbId,
    157336,
  );
  assert.equal(
    filterCatalog(rows, 'en', { q: 'Inception 2010' })[0].title.tmdbId,
    27205,
  );
  assert.equal(filterCatalog(rows, 'en', { q: 'Inception 2011' }).length, 0);
  assert(
    filterCatalog(rows, 'en', { maxMinutes: 120, scope: 'finder' }).every(
      (x) => x.title.runtime! <= 120,
    ),
  );
  assert.equal(filterCatalog(rows, 'fr', { audio: 'fr' }).length, 0);
});
test('Pagination abort never advances watermark; looping cursor rejected', async () => {
  let committed = false;
  let n = 0;
  await assert.rejects(
    paginate(
      async () => {
        if (n++ === 0) return { items: [1], hasMore: true, nextCursor: 'next' };
        throw new ProviderError('quota');
      },
      async () => {},
      async () => {
        committed = true;
      },
    ),
  );
  assert.equal(committed, false);
  await assert.rejects(
    paginate(
      async () => ({ items: [], hasMore: true, nextCursor: 'same' }),
      async () => {},
      async () => {},
    ),
  );
});
test('Provider failures distinguish empty success, 404, 429, auth, timeout and schema', async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, code] of [
      [404, 'missing'],
      [429, 'quota'],
      [401, 'auth'],
      [503, 'upstream'],
    ] as const) {
      globalThis.fetch = async () =>
        new Response('{}', { status, headers: { 'Retry-After': '3' } });
      await assert.rejects(
        request(
          new URL('https://example.com'),
          {},
          showSchema,
          'saa',
          async () => true,
        ),
        (e) =>
          e instanceof ProviderError &&
          e.code === code &&
          e.retryAfter === 3000,
      );
    }
    globalThis.fetch = async () => Response.json(raw('movie', []));
    assert.equal(
      (
        await request(
          new URL('https://example.com'),
          {},
          showSchema,
          'saa',
          async () => true,
        )
      ).streamingOptions.de.length,
      0,
    );
    globalThis.fetch = async () => Response.json({ invalid: true });
    await assert.rejects(
      request(
        new URL('https://example.com'),
        {},
        showSchema,
        'saa',
        async () => true,
      ),
      (e) => e instanceof ProviderError && e.code === 'schema',
    );
    globalThis.fetch = async () => {
      throw new DOMException('Timed out', 'TimeoutError');
    };
    await assert.rejects(
      request(
        new URL('https://example.com'),
        {},
        showSchema,
        'saa',
        async () => true,
      ),
      (e) => e instanceof ProviderError && e.code === 'timeout',
    );
  } finally {
    globalThis.fetch = original;
  }
});
test('JSON-LD cannot break out into script; fixture cannot run on a production origin', () => {
  const data = { name: '</script><script>alert(1)</script>' };
  assert(!jsonLd(data).includes('</script>'));
  assert.deepEqual(JSON.parse(jsonLd(data)), data);
  assert.throws(() =>
    config({
      APP_MODE: 'fixture',
      DEPLOYMENT_ENV: 'preview',
      SITE_URL: 'https://example.com',
    }),
  );
  assert.throws(() => config({ APP_MODE: 'live' }));
  assert.equal(config({ CONTACT_EMAIL: '' }).CONTACT_EMAIL, undefined);
});
test('Backoff respects upstream retry-after and bounds jitter', () => {
  assert(backoff(1, 60000, 0) >= 60000);
  assert(backoff(4, 0, 0) < backoff(4, 0, 1));
});

test('Canonical prefixed TMDb identities and unnumbered granular offers are preserved', () => {
  const parsed = normalizeShow(
    { ...raw(), tmdbId: 'movie/1' },
    'movie',
    1,
    'de',
  );
  assert.equal(parsed.offers[0].id.length, 64);
  assert.throws(
    () => normalizeShow({ ...raw(), tmdbId: 'tv/1' }, 'movie', 1, 'de'),
    ProviderError,
  );
  const result = normalizeShow(
    {
      ...raw('series'),
      tmdbId: 'tv/1',
      seasons: [
        {
          itemType: 'season',
          title: 'A special collection',
          streamingOptions: {
            de: [
              {
                ...offer,
                type: 'buy',
                price: { amount: '9.99', currency: 'EUR' },
                quality: 'hd',
              },
            ],
          },
          episodes: [
            {
              itemType: 'episode',
              title: 'Pilot',
              streamingOptions: { de: [offer] },
            },
          ],
        },
      ],
    },
    'tv',
    1,
    'de',
  );
  assert.equal(result.offers[1].season, null);
  assert.equal(result.offers[1].unit, 'season');
  assert.equal(result.offers[2].episode, null);
  assert.equal(result.offers[2].unit, 'episode');
  assert.equal(lowestPrices(result.offers).size, 0);
});

import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Metadata } from 'next';
import type { Database } from '../data/db';
import { locales, markets, defaultMarkets, countryName } from '../i18n/config';
import { path, type RouteKey } from '../i18n/routes';
import { metadata } from '../seo/metadata';
import { fallbackMetadata } from '../seo/fallback';
import { identifyMetadata } from '../seo/identify';
import { comparisonMetadata } from '../seo/comparisons';
import { comparisonIds } from '../content/comparisons/routes';
import { infoDescriptions } from '../content/info';
import { streamingDescription } from '../seo/content';
import { pageCopy } from '../seo/copy';
import { OG_IMAGE_VERSION, ogTitleFontSize } from '../seo/og';
import { fixtureCatalog, fixtureProviders } from './fixtures/catalog';
import { providerStatus } from '../data/repositories/catalog';

const origin = 'https://cineradar.tv';
const previous = { ...process.env };
before(() => {
  Object.assign(process.env, {
    APP_MODE: 'live',
    DEPLOYMENT_ENV: 'production',
    SITE_URL: origin,
    ENABLED_MARKETS: markets.join(','),
    DATABASE_URL: 'postgres://unused',
    TMDB_READ_ACCESS_TOKEN: 'unused',
    SAA_API_KEY: 'unused',
    SAA_ACCESS_MODE: 'direct',
    SESSION_SECRET: 'a'.repeat(40),
    ADMIN_KEY: 'b'.repeat(30),
    OPERATOR_NAME: 'Test',
    OPERATOR_ADDRESS: 'Test',
    CONTACT_EMAIL: 'test@example.com',
    LEGAL_APPROVED: 'true',
    LICENSES_CONFIRMED: 'true',
    SYNC_ENABLED: 'false',
  });
});
after(() => {
  process.env = previous;
});

const landingDatabase: Database = {
  async query<T>() {
    return {
      rows: locales.flatMap((locale) =>
        markets.map((market) => ({ locale, market, total: 100 })),
      ) as T[],
    };
  },
};
const titleDatabase: Database = {
  async query<T>() {
    return {
      rows: markets.map((market) => ({
        market,
        availability: 'available',
        checkedAt: new Date().toISOString(),
        hasOffers: true,
      })) as T[],
    };
  },
};
function sample() {
  const item = structuredClone(fixtureCatalog()[0]);
  item.title.fixture = false;
  item.snapshot.availability = 'available';
  item.snapshot.freshness = 'fresh';
  item.snapshot.checkedAt = new Date().toISOString();
  for (const local of Object.values(item.title.localizations))
    local.overview = 'A verified localized synopsis.';
  return item;
}
function assertShare(meta: Metadata) {
  assert.equal(typeof meta.title, 'string');
  assert.ok(meta.description && meta.description.length > 30);
  assert.doesNotMatch(JSON.stringify(meta), /undefined|\{country\}|\{label\}/);
  assert.equal(meta.openGraph?.title, meta.title);
  assert.equal(meta.openGraph?.description, meta.description);
  assert.equal(meta.twitter?.title, meta.title);
  assert.equal(meta.twitter?.description, meta.description);
  assert.match(
    meta.openGraph?.locale || '',
    /^(de|fr|it|es|en)_(DE|FR|IT|ES|US)$/,
  );
  const images = meta.openGraph?.images as {
    url: string;
    width: number;
    height: number;
    alt: string;
  }[];
  assert.equal(images.length, 1);
  const image = images[0];
  assert.equal(new URL(image.url).origin, origin);
  assert.equal(new URL(image.url).searchParams.get('v'), OG_IMAGE_VERSION);
  assert.equal(image.width, 1200);
  assert.equal(image.height, 630);
  assert.ok(image.alt);
  assert.ok(meta.twitter?.images);
  assert.equal((meta.twitter.images as { url: string }[])[0].url, image.url);
  assert.equal(Object.hasOwn(meta, 'keywords'), false);
}

test('every standard page type has coherent localized metadata in all 25 contexts', async () => {
  const routes: RouteKey[] = [
    'home',
    'movies',
    'series',
    'providers',
    'search',
    'new',
    'leaving',
    'free',
    'finder',
    'topics',
    'watchlist',
    'myProviders',
    'about',
    'data',
    'help',
    'contact',
    'report',
    'legal',
    'privacy',
    'credits',
    'ops',
  ];
  for (const locale of locales)
    for (const market of markets)
      for (const route of routes) {
        const meta = await metadata(
          locale,
          market,
          route,
          null,
          false,
          '',
          1,
          undefined,
          { database: landingDatabase },
        );
        assertShare(meta);
        const preferredMarket = Object.hasOwn(infoDescriptions, route)
          ? defaultMarkets[locale]
          : market;
        assert.equal(
          meta.alternates?.canonical,
          origin + path(locale, preferredMarket, route),
        );
        assert.equal(meta.openGraph?.url, meta.alternates?.canonical);
        const index = ['home', 'movies', 'series', 'providers'].includes(route);
        assert.equal(
          (meta.robots as { index: boolean }).index,
          index,
          `${locale}/${market}/${route}`,
        );
        if (index) {
          assert.equal(
            Object.keys(meta.alternates?.languages || {}).length,
            25,
          );
          assert.equal(
            meta.alternates?.languages?.[`${locale}-${market.toUpperCase()}`],
            meta.alternates?.canonical,
          );
        } else assert.equal(meta.alternates?.languages, undefined);
      }
});

test('home and collection metadata identifies what the page actually helps users find', async () => {
  for (const locale of locales) {
    const home = await metadata(
      locale,
      defaultMarkets[locale],
      'home',
      null,
      false,
      '',
      1,
      undefined,
      { database: landingDatabase },
    );
    assert.match(home.title as string, /streaming/i);
    for (const [route, tail, label] of [
      ['providers', 'netflix', 'Netflix'],
      ['topics', 'thriller', 'Thriller'],
    ] as const) {
      const meta = await metadata(
        locale,
        defaultMarkets[locale],
        route,
        null,
        false,
        tail,
        1,
        label,
        { database: landingDatabase },
      );
      assert.ok((meta.title as string).includes(label));
      assert.ok(meta.description?.includes(label));
      assertShare(meta);
    }
  }
});

test('title metadata keeps checked market alternates and never invents pagination', async () => {
  const item = sample();
  for (const locale of locales)
    for (const market of markets) {
      item.snapshot.market = market;
      for (const offer of item.snapshot.offers) offer.market = market;
      const meta = await metadata(
        locale,
        market,
        'movie',
        item,
        false,
        '',
        99,
        undefined,
        { database: titleDatabase },
      );
      assertShare(meta);
      assert.equal(new URL(meta.alternates?.canonical as string).search, '');
      assert.equal(Object.keys(meta.alternates?.languages || {}).length, 25);
      assert.equal(
        meta.alternates?.languages?.[`${locale}-${market.toUpperCase()}`],
        meta.alternates?.canonical,
      );
      assert.ok(
        (meta.title as string).includes(item.title.localizations[locale].title),
      );
      assert.ok(meta.description?.includes(String(item.title.year)));
    }
});

test('query variants are noindex and carry no raw user input in share metadata', async () => {
  for (const key of [
    'home',
    'search',
    'movies',
    'providers',
    'watchlist',
  ] as const) {
    const meta = await metadata('en', 'us', key, null, true, '', 2, undefined, {
      database: landingDatabase,
    });
    assert.equal((meta.robots as { index: boolean }).index, false);
    assert.equal(meta.alternates?.languages, undefined);
    assert.ok(meta.openGraph?.images);
    assert.equal(
      new URL(
        (meta.openGraph.images as { url: string }[])[0].url,
      ).searchParams.has('q'),
      false,
    );
  }
  for (const locale of locales) {
    const feature = identifyMetadata(locale, true);
    assertShare(feature);
    assert.equal((feature.robots as { index: boolean }).index, false);
    assert.equal(feature.alternates?.languages, undefined);
    for (const id of [undefined, ...comparisonIds]) {
      const editorial = comparisonMetadata(locale, id, true);
      assertShare(editorial);
      assert.equal((editorial.robots as { index: boolean }).index, false);
      assert.equal(editorial.alternates?.languages, undefined);
    }
  }
});

test('listing data and eligibility database failures remain noindex rather than asserting complete content', async () => {
  const failing: Database = {
    async query() {
      throw new Error('database unavailable');
    },
  };
  const failed = await metadata(
    'en',
    'us',
    'movies',
    null,
    false,
    '',
    2,
    undefined,
    { database: failing },
  );
  assert.equal((failed.robots as { index: boolean }).index, false);
  assert.equal(failed.alternates?.languages, undefined);
  const unavailable = await metadata(
    'en',
    'us',
    'movies',
    null,
    false,
    '',
    1,
    undefined,
    { database: landingDatabase, unavailable: true },
  );
  assert.equal((unavailable.robots as { index: boolean }).index, false);
});

test('detail descriptions summarize providers once and retain empty/stale distinctions in five languages', () => {
  const item = sample();
  const original = item.snapshot.offers[0];
  assert.ok(original);
  item.snapshot.market = 'de';
  item.snapshot.offers = fixtureProviders.flatMap((provider) =>
    ['subscription', 'rent', 'buy'].map((type) => ({
      ...original,
      id: `${provider.id}:${type}`,
      market: 'de',
      provider,
      type: type as 'subscription' | 'rent' | 'buy',
      expiresOn: null,
    })),
  );
  for (const locale of locales) {
    const fresh = streamingDescription(item, locale, 'de');
    assert.equal(fresh.match(/Netflix/g)?.length, 1);
    assert.equal(fresh.match(/Prime Video/g)?.length, 1);
    assert.ok(!fresh.includes('Apple TV'));
    assert.ok(fresh.includes('Cineradar'));
    assert.ok(!fresh.endsWith('…'));
    item.snapshot.freshness = 'stale';
    assert.notEqual(streamingDescription(item, locale, 'de'), fresh);
    item.snapshot.freshness = 'fresh';
  }
  item.snapshot.offers = [];
  item.snapshot.availability = 'empty';
  const empty = streamingDescription(item, 'en', 'de');
  item.snapshot.availability = 'error';
  assert.notEqual(streamingDescription(item, 'en', 'de'), empty);
});

test('US country grammar is correct and every location token resolves across the 25 contexts', () => {
  const expected = {
    de: 'in den Vereinigten Staaten',
    fr: 'aux États-Unis',
    it: 'negli Stati Uniti',
    es: 'en Estados Unidos',
    en: 'in the United States',
  };
  for (const locale of locales)
    for (const market of markets) {
      const copy = pageCopy(locale, countryName(locale, market), 'home');
      assert.doesNotMatch(JSON.stringify(copy), /\{(?:country|label)\}/);
      if (market === 'us')
        assert.ok(copy.description?.includes(expected[locale]), locale);
    }
  assert.match(
    pageCopy('en', 'United States', 'home').title,
    /for the United States/,
  );
  assert.match(
    pageCopy('de', 'Vereinigte Staaten', 'home').title,
    /für die Vereinigten Staaten/,
  );
  assert.match(
    pageCopy('en', 'United States', 'movies').description || '',
    /movies/,
  );
});

test('404 fallback metadata is localized, noindex and has no misleading canonical', () => {
  for (const locale of locales) {
    const missing = fallbackMetadata(locale, true);
    assertShare(missing);
    assert.equal((missing.robots as { index: boolean }).index, false);
    assert.equal(missing.alternates?.canonical, null);
    assert.equal(missing.alternates?.languages, undefined);
    assert.ok(missing.openGraph?.images);
    assert.equal(
      new URL(
        (missing.openGraph.images as { url: string }[])[0].url,
      ).searchParams.get('page'),
      'notFound',
    );
  }
});

test('long original titles retain a smaller readable share-image font', () => {
  assert.equal(ogTitleFontSize('Lucifer'), 72);
  assert.ok(ogTitleFontSize('A'.repeat(174)) < ogTitleFontSize('A'.repeat(61)));
  assert.ok(ogTitleFontSize('A'.repeat(174)) >= 18);
});

test('provider lookup distinguishes confirmed empty data from a temporary database failure', async () => {
  const empty: Database = {
    async query() {
      return { rows: [] };
    },
  };
  const failed: Database = {
    async query() {
      throw new Error('unavailable');
    },
  };
  assert.deepEqual(await providerStatus('de', empty), {
    items: [],
    unavailable: false,
  });
  assert.deepEqual(await providerStatus('de', failed), {
    items: [],
    unavailable: true,
  });
});

test('real catalogue pages use their own canonical and localized page number in title and description', async () => {
  for (const locale of locales) {
    const first = await metadata(
      locale,
      defaultMarkets[locale],
      'movies',
      null,
      false,
      '',
      1,
      undefined,
      { database: landingDatabase },
    );
    const second = await metadata(
      locale,
      defaultMarkets[locale],
      'movies',
      null,
      false,
      '',
      2,
      undefined,
      { database: landingDatabase },
    );
    assert.equal(
      new URL(second.alternates?.canonical as string).search,
      '?page=2',
    );
    assert.notEqual(second.title, first.title);
    assert.notEqual(second.description, first.description);
    assert.match(second.description || '', /^[^.]*2\./);
    assert.equal((second.robots as { index: boolean }).index, true);
    assert.equal(
      second.alternates?.languages?.[
        `${locale}-${defaultMarkets[locale].toUpperCase()}`
      ],
      second.alternates?.canonical,
    );
  }
});

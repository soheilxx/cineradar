import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visitorContext } from '../lib/visitor-context';
import { markets, defaultMarkets } from '../i18n/config';
import { fixtureCatalog } from './fixtures/catalog';
import { streamingContent, meaningfulTitle } from '../seo/content';
import { catalogCard } from '../domain/cards';
import { filterSchema } from '../lib/catalog-filters';

test('Visitor routing respects saved choices, weighted language and US English default', () => {
  const base = { markets: [...markets] };
  assert.deepEqual(
    visitorContext({
      ...base,
      languages: 'fr-FR;q=0.5,de-DE;q=0.9,en;q=0.1',
      country: 'FR',
    }),
    { locale: 'de', market: 'fr' },
  );
  assert.deepEqual(
    visitorContext({ ...base, languages: 'en-GB,en;q=0.9', country: 'DE' }),
    { locale: 'en', market: 'us' },
  );
  assert.equal(defaultMarkets.en, 'us');
  assert.deepEqual(
    visitorContext({ ...base, languages: 'en', country: 'US', saved: 'it.es' }),
    { locale: 'it', market: 'es' },
  );
  assert.deepEqual(visitorContext({ ...base, locale: 'en', saved: 'de.fr' }), {
    locale: 'en',
    market: 'us',
  });
  assert.deepEqual(
    visitorContext({ ...base, languages: 'de-CH', country: 'CH' }),
    { locale: 'de', market: 'de' },
  );
  assert.deepEqual(
    visitorContext({ ...base, languages: 'it;q=0,es-ES;q=0.7' }),
    { locale: 'es', market: 'es' },
  );
});

test('Title answers use actual country offers, distinguish free from subscriptions and omit unknown HD', () => {
  const item = structuredClone(
    fixtureCatalog().find((x) => x.snapshot.market === 'de')!,
  );
  const source = item.snapshot.offers[0];
  item.snapshot.offers = [
    {
      ...source,
      type: 'subscription',
      quality: null,
      provider: { ...source.provider, name: 'Paid Stream' },
      expiresOn: null,
    },
    {
      ...source,
      id: 'foreign',
      market: 'us',
      type: 'free',
      provider: { ...source.provider, name: 'Foreign Free' },
    },
  ];
  item.snapshot.availability = 'available';
  item.snapshot.freshness = 'fresh';
  const content = streamingContent(item, 'en', 'de');
  assert.match(content.answer, /Paid Stream/);
  assert.doesNotMatch(JSON.stringify(content), /Foreign Free|\bHD\b/);
  assert.match(content.questions[0].body, /no free/i);
  assert.match(content.description, new RegExp(String(item.title.year)));
  item.snapshot.freshness = 'stale';
  assert.notEqual(streamingContent(item, 'en', 'de').answer, content.answer);
});

test('Rental-only titles retain their provider on compact cards; indexability is per language', () => {
  const item = structuredClone(fixtureCatalog()[0]);
  item.snapshot.offers = item.snapshot.offers
    .slice(0, 1)
    .map((o) => ({ ...o, type: 'rent', expiresOn: null }));
  const card = catalogCard(item, 'en');
  assert.equal(card.providers.length, 1);
  assert.equal(card.providers[0].id, item.snapshot.offers[0].provider.id);
  item.title.localizations.fr.overview = '';
  item.title.cast = [];
  item.title.localizations.en.overview =
    'A pilot travels beyond the solar system to find a new home for humanity.';
  assert.equal(meaningfulTitle(item, 'fr'), false);
  assert.equal(meaningfulTitle(item, 'en'), true);
});

test('Catalog paging validates bounds and preserves provider/type/order filters', () => {
  assert.equal(filterSchema.safeParse({ page: '0' }).success, false);
  assert.equal(filterSchema.safeParse({ page: '1001' }).success, false);
  assert.equal(filterSchema.safeParse({ sort: 'arbitrary' }).success, false);
  assert.deepEqual(
    filterSchema.parse({
      page: '2',
      type: 'tv',
      provider: 'netflix',
      sort: 'latest',
      locale: 'en',
    }),
    { page: 2, type: 'tv', provider: 'netflix', sort: 'latest' },
  );
});

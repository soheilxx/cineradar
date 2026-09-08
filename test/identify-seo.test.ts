import test from 'node:test';
import assert from 'node:assert/strict';
import { locales, markets, defaultMarkets } from '../i18n/config';
import { path, routeFor } from '../i18n/routes';
import { identifyEditorial } from '../content/identify-editorial';
import {
  identifyAlternates,
  identifyMetadata,
  identifySchema,
  identifySitemapEntries,
} from '../seo/identify';

const origin = 'https://cineradar.tv';
function production(run: () => void) {
  const previous = { ...process.env };
  Object.assign(process.env, {
    APP_MODE: 'live',
    DEPLOYMENT_ENV: 'production',
    SITE_URL: origin,
    ENABLED_MARKETS: 'de,fr,it,es,us',
    DATABASE_URL: 'postgres://unused',
    TMDB_READ_ACCESS_TOKEN: 'unused',
    SAA_API_KEY: 'unused',
    SESSION_SECRET: 'a'.repeat(40),
    ADMIN_KEY: 'b'.repeat(30),
    OPERATOR_NAME: 'Test',
    OPERATOR_ADDRESS: 'Test',
    CONTACT_EMAIL: 'test@example.com',
    LEGAL_APPROVED: 'true',
    LICENSES_CONFIRMED: 'true',
    SYNC_ENABLED: 'false',
  });
  try {
    run();
  } finally {
    process.env = previous;
  }
}
test('description recognition has distinct localized routes in all 25 contexts', () => {
  const expected = {
    de: 'titel-finden',
    fr: 'retrouver-un-titre',
    it: 'trova-titolo',
    es: 'encontrar-titulo',
    en: 'find-title',
  };
  for (const locale of locales)
    for (const market of markets) {
      assert.equal(
        path(locale, market, 'identify'),
        `/${locale}/${market}/${expected[locale]}/`,
      );
      assert.equal(routeFor(locale, expected[locale]), 'identify');
      assert.notEqual(
        path(locale, market, 'identify'),
        path(locale, market, 'finder'),
      );
    }
});
test('five substantive editorial translations share the promised content contract', () => {
  for (const locale of locales) {
    const copy = identifyEditorial[locale];
    for (const key of [
      'headline',
      'introduction',
      'seoTitle',
      'metaDescription',
      'privacyNotice',
      'browserVoiceNotice',
      'aiNotice',
    ] as const)
      assert.ok(copy[key].trim().length > 20, `${locale}:${key}`);
    assert.equal(copy.steps.length, 3);
    assert.equal(copy.faq.length, 5);
    assert.equal(copy.examples.length, 3);
    for (const example of copy.examples)
      assert.ok(example.length >= 15 && example.length <= 1600);
    assert.ok(
      copy.faq.every(
        (entry) => entry.question.length > 10 && entry.answer.length > 40,
      ),
    );
  }
});
test('only preferred language variants enter the sitemap, with reciprocal language references', () => {
  const entries = identifySitemapEntries(origin, [...markets]);
  assert.equal(entries.length, 5);
  const valid = new Set(entries.map((entry) => entry.url));
  const alternates = identifyAlternates(origin, [...markets]);
  assert.equal(alternates.en, origin + '/en/us/find-title/');
  for (const entry of entries) {
    assert.equal(
      entry.market,
      defaultMarkets[entry.locale as keyof typeof defaultMarkets],
    );
    assert.ok(entry.indexable && entry.sitemapEligible);
    assert.equal(entry.entity, 'feature:identify');
    assert.ok(entry.segment.startsWith('landings-'));
    assert.deepEqual(entry.alternates, alternates);
    for (const target of Object.values(entry.alternates))
      assert.ok(valid.has(target));
  }
  const limited = identifySitemapEntries(origin, ['de', 'us']);
  assert.deepEqual(
    limited.map((entry) => entry.locale),
    ['de', 'en'],
  );
  assert.equal(Object.keys(limited[0].alternates).length, 2);
});
test('feature metadata uses preferred canonicals and generic share data; query variants are noindex', () =>
  production(() => {
    for (const locale of locales) {
      const clean = identifyMetadata(locale);
      const query = identifyMetadata(locale, true);
      assert.equal(
        clean.alternates?.canonical,
        origin + path(locale, defaultMarkets[locale], 'identify'),
      );
      assert.deepEqual(
        clean.alternates?.languages,
        identifyAlternates(origin, [...markets]),
      );
      assert.equal((clean.robots as { index: boolean }).index, true);
      assert.equal((query.robots as { index: boolean }).index, false);
      assert.equal(query.alternates?.languages, undefined);
      assert.equal(clean.title, identifyEditorial[locale].seoTitle);
      assert.equal(clean.description, query.description);
      assert.ok(JSON.stringify(clean.openGraph).includes('page=identify'));
      const schema = identifySchema(locale);
      assert.equal(schema.url, clean.alternates?.canonical);
      assert.equal(schema.inLanguage, locale);
    }
  }));

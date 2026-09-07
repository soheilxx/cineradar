import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visitorContext, visitorCountry } from '../lib/visitor-context';
import { markets } from '../i18n/config';

const base = { markets: [...markets] };

test('A new visitor with German country data receives Germany even with an English browser', () => {
  for (const languages of [
    'en-US,en;q=0.9',
    'en-GB,en;q=0.9,de;q=0.1',
    'fr-FR',
    '',
    null,
  ]) {
    const country = visitorCountry(
      new Headers({ 'x-vercel-ip-country': 'DE' }),
      'vercel',
    );
    assert.deepEqual(visitorContext({ ...base, country, languages }), {
      locale: 'de',
      market: 'de',
    });
  }
});

test('Supported country markets precede browser language for first visits', () => {
  for (const [country, locale, market] of [
    ['DE', 'de', 'de'],
    ['FR', 'fr', 'fr'],
    ['IT', 'it', 'it'],
    ['ES', 'es', 'es'],
    ['US', 'en', 'us'],
    [' de ', 'de', 'de'],
  ]) {
    assert.deepEqual(
      visitorContext({ ...base, country, languages: 'en-US,de-DE;q=0.9' }),
      { locale, market },
    );
  }
});

test('A valid saved pair overrides geography; malformed or disabled pairs do not', () => {
  for (const saved of ['en.us', 'en.de', 'fr.it', 'de.fr']) {
    const [locale, market] = saved.split('.');
    assert.deepEqual(
      visitorContext({ ...base, country: 'DE', languages: 'de-DE', saved }),
      { locale, market },
    );
  }
  for (const saved of [
    'en.zz',
    'xx.us',
    'en.us.extra',
    'en',
    'en.US',
    '',
    'en.us;other=value',
  ]) {
    assert.deepEqual(
      visitorContext({ ...base, country: 'DE', languages: 'en-US', saved }),
      { locale: 'de', market: 'de' },
    );
  }
});

test('Missing or unsupported geography uses weighted browser language and English US fallback', () => {
  for (const country of [
    null,
    undefined,
    '',
    'GB',
    'CH',
    'XX',
    'T1',
    'DE,US',
  ]) {
    assert.deepEqual(
      visitorContext({ ...base, country, languages: 'en-GB,en;q=0.9' }),
      { locale: 'en', market: 'us' },
    );
    assert.deepEqual(
      visitorContext({
        ...base,
        country,
        languages: 'fr-FR;q=0.5,de-DE;q=0.9',
      }),
      { locale: 'de', market: 'de' },
    );
  }
  assert.deepEqual(
    visitorContext({ ...base, languages: 'it;q=0,es-ES;q=0.7' }),
    { locale: 'es', market: 'es' },
  );
  assert.deepEqual(
    visitorContext({ ...base, languages: 'en;q=nope,fr;q=0.8' }),
    { locale: 'fr', market: 'fr' },
  );
  assert.deepEqual(visitorContext(base), { locale: 'en', market: 'us' });
  assert.deepEqual(
    visitorContext({
      markets: ['fr', 'us'],
      country: 'DE',
      languages: 'fr-FR',
    }),
    { locale: 'fr', market: 'fr' },
  );
});

test('Explicit English selection remains US while matching saved market choices are respected', () => {
  assert.deepEqual(
    visitorContext({
      ...base,
      locale: 'en',
      country: 'DE',
      languages: 'de-DE',
      saved: 'de.de',
    }),
    { locale: 'en', market: 'us' },
  );
  assert.deepEqual(
    visitorContext({ ...base, locale: 'en', country: 'DE', saved: 'en.us' }),
    { locale: 'en', market: 'us' },
  );
  assert.deepEqual(
    visitorContext({ ...base, locale: 'en', country: 'US', saved: 'en.de' }),
    { locale: 'en', market: 'de' },
  );
});

test('Only the active hosting platform supplies country data; client IP headers are never inferred', () => {
  const headers = new Headers({
    'x-vercel-ip-country': 'DE',
    'cf-ipcountry': 'US',
    'x-forwarded-for': '203.0.113.10',
    'x-real-ip': '203.0.113.11',
  });
  assert.equal(visitorCountry(headers, 'vercel'), 'de');
  assert.equal(visitorCountry(headers, 'cloudflare'), 'us');
  assert.equal(visitorCountry(headers, 'other'), null);
  headers.delete('x-vercel-ip-country');
  assert.equal(
    visitorCountry(headers, 'vercel'),
    null,
    'Do not fall back to a foreign provider header',
  );
  for (const malformed of ['DE, US', 'DE\nUS', 'Germany', 'D3']) {
    const get = () => malformed;
    assert.equal(visitorCountry({ get }, 'vercel'), null);
  }
});

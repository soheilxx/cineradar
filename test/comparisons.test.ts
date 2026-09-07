import test from 'node:test';
import assert from 'node:assert/strict';
import { locales } from '../i18n/config';
import {
  comparisonIds,
  comparisonPath,
  comparisonRoute,
} from '../content/comparisons/routes';
import { comparisons } from '../content/comparisons';
import { comparisonMetadata } from '../seo/comparisons';
test('short editorial routes do not consume locale entries or market catalog routes', () => {
  const urls = new Set<string>();
  for (const locale of locales)
    for (const id of [undefined, ...comparisonIds]) {
      const path = comparisonPath(locale, id);
      urls.add(path);
      assert.deepEqual(comparisonRoute(path), {
        locale,
        ...(id ? { id } : {}),
      });
      assert.deepEqual(comparisonRoute(path + '/'), comparisonRoute(path));
      assert.ok(!path.endsWith('/'));
    }
  assert.equal(urls.size, 55);
  for (const path of [
    '/',
    '/fr/',
    '/en/us/',
    '/de/de/filme/',
    '/fr/fr/film/dune-438631/',
    '/de/wer-streamt-es',
    '/fr/unknown',
    '/unknown',
    '/fr/justwatch/extra',
  ])
    assert.equal(comparisonRoute(path), null, path);
});
test('all comparison translations have reciprocal self-canonicals and complete evidence', () => {
  assert.equal(comparisons.length, 10);
  for (const item of comparisons) {
    assert.ok(item.claims.length >= 2);
    for (const locale of locales) {
      const meta = comparisonMetadata(locale, item.id);
      const expected = new URL(
        comparisonPath(locale, item.id),
        'http://localhost:3000',
      ).pathname;
      assert.equal(typeof meta.alternates?.canonical, 'string');
      assert.equal(
        new URL(meta.alternates?.canonical as string).pathname,
        expected,
      );
      assert.equal(
        meta.alternates?.languages?.[locale],
        meta.alternates?.canonical,
      );
      assert.equal(Object.keys(meta.alternates?.languages || {}).length, 5);
      for (const field of [
        'intro',
        'focus',
        'decision',
        'question',
        'answer',
      ] as const)
        assert.ok(item[field][locale].trim().length > 10);
      for (const claim of item.claims) {
        assert.ok(claim.text[locale]);
        assert.ok(claim.scope[locale]);
        assert.match(claim.source, /^https:\/\//);
        assert.match(claim.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
      }
    }
  }
});

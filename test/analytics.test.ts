import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyticsPage,
  analyticsReferrer,
  CONSENT_KEY,
  CONSENT_TTL,
  currentConsent,
  getConsent,
  parseConsent,
  sanitizeAnalyticsParams,
  setAnalyticsPublisher,
  setConsent,
  subscribeConsent,
  subscribePageRestores,
  trackEvent,
} from '../lib/analytics';
import { locales } from '../i18n/config';
import { path } from '../i18n/routes';
import { comparisonIds, comparisonPath } from '../content/comparisons/routes';

class MemoryStorage {
  values = new Map<string, string>();
  failRead = false;
  failWrite = false;
  getItem(key: string) {
    if (this.failRead) throw new Error('Storage access blocked');
    return this.values.get(key) || null;
  }
  setItem(key: string, value: string) {
    if (this.failWrite) throw new Error('Storage quota exceeded');
    this.values.set(key, value);
  }
}
function storageEvent(target: EventTarget, key: string | null = CONSENT_KEY) {
  const event = new Event('storage');
  Object.defineProperty(event, 'key', { value: key });
  target.dispatchEvent(event);
}
function browser(
  run: (target: EventTarget & { localStorage: MemoryStorage }) => void,
) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const target = Object.assign(new EventTarget(), {
    localStorage: new MemoryStorage(),
  });
  Object.defineProperty(globalThis, 'window', {
    value: target,
    configurable: true,
  });
  const unsubscribe = subscribeConsent(() => {});
  storageEvent(target, null);
  try {
    run(target);
  } finally {
    setAnalyticsPublisher(null);
    target.localStorage.values.clear();
    storageEvent(target, null);
    unsubscribe();
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}
function consent(value: string, at = Date.now(), version = 1) {
  return JSON.stringify({ version, value, at });
}

test('Consent parser rejects future, expired, malformed and unknown decisions', () => {
  const now = Date.now();
  assert.equal(parseConsent(consent('granted', now), now), 'granted');
  assert.equal(parseConsent(consent('denied', now), now), 'denied');
  assert.equal(
    parseConsent(consent('granted', now - CONSENT_TTL + 1), now),
    'granted',
  );
  for (const value of [
    null,
    'undefined',
    '{bad',
    'true',
    consent('granted', now - CONSENT_TTL),
    consent('granted', now + 1),
    consent('granted', now, 2),
    consent('unknown', now),
    JSON.stringify({ version: 1, value: 'granted', at: String(now) }),
  ])
    assert.equal(parseConsent(value, now), null);
});

test('Analytics has no pre-consent backlog, ignores unknown events and stops immediately on withdrawal', () => {
  browser(() => {
    const published: { name: string; params: unknown }[] = [];
    setAnalyticsPublisher((name, params) => published.push({ name, params }));
    trackEvent('ui_click', { control: 'before_choice' });
    assert.equal(published.length, 0);
    setConsent(true);
    assert.equal(
      published.length,
      0,
      'Granting consent does not replay earlier events',
    );
    trackEvent('ui_click', {
      control: 'watchlist_toggle',
      email: 'private@example.com',
    });
    trackEvent('arbitrary_event', { control: 'watchlist_toggle' });
    assert.deepEqual(published, [
      { name: 'ui_click', params: { control: 'watchlist_toggle' } },
    ]);
    setConsent(false);
    trackEvent('ui_click', { control: 'after_withdrawal' });
    assert.equal(currentConsent(), 'denied');
    assert.equal(published.length, 1);
    setConsent(true);
    setAnalyticsPublisher(null);
    trackEvent('ui_click', { control: 'publisher_unavailable' });
    const resumed: string[] = [];
    setAnalyticsPublisher((name) => resumed.push(name));
    assert.equal(
      resumed.length,
      0,
      'Unavailable publisher does not queue events',
    );
  });
});

test('Scene recognition and voice events never forward descriptions, transcripts or audio', () => {
  browser(() => {
    const published: { name: string; params: unknown }[] = [];
    setAnalyticsPublisher((name, params) => published.push({ name, params }));
    const params = {
      locale: 'de',
      market: 'de',
      query_length: 81,
      description: 'Private memory with name@example.com',
      transcript: 'Private voice transcript',
      audio: 'data:audio/webm;base64,private',
    };
    trackEvent('identify_submit', params);
    trackEvent('voice_result', params);
    assert.equal(published.length, 0);
    setConsent(true);
    trackEvent('identify_submit', params);
    trackEvent('voice_result', params);
    assert.deepEqual(
      published,
      ['identify_submit', 'voice_result'].map((name) => ({
        name,
        params: { locale: 'de', market: 'de', query_length: 81 },
      })),
    );
    setConsent(false);
    trackEvent('identify_confirm', { title_id: 'tv:63174' });
    assert.equal(published.length, 2);
  });
});

test('Analytics publisher failures cannot interrupt a visitor action', () => {
  browser(() => {
    setConsent(true);
    setAnalyticsPublisher(() => {
      throw new Error('Analytics transport unavailable');
    });
    let completed = false;
    assert.doesNotThrow(() => {
      trackEvent('contact_submit', { form_id: 'contact' });
      completed = true;
    });
    assert.equal(completed, true);
  });
});

test('Only a BFCache pageshow restarts page measurement and cleanup removes the listener', () => {
  browser((target) => {
    let restores = 0;
    const unsubscribe = subscribePageRestores(() => restores++);
    const show = (persisted: boolean) => {
      const event = new Event('pageshow');
      Object.defineProperty(event, 'persisted', { value: persisted });
      target.dispatchEvent(event);
    };
    show(false);
    assert.equal(
      restores,
      0,
      'Normal initial pageshow must not duplicate the initial view',
    );
    show(true);
    assert.equal(restores, 1);
    show(true);
    assert.equal(
      restores,
      2,
      'A later back/forward restore is another page visit',
    );
    unsubscribe();
    show(true);
    assert.equal(restores, 2);
  });
});

test('Withdrawal overrides an old stored grant even when persistence fails', () => {
  browser((target) => {
    target.localStorage.values.set(CONSENT_KEY, consent('granted'));
    assert.equal(getConsent(), 'granted');
    target.localStorage.failWrite = true;
    setConsent(false);
    assert.equal(getConsent(), 'denied');
    const sent: string[] = [];
    setAnalyticsPublisher((name) => sent.push(name));
    trackEvent('ui_click');
    assert.equal(sent.length, 0);
    target.localStorage.failRead = true;
    assert.equal(currentConsent(), 'denied');
    setConsent(true);
    assert.equal(
      currentConsent(),
      'granted',
      'Explicit current-page choice works with blocked persistence',
    );
  });
});

test('In-memory and persistent consent expire at the same boundary', () => {
  browser(() => {
    const originalNow = Date.now;
    const started = originalNow();
    let now = started;
    Date.now = () => now;
    try {
      setConsent(true);
      now = started + CONSENT_TTL - 1;
      assert.equal(currentConsent(), 'granted');
      now++;
      assert.equal(getConsent(), null);
      assert.equal(currentConsent(), null);
      const sent: string[] = [];
      setAnalyticsPublisher((name) => sent.push(name));
      trackEvent('ui_click');
      assert.equal(sent.length, 0);
    } finally {
      Date.now = originalNow;
    }
  });
});

test('Cross-tab changes replace local consent and unsubscribe removes listeners', () => {
  browser((target) => {
    let notifications = 0;
    const unsubscribe = subscribeConsent(() => notifications++);
    setConsent(true);
    assert.equal(notifications, 1);
    target.localStorage.values.set(CONSENT_KEY, consent('denied'));
    storageEvent(target);
    assert.equal(notifications, 2);
    assert.equal(currentConsent(), 'denied');
    storageEvent(target, 'cineradar:watchlist');
    assert.equal(notifications, 2);
    target.localStorage.values.clear();
    storageEvent(target, null);
    assert.equal(getConsent(), null);
    assert.equal(notifications, 3);
    unsubscribe();
    storageEvent(target);
    assert.equal(notifications, 3);
  });
});

test('Parameter allowlist removes personal fields, URLs and invalid numbers without dropping valid zero/false', () => {
  assert.deepEqual(
    sanitizeAnalyticsParams({
      title_id: 'tv:63174',
      provider_id: 'netflix',
      media_type: 'tv',
      selected: false,
      query_length: 0,
      result_count: 50,
      offer_price: 3.99,
      position: 1,
      email: 'person@example.com',
      name: 'Private Person',
      message: 'Contact contents',
      search_term: 'private search',
      query: 'private search',
      page_location: 'https://example.com/?email=person@example.com',
      page_referrer: 'https://example.com/?secret=1',
      url: 'https://example.com/private',
      source: 'person@example.com',
      filter_value: 'https://example.com/',
      control: 'Private Person',
      duration_ms: Number.NaN,
      season_number: -1,
      episode_number: Number.POSITIVE_INFINITY,
      selected_count: 1e20,
      status: 'a'.repeat(65),
    }),
    {
      title_id: 'tv:63174',
      provider_id: 'netflix',
      media_type: 'tv',
      selected: false,
      query_length: 0,
      result_count: 50,
      offer_price: 3.99,
      position: 1,
      selected_count: 1e10,
    },
  );
  for (const title_id of [
    '63174',
    'tv:0',
    'tv:abc',
    'movie:123?private',
    'tv:12345678901234',
  ])
    assert.deepEqual(sanitizeAnalyticsParams({ title_id }), {});
});

test('Page context retains only recognized route families and numeric title identities in every language', () => {
  for (const locale of locales) {
    for (const kind of ['movie', 'tv'] as const) {
      const original =
        path(locale, 'de', kind, 'private-person-email-63174') +
        '?q=person%40example.com#contact-details';
      const page = analyticsPage(original);
      assert.equal(page.page_type, kind);
      assert.equal(page.title_id, `${kind}:63174`);
      assert.equal(page.locale, locale);
      assert.equal(page.market, 'de');
      assert.equal(page.path, path(locale, 'de', kind, '63174'));
      assert.doesNotMatch(
        JSON.stringify(page),
        /private|person|email|contact|\?|#/,
      );
    }
    for (const route of [
      'home',
      'search',
      'movies',
      'series',
      'providers',
      'topics',
      'contact',
      'privacy',
      'ops',
    ] as const) {
      const page = analyticsPage(path(locale, 'de', route) + '?q=private');
      assert.equal(page.page_type, route);
      assert.equal(page.path, path(locale, 'de', route));
    }
    for (const id of [undefined, ...comparisonIds]) {
      const page = analyticsPage(comparisonPath(locale, id) + '?q=private');
      assert.equal(page.comparison_id, id);
      assert.equal(page.path, comparisonPath(locale, id) + '/');
    }
  }
  assert.equal(
    analyticsPage('/de/de/anbieter/private-account/').path,
    '/de/de/anbieter/',
  );
  assert.equal(
    analyticsPage('/de/de/film/private-person/').title_id,
    undefined,
  );
  for (const input of [
    '/private-person',
    '/de/zz/suche/?q=private',
    '/de/de/private-person/?q=private',
  ])
    assert.deepEqual(analyticsPage(input), {
      path: '/unrecognized/',
      locale: 'en',
      page_type: 'other',
    });
});

test('Referrers exclude query, fragment, credentials and arbitrary paths', () => {
  const origin = 'https://cineradar.tv';
  assert.equal(
    analyticsReferrer(
      'https://google.com/search?q=person@example.com#private',
      origin,
    ),
    'https://google.com/',
  );
  assert.equal(
    analyticsReferrer(
      'https://person:secret@outside.example/private/profile?q=secret',
      origin,
    ),
    'https://outside.example/',
  );
  assert.equal(
    analyticsReferrer(origin + '/de/de/suche/?q=person@example.com', origin),
    origin + '/de/de/suche/',
  );
  assert.equal(
    analyticsReferrer(
      origin + '/de/de/serie/private-person-63174/?token=abc',
      origin,
    ),
    origin + '/de/de/serie/63174/',
  );
  for (const input of [
    '',
    'not a URL',
    'javascript:alert(1)',
    'mailto:person@example.com',
  ])
    assert.equal(analyticsReferrer(input, origin), '');
});

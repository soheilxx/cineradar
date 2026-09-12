import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Database } from '../data/db';
import type { Episode, EpisodeShow } from '../domain/episodes';
import { calendarView } from '../data/repositories/calendar-view';
import { calendarMetadata, calendarSitemapEntries } from '../seo/calendar';
import { locales, defaultMarkets } from '../i18n/config';
import { fixtureCatalog } from './fixtures/catalog';

const saved = { ...process.env };
const origin = 'https://cineradar.test';
const episode: Episode = {
  id: 1,
  showId: 1,
  name: 'A new episode',
  season: 2,
  number: 3,
  type: 'regular',
  airDate: '2026-09-13',
  airTime: '20:00',
  airStamp: '2026-09-13T20:00:00Z',
  runtime: 45,
  summary: 'An episode summary.',
  url: 'https://www.tvmaze.com/episodes/1',
};
const show: EpisodeShow & { type: string } = {
  id: 1,
  name: 'A series',
  type: 'Scripted',
  url: 'https://www.tvmaze.com/shows/1',
  status: 'Running',
  networkName: 'Network',
  country: 'us',
  timezone: 'America/New_York',
  distribution: 'country',
};
const sample = () => ({
  episode: { ...episode },
  show: { ...show },
  title: structuredClone(fixtureCatalog()[0].title),
});
const records = (rows: ReturnType<typeof sample>[]): Database => ({
  query: async <T>() => ({ rows: structuredClone(rows) as T[] }),
});
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
    TVMAZE_ENABLED: 'true',
    ENABLED_MARKETS: 'de,fr,it,es,us',
    SYNC_ENABLED: 'false',
  });
});
after(restoreEnv);

test('Published calendar metadata and sitemap entries share canonical URLs and reciprocal hreflang', async () => {
  const database = records([sample()]);
  const entries = await calendarSitemapEntries(database, origin);
  assert.equal(entries.length, 5);
  const published = new Set(entries.map((entry) => entry.url));
  for (const locale of locales) {
    const entry = entries.find((candidate) => candidate.locale === locale)!;
    const meta = await calendarMetadata(locale, defaultMarkets[locale], false, {
      database,
    });
    assert.equal(meta.robots.index, true);
    assert.equal(meta.alternates.canonical, entry.url);
    assert.equal(meta.openGraph?.url, entry.url);
    assert.deepEqual(meta.alternates.languages, entry.alternates);
    assert.equal(meta.alternates.languages?.[locale], entry.url);
    for (const url of Object.values(entry.alternates))
      assert.equal(published.has(url), true);
  }
});

test('Filtered and secondary-market calendars are noindex and emit no hreflang', async () => {
  const database = records([sample()]);
  for (const locale of locales) {
    const canonical = await calendarMetadata(
      locale,
      defaultMarkets[locale],
      false,
      { database },
    );
    const filtered = await calendarMetadata(
      locale,
      defaultMarkets[locale],
      true,
      { database },
    );
    const alternateMarket = defaultMarkets[locale] === 'us' ? 'de' : 'us';
    const duplicate = await calendarMetadata(locale, alternateMarket, false, {
      database,
    });
    for (const meta of [filtered, duplicate]) {
      assert.equal(meta.robots.index, false);
      assert.equal(meta.robots.googleBot.index, false);
      assert.equal(meta.alternates.languages, undefined);
      assert.equal(meta.alternates.canonical, canonical.alternates.canonical);
    }
  }
});

test('Disabled markets cannot be indexed or advertised as calendar alternates', async () => {
  process.env.ENABLED_MARKETS = 'us';
  const database = records([sample()]);
  const entries = await calendarSitemapEntries(database, origin);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].locale, 'en');
  const english = await calendarMetadata('en', 'us', false, { database });
  const german = await calendarMetadata('de', 'de', false, { database });
  assert.equal(english.robots.index, true);
  assert.deepEqual(english.alternates.languages, entries[0].alternates);
  assert.deepEqual(Object.keys(english.alternates.languages!), ['en']);
  assert.equal(german.robots.index, false);
  assert.equal(german.alternates.languages, undefined);
});

test('Empty calendars are absent from sitemaps and cannot assert indexable alternate pages', async () => {
  const database = records([]);
  assert.deepEqual(await calendarSitemapEntries(database, origin), []);
  for (const locale of locales) {
    const meta = await calendarMetadata(locale, defaultMarkets[locale], false, {
      database,
    });
    assert.equal(meta.robots.index, false);
    assert.equal(meta.alternates.languages, undefined);
  }
});

test('Provider disabling and preview deployment suppress calendar publication', async () => {
  const forbidden: Database = {
    query: async () => {
      throw new Error('Disabled publication must not read the DB');
    },
  };
  process.env.TVMAZE_ENABLED = 'false';
  assert.equal(await calendarView('de', forbidden), null);
  assert.deepEqual(await calendarSitemapEntries(forbidden, origin), []);
  const disabled = await calendarMetadata('de', 'de', false, {
    database: forbidden,
  });
  assert.equal(disabled.robots.index, false);
  assert.equal(disabled.alternates.languages, undefined);
  process.env.TVMAZE_ENABLED = 'true';
  process.env.DEPLOYMENT_ENV = 'preview';
  process.env.LEGAL_APPROVED = 'false';
  process.env.LICENSES_CONFIRMED = 'false';
  assert.deepEqual(await calendarSitemapEntries(forbidden, origin), []);
  const preview = await calendarMetadata('de', 'de', false, {
    database: records([sample()]),
  });
  assert.equal(preview.robots.index, false);
  assert.equal(preview.alternates.languages, undefined);
});

test('A calendar DB failure gives noindex metadata and aborts sitemap rebuilding instead of publishing emptiness', async () => {
  const database: Database = {
    query: async () => {
      throw new Error('Database unavailable');
    },
  };
  assert.equal(await calendarView('de', database), null);
  const meta = await calendarMetadata('de', 'de', false, { database });
  assert.equal(meta.robots.index, false);
  assert.equal(meta.alternates.languages, undefined);
  await assert.rejects(
    calendarSitemapEntries(database, origin),
    /Database unavailable/,
  );
});

test('Calendar revisions change with displayed episode numbers and localized title links', async () => {
  const original = sample();
  const before = await calendarSitemapEntries(records([original]), origin);
  const changedEpisode = structuredClone(original);
  changedEpisode.episode.season++;
  changedEpisode.episode.number!++;
  const renumbered = await calendarSitemapEntries(
    records([changedEpisode]),
    origin,
  );
  assert.notEqual(before[0].revision, renumbered[0].revision);
  const changedTitle = structuredClone(original);
  changedTitle.title.localizations.de.slug = 'updated-source-title';
  changedTitle.title.localizations.de.title = 'Neuer Serientitel';
  const relinked = await calendarSitemapEntries(
    records([changedTitle]),
    origin,
  );
  assert.notEqual(
    before.find((row) => row.locale === 'de')!.revision,
    relinked.find((row) => row.locale === 'de')!.revision,
  );
  assert.equal(
    before.find((row) => row.locale === 'en')!.revision,
    relinked.find((row) => row.locale === 'en')!.revision,
  );
});

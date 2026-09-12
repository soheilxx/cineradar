import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarContent } from '../ui/episode-calendar';
import {
  TVMAZE_SOURCE,
  type UpcomingEpisode,
  type UpcomingEpisodes,
} from '../domain/episodes';
import { locales, defaultMarkets, type Locale } from '../i18n/config';
import { path } from '../i18n/routes';
import { fixtureCatalog } from './fixtures/catalog';

const now = new Date('2026-09-12T22:30:00Z');
const mappedTitle = fixtureCatalog().find(
  (item) => item.title.type === 'tv',
)!.title;

function row(
  id: number,
  name: string,
  overrides: Partial<UpcomingEpisode['episode']> = {},
): UpcomingEpisode {
  return {
    episode: {
      id,
      showId: id,
      name: 'Episode ' + id,
      season: 2,
      number: 1,
      type: 'regular',
      airDate: '2026-09-13',
      airTime: '20:30',
      airStamp: '2026-09-13T00:30:00Z',
      runtime: 42,
      summary: '',
      url: `https://www.tvmaze.com/episodes/${id}`,
      ...overrides,
    },
    show: {
      id,
      name,
      url: `https://www.tvmaze.com/shows/${id}`,
      status: 'Running',
      networkName: 'Example Network',
      country: 'us',
      timezone: 'America/New_York',
      distribution: 'country',
    },
    title: null,
    marketRelation: 'original',
    source: TVMAZE_SOURCE,
  };
}

function render(
  rows: UpcomingEpisode[],
  locale: Locale = 'de',
  market = defaultMarkets[locale],
) {
  const data: UpcomingEpisodes = {
    episodes: rows,
    source: TVMAZE_SOURCE,
    days: 14,
    market,
    truncated: false,
  };
  return renderToStaticMarkup(
    createElement(CalendarContent, { locale, market, data, now }),
  );
}

const anchors = (html: string) =>
  [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>[\s\S]*?<\/a>/g)].map(
    (match) => ({ href: match[1], html: match[0] }),
  );
const articles = (html: string) =>
  html.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) || [];

test('Calendar titles stay on Cineradar and every day-navigation link resolves to a labelled section', () => {
  for (const locale of locales) {
    const mapped = { ...row(1, 'Mapped source title'), title: mappedTitle };
    const html = render([mapped, row(2, 'Unmapped Series')], locale);
    const cards = articles(html);
    assert.equal(cards.length, 2, locale);
    // Standalone Next Link rendering does not load next.config's trailingSlash.
    assert.deepEqual(
      anchors(cards[0]!).map((link) => link.href.replace(/\/$/, '')),
      [
        path(
          locale,
          defaultMarkets[locale],
          'tv',
          mappedTitle.localizations[locale].slug,
        ).replace(/\/$/, ''),
      ],
      locale,
    );
    assert.match(cards[1]!, /Unmapped Series/, locale);
    assert.equal(anchors(cards[1]!).length, 0, locale);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(ids.length, new Set(ids).size, locale);
    for (const link of anchors(html)) {
      if (link.href.startsWith('#'))
        assert.ok(
          ids.includes(link.href.slice(1)),
          `${locale}: unresolved day link`,
        );
      else {
        const host = new URL(link.href, 'https://cineradar.test').hostname;
        assert.doesNotMatch(
          host,
          /(?:^|\.)(?:tvmaze\.com|omdbapi\.com|themoviedb\.org|tmdb\.org|movieofthenight\.com)$/i,
          locale,
        );
      }
    }
    for (const match of html.matchAll(/aria-labelledby="([^"]+)"/g))
      for (const id of match[1].split(/\s+/))
        assert.ok(ids.includes(id), `${locale}: unresolved section heading`);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, locale);
  }
});

test('Only the first regular episode can advertise a season premiere', () => {
  const cards = articles(
    render([
      row(1, 'Regular Premiere'),
      row(2, 'Special Premiere', { type: 'significant_special' }),
      row(3, 'Another Episode', { number: 2 }),
      row(4, 'Special Season', { season: 0 }),
    ]),
  );
  assert.equal(cards.length, 4);
  assert.match(cards[0]!, /Staffelstart/);
  for (const card of cards.slice(1)) assert.doesNotMatch(card, /Staffelstart/);
});

test('A date-only announcement never displays the provider placeholder as an exact release time', () => {
  const announcement = row(1, 'Date-only Series', {
    airTime: null,
    airStamp: '2026-09-13T12:00:00Z',
  });
  for (const [locale, market] of [
    ['de', 'de'],
    ['en', 'us'],
  ] as const) {
    const html = render([announcement], locale, market);
    assert.equal((html.match(/<article\b/g) || []).length, 1);
    assert.doesNotMatch(articles(html)[0]!, /<time\b/);
    assert.match(html, /id="day-2026-09-13"/);
    assert.match(
      html,
      /<time dateTime="2026-09-13">|<time datetime="2026-09-13">/,
    );
  }
});

test('A midnight-crossing broadcast belongs to the selected country’s calendar day and Today label', () => {
  const episode = row(1, 'Midnight Series');
  const german = render([episode], 'de', 'de');
  const american = render([episode], 'en', 'us');
  assert.match(german, /id="day-2026-09-13"/);
  assert.match(american, /id="day-2026-09-12"/);
  assert.match(german, /id="heading-2026-09-13">Heute/);
  assert.match(american, /id="heading-2026-09-12">Today/);
  assert.equal(articles(german).length, 1);
  assert.equal(articles(american).length, 1);
  assert.match(articles(german)[0]!, /02:30/);
  assert.match(articles(american)[0]!, /(?:08:30|8:30)\s*PM|20:30/);
});

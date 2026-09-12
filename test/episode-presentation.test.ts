import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Episode } from '../domain/episodes';
import { episodeDate, episodeDay, exactEpisodeTime } from '../ui/episode-dates';
import { calendarMetadata } from '../seo/calendar';
import { path } from '../i18n/routes';
import { locales, defaultMarkets } from '../i18n/config';

const episode: Episode = {
  id: 1,
  showId: 1,
  name: 'Pilot',
  season: 1,
  number: 1,
  type: 'regular',
  airDate: '2026-09-12',
  airTime: null,
  airStamp: '2026-09-12T12:00:00Z',
  runtime: 40,
  summary: '',
  url: 'https://www.tvmaze.com/episodes/1/pilot',
};
test('date-only releases do not invent a time from TVmaze noon placeholders', () => {
  assert.equal(exactEpisodeTime(episode), false);
  assert.equal(episodeDay(episode, 'us'), '2026-09-12');
  assert.equal(episodeDay(episode, 'de'), '2026-09-12');
  assert.equal(episodeDate(episode, 'de', 'de'), '12.09.2026');
});
test('known times use their actual broadcast day in the selected zone', () => {
  const early = {
    ...episode,
    airTime: '01:00',
    airStamp: '2026-09-13T01:00:00Z',
  };
  assert.equal(episodeDay(early, 'us'), '2026-09-12');
  assert.equal(episodeDay(early, 'de'), '2026-09-13');
  assert.match(episodeDate(early, 'de', 'de'), /03:00/);
  const lateBroadcast = {
    ...early,
    airDate: '2026-09-11',
    airStamp: '2026-09-12T08:00:00Z',
  };
  assert.equal(episodeDay(lateBroadcast, 'us'), '2026-09-12');
});
test('unknown dates remain unknown and every calendar has a localized canonical route', async () => {
  assert.equal(
    episodeDate({ ...episode, airDate: null, airStamp: null }, 'de', 'de'),
    'Termin offen',
  );
  const previous = process.env.TVMAZE_ENABLED;
  process.env.TVMAZE_ENABLED = 'false';
  try {
    for (const locale of locales) {
      const meta = await calendarMetadata(locale, 'de', false);
      assert.ok(
        String(meta.alternates?.canonical).endsWith(
          path(locale, defaultMarkets[locale], 'calendar'),
        ),
      );
      assert.ok(meta.description && meta.description.length > 60);
      assert.equal((meta.robots as { index: boolean }).index, false);
    }
  } finally {
    if (previous === undefined) delete process.env.TVMAZE_ENABLED;
    else process.env.TVMAZE_ENABLED = previous;
  }
});

import type { Episode } from '../domain/episodes';
import type { Locale } from '../i18n/config';
import { episodeCopy, calendarZones } from '../content/episodes';

export function exactEpisodeTime(episode: Episode) {
  return Boolean(
    episode.airTime &&
    episode.airStamp &&
    Number.isFinite(Date.parse(episode.airStamp)),
  );
}
export function episodeDay(episode: Episode, market: string) {
  if (!exactEpisodeTime(episode)) return episode.airDate || '';
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: calendarZones[market] || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(episode.airStamp!));
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join('-');
}
export function episodeDate(episode: Episode, locale: Locale, market: string) {
  if (exactEpisodeTime(episode))
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: calendarZones[market] || 'UTC',
    }).format(new Date(episode.airStamp!));
  if (episode.airDate && /^\d{4}-\d{2}-\d{2}$/.test(episode.airDate))
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(episode.airDate + 'T12:00:00Z'));
  return episodeCopy.tba[locale];
}

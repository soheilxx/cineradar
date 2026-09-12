import { CalendarDays, ArrowUpRight } from 'lucide-react';
import { calendarView } from '@/data/repositories/calendar-view';
import { episodeCopy as c, calendarZones } from '@/content/episodes';
import type { Locale } from '@/i18n/config';
import { countryName } from '@/i18n/config';
import { path } from '@/i18n/routes';
import { t } from '@/i18n/messages';
import { AppLink } from './app-link';
import { EpisodeSource } from './episode-guide';
import { episodeDay, exactEpisodeTime } from './episode-dates';

export async function EpisodeCalendar({
  locale,
  market,
}: {
  locale: Locale;
  market: string;
}) {
  const data = await calendarView(market);
  const episodes = data?.episodes || [];
  const zone = calendarZones[market] || 'UTC';
  const groups = new Map<string, typeof episodes>();
  for (const item of episodes) {
    const date = episodeDay(item.episode, market);
    const rows = groups.get(date) || [];
    rows.push(item);
    groups.set(date, rows);
  }
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow gold">
          <CalendarDays size={18} /> Cineradar
        </p>
        <h1>{c.title[locale]}</h1>
        <p>{c.intro[locale]}</p>
      </div>
      <div className="calendar-toolbar">
        <span>{countryName(locale, market)}</span>
        <span>
          {c.times[locale]}: {zone}
        </span>
        <AppLink className="text-link" href={path(locale, market, 'series')}>
          {t(locale, 'series')} <ArrowUpRight size={16} />
        </AppLink>
      </div>
      <div className="episode-calendar">
        {episodes.length === 0 ? (
          <p className="empty-state">{c.empty[locale]}</p>
        ) : (
          [...groups.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, rows]) => (
              <section className="calendar-day" key={day}>
                <h2>
                  {day
                    ? new Intl.DateTimeFormat(locale, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        timeZone: 'UTC',
                      }).format(new Date(day + 'T12:00:00Z'))
                    : c.tba[locale]}
                </h2>
                <div className="calendar-episodes">
                  {rows.map(({ episode, show, title, marketRelation }) => (
                    <article className="calendar-episode" key={episode.id}>
                      <div className="calendar-time">
                        <time
                          dateTime={
                            (exactEpisodeTime(episode)
                              ? episode.airStamp
                              : episode.airDate) || undefined
                          }
                        >
                          {exactEpisodeTime(episode)
                            ? new Intl.DateTimeFormat(locale, {
                                timeStyle: 'short',
                                timeZone: zone,
                              }).format(new Date(episode.airStamp!))
                            : '—'}
                        </time>
                        <span>{show.networkName}</span>
                      </div>
                      <div>
                        <h3>
                          <AppLink
                            href={
                              title
                                ? path(
                                    locale,
                                    market,
                                    'tv',
                                    title.localizations[locale].slug,
                                  )
                                : show.url
                            }
                          >
                            {title?.localizations[locale].title || show.name}
                          </AppLink>
                        </h3>
                        <p>
                          {t(locale, 'season', { number: episode.season })}
                          {episode.number !== null
                            ? ` · E${episode.number}`
                            : ''}{' '}
                          · {episode.name}
                        </p>
                        <p className="calendar-origin">
                          {marketRelation === 'global'
                            ? c.global[locale]
                            : c.original[locale]}
                          {show.country
                            ? ` · ${countryName(locale, show.country.toLowerCase())}`
                            : ''}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
        )}
      </div>
      <section className="calendar-editorial">
        <h2>{c.next[locale]}</h2>
        <p>{c.scope[locale]}</p>
        <p>{c.intro[locale]}</p>
        {data?.truncated && (
          <AppLink href="https://www.tvmaze.com/calendar">
            {c.complete[locale]} <ArrowUpRight size={16} />
          </AppLink>
        )}
        <EpisodeSource locale={locale} />
      </section>
    </>
  );
}

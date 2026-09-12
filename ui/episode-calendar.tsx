import { CalendarDays, ArrowUpRight, Clock3, Sparkles, Tv } from 'lucide-react';
import { calendarView } from '@/data/repositories/calendar-view';
import { episodeCopy as c, calendarZones } from '@/content/episodes';
import { calendarCopy as copy } from '@/content/calendar';
import type { UpcomingEpisodes } from '@/domain/episodes';
import type { Locale } from '@/i18n/config';
import { countryName } from '@/i18n/config';
import { path } from '@/i18n/routes';
import { t } from '@/i18n/messages';
import { AppLink } from './app-link';
import { Artwork } from './artwork';
import { EpisodeSource } from './episode-guide';
import { episodeDay, exactEpisodeTime } from './episode-dates';

export async function EpisodeCalendar({
  locale,
  market,
}: {
  locale: Locale;
  market: string;
}) {
  return (
    <CalendarContent
      locale={locale}
      market={market}
      data={await calendarView(market)}
    />
  );
}

export function CalendarContent({
  locale,
  market,
  data,
  now = new Date(),
}: {
  locale: Locale;
  market: string;
  data: UpcomingEpisodes | null;
  now?: Date;
}) {
  const episodes = data?.episodes || [];
  const zone = calendarZones[market] || 'UTC';
  const dateParts = new Intl.DateTimeFormat('en', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const today = ['year', 'month', 'day']
    .map((type) => dateParts.find((part) => part.type === type)!.value)
    .join('-');
  // Increment the local calendar date without assuming a 24-hour DST day.
  const tomorrow = new Date(Date.parse(today + 'T12:00:00Z') + 86400000)
    .toISOString()
    .slice(0, 10);
  const dayDate = (day: string) => new Date(day + 'T12:00:00Z');
  const dayLabel = (day: string) =>
    day === today
      ? copy.today[locale]
      : day === tomorrow
        ? copy.tomorrow[locale]
        : new Intl.DateTimeFormat(locale, {
            weekday: 'long',
            timeZone: 'UTC',
          }).format(dayDate(day));
  const groups = new Map<string, typeof episodes>();
  for (const item of episodes) {
    const day = episodeDay(item.episode, market);
    const rows = groups.get(day) || [];
    rows.push(item);
    groups.set(day, rows);
  }
  const days = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  const count = (n: number) => new Intl.NumberFormat(locale).format(n);
  const countLabel = (n: number) =>
    `${count(n)} ${n === 1 ? copy.episodeSingular[locale] : copy.episodeCount[locale]}`;
  return (
    <div className="calendar-page">
      <header className="calendar-hero">
        <div className="calendar-hero-copy">
          <p className="eyebrow gold">
            <CalendarDays size={17} aria-hidden="true" />{' '}
            {copy.schedule[locale]}
          </p>
          <h1>{copy.title[locale]}</h1>
          <p className="calendar-intro">{copy.intro[locale]}</p>
          <div className="calendar-context">
            <span>
              <Clock3 size={14} aria-hidden="true" /> {zone}
            </span>
            <span>{countryName(locale, market)}</span>
          </div>
        </div>
        <div className="calendar-date-art" aria-hidden="true">
          <span>
            {new Intl.DateTimeFormat(locale, {
              month: 'long',
              timeZone: zone,
            }).format(now)}
          </span>
          <strong>
            {new Intl.DateTimeFormat(locale, {
              day: '2-digit',
              timeZone: zone,
            }).format(now)}
          </strong>
          <span>
            {copy.today[locale]} <i />
          </span>
        </div>
      </header>

      {days.length > 0 && (
        <nav
          className="calendar-day-nav"
          aria-label={copy.dayNavigation[locale]}
        >
          {days.map(([day, rows]) => (
            <a
              key={day}
              href={`#day-${day || 'tba'}`}
              className={day === today ? 'is-today' : undefined}
            >
              <span>{day ? dayLabel(day) : c.tba[locale]}</span>
              <strong>
                {day
                  ? new Intl.DateTimeFormat(locale, {
                      day: '2-digit',
                      month: 'short',
                      timeZone: 'UTC',
                    }).format(dayDate(day))
                  : '—'}
              </strong>
              <small>{countLabel(rows.length)}</small>
            </a>
          ))}
        </nav>
      )}

      <div className="calendar-schedule-heading">
        <p>
          <span className="calendar-live-dot" />
          {countLabel(episodes.length)}
        </p>
        <AppLink className="text-link" href={path(locale, market, 'series')}>
          {copy.discoverSeries[locale]}{' '}
          <ArrowUpRight size={16} aria-hidden="true" />
        </AppLink>
      </div>
      <div className="episode-calendar">
        {episodes.length === 0 ? (
          <div className="calendar-empty">
            <CalendarDays size={36} aria-hidden="true" />
            <p>{c.empty[locale]}</p>
          </div>
        ) : (
          days.map(([day, rows]) => (
            <section
              className="calendar-day"
              id={`day-${day || 'tba'}`}
              key={day}
              aria-labelledby={`heading-${day || 'tba'}`}
            >
              <div className="calendar-day-heading">
                <div className="calendar-day-number" aria-hidden="true">
                  {day ? day.slice(-2) : '—'}
                </div>
                <h2 id={`heading-${day || 'tba'}`}>
                  {day ? dayLabel(day) : c.tba[locale]}
                  {day && (
                    <time dateTime={day}>
                      {new Intl.DateTimeFormat(locale, {
                        day: 'numeric',
                        month: 'long',
                        timeZone: 'UTC',
                      }).format(dayDate(day))}
                    </time>
                  )}
                </h2>
                <span>{countLabel(rows.length)}</span>
              </div>
              <div className="calendar-episodes">
                {rows.map(({ episode, show, title, marketRelation }) => {
                  const name = title?.localizations[locale].title || show.name;
                  const premiere =
                    episode.type === 'regular' &&
                    episode.number === 1 &&
                    episode.season > 0;
                  return (
                    <article
                      className={`calendar-episode${premiere ? ' is-premiere' : ''}`}
                      key={episode.id}
                    >
                      <div className="calendar-cover" aria-hidden="true">
                        {title?.poster ? (
                          <Artwork
                            src={title.poster}
                            artwork={title.artwork?.poster}
                            alt=""
                            width="68"
                            height="102"
                            loading="lazy"
                          />
                        ) : (
                          <div className="calendar-cover-type">
                            <Tv size={17} />
                            <span>
                              {Array.from(name)
                                .slice(0, 2)
                                .join('')
                                .toLocaleUpperCase(locale)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="calendar-episode-body">
                        <div className="calendar-card-top">
                          {exactEpisodeTime(episode) && (
                            <time dateTime={episode.airStamp || undefined}>
                              <Clock3 size={13} aria-hidden="true" />
                              {new Intl.DateTimeFormat(locale, {
                                timeStyle: 'short',
                                timeZone: zone,
                              }).format(new Date(episode.airStamp!))}
                            </time>
                          )}
                          {show.networkName && (
                            <span className="calendar-network">
                              {show.networkName}
                            </span>
                          )}
                          {premiere && (
                            <span className="calendar-premiere">
                              <Sparkles size={11} aria-hidden="true" />
                              {copy.premiere[locale]}
                            </span>
                          )}
                        </div>
                        <h3>
                          {title ? (
                            <AppLink
                              href={path(
                                locale,
                                market,
                                'tv',
                                title.localizations[locale].slug,
                              )}
                              data-analytics-title-id={title.id}
                              data-analytics-media-type="tv"
                            >
                              {name}
                              <ArrowUpRight size={15} aria-hidden="true" />
                            </AppLink>
                          ) : (
                            name
                          )}
                        </h3>
                        <p className="calendar-episode-name">
                          <span>
                            {t(locale, 'season', { number: episode.season })}
                            {episode.number !== null
                              ? ` · E${episode.number}`
                              : ''}
                          </span>
                          {episode.name}
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
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      <section
        className="calendar-editorial"
        aria-labelledby="calendar-guide-heading"
      >
        <div className="calendar-editorial-intro">
          <p className="eyebrow gold">Cineradar</p>
          <h2 id="calendar-guide-heading">{copy.editorialHeading[locale]}</h2>
          <p>{copy.editorialIntro[locale]}</p>
          <AppLink className="text-link" href={path(locale, market, 'series')}>
            {copy.discoverSeries[locale]}{' '}
            <ArrowUpRight size={16} aria-hidden="true" />
          </AppLink>
        </div>
        <div className="calendar-editorial-details">
          <h3>{copy.howHeading[locale]}</h3>
          <p>{copy.howText[locale]}</p>
          <h3>{copy.availabilityHeading[locale]}</h3>
          <p>{copy.availabilityText[locale]}</p>
        </div>
      </section>
      <section className="calendar-faq" aria-labelledby="calendar-faq-heading">
        <h2 id="calendar-faq-heading">{copy.faqHeading[locale]}</h2>
        {copy.faqs.map((faq, index) => (
          <details key={index}>
            <summary>
              {faq.question[locale]}
              <span aria-hidden="true">+</span>
            </summary>
            <p>{faq.answer[locale]}</p>
          </details>
        ))}
      </section>
      <EpisodeSource locale={locale} />
    </div>
  );
}

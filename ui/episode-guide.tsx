import { cache } from 'react';
import { CalendarDays, ArrowUpRight } from 'lucide-react';
import { getEpisodeGuide } from '@/data/repositories/episodes';
import { getEnrichment } from '@/data/repositories/enrichment';
import { TVMAZE_SOURCE } from '@/domain/episodes';
import type { Locale } from '@/i18n/config';
import { countryName } from '@/i18n/config';
import { t } from '@/i18n/messages';
import { path } from '@/i18n/routes';
import { config } from '@/lib/config';
import { episodeCopy as c, calendarZones } from '@/content/episodes';
import { AppLink } from './app-link';
import { episodeDate, exactEpisodeTime } from './episode-dates';

const readGuide = cache(getEpisodeGuide);
export function EpisodeSource({
  locale,
  url = TVMAZE_SOURCE.url,
}: {
  locale: Locale;
  url?: string;
}) {
  return (
    <p className="episode-source">
      {c.source[locale]}: TVmaze ·{' '}
      <AppLink href={TVMAZE_SOURCE.licenseUrl}>{TVMAZE_SOURCE.license}</AppLink>
      <span className="source-uri">{url}</span>
      <span>{c.adapted[locale]}</span>
    </p>
  );
}
export async function TitleEpisodeGuide({
  titleId,
  locale,
  market,
}: {
  titleId: string;
  locale: Locale;
  market: string;
}) {
  if (!config().tvmazeEnabled) return null;
  const guide = await readGuide(titleId).catch(() => null);
  if (!guide || (!guide.updatedAt && !guide.nextEpisode)) return null;
  const next = guide.nextEpisode;
  const preferredSeason = next?.season ?? guide.seasons.at(-1)?.number;
  return (
    <section className="section episode-guide" id="episodes">
      <div className="episode-next">
        <CalendarDays size={26} aria-hidden="true" />
        <div>
          <p className="eyebrow gold">{c.next[locale]}</p>
          {next ? (
            <>
              <h2>{next.name}</h2>
              <p>
                {t(locale, 'season', { number: next.season })}
                {next.number !== null ? ` · E${next.number}` : ''} ·{' '}
                <time
                  dateTime={
                    (exactEpisodeTime(next) ? next.airStamp : next.airDate) ||
                    undefined
                  }
                >
                  {episodeDate(next, locale, market)}
                </time>
              </p>
            </>
          ) : (
            <h2>{c.none[locale]}</h2>
          )}
          <p className="muted">
            {guide.show.networkName}
            {guide.show.country
              ? ` · ${countryName(locale, guide.show.country.toLowerCase())}`
              : ''}
            {guide.show.networkName ? ' · ' : ''}
            {c.original[locale]}
          </p>
        </div>
        <AppLink className="text-link" href={path(locale, market, 'calendar')}>
          {c.title[locale]} <ArrowUpRight size={16} />
        </AppLink>
      </div>
      <p className="episode-context">
        {c.scope[locale]} {c.times[locale]}: {calendarZones[market] || 'UTC'}.
      </p>
      <h2>{c.guide[locale]}</h2>
      <div className="season-list episode-seasons">
        {guide.seasons.map((season) => (
          <details key={season.number} open={season.number === preferredSeason}>
            <summary>
              {season.number === 0
                ? c.specials[locale]
                : t(locale, 'season', { number: season.number })}
              <span>{season.total}</span>
            </summary>
            <ol className="episode-list">
              {season.episodes.map((episode) => (
                <li key={episode.id}>
                  <span className="episode-number">
                    {episode.number === null
                      ? '—'
                      : String(episode.number).padStart(2, '0')}
                  </span>
                  <div>
                    <h3>{episode.name}</h3>
                    <time
                      dateTime={
                        (exactEpisodeTime(episode)
                          ? episode.airStamp
                          : episode.airDate) || undefined
                      }
                    >
                      {episodeDate(episode, locale, market)}
                    </time>
                    {episode.summary && <p>{episode.summary}</p>}
                  </div>
                  {episode.runtime ? (
                    <span className="episode-runtime">
                      {t(locale, 'minutes', { count: episode.runtime })}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
      <EpisodeSource locale={locale} url={guide.show.url} />
    </section>
  );
}
export async function TitleEnrichment({
  titleId,
  locale,
}: {
  titleId: string;
  locale: Locale;
}) {
  if (!config().omdbEnabled) return null;
  const data = await getEnrichment(titleId).catch(() => null);
  if (!data || (!data.ratings.length && !data.awards)) return null;
  return (
    <section className="section title-enrichment">
      {data.ratings.length > 0 && (
        <>
          <h2>{c.ratings[locale]}</h2>
          <dl className="source-ratings">
            {data.ratings.map((r) => (
              <div key={r.source}>
                <dt>
                  {r.source === 'Internet Movie Database' ? 'IMDb' : r.source}
                </dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {data.awards && (
        <>
          <h3>{c.awards[locale]}</h3>
          <p lang="en">{data.awards}</p>
        </>
      )}
      <p className="episode-source">
        OMDb ·{' '}
        <time dateTime={data.fetchedAt}>
          {new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeZone: 'UTC',
          }).format(new Date(data.fetchedAt))}
        </time>
      </p>
    </section>
  );
}

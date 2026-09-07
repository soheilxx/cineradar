'use client';
import { useState } from 'react';
import { ArrowUpRight, Check, Info } from 'lucide-react';
import type { Offer } from '@/domain/types';
import { lowestPrices, activeOffers } from '@/domain/offers';
import { t } from '@/i18n/messages';
import { type Locale, languageNames } from '@/i18n/config';
import { Choice } from './select';
import { trackEvent } from '@/lib/analytics';
export function OfferList({
  offers,
  locale,
  seasonMode = false,
  fixedSeason,
}: {
  offers: Offer[];
  locale: Locale;
  seasonMode?: boolean;
  fixedSeason?: number;
}) {
  const [type, setType] = useState('');
  const [audio, setAudio] = useState('');
  const [subs, setSubs] = useState('');
  const [quality, setQuality] = useState('');
  const [season, setSeason] = useState('');
  const rows = activeOffers(offers).filter(
    (o) =>
      (!type || o.type === type) &&
      (!audio || o.audio?.includes(audio)) &&
      (!subs || o.subtitles?.includes(subs)) &&
      (!quality || o.quality === quality) &&
      (fixedSeason !== undefined
        ? o.season === fixedSeason
        : season
          ? o.season === Number(season)
          : o.season === null),
  );
  const best = lowestPrices(rows);
  const all = { value: '', label: t(locale, 'all') };
  const languageOptions = [
    all,
    ...Object.entries(languageNames).map(([value, label]) => ({
      value,
      label,
    })),
  ];
  function changeFilter(
    name: string,
    value: string,
    update: (value: string) => void,
  ) {
    update(value);
    trackEvent('offer_filter_change', {
      title_id: offers[0]?.titleId,
      market: offers[0]?.market,
      filter_name: name,
      filter_value: value || 'all',
    });
  }
  return (
    <>
      <div className="offer-toolbar">
        <Choice
          label={t(locale, 'offerType')}
          value={type}
          onChange={(value) => changeFilter('offer_type', value, setType)}
          options={[
            all,
            ...(['subscription', 'addon', 'free', 'rent', 'buy'] as const).map(
              (value) => ({ value, label: t(locale, value) }),
            ),
          ]}
        />
        <Choice
          label={t(locale, 'quality')}
          value={quality}
          onChange={(value) => changeFilter('quality', value, setQuality)}
          options={[
            all,
            ...['sd', 'hd', 'qhd', 'uhd'].map((value) => ({
              value,
              label: value.toUpperCase(),
            })),
          ]}
        />
        <Choice
          label={t(locale, 'audio')}
          value={audio}
          onChange={(value) => changeFilter('audio', value, setAudio)}
          options={languageOptions}
        />
        <Choice
          label={t(locale, 'subtitles')}
          value={subs}
          onChange={(value) => changeFilter('subtitles', value, setSubs)}
          options={languageOptions}
        />
        {seasonMode && (
          <Choice
            label={t(locale, 'seasons')}
            value={season}
            onChange={(value) => changeFilter('season', value, setSeason)}
            options={[
              { value: '', label: t(locale, 'seriesUnit') },
              ...Array.from(
                new Set(offers.map((o) => o.season).filter((n) => n !== null)),
              )
                .sort((a, b) => a - b)
                .map((n) => ({
                  value: String(n),
                  label: t(locale, 'season', { number: n }),
                })),
            ]}
          />
        )}
      </div>
      <div className="offers-list">
        {rows.map((o) => (
          <article key={o.id} className="offer-card">
            <div className="offer-provider">
              {o.provider.logo ? (
                <img src={o.provider.logo} alt="" width="100" height="46" />
              ) : (
                <span className={'provider-word provider-' + o.provider.id}>
                  {o.provider.name}
                </span>
              )}
              <div>
                <h3>{o.provider.name}</h3>
                <p>
                  {t(locale, o.type)}
                  {o.addon && <> · {o.addon.name}</>}
                </p>
              </div>
            </div>
            <div className="offer-properties">
              {o.quality && (
                <span className="quality-badge">
                  {o.quality === 'uhd' ? '4K' : o.quality.toUpperCase()}
                </span>
              )}
              <span>
                {t(
                  locale,
                  o.unit === 'film'
                    ? 'filmUnit'
                    : o.unit === 'series'
                      ? 'seriesUnit'
                      : o.unit === 'season'
                        ? 'seasonUnit'
                        : 'episodeUnit',
                )}
                {o.season !== null && ` ${o.season}`}
                {o.episode !== null &&
                  ` · ${t(locale, 'episode', { number: o.episode })}`}
              </span>
              {!!o.audio?.length && (
                <small>
                  {t(locale, 'audio')}:{' '}
                  {o.audio
                    .map((l) => languageNames[l as Locale] || l)
                    .join(', ')}
                </small>
              )}
              {o.subtitles?.length ? (
                <small>
                  {t(locale, 'subtitles')}:{' '}
                  {o.subtitles
                    .map((l) => languageNames[l as Locale] || l)
                    .join(', ')}
                </small>
              ) : null}
            </div>
            <div className="offer-price">
              <strong>
                {o.price !== null && o.currency
                  ? new Intl.NumberFormat(locale, {
                      style: 'currency',
                      currency: o.currency,
                    }).format(Number(o.price))
                  : t(
                      locale,
                      o.type === 'free'
                        ? 'free'
                        : o.type === 'subscription'
                          ? 'subscription'
                          : o.type === 'addon'
                            ? 'addon'
                            : 'priceUnknown',
                    )}
              </strong>
              {best.has(o.id) && (
                <small className="gold">
                  <Check size={13} />
                  {t(locale, 'bestPrice')}
                </small>
              )}
              {o.expiresOn && (
                <small>
                  {t(locale, 'expires', {
                    date: new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeZone: 'UTC',
                    }).format(new Date(o.expiresOn)),
                  })}
                </small>
              )}
            </div>
            <a
              href={`/api/out/${encodeURIComponent(o.id)}/`}
              className="button primary"
              target="_blank"
              rel="noopener noreferrer"
              title={t(locale, 'external')}
              data-analytics-title-id={o.titleId}
              data-analytics-provider-id={o.provider.id}
              data-analytics-offer-type={o.type}
              data-analytics-quality={o.quality || undefined}
              data-analytics-currency={o.currency || undefined}
              data-analytics-value={o.price || undefined}
              data-analytics-season-number={o.season ?? undefined}
              data-analytics-episode-number={o.episode ?? undefined}
              data-analytics-unit={o.unit}
            >
              {t(locale, 'openProvider')}
              <ArrowUpRight size={17} />
            </a>
          </article>
        ))}
      </div>
      {!rows.length && (
        <div className="empty-state compact">
          <Info />
          <p>{t(locale, 'noResults')}</p>
          <button
            className="text-button"
            onClick={() => {
              setType('');
              setAudio('');
              setSubs('');
              setQuality('');
              setSeason('');
              trackEvent('offer_filter_reset', {
                title_id: offers[0]?.titleId,
                market: offers[0]?.market,
              });
            }}
          >
            {t(locale, 'reset')}
          </button>
        </div>
      )}
      <p className="offer-disclaimer">
        <Info size={15} />
        {t(locale, 'pictureHelp')} {t(locale, 'priceHelp')}{' '}
        {t(locale, 'external')}.
      </p>
    </>
  );
}

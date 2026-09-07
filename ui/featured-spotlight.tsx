'use client';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { t } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';
import { SaveButton } from './save-button';
import { imageSet } from '@/domain/artwork';
import { trackEvent } from '@/lib/analytics';
export interface FeaturedTitle {
  id: string;
  title: string;
  image: string;
  href: string;
  year: number | null;
  type: 'movie' | 'tv';
  genres: string;
  overview: string;
}
export function FeaturedSpotlight({
  items,
  locale,
  market,
}: {
  items: FeaturedTitle[];
  locale: Locale;
  market: string;
}) {
  const [active, setActive] = useState(0);
  const item = items[active];
  if (!item) return null;
  function change(index: number, direction: string) {
    setActive(index);
    trackEvent('spotlight_change', {
      title_id: items[index].id,
      media_type: items[index].type,
      position: index + 1,
      direction,
      market,
    });
  }
  return (
    <article className="spotlight">
      <img
        key={item.image}
        className="feature-image"
        src={item.image}
        srcSet={imageSet(item.image, [300, 780, 1280])}
        sizes="(max-width: 680px) 100vw, 65vw"
        alt=""
        width="1280"
        height="720"
        fetchPriority="high"
      />
      <div className="feature-gradient" />
      <div className="spotlight-top">
        <span className="film-label">{t(locale, 'trendingNow')}</span>
        <span className="feature-number">
          {String(active + 1).padStart(2, '0')} /{' '}
          {String(items.length).padStart(2, '0')}
        </span>
      </div>
      <div className="spotlight-copy">
        <p className="eyebrow">{item.genres}</p>
        <h2>
          <a
            href={item.href}
            data-analytics-title-id={item.id}
            data-analytics-source="spotlight"
            data-analytics-position={active + 1}
          >
            {item.title}
          </a>
        </h2>
        <p>
          {item.year} · {t(locale, item.type)}
        </p>
        <p className="spotlight-overview">{item.overview}</p>
        <div className="feature-actions">
          <a
            className="button primary"
            href={item.href}
            data-analytics-title-id={item.id}
            data-analytics-source="spotlight"
            data-analytics-position={active + 1}
          >
            {t(locale, 'offers')}
            <ArrowUpRight size={18} />
          </a>
          <SaveButton id={item.id} locale={locale} market={market} />
        </div>
      </div>
      <nav className="spotlight-controls" aria-label={t(locale, 'trendingNow')}>
        <button
          onClick={() =>
            change((active + items.length - 1) % items.length, 'previous')
          }
          aria-label={t(locale, 'previous')}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          {items.map((entry, index) => (
            <button
              key={entry.id}
              aria-label={entry.title}
              aria-pressed={active === index}
              onClick={() => change(index, 'direct')}
            >
              <span />
            </button>
          ))}
        </div>
        <button
          onClick={() => change((active + 1) % items.length, 'next')}
          aria-label={t(locale, 'next')}
        >
          <ArrowRight size={18} />
        </button>
      </nav>
    </article>
  );
}

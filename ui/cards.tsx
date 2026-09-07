import type { CatalogItem } from '@/domain/types';
import type { Locale } from '@/i18n/config';
import { t } from '@/i18n/messages';
import { path } from '@/i18n/routes';
import { SaveButton } from './save-button';
import { ArrowUpRight, Film } from 'lucide-react';
import { Artwork } from './artwork';
import { catalogCard, type CardItem } from '@/domain/cards';
export function titlePath(
  item: CatalogItem | CardItem,
  locale: Locale,
  market: string,
) {
  if ('slug' in item) return path(locale, market, item.type, item.slug);
  return path(
    locale,
    market,
    item.title.type,
    item.title.localizations[locale].slug,
  );
}
export function PosterCard({
  item,
  locale,
  market,
  index = 0,
}: {
  item: CatalogItem | CardItem;
  locale: Locale;
  market: string;
  index?: number;
}) {
  const card = 'slug' in item ? item : catalogCard(item, locale);
  const title = card.title;
  const providers = card.providers;
  return (
    <article
      className="poster-card"
      style={{ '--card-order': index } as React.CSSProperties}
    >
      <div className="poster-wrap">
        <a
          href={titlePath(item, locale, market)}
          aria-label={title}
          className="poster-link"
        >
          {card.poster ? (
            <Artwork
              src={card.poster}
              alt={title}
              width="500"
              height="750"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="poster-fallback">
              <Film />
              <span>{title}</span>
            </div>
          )}
          <span className="poster-arrow">
            <ArrowUpRight />
          </span>
        </a>
        <SaveButton id={card.id} locale={locale} market={market} compact />
        {card.rating !== null && (
          <span className="rating" title={t(locale, 'rating')}>
            ★{' '}
            {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
              card.rating,
            )}
          </span>
        )}
      </div>
      <a href={titlePath(item, locale, market)}>
        <h3>{title}</h3>
      </a>
      <p className="card-meta">
        {card.year} <span>·</span> {t(locale, card.type)}{' '}
        {card.runtime && (
          <>
            <span>·</span>
            {t(locale, 'minutes', { count: card.runtime })}
          </>
        )}
      </p>
      <div className="card-providers">
        {providers.length ? (
          providers.slice(0, 2).map((p) => <span key={p.id}>{p.name}</span>)
        ) : (
          <span>
            {t(
              locale,
              card.availability === 'empty' || card.availability === 'available'
                ? 'noOffers'
                : 'unchecked',
            )}
          </span>
        )}
      </div>
    </article>
  );
}
export function PosterGrid({
  items,
  locale,
  market,
}: {
  items: CatalogItem[];
  locale: Locale;
  market: string;
}) {
  return (
    <div className="poster-grid">
      {items.map((item, index) => (
        <PosterCard key={item.title.id} {...{ item, index, locale, market }} />
      ))}
    </div>
  );
}

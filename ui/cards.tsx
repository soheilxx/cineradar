import type { CatalogItem } from '@/domain/types';
import type { Locale } from '@/i18n/config';
import { t } from '@/i18n/messages';
import { path } from '@/i18n/routes';
import { SaveButton } from './save-button';
import { ArrowUpRight, Film } from 'lucide-react';
import { Artwork } from './artwork';
export function titlePath(item: CatalogItem, locale: Locale, market: string) {
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
  item: CatalogItem;
  locale: Locale;
  market: string;
  index?: number;
}) {
  const title = item.title.localizations[locale].title;
  const providers = [
    ...new Map(
      item.snapshot.offers
        .filter((o) => o.type === 'subscription' || o.type === 'free')
        .map((o) => [o.provider.id, o.provider]),
    ).values(),
  ];
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
          {item.title.poster ? (
            <Artwork
              src={item.title.poster}
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
        <SaveButton
          id={item.title.id}
          locale={locale}
          market={market}
          compact
        />
        {item.title.rating !== null && (
          <span className="rating" title={t(locale, 'rating')}>
            ★{' '}
            {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
              item.title.rating,
            )}
          </span>
        )}
      </div>
      <a href={titlePath(item, locale, market)}>
        <h3>{title}</h3>
      </a>
      <p className="card-meta">
        {item.title.year} <span>·</span> {t(locale, item.title.type)}{' '}
        {item.title.runtime && (
          <>
            <span>·</span>
            {t(locale, 'minutes', { count: item.title.runtime })}
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
              item.snapshot.availability === 'empty' ? 'noOffers' : 'unchecked',
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

import type { CatalogItem, Provider } from './types';
import type { Locale } from '../i18n/config';
import { activeOffers } from './offers';
import type { StoredArtwork } from './media';
export interface CardItem {
  id: string;
  title: string;
  slug: string;
  type: 'movie' | 'tv';
  year: number | null;
  runtime: number | null;
  poster: string | null;
  posterArtwork?: StoredArtwork;
  rating: number | null;
  providers: Pick<Provider, 'id' | 'name'>[];
  availability: CatalogItem['snapshot']['availability'];
}
export function catalogCard(item: CatalogItem, locale: Locale): CardItem {
  const offers = activeOffers(item.snapshot.offers);
  const included = offers.filter(
    (o) => o.type === 'subscription' || o.type === 'free',
  );
  return {
    id: item.title.id,
    title: item.title.localizations[locale].title,
    slug: item.title.localizations[locale].slug,
    type: item.title.type,
    year: item.title.year,
    runtime: item.title.runtime,
    poster: item.title.poster,
    ...(item.title.artwork?.poster
      ? { posterArtwork: item.title.artwork.poster }
      : {}),
    rating: item.title.rating,
    providers: [
      ...new Map(
        (included.length ? included : offers).map((o) => [
          o.provider.id,
          { id: o.provider.id, name: o.provider.name },
        ]),
      ).values(),
    ],
    availability: item.snapshot.availability,
  };
}

import type { Locale } from '../i18n/config';
import type { MediaKind, StoredArtwork } from './media';
export type MediaType = 'movie' | 'tv';
export type OfferType = 'subscription' | 'addon' | 'free' | 'rent' | 'buy';
export type Availability =
  | 'available'
  | 'empty'
  | 'unsupported'
  | 'unchecked'
  | 'error';
export type Freshness = 'fresh' | 'overdue' | 'stale' | 'unknown';
export type Genre =
  | 'action'
  | 'adventure'
  | 'comedy'
  | 'drama'
  | 'scifi'
  | 'thriller'
  | 'animation'
  | 'crime'
  | 'documentary'
  | 'fantasy'
  | 'family'
  | 'horror'
  | 'mystery'
  | 'romance';
export interface Localization {
  locale: Locale;
  title: string;
  overview: string;
  slug: string;
  source: 'tmdb' | 'translation' | 'facts' | 'editorial';
  sourceHash: string;
}
export interface Title {
  id: string;
  type: MediaType;
  tmdbId: number;
  saaId?: string;
  originalTitle: string;
  year: number | null;
  runtime: number | null;
  poster: string | null;
  backdrop: string | null;
  artwork?: Partial<Record<MediaKind, StoredArtwork>>;
  artworkRevision?: string;
  genres: Genre[];
  rating: number | null;
  votes: number;
  popularity?: number;
  popularityUpdatedAt?: string;
  cast: string[];
  seasons: { number: number; name: string; episodes: number | null }[];
  localizations: Record<Locale, Localization>;
  revision: string;
  indexable: boolean;
  fixture?: boolean;
}
export interface Provider {
  id: string;
  name: string;
  logo: string | null;
  url: string;
  types: OfferType[];
  addons: { id: string; name: string; logo: string | null }[];
}
export interface Offer {
  id: string;
  titleId: string;
  market: string;
  provider: Provider;
  type: OfferType;
  addon: { id: string; name: string } | null;
  link: string;
  quality: string | null;
  audio: string[] | null;
  subtitles: string[] | null;
  price: string | null;
  currency: string | null;
  unit: 'film' | 'series' | 'season' | 'episode';
  season: number | null;
  episode: number | null;
  availableSince: string | null;
  expiresOn: string | null;
  observedAt: string;
}
export interface Snapshot {
  titleId: string;
  market: string;
  availability: Availability;
  checkedAt: string | null;
  attemptAt: string | null;
  errorCode: string | null;
  freshness: Freshness;
  offers: Offer[];
  revision: string;
}
export interface Change {
  id: string;
  titleId: string;
  market: string;
  kind: 'added' | 'removed' | 'updated';
  provider: string;
  at: string;
}
export interface CatalogItem {
  title: Title;
  snapshot: Snapshot;
}
export interface Filters {
  q?: string;
  type?: MediaType;
  genre?: string;
  provider?: string;
  offerType?: OfferType;
  quality?: string;
  audio?: string;
  subtitles?: string;
  maxMinutes?: number;
  year?: number;
  sort?: 'relevance' | 'title' | 'year' | 'latest' | 'trending';
  page?: number;
  scope?: 'new' | 'leaving' | 'free' | 'finder';
  mine?: string[];
}

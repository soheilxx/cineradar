import type { Title } from './types';

export const TVMAZE_SOURCE = {
  name: 'TVmaze',
  url: 'https://www.tvmaze.com',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  changes: 'Normalized fields, plain-text summaries and UTC timestamps.',
} as const;

export interface Episode {
  id: number;
  showId: number;
  name: string;
  season: number;
  number: number | null;
  type: string;
  airDate: string | null;
  airTime: string | null;
  airStamp: string | null;
  runtime: number | null;
  summary: string;
  url: string;
}

export interface EpisodeShow {
  id: number;
  name: string;
  url: string;
  status: string;
  type?: string | null;
  networkName: string | null;
  country: string | null;
  timezone: string | null;
  distribution: 'country' | 'global' | 'unknown';
}

export interface EpisodeGuide {
  show: EpisodeShow;
  seasons: { number: number; total: number; episodes: Episode[] }[];
  nextEpisode: Episode | null;
  totalEpisodes: number;
  truncated: boolean;
  updatedAt: string | null;
  source: typeof TVMAZE_SOURCE;
}

export interface UpcomingEpisode {
  episode: Episode;
  show: EpisodeShow;
  title: Title | null;
  // A country's original broadcast or global channel is not a streaming offer.
  marketRelation: 'market' | 'global' | 'original';
  source: typeof TVMAZE_SOURCE;
}

export interface UpcomingEpisodes {
  episodes: UpcomingEpisode[];
  source: typeof TVMAZE_SOURCE;
  days: number;
  market: string;
  truncated: boolean;
}

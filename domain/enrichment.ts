import { z } from 'zod';

// Source data is deliberately separate from Title and its TMDB aggregate rating.
export const omdbDataSchema = z.object({
  source: z.literal('omdb'),
  sourceUrl: z.literal('https://www.omdbapi.com/'),
  imdbId: z.string().regex(/^tt\d{7,12}$/),
  type: z.enum(['movie', 'tv']),
  title: z.string().min(1).max(500),
  plot: z.string().max(30000).nullable(),
  runtimeMinutes: z.number().int().positive().max(10000).nullable(),
  awards: z.string().max(3000).nullable(),
  rated: z.string().max(100).nullable(),
  directors: z.array(z.string().max(500)).max(50),
  writers: z.array(z.string().max(500)).max(100),
  languages: z.array(z.string().max(100)).max(100),
  countries: z.array(z.string().max(100)).max(100),
  imdbRating: z.number().min(0).max(10).nullable(),
  imdbVotes: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .nullable(),
  metascore: z.number().int().min(0).max(100).nullable(),
  ratings: z
    .array(
      z.object({
        source: z.enum([
          'Internet Movie Database',
          'Rotten Tomatoes',
          'Metacritic',
        ]),
        value: z.string().max(20),
      }),
    )
    .max(3),
});

export type OmdbData = z.infer<typeof omdbDataSchema>;
export interface OmdbEnrichment extends OmdbData {
  fetchedAt: string;
  expiresAt: string;
  stale: boolean;
}

export interface OmdbJob {
  title_id: string;
  imdb_id: string;
  media_type: 'movie' | 'tv';
  attempts: number;
  lock_token: string;
}

export type OmdbFailure =
  | 'disabled'
  | 'auth'
  | 'missing'
  | 'quota'
  | 'budget'
  | 'timeout'
  | 'network'
  | 'upstream'
  | 'schema'
  | 'identity';

export class OmdbError extends Error {
  constructor(
    public code: OmdbFailure,
    public retryAfter = 0,
  ) {
    // Never retain upstream errors or request URLs: those can contain the API key.
    super(code);
    this.name = 'OmdbError';
  }
}

export const OMDB_REFRESH_DAYS = 30;

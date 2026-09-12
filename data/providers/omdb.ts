import { z } from 'zod';
import { config } from '../../lib/config';
import {
  omdbDataSchema,
  OmdbError,
  type OmdbData,
} from '../../domain/enrichment';
import type { MediaType } from '../../domain/types';

export interface OmdbReservation {
  allowed: boolean;
  retryAfter?: number;
}

const rawSchema = z.object({
  Response: z.literal('True'),
  imdbID: z.string().regex(/^tt\d{7,12}$/),
  Type: z.enum(['movie', 'series', 'episode']),
  Title: z.string().min(1).max(500),
  Plot: z.string().max(30000).optional(),
  Runtime: z.string().max(100).optional(),
  Awards: z.string().max(3000).optional(),
  Rated: z.string().max(100).optional(),
  Director: z.string().max(10000).optional(),
  Writer: z.string().max(20000).optional(),
  Language: z.string().max(10000).optional(),
  Country: z.string().max(10000).optional(),
  imdbRating: z.string().max(20).optional(),
  imdbVotes: z.string().max(30).optional(),
  Metascore: z.string().max(20).optional(),
  Ratings: z
    .array(
      z.object({ Source: z.string().max(100), Value: z.string().max(100) }),
    )
    .max(20)
    .optional(),
});

const clean = (value?: string) => {
  const text = value?.trim();
  return text && text.toUpperCase() !== 'N/A' ? text : null;
};
const list = (value?: string) =>
  clean(value)
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
function number(value: string | undefined, max: number, integer = false) {
  const text = clean(value)?.replaceAll(',', '');
  if (!text || !/^\d+(?:\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) && n <= max && (!integer || Number.isSafeInteger(n))
    ? n
    : null;
}

export function normalizeOmdb(
  data: unknown,
  imdbId: string,
  type: MediaType,
): OmdbData {
  const parsed = rawSchema.safeParse(data);
  if (!parsed.success) throw new OmdbError('schema');
  const raw = parsed.data;
  if (
    raw.imdbID !== imdbId ||
    raw.Type !== (type === 'tv' ? 'series' : 'movie')
  )
    throw new OmdbError('identity');
  if (!clean(raw.Title)) throw new OmdbError('schema');
  const imdbRating = number(raw.imdbRating, 10);
  const metascore = number(raw.Metascore, 100, true);
  const ratings: OmdbData['ratings'] = [];
  for (const rating of raw.Ratings ?? []) {
    if (ratings.some((item) => item.source === rating.Source)) continue;
    const value = clean(rating.Value);
    if (!value) continue;
    if (
      rating.Source === 'Internet Movie Database' &&
      /^\d+(?:\.\d+)?\/10$/.test(value) &&
      Number(value.split('/')[0]) <= 10
    )
      ratings.push({ source: rating.Source, value });
    if (
      rating.Source === 'Rotten Tomatoes' &&
      /^\d{1,3}%$/.test(value) &&
      Number(value.slice(0, -1)) <= 100
    )
      ratings.push({ source: rating.Source, value });
    if (
      rating.Source === 'Metacritic' &&
      /^\d{1,3}\/100$/.test(value) &&
      Number(value.split('/')[0]) <= 100
    )
      ratings.push({ source: rating.Source, value });
  }
  if (
    imdbRating !== null &&
    !ratings.some((item) => item.source === 'Internet Movie Database')
  )
    ratings.push({
      source: 'Internet Movie Database',
      value: `${imdbRating}/10`,
    });
  if (
    metascore !== null &&
    !ratings.some((item) => item.source === 'Metacritic')
  )
    ratings.push({ source: 'Metacritic', value: `${metascore}/100` });
  const runtime = clean(raw.Runtime)?.match(/^(\d+) min$/)?.[1];
  const runtimeMinutes = number(runtime, 10000, true);
  const result = omdbDataSchema.safeParse({
    source: 'omdb',
    sourceUrl: 'https://www.omdbapi.com/',
    imdbId,
    type,
    title: raw.Title.trim(),
    plot: clean(raw.Plot),
    runtimeMinutes:
      runtimeMinutes && runtimeMinutes > 0 ? runtimeMinutes : null,
    awards: clean(raw.Awards),
    rated: clean(raw.Rated),
    directors: list(raw.Director),
    writers: list(raw.Writer),
    languages: list(raw.Language),
    countries: list(raw.Country),
    imdbRating,
    imdbVotes: number(raw.imdbVotes, Number.MAX_SAFE_INTEGER, true),
    metascore,
    ratings,
  });
  if (!result.success) throw new OmdbError('schema');
  return result.data;
}

function retryAfter(value: string | null) {
  const delay =
    value && /^\d+$/.test(value)
      ? Number(value) * 1000
      : value
        ? Date.parse(value) - Date.now()
        : 0;
  return Number.isFinite(delay) ? Math.min(86400000, Math.max(0, delay)) : 0;
}

async function boundedJson(response: Response): Promise<unknown> {
  const maxBytes = 262144;
  const size = Number(response.headers.get('content-length'));
  if (size > maxBytes) {
    await response.body?.cancel();
    throw new OmdbError('schema');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new OmdbError('schema');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new OmdbError('schema');
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    throw new OmdbError('schema');
  }
}

export class OMDb {
  constructor(
    private reserve: () => Promise<OmdbReservation>,
    private fetcher: typeof fetch = fetch,
  ) {}

  async title(imdbId: string, type: MediaType): Promise<OmdbData> {
    const c = config();
    if (!c.omdbEnabled) throw new OmdbError('disabled');
    if (!/^tt\d{7,12}$/.test(imdbId) || !['movie', 'tv'].includes(type))
      throw new OmdbError('identity');
    const reservation = await this.reserve();
    if (!reservation.allowed)
      throw new OmdbError('budget', reservation.retryAfter);
    const url = new URL('https://www.omdbapi.com/');
    url.searchParams.set('apikey', c.OMDB_API_KEY!);
    url.searchParams.set('i', imdbId);
    url.searchParams.set('type', type === 'tv' ? 'series' : 'movie');
    url.searchParams.set('plot', 'full');
    url.searchParams.set('r', 'json');
    try {
      const response = await this.fetcher(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
        cache: 'no-store',
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new OmdbError(
          response.status === 429
            ? 'quota'
            : [401, 403].includes(response.status)
              ? 'auth'
              : response.status === 404
                ? 'missing'
                : 'upstream',
          retryAfter(response.headers.get('retry-after')),
        );
      }
      const data = await boundedJson(response);
      if (
        data &&
        typeof data === 'object' &&
        'Response' in data &&
        data.Response === 'False'
      ) {
        const error =
          'Error' in data && typeof data.Error === 'string' ? data.Error : '';
        throw new OmdbError(
          /api\s*key|apikey/i.test(error)
            ? 'auth'
            : /limit|quota|too many/i.test(error)
              ? 'quota'
              : /not found|incorrect imdb/i.test(error)
                ? 'missing'
                : 'upstream',
        );
      }
      return normalizeOmdb(data, imdbId, type);
    } catch (error) {
      if (error instanceof OmdbError) throw error;
      throw new OmdbError(
        error instanceof Error &&
          ['TimeoutError', 'AbortError'].includes(error.name)
          ? 'timeout'
          : 'network',
      );
    }
  }
}

import { z } from 'zod';
import type { Episode, EpisodeShow } from '../../domain/episodes';
import { ProviderError } from './http';

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const sourceUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 'www.tvmaze.com';
});
const country = z.object({
  code: z.string().regex(/^[A-Z]{2}$/),
  timezone: z.string().max(100).nullable(),
});
const channel = z.object({
  name: z.string().max(300),
  country: country.nullable(),
});
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value);
    return (
      !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  });
const nullableDate = z
  .union([date, z.literal(''), z.null()])
  .transform((value) => value || null);
export const tvmazeShowSchema = z.object({
  id,
  url: sourceUrl,
  name: z.string().max(1000),
  status: z.string().max(100),
  type: z.string().max(100).nullable().optional(),
  network: channel.nullable(),
  webChannel: channel.nullable(),
  externals: z.object({
    imdb: z
      .string()
      .regex(/^tt\d{5,12}$/)
      .nullable(),
    thetvdb: id.nullable(),
  }),
  updated: z.number().int().nonnegative(),
});
export type TvmazeShow = z.infer<typeof tvmazeShowSchema>;
export const tvmazeEpisodeSchema = z.object({
  id,
  url: sourceUrl,
  name: z.string().max(1000),
  season: z.number().int().nonnegative(),
  number: z.number().int().nonnegative().nullable(),
  type: z.string().max(100),
  airdate: nullableDate,
  airtime: z
    .union([
      z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
      z.literal(''),
      z.null(),
    ])
    .transform((value) => value || null),
  airstamp: z
    .union([z.iso.datetime({ offset: true }), z.literal(''), z.null()])
    .transform((value) => (value ? new Date(value).toISOString() : null)),
  runtime: z.number().int().nonnegative().nullable(),
  summary: z.string().max(100000).nullable(),
});
export type TvmazeEpisode = z.infer<typeof tvmazeEpisodeSchema>;

export function normalizeTvmazeShow(show: TvmazeShow): EpisodeShow {
  const channel = show.network ?? show.webChannel;
  return {
    id: show.id,
    name: show.name,
    url: show.url,
    status: show.status,
    type: show.type ?? null,
    networkName: channel?.name ?? null,
    country: channel?.country?.code.toLowerCase() ?? null,
    timezone: channel?.country?.timezone ?? null,
    distribution: channel?.country
      ? 'country'
      : show.webChannel
        ? 'global'
        : 'unknown',
  };
}

export function normalizeTvmazeEpisode(
  episode: TvmazeEpisode,
  showId: number,
): Episode {
  return {
    id: episode.id,
    showId,
    name: episode.name,
    season: episode.season,
    number: episode.number,
    type: episode.type,
    airDate: episode.airdate,
    airTime: episode.airtime,
    // TVmaze synthesizes noon when an air date is known but no release time
    // exists (notably all global web channels). That is not an exact instant.
    airStamp: episode.airtime ? episode.airstamp : null,
    runtime: episode.runtime,
    // Data remains text. Consumers must never render TVmaze markup as HTML.
    summary: (episode.summary ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000),
    url: episode.url,
  };
}

export class TVmaze {
  constructor(
    private reserve: () => Promise<boolean>,
    private fetcher: typeof fetch = fetch,
    private timeoutMs = 8000,
  ) {}

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    lookup = false,
  ): Promise<T> {
    if (!(await this.reserve())) throw new ProviderError('budget');
    let response: Response;
    try {
      // The lookup endpoint redirects to the canonical show URL. Both URLs stay
      // on api.tvmaze.com; no credentials are sent by this keyless adapter.
      response = await this.fetcher(new URL(path, 'https://api.tvmaze.com'), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CineRadar/1.0 (TVmaze catalog sync)',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: lookup ? 'follow' : 'error',
      });
    } catch (error) {
      throw new ProviderError(
        error instanceof Error &&
          ['TimeoutError', 'AbortError'].includes(error.name)
          ? 'timeout'
          : 'network',
      );
    }
    if (
      response.url &&
      new URL(response.url).origin !== 'https://api.tvmaze.com'
    ) {
      await response.body?.cancel();
      throw new ProviderError('schema');
    }
    if (!response.ok) {
      const raw = response.headers.get('retry-after');
      const retry = raw
        ? /^\d+$/.test(raw)
          ? Number(raw) * 1000
          : Math.max(0, Date.parse(raw) - Date.now())
        : 0;
      await response.body?.cancel();
      throw new ProviderError(
        response.status === 404
          ? 'missing'
          : response.status === 429
            ? 'quota'
            : 'upstream',
        Number.isFinite(retry) ? retry : 0,
      );
    }
    // Bound even unexpectedly large upstream payloads (including chunked ones).
    if (Number(response.headers.get('content-length')) > 12_000_000) {
      await response.body?.cancel();
      throw new ProviderError('schema');
    }
    try {
      const reader = response.body?.getReader();
      if (!reader) throw new ProviderError('schema');
      const decoder = new TextDecoder();
      let body = '',
        bytes = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 12_000_000) {
          await reader.cancel();
          throw new ProviderError('schema');
        }
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
      const parsed = schema.safeParse(JSON.parse(body));
      if (!parsed.success) throw new ProviderError('schema');
      return parsed.data;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        error instanceof Error &&
          ['TimeoutError', 'AbortError'].includes(error.name)
          ? 'timeout'
          : 'schema',
      );
    }
  }

  async index(page: number): Promise<TvmazeShow[] | null> {
    if (!Number.isSafeInteger(page) || page < 0)
      throw new ProviderError('schema');
    try {
      return await this.request(
        `/shows?page=${page}`,
        z.array(tvmazeShowSchema).max(250),
      );
    } catch (error) {
      if (error instanceof ProviderError && error.code === 'missing')
        return null;
      throw error;
    }
  }

  async lookup(external: {
    imdb?: string;
    tvdb?: number;
  }): Promise<TvmazeShow | null> {
    const query =
      external.imdb && /^tt\d{5,12}$/.test(external.imdb)
        ? `imdb=${external.imdb}`
        : Number.isSafeInteger(external.tvdb) && external.tvdb! > 0
          ? `thetvdb=${external.tvdb}`
          : null;
    if (!query) throw new ProviderError('schema');
    try {
      const show = await this.request(
        `/lookup/shows?${query}`,
        tvmazeShowSchema,
        true,
      );
      // Redirects and a provider result are insufficient evidence on their own.
      if (
        (external.imdb && external.imdb !== show.externals.imdb) ||
        (external.tvdb &&
          (!external.imdb || show.externals.thetvdb !== null) &&
          external.tvdb !== show.externals.thetvdb)
      )
        return null;
      return show;
    } catch (error) {
      if (error instanceof ProviderError && error.code === 'missing')
        return null;
      throw error;
    }
  }

  show(showId: number) {
    return this.request(`/shows/${checkedId(showId)}`, tvmazeShowSchema);
  }
  episodes(showId: number) {
    return this.request(
      `/shows/${checkedId(showId)}/episodes?specials=1`,
      z.array(tvmazeEpisodeSchema).max(30000),
    );
  }
  schedule(market: string, day: string) {
    if (
      !(market === 'global' || /^[a-z]{2}$/.test(market)) ||
      !date.safeParse(day).success
    )
      throw new ProviderError('schema');
    const path =
      market === 'global'
        ? `/schedule/web?country=&date=${day}`
        : `/schedule?country=${market.toUpperCase()}&date=${day}`;
    return this.request(
      path,
      z
        .array(
          tvmazeEpisodeSchema
            .extend({
              show: tvmazeShowSchema.optional(),
              _embedded: z.object({ show: tvmazeShowSchema }).optional(),
            })
            .refine((entry) => Boolean(entry.show ?? entry._embedded?.show)),
        )
        .max(10000),
    );
  }
}

function checkedId(value: number) {
  if (!id.safeParse(value).success) throw new ProviderError('schema');
  return value;
}

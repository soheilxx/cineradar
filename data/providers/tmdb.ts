import { z } from 'zod';
import type { Genre, Title, MediaType, Localization } from '../../domain/types';
import { locales, type Locale } from '../../i18n/config';
import { slugify } from '../../i18n/routes';
import { config } from '../../lib/config';
import { request, ProviderError, type Reserve } from './http';
const externalIdsSchema = z.object({
  imdb_id: z.string().nullable().optional(),
  tvdb_id: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .nullable()
    .optional(),
});
export function normalizeExternalIds(
  raw: z.infer<typeof externalIdsSchema>,
): NonNullable<Title['externalIds']> {
  return {
    ...(raw.imdb_id && /^tt\d{7,12}$/.test(raw.imdb_id)
      ? { imdb: raw.imdb_id }
      : {}),
    ...(raw.tvdb_id && Number.isSafeInteger(raw.tvdb_id) && raw.tvdb_id > 0
      ? { tvdb: raw.tvdb_id }
      : {}),
  };
}
const detail = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  external_ids: externalIdsSchema.optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  original_title: z.string().optional(),
  original_name: z.string().optional(),
  overview: z.string().nullable().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  runtime: z.number().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  genres: z.array(z.object({ id: z.number(), name: z.string() })).default([]),
  vote_average: z.number().default(0),
  vote_count: z.number().default(0),
  popularity: z.number().nonnegative().optional(),
  credits: z
    .object({ cast: z.array(z.object({ name: z.string() })) })
    .optional(),
  seasons: z
    .array(
      z.object({
        season_number: z.number(),
        name: z.string(),
        episode_count: z.number().optional(),
      }),
    )
    .optional(),
});
const configSchema = z.object({
  images: z.object({
    secure_base_url: z.url(),
    poster_sizes: z.array(z.string()),
    backdrop_sizes: z.array(z.string()),
  }),
});
const list = z.object({
  results: z.array(
    z.object({
      id: z.number().int().positive(),
      media_type: z.enum(['movie', 'tv', 'person']).optional(),
      title: z.string().optional(),
      name: z.string().optional(),
    }),
  ),
  total_pages: z.number().optional(),
});
const genreIds: Record<number, Genre> = {
  28: 'action',
  12: 'adventure',
  16: 'animation',
  35: 'comedy',
  80: 'crime',
  99: 'documentary',
  18: 'drama',
  10751: 'family',
  14: 'fantasy',
  27: 'horror',
  9648: 'mystery',
  10749: 'romance',
  878: 'scifi',
  53: 'thriller',
  10765: 'scifi',
  10759: 'action',
};
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export class TMDB {
  private images: Promise<z.infer<typeof configSchema>> | null = null;
  constructor(private reserve: Reserve) {}
  private get<T>(
    endpoint: string,
    params: Record<string, string>,
    schema: z.ZodType<T>,
  ) {
    const url = new URL('https://api.themoviedb.org/3' + endpoint);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request(
      url,
      { Authorization: 'Bearer ' + config().TMDB_READ_ACCESS_TOKEN },
      schema,
      'tmdb',
      this.reserve,
    );
  }
  trending() {
    return this.get('/trending/all/day', {}, list);
  }
  search(query: string, locale: Locale) {
    return this.get(
      '/search/multi',
      { query, language: locale, include_adult: 'false' },
      list,
    );
  }
  async externalIds(type: MediaType, id: number) {
    if (!['movie', 'tv'].includes(type) || !Number.isSafeInteger(id) || id <= 0)
      throw new ProviderError('schema');
    const result = await this.get(
      `/${type}/${id}/external_ids`,
      {},
      externalIdsSchema.extend({
        id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      }),
    );
    if (result.id !== id) throw new ProviderError('schema');
    return normalizeExternalIds(result);
  }
  async findSeries(externalId: string, source: 'imdb_id' | 'tvdb_id') {
    if (
      !['imdb_id', 'tvdb_id'].includes(source) ||
      !(source === 'imdb_id'
        ? /^tt\d{7,12}$/.test(externalId)
        : /^[1-9]\d{0,15}$/.test(externalId) &&
          Number.isSafeInteger(Number(externalId)))
    )
      throw new ProviderError('schema');
    const result = await this.get(
      `/find/${externalId}`,
      { external_source: source },
      z.object({
        tv_results: z
          .array(
            z.object({
              id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
            }),
          )
          .max(100),
      }),
    );
    // A source identifier must resolve unambiguously before importing a title.
    return result.tv_results.length === 1 ? result.tv_results[0].id : null;
  }
  async title(type: MediaType, id: number, previous?: Title): Promise<Title> {
    if (!['movie', 'tv'].includes(type) || !Number.isSafeInteger(id) || id <= 0)
      throw new ProviderError('schema');
    this.images ??= this.get('/configuration', {}, configSchema);
    const images = (await this.images).images;
    if (new URL(images.secure_base_url).hostname !== 'image.tmdb.org')
      throw new ProviderError('schema');
    const localizations = {} as Record<Locale, Localization>;
    let base: z.infer<typeof detail> | null = null;
    for (const locale of locales) {
      const d = await this.get(
        `/${type}/${id}`,
        { language: locale, append_to_response: 'credits,external_ids' },
        detail,
      );
      if (d.id !== id) throw new ProviderError('schema');
      base ??= d;
      const name = d.title || d.name || d.original_title || d.original_name;
      if (!name) throw new ProviderError('schema');
      const sourceHash = await hash(d.overview || '');
      let overview = d.overview || '';
      let source: Localization['source'] = overview ? 'tmdb' : 'facts';
      if (previous?.localizations[locale].source === 'editorial') {
        overview = previous.localizations[locale].overview;
        source = 'editorial';
      }
      localizations[locale] = {
        locale,
        title: name,
        overview,
        slug: slugify(name) + '-' + id,
        source,
        sourceHash,
      };
    }
    const d = base!;
    const img = (
      p: string | null | undefined,
      sizes: string[],
      size: string,
    ) =>
      p && /^\/[A-Za-z0-9._-]+$/.test(p) && sizes.includes(size)
        ? images.secure_base_url + size + p
        : null;
    return {
      id: type + ':' + id,
      type,
      tmdbId: id,
      externalIds:
        d.external_ids === undefined
          ? { ...previous?.externalIds }
          : {
              ...(previous?.externalIds?.tvmaze
                ? { tvmaze: previous.externalIds.tvmaze }
                : {}),
              ...normalizeExternalIds(d.external_ids),
            },
      ...(d.external_ids !== undefined
        ? { externalIdsCheckedAt: new Date().toISOString() }
        : previous?.externalIdsCheckedAt
          ? { externalIdsCheckedAt: previous.externalIdsCheckedAt }
          : {}),
      originalTitle:
        d.original_title || d.original_name || localizations.en.title,
      year:
        Number((d.release_date || d.first_air_date || '').slice(0, 4)) || null,
      runtime: d.runtime || null,
      poster: img(d.poster_path, images.poster_sizes, 'w500'),
      backdrop: img(d.backdrop_path, images.backdrop_sizes, 'w1280'),
      genres: d.genres.map((x) => genreIds[x.id]).filter(Boolean),
      rating: d.vote_count > 0 ? d.vote_average : null,
      votes: d.vote_count,
      ...(d.popularity === undefined
        ? {}
        : {
            popularity: d.popularity,
            popularityUpdatedAt: new Date().toISOString(),
          }),
      cast: d.credits?.cast.slice(0, 8).map((x) => x.name) || [],
      seasons:
        d.seasons
          ?.filter((s) => s.season_number > 0)
          .map((s) => ({
            number: s.season_number,
            name: s.name,
            episodes: s.episode_count ?? null,
          })) || [],
      localizations,
      revision: await hash(JSON.stringify(localizations)),
      indexable: false,
    };
  }
}

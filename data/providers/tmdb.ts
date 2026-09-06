import { z } from 'zod';
import type { Genre, Title, MediaType, Localization } from '../../domain/types';
import { locales, type Locale } from '../../i18n/config';
import { slugify } from '../../i18n/routes';
import { config } from '../../lib/config';
import { request, ProviderError, type Reserve } from './http';
const detail = z.object({
  id: z.number().int().positive(),
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
  async title(type: MediaType, id: number, previous?: Title): Promise<Title> {
    this.images ??= this.get('/configuration', {}, configSchema);
    const images = (await this.images).images;
    if (new URL(images.secure_base_url).hostname !== 'image.tmdb.org')
      throw new ProviderError('schema');
    const localizations = {} as Record<Locale, Localization>;
    let base: z.infer<typeof detail> | null = null;
    for (const locale of locales) {
      const d = await this.get(
        `/${type}/${id}`,
        { language: locale, append_to_response: 'credits' },
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

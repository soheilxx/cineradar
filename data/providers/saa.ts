import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { Offer, Provider, MediaType } from '../../domain/types';
import { safeHttps } from '../../domain/offers';
import { config } from '../../lib/config';
import { request, ProviderError, type Reserve } from './http';
const https = z.string().refine((x) => !!safeHttps(x));
const optionalImage = z
  .union([https, z.literal('')])
  .nullish()
  .transform((value) => value || null);
const image = z.object({
  darkThemeImage: optionalImage,
  lightThemeImage: optionalImage,
  whiteImage: optionalImage,
});
const service = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  homePage: https,
  imageSet: image,
});
const addon = service;
export const countrySchema = z.object({
  countryCode: z.string().length(2),
  name: z.string(),
  services: z.array(
    service.extend({
      streamingOptionTypes: z.object({
        subscription: z.boolean(),
        addon: z.boolean(),
        free: z.boolean(),
        rent: z.boolean(),
        buy: z.boolean(),
      }),
      addons: z.array(addon),
    }),
  ),
});
export const offerSchema = z
  .object({
    service,
    type: z.enum(['subscription', 'addon', 'free', 'rent', 'buy']),
    addon: addon.optional(),
    link: https,
    quality: z.enum(['sd', 'hd', 'qhd', 'uhd']).optional(),
    audios: z.array(z.object({ language: z.string() })).optional(),
    subtitles: z
      .array(z.object({ locale: z.object({ language: z.string() }) }))
      .optional(),
    price: z
      .object({
        amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
      .nullish(),
    availableSince: z.number().int().nonnegative().optional(),
    expiresSoon: z.boolean().optional(),
    expiresOn: z.number().int().nonnegative().optional(),
  })
  .refine((o) => o.type !== 'addon' || !!o.addon);
const options = z.record(z.string(), z.array(offerSchema));
const episode = z.object({
  itemType: z.literal('episode'),
  title: z.string(),
  streamingOptions: options,
});
const season = z.object({
  itemType: z.literal('season'),
  title: z.string(),
  streamingOptions: options,
  episodes: z.array(episode).optional(),
});
export const showSchema = z.object({
  itemType: z.literal('show'),
  id: z.string().min(1),
  showType: z.enum(['movie', 'series']),
  tmdbId: z.string().regex(/^(?:(?:movie|tv)\/)?\d+$/),
  streamingOptions: options,
  seasons: z.array(season).optional(),
});
export const catalogPageSchema = z
  .object({
    shows: z.array(showSchema),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
  })
  .refine((page) => !page.hasMore || !!page.nextCursor);
const changeSchema = z.object({
  changeType: z.enum(['new', 'updated', 'removed', 'expiring', 'upcoming']),
  showId: z.string(),
  timestamp: z.number().int(),
  itemType: z.enum(['show', 'season', 'episode']),
  service,
  season: z.number().optional(),
  episode: z.number().optional(),
});
export const changesSchema = z
  .object({
    changes: z.array(changeSchema),
    shows: z.record(z.string(), showSchema),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
  })
  .refine((p) => !p.hasMore || !!p.nextCursor);
const languageMap: Record<string, string> = {
  eng: 'en',
  deu: 'de',
  ger: 'de',
  fra: 'fr',
  fre: 'fr',
  ita: 'it',
  spa: 'es',
};
function lang(v: string) {
  return languageMap[v] || v;
}
export function providerFrom(raw: z.infer<typeof service>): Provider {
  return {
    id: raw.id,
    name: raw.name,
    logo: raw.imageSet.darkThemeImage || raw.imageSet.lightThemeImage,
    url: raw.homePage,
    types: [],
    addons: [],
  };
}
export function normalizeShow(
  raw: unknown,
  type: MediaType,
  tmdbId: number,
  market: string,
  observedAt = new Date().toISOString(),
): { saaId: string; offers: Offer[]; supported: boolean } {
  const result = showSchema.safeParse(raw);
  if (!result.success) throw new ProviderError('schema');
  const s = result.data;
  if (
    ![String(tmdbId), `${type}/${tmdbId}`].includes(s.tmdbId) ||
    s.showType !== (type === 'tv' ? 'series' : 'movie')
  )
    throw new ProviderError('schema');
  const titleId = type + ':' + tmdbId;
  const out: Offer[] = [];
  function add(
    list: z.infer<typeof offerSchema>[],
    seasonNumber: number | null = null,
    episodeNumber: number | null = null,
    explicitUnit?: Offer['unit'],
    sourceLabel = '',
  ) {
    for (const o of list) {
      const unit =
        explicitUnit ||
        (episodeNumber !== null
          ? 'episode'
          : seasonNumber !== null
            ? 'season'
            : type === 'movie'
              ? 'film'
              : 'series');
      const id = createHash('sha256')
        .update(
          [
            titleId,
            market,
            o.service.id,
            o.addon?.id || '',
            o.type,
            o.quality || '',
            unit,
            seasonNumber ?? '',
            episodeNumber ?? '',
            o.link,
            sourceLabel,
          ].join('|'),
        )
        .digest('hex');
      out.push({
        id,
        titleId,
        market,
        provider: providerFrom(o.service),
        type: o.type,
        addon: o.addon ? { id: o.addon.id, name: o.addon.name } : null,
        link: o.link,
        quality: o.quality || null,
        audio: o.audios ? o.audios.map((x) => lang(x.language)) : null,
        subtitles: o.subtitles
          ? o.subtitles.map((x) => lang(x.locale.language))
          : null,
        price: ['buy', 'rent'].includes(o.type)
          ? (o.price?.amount ?? null)
          : null,
        currency: ['buy', 'rent'].includes(o.type)
          ? (o.price?.currency ?? null)
          : null,
        unit,
        season: seasonNumber,
        episode: episodeNumber,
        availableSince: o.availableSince
          ? new Date(o.availableSince * 1000).toISOString()
          : null,
        expiresOn: o.expiresOn
          ? new Date(o.expiresOn * 1000).toISOString()
          : null,
        observedAt,
      });
    }
  }
  add(s.streamingOptions[market] || []);
  s.seasons?.forEach((se) => {
    // The v4 contract does not guarantee array index = season number.
    const seasonNumber = /^Season (\d+)$/i.exec(se.title)?.[1];
    const n = seasonNumber ? Number(seasonNumber) : null;
    add(se.streamingOptions[market] || [], n, null, 'season', se.title);
    se.episodes?.forEach((ep) =>
      add(
        ep.streamingOptions[market] || [],
        n,
        /^Episode (\d+)$/i.test(ep.title)
          ? Number(ep.title.match(/\d+$/)![0])
          : null,
        'episode',
        se.title + ':' + ep.title,
      ),
    );
  });
  return { saaId: s.id, offers: out, supported: market in s.streamingOptions };
}
export class SAA {
  constructor(private reserve: Reserve) {}
  private get<T>(
    endpoint: string,
    params: Record<string, string>,
    schema: z.ZodType<T>,
  ) {
    const c = config();
    const url = new URL(
      (c.SAA_ACCESS_MODE === 'direct'
        ? 'https://api.movieofthenight.com/v4'
        : 'https://streaming-availability.p.rapidapi.com') + endpoint,
    );
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const headers: Record<string, string> =
      c.SAA_ACCESS_MODE === 'direct'
        ? { 'X-API-Key': c.SAA_API_KEY || '' }
        : {
            'X-RapidAPI-Key': c.RAPIDAPI_KEY || '',
            'X-RapidAPI-Host': 'streaming-availability.p.rapidapi.com',
          };
    return request(
      url,
      headers,
      schema,
      'saa',
      this.reserve,
      c.SAA_ENDPOINT_WEIGHT,
    );
  }
  countries() {
    return this.get('/countries', {}, z.record(z.string(), countrySchema));
  }
  show(type: MediaType, id: number) {
    return this.get(
      '/shows/' + encodeURIComponent(`${type}/${id}`),
      { output_language: 'en', series_granularity: 'episode' },
      showSchema,
    );
  }
  catalog(market: string, type: MediaType, cursor?: string) {
    return this.get(
      '/shows/search/filters',
      {
        country: market,
        show_type: type === 'tv' ? 'series' : 'movie',
        order_by: 'popularity_1year',
        order_direction: 'desc',
        output_language: 'en',
        series_granularity: 'episode',
        ...(cursor ? { cursor } : {}),
      },
      catalogPageSchema,
    );
  }
  changes(
    market: string,
    from: number,
    to: number,
    changeType: 'new' | 'updated' | 'removed',
    cursor?: string,
  ) {
    return this.get(
      '/changes',
      {
        country: market,
        change_type: changeType,
        from: String(from),
        to: String(to),
        ...(cursor ? { cursor } : {}),
      },
      changesSchema,
    );
  }
}

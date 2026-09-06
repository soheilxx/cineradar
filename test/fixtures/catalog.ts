// Local-only test fixtures. Film artwork verified on TMDb 2026-09-06.
// Availability, prices and timestamps below are intentionally synthetic.
import type {
  Title,
  Provider,
  CatalogItem,
  Genre,
  Offer,
} from '../../domain/types';
import { locales, markets } from '../../i18n/config';
import { slugify } from '../../i18n/routes';
import { emptySnapshot } from '../../domain/offers';
export const fixtureProviders: Provider[] = [
  ['netflix', 'Netflix', 'https://www.netflix.com/'],
  ['prime', 'Prime Video', 'https://www.primevideo.com/'],
  ['disney', 'Disney+', 'https://www.disneyplus.com/'],
  ['apple', 'Apple TV', 'https://tv.apple.com/'],
  ['arte', 'ARTE', 'https://www.arte.tv/'],
].map(([id, name, url]) => ({
  id,
  name,
  url,
  logo: null,
  types: ['subscription', 'rent', 'buy', 'addon', 'free'],
  addons: id === 'prime' ? [{ id: 'mubi', name: 'MUBI', logo: null }] : [],
}));
const rows: [
  number,
  string,
  number,
  number | null,
  Genre[],
  string,
  string,
  'movie' | 'tv',
][] = [
  [
    157336,
    'Interstellar',
    2014,
    169,
    ['scifi', 'adventure', 'drama'],
    'yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg',
    '5XNQBqnBwPA9yT0jZ0p3s8bbLh0.jpg',
    'movie',
  ],
  [
    693134,
    'Dune: Part Two',
    2024,
    167,
    ['scifi', 'adventure'],
    '6izwz7rsy95ARzTR3poZ8H6c5pp.jpg',
    'eZ239CUp1d6OryZEBPnO2n87gMG.jpg',
    'movie',
  ],
  [
    120467,
    'The Grand Budapest Hotel',
    2014,
    100,
    ['comedy', 'drama'],
    'eWdyYQreja6JGCzqHWXpWHDrrPo.jpg',
    'jK65srQczOKTpW62wPxwwKztGgE.jpg',
    'movie',
  ],
  [
    27205,
    'Inception',
    2010,
    148,
    ['scifi', 'thriller'],
    'xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg',
    '8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
    'movie',
  ],
  [
    129,
    'Spirited Away',
    2001,
    125,
    ['animation', 'fantasy'],
    '39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
    'dyJvKsNs2KP8qQnAXbRwDjblViy.jpg',
    'movie',
  ],
  [
    414906,
    'The Batman',
    2022,
    177,
    ['crime', 'thriller'],
    '74xTEgt7R36Fpooo50r9T25onhq.jpg',
    'rvtdN5XkWAfGX6xDuPL6yYS2seK.jpg',
    'movie',
  ],
  [
    70523,
    'Dark',
    2017,
    null,
    ['mystery', 'scifi'],
    'apbrbWs8M9lyOpJYU5WXrpFbk1Z.jpg',
    '3jDXL4Xvj3AzDOF6UH1xeyHW8MH.jpg',
    'tv',
  ],
  [
    136315,
    'The Bear',
    2022,
    null,
    ['drama', 'comedy'],
    'eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg',
    'aJtG4txtmiRHwAAqENQHZvBs6kY.jpg',
    'tv',
  ],
];
export function fixtureCatalog(now = Date.now()): CatalogItem[] {
  return rows.flatMap(
    ([tmdbId, name, year, runtime, genres, poster, backdrop, type], i) => {
      const id = type + ':' + tmdbId;
      const localizations = Object.fromEntries(
        locales.map((locale) => [
          locale,
          {
            locale,
            title: name,
            overview: '',
            slug: slugify(name) + '-' + tmdbId,
            source: 'facts',
            sourceHash: 'fixture',
          },
        ]),
      ) as Title['localizations'];
      const title: Title = {
        id,
        tmdbId,
        type,
        originalTitle: name,
        year,
        runtime,
        genres,
        poster: 'https://media.themoviedb.org/t/p/w500/' + poster,
        backdrop:
          'https://media.themoviedb.org/t/p/w1920_and_h800_multi_faces/' +
          backdrop,
        rating: null,
        votes: 0,
        cast: [],
        seasons:
          type === 'tv'
            ? [
                { number: 1, name: '', episodes: 8 },
                { number: 2, name: '', episodes: 8 },
                { number: 3, name: '', episodes: null },
              ]
            : [],
        localizations,
        revision: 'fixture-1',
        fixture: true,
        indexable: false,
      };
      return markets.map((market, mi) => {
        const checkedAt = new Date(
          now - (i === 5 ? 96 : 1) * 3600000,
        ).toISOString();
        const provider = fixtureProviders[(i + mi) % 4];
        const offer: Offer = {
          id: `${id}:${market}:subscription`,
          titleId: id,
          market,
          provider,
          type: 'subscription',
          addon: null,
          link: provider.url,
          quality: 'uhd',
          audio: mi === 0 ? ['de', 'en'] : ['en', market],
          subtitles: ['en', market],
          price: null,
          currency: null,
          unit: type === 'movie' ? 'film' : 'series',
          season: null,
          episode: null,
          availableSince: new Date(now - 2 * 86400000).toISOString(),
          expiresOn:
            i === 2 ? new Date(now + 5 * 86400000).toISOString() : null,
          observedAt: checkedAt,
        };
        const offers: Offer[] = [offer];
        if (type === 'movie') {
          offers.push({
            ...offer,
            id: offer.id + ':rent',
            type: 'rent',
            provider: fixtureProviders[1],
            link: fixtureProviders[1].url,
            price: '3.99',
            currency: 'EUR',
            quality: 'hd',
          });
          offers.push({
            ...offer,
            id: offer.id + ':buy',
            type: 'buy',
            provider: fixtureProviders[3],
            link: fixtureProviders[3].url,
            price: '9.99',
            currency: 'EUR',
            quality: 'hd',
          });
        }
        if (i === 0)
          offers.push({
            ...offer,
            id: offer.id + ':addon',
            type: 'addon',
            provider: fixtureProviders[1],
            link: fixtureProviders[1].url,
            addon: { id: 'mubi', name: 'MUBI' },
          });
        if (type === 'tv')
          offers.push({
            ...offer,
            id: offer.id + ':season1',
            unit: 'season',
            season: 1,
            quality: 'hd',
            audio: null,
            subtitles: null,
          });
        if (i === 4)
          offers.push({
            ...offer,
            id: offer.id + ':free',
            type: 'free',
            provider: fixtureProviders[4],
            link: fixtureProviders[4].url,
          });
        return {
          title,
          snapshot: {
            ...emptySnapshot(id, market),
            availability: i === 7 ? 'error' : 'available',
            checkedAt,
            attemptAt: checkedAt,
            errorCode: i === 7 ? 'timeout' : null,
            freshness: i === 5 ? 'stale' : 'fresh',
            offers,
            revision: 'fixture-1',
          },
        };
      });
    },
  );
}

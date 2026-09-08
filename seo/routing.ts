import type { Filters } from '../domain/types';
import type { RouteKey } from '../i18n/routes';
import { filterSchema } from '../lib/catalog-filters';

export type PageSearchParams = Record<string, string | string[] | undefined>;
export const topicGenres = [
  'action',
  'adventure',
  'animation',
  'comedy',
  'crime',
  'documentary',
  'drama',
  'family',
  'fantasy',
  'horror',
  'mystery',
  'romance',
  'scifi',
  'thriller',
] as const;

export function isPaginatedRoute(key: RouteKey, tail = '') {
  return (
    [
      'movies',
      'series',
      'search',
      'new',
      'leaving',
      'free',
      'finder',
      'topics',
    ].includes(key) ||
    (key === 'providers' && Boolean(tail))
  );
}

// Both the page and its metadata consume this validated representation.
export function routeQuery(key: RouteKey, tail: string, raw: PageSearchParams) {
  if (key === 'identify')
    return {
      filters: { page: 1 } as Filters,
      filtered: Object.keys(raw).length > 0,
      page: 1,
    };
  if (Object.values(raw).some(Array.isArray)) return null;
  const parsed = filterSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { mine, ...rest } = parsed.data;
  const paginated = isPaginatedRoute(key, tail);
  const filters: Filters = {
    ...rest,
    mine: mine?.split(','),
    page: paginated ? rest.page : 1,
  };
  if (key === 'movies' || key === 'series') {
    filters.type = key === 'movies' ? 'movie' : 'tv';
    filters.sort ||= 'latest';
  }
  if (['new', 'leaving', 'free', 'finder'].includes(key))
    filters.scope = key as Filters['scope'];
  if (key === 'providers' && tail) filters.provider = tail;
  if (key === 'topics' && tail) filters.genre = tail;
  return {
    filters,
    page: filters.page || 1,
    filtered: Object.keys(raw).some((name) => name !== 'page' || !paginated),
  };
}

export function missingCatalogPage(
  page: number,
  result: { items: unknown[]; unavailable: boolean },
) {
  return page > 1 && !result.unavailable && result.items.length === 0;
}

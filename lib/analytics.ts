// Only this module may forward product events to GA4. No pre-consent backlog.
import { routeFor } from '../i18n/routes';
import { isLocale } from '../i18n/config';
import { comparisonPath, comparisonRoute } from '../content/comparisons/routes';
export const GA4_ID = 'G-6VDG3EL0NF';
export const CONSENT_KEY = 'cr:analytics-consent:v1';
export const CONSENT_EVENT = 'cr:analytics-consent';
export const CONSENT_TTL = 180 * 86400000;
export type AnalyticsConsent = 'granted' | 'denied' | null;
export type AnalyticsParams = Record<
  string,
  string | number | boolean | undefined
>;
const numeric = new Set([
  'query_length',
  'result_count',
  'position',
  'page_number',
  'duration_ms',
  'selected_count',
  'change_count',
  'item_count',
  'scroll_percent',
  'engagement_time_msec',
  'offer_price',
  'season_number',
  'episode_number',
]);
const booleans = new Set(['selected', 'results_available']);
const tokens = new Set([
  'media_type',
  'status',
  'trigger',
  'filter_name',
  'filter_value',
  'provider_id',
  'comparison_id',
  'direction',
  'source',
  'error_code',
  'form_id',
  'locale',
  'market',
  'content_language',
  'streaming_market',
  'page_type',
  'control',
  'placement',
  'element_tag',
  'interaction_type',
  'link_category',
  'offer_type',
  'quality',
  'currency',
  'unit',
  'sort',
  'target_page_type',
]);
const events = new Set([
  'page_view',
  'ui_click',
  'title_select',
  'provider_click',
  'navigation_click',
  'section_open',
  'scroll_depth',
  'active_time',
  'view_title',
  'search_results_view',
  'filter_change',
  'filter_apply',
  'filter_reset',
  'mobile_menu_open',
  'mobile_menu_close',
  'context_change',
  'search_submit',
  'search_suggestions_view',
  'search_suggestions_error',
  'search_suggestion_select',
  'search_more_start',
  'search_more_status',
  'catalog_load_more',
  'catalog_load_success',
  'catalog_load_error',
  'watchlist_add',
  'watchlist_remove',
  'watchlist_error',
  'watchlist_load_success',
  'watchlist_load_error',
  'watchlist_sort_change',
  'provider_selection_change',
  'provider_selection_error',
  'provider_dialog_open',
  'provider_dialog_close',
  'offer_filter_change',
  'offer_filter_reset',
  'contact_start',
  'contact_validation_error',
  'contact_submit',
  'contact_success',
  'contact_error',
  'comparison_search_submit',
  'spotlight_change',
  'shelf_scroll',
]);
export function sanitizeAnalyticsParams(
  input: AnalyticsParams,
): AnalyticsParams {
  const out: AnalyticsParams = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      numeric.has(key) &&
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0
    )
      out[key] = Math.min(value, 1e10);
    else if (booleans.has(key) && typeof value === 'boolean') out[key] = value;
    else if (
      key === 'title_id' &&
      typeof value === 'string' &&
      /^(movie|tv):[1-9]\d{0,12}$/.test(value)
    )
      out[key] = value;
    else if (
      tokens.has(key) &&
      typeof value === 'string' &&
      /^[a-zA-Z0-9_:.-]{1,64}$/.test(value)
    )
      out[key] = value;
  }
  return out;
}
export function parseConsent(
  value: string | null,
  now = Date.now(),
): AnalyticsConsent {
  try {
    const saved = JSON.parse(value || 'null');
    return saved?.version === 1 &&
      ['granted', 'denied'].includes(saved?.value) &&
      typeof saved.at === 'number' &&
      saved.at <= now &&
      now - saved.at < CONSENT_TTL
      ? saved.value
      : null;
  } catch {
    return null;
  }
}
export function getConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return null;
  const now = Date.now();
  if (inMemoryConsent) {
    if (inMemoryConsent.at <= now && now - inMemoryConsent.at < CONSENT_TTL)
      return inMemoryConsent.value;
    inMemoryConsent = null;
  }
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_KEY), now);
  } catch {
    return null;
  }
}
let inMemoryConsent: {
  value: Exclude<AnalyticsConsent, null>;
  at: number;
} | null = null;
let publisher: ((event: string, params: AnalyticsParams) => void) | null = null;
export function setConsent(granted: boolean) {
  if (typeof window === 'undefined') return;
  inMemoryConsent = { value: granted ? 'granted' : 'denied', at: Date.now() };
  try {
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ version: 1, ...inMemoryConsent }),
    );
  } catch {
    /* Applies to this page even when persistence is unavailable. */
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
export function currentConsent() {
  return getConsent();
}
export function subscribeConsent(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  const storage = (event: StorageEvent) => {
    if (event.key === CONSENT_KEY || event.key === null) {
      inMemoryConsent = null;
      listener();
    }
  };
  window.addEventListener(CONSENT_EVENT, listener);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(CONSENT_EVENT, listener);
    window.removeEventListener('storage', storage);
  };
}
export function openConsentSettings() {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event('cr:analytics-settings'));
}
export function setAnalyticsPublisher(next: typeof publisher) {
  publisher = next;
}
export function subscribePageRestores(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  const restore = (event: PageTransitionEvent) => {
    if (event.persisted) listener();
  };
  window.addEventListener('pageshow', restore);
  return () => window.removeEventListener('pageshow', restore);
}
export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (
    typeof window === 'undefined' ||
    currentConsent() !== 'granted' ||
    !events.has(name)
  )
    return;
  try {
    publisher?.(name, sanitizeAnalyticsParams(params));
  } catch {
    // Analytics must never interrupt the action the visitor is performing.
  }
}

// URLs may contain names, email addresses or submitted search text. Reporting
// uses route families and numeric public title IDs, never raw slugs or queries.
export interface AnalyticsPage {
  path: string;
  locale: string;
  market?: string;
  page_type: string;
  title_id?: string;
  comparison_id?: string;
}
export function analyticsPage(input: string): AnalyticsPage {
  const fallback = { path: '/unrecognized/', locale: 'en', page_type: 'other' };
  try {
    const u = new URL(input, 'https://cineradar.tv');
    const editorial = comparisonRoute(u.pathname);
    if (editorial)
      return {
        path: comparisonPath(editorial.locale, editorial.id) + '/',
        locale: editorial.locale,
        page_type: editorial.id ? 'comparison' : 'comparisons',
        comparison_id: editorial.id,
      };
    const parts = u.pathname.split('/').filter(Boolean);
    if (!parts.length) return { path: '/', locale: 'en', page_type: 'entry' };
    const [language, country, segment = '', tail = ''] = parts;
    if (!isLocale(language)) return fallback;
    if (parts.length === 1)
      return { path: `/${language}/`, locale: language, page_type: 'entry' };
    if (!/^(de|fr|it|es|us)$/.test(country || '')) return fallback;
    const route = routeFor(language, segment, Boolean(tail));
    if (!route) return fallback;
    const base = `/${language}/${country}/${segment ? segment + '/' : ''}`;
    const id = ['movie', 'tv'].includes(route)
      ? tail.match(/-([1-9]\d{0,12})$/)?.[1]
      : undefined;
    return {
      path: id ? base + id + '/' : base,
      locale: language,
      market: country,
      page_type: route,
      title_id: id ? `${route}:${id}` : undefined,
    };
  } catch {
    return fallback;
  }
}
export function analyticsReferrer(input: string, origin: string) {
  try {
    if (!input) return '';
    const u = new URL(input);
    if (!['http:', 'https:'].includes(u.protocol)) return '';
    return u.origin === origin
      ? u.origin + analyticsPage(input).path
      : u.origin + '/';
  } catch {
    return '';
  }
}

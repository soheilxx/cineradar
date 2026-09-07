'use client';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  GA4_ID,
  NAVIGATION_EVENT_TIMEOUT,
  analyticsPage,
  analyticsReferrer,
  currentConsent,
  getConsent,
  setAnalyticsPublisher,
  subscribeConsent,
  subscribePageRestores,
  trackEvent,
  type AnalyticsPage,
} from '@/lib/analytics';

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  'ga-disable-G-6VDG3EL0NF'?: boolean;
};
const serverConsent = () => null;
const denied = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

function removeAnalyticsCookies() {
  const host = location.hostname.split('.');
  const domains = [
    '',
    ...host
      .map((_, i) => host.slice(i).join('.'))
      .filter((x) => x.includes('.')),
  ];
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim();
    if (!/^_ga(?:_|$)/.test(name)) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/;${domain ? ` domain=${domain};` : ''} SameSite=Lax`;
    }
  }
}

export function Analytics({
  enabled,
  nonce,
  debug = false,
}: {
  enabled: boolean;
  nonce?: string;
  debug?: boolean;
}) {
  const pathname = usePathname();
  const query = useSearchParams();
  const [restores, setRestores] = useState(0);
  const routeKey = pathname + '?' + query.toString() + '#' + restores; // Local deduplication only; never sent.
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsent,
    serverConsent,
  );
  const page = analyticsPage(pathname);
  const active = enabled && consent === 'granted' && page.page_type !== 'ops';
  const previous = useRef('');
  const lastView = useRef('');
  const eventContext = useRef<{ page: AnalyticsPage; referrer: string } | null>(
    null,
  );

  useEffect(
    () =>
      subscribePageRestores(() => {
        // A restored document is a new visit to this page without a React remount.
        previous.current = '';
        setRestores((count) => count + 1);
      }),
    [],
  );

  useEffect(() => {
    const w = window as AnalyticsWindow;
    if (!active) {
      setAnalyticsPublisher(null);
      lastView.current = '';
      w['ga-disable-G-6VDG3EL0NF'] = true;
      if (w.gtag) w.gtag('consent', 'update', denied);
      if (w.dataLayer) w.dataLayer.length = 0;
      removeAnalyticsCookies();
      return;
    }
    w['ga-disable-G-6VDG3EL0NF'] = false;
    w.dataLayer ||= [];
    w.gtag ||= function () {
      // Google's gtag command queue uses the Arguments object protocol.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    // Consent is established before loading gtag or configuring the property.
    w.gtag('consent', 'default', denied);
    w.gtag('consent', 'update', { ...denied, analytics_storage: 'granted' });
    w.gtag('js', new Date());
    const current = analyticsPage(location.pathname);
    w.gtag('config', GA4_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: 180 * 86400,
      cookie_update: false,
      cookie_flags: 'SameSite=Lax;Secure',
      page_location: location.origin + current.path,
      page_referrer: analyticsReferrer(document.referrer, location.origin),
      page_title: `Cineradar | ${current.page_type}`,
      debug_mode: debug,
    });
    setAnalyticsPublisher((event, params, onProcessed) => {
      if (currentConsent() !== 'granted' || w['ga-disable-G-6VDG3EL0NF']) {
        onProcessed?.();
        return;
      }
      const context =
        eventContext.current?.page || analyticsPage(location.pathname);
      if (analyticsPage(location.pathname).page_type === 'ops' || !w.gtag) {
        onProcessed?.();
        return;
      }
      w.gtag('event', event, {
        ...params,
        content_language: context.locale,
        streaming_market: context.market,
        page_type: context.page_type,
        page_location: location.origin + context.path,
        page_title: `Cineradar | ${context.page_type}`,
        page_referrer:
          eventContext.current?.referrer ||
          analyticsReferrer(document.referrer, location.origin),
        send_to: GA4_ID,
        transport_type: 'beacon',
        debug_mode: debug,
        ...(onProcessed
          ? {
              event_callback: onProcessed,
              event_timeout: NAVIGATION_EVENT_TIMEOUT,
            }
          : {}),
      });
    });
    return () => setAnalyticsPublisher(null);
  }, [active, debug]);

  useEffect(() => {
    if (!active) return;
    const context = analyticsPage(location.pathname);
    const url = location.origin + context.path;
    const w = window as AnalyticsWindow;
    if (lastView.current !== routeKey) {
      lastView.current = routeKey;
      const referrer =
        previous.current ||
        analyticsReferrer(document.referrer, location.origin);
      eventContext.current = { page: context, referrer };
      w.gtag?.('set', {
        page_location: url,
        page_title: `Cineradar | ${context.page_type}`,
        page_referrer: referrer,
      });
      trackEvent('page_view', {
        title_id: context.title_id,
        comparison_id: context.comparison_id,
      });
      if (context.title_id)
        trackEvent('view_title', {
          title_id: context.title_id,
          media_type: context.page_type,
        });
      const results = document.querySelector<HTMLElement>(
        '[data-analytics-search-results]',
      );
      if (results)
        trackEvent('search_results_view', {
          query_length: Number(results.dataset.analyticsQueryLength || 0),
          result_count: Number(results.dataset.analyticsResultCount || 0),
          page_number: Number(results.dataset.analyticsPageNumber || 1),
        });
      previous.current = url;
    }
    const depths = new Set<number>();
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const percent =
        height > 0 ? Math.min(100, (100 * window.scrollY) / height) : 0;
      for (const point of [25, 50, 75, 90, 100])
        if (percent >= point && !depths.has(point)) {
          depths.add(point);
          trackEvent('scroll_depth', { scroll_percent: point });
        }
    };
    let activeMs = 0;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (document.visibilityState === 'visible')
        activeMs += Math.min(now - lastTick, 1000);
      lastTick = now;
      if (activeMs >= 15000) {
        trackEvent('active_time', {
          engagement_time_msec: Math.round(activeMs),
        });
        activeMs = 0;
      }
    }, 1000);
    const flush = () => {
      if (activeMs > 0) {
        trackEvent('active_time', {
          engagement_time_msec: Math.round(activeMs),
        });
        activeMs = 0;
      }
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') flush();
      lastTick = performance.now();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      flush();
      clearInterval(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [active, routeKey]);

  useEffect(() => {
    if (!active) return;
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest('[data-analytics-ignore]')) return;
      const element =
        target.closest<HTMLElement>(
          'a,button,input,select,textarea,summary,[role="button"]',
        ) || target;
      const control = element.closest<HTMLElement>('[data-analytics-control]')
        ?.dataset.analyticsControl;
      const placement = element.closest('header')
        ? 'header'
        : element.closest('footer')
          ? 'footer'
          : 'content';
      trackEvent('ui_click', {
        element_tag: element.tagName.toLowerCase(),
        control,
        placement,
        interaction_type: event.detail === 0 ? 'keyboard' : 'pointer',
      });
      const link = element.closest<HTMLAnchorElement>('a[href]');
      if (!link) return;
      const data = link.dataset;
      const title =
        data.analyticsTitleId ||
        link.closest<HTMLElement>('[data-analytics-title-id]')?.dataset
          .analyticsTitleId;
      if (data.analyticsProviderId) {
        trackEvent('provider_click', {
          title_id: title,
          provider_id: data.analyticsProviderId,
          offer_type: data.analyticsOfferType,
          quality: data.analyticsQuality,
          currency: data.analyticsCurrency,
          offer_price:
            data.analyticsValue === undefined
              ? undefined
              : Number(data.analyticsValue),
          season_number:
            data.analyticsSeasonNumber === undefined
              ? undefined
              : Number(data.analyticsSeasonNumber),
          episode_number:
            data.analyticsEpisodeNumber === undefined
              ? undefined
              : Number(data.analyticsEpisodeNumber),
          unit: data.analyticsUnit,
          placement,
        });
      } else if (title) {
        trackEvent('title_select', {
          title_id: title,
          media_type: data.analyticsMediaType,
          position: data.analyticsPosition
            ? Number(data.analyticsPosition)
            : undefined,
          source: data.analyticsSource || placement,
        });
      } else {
        try {
          const destination = new URL(link.href, location.origin);
          trackEvent('navigation_click', {
            placement,
            link_category:
              destination.origin === location.origin ? 'internal' : 'external',
            target_page_type:
              destination.origin === location.origin
                ? analyticsPage(destination.href).page_type
                : undefined,
          });
        } catch {
          /* Invalid links are not forwarded. */
        }
      }
    };
    const toggle = (event: Event) => {
      const target = event.target;
      if (
        target instanceof HTMLDetailsElement &&
        target.open &&
        !target.closest('[data-analytics-ignore]')
      )
        trackEvent('section_open', { control: 'details' });
    };
    document.addEventListener('click', click, true);
    document.addEventListener('toggle', toggle, true);
    return () => {
      document.removeEventListener('click', click, true);
      document.removeEventListener('toggle', toggle, true);
    };
  }, [active]);
  return active ? (
    <Script
      id="cineradar-ga4"
      nonce={nonce}
      src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
      strategy="afterInteractive"
    />
  ) : null;
}

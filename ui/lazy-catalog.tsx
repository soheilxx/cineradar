'use client';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { CardItem } from '@/domain/cards';
import type { Filters } from '@/domain/types';
import type { Locale } from '@/i18n/config';
import { t } from '@/i18n/messages';
import { trackEvent } from '@/lib/analytics';
import { PosterCard } from './cards';

export function LazyCatalog({
  initialItems,
  total,
  locale,
  market,
  filters,
  navigation,
}: {
  initialItems: CardItem[];
  total: number;
  locale: Locale;
  market: string;
  filters: Filters;
  navigation?: ReactNode;
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(filters.page || 1);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [currentTotal, setCurrentTotal] = useState(total);
  const [exhausted, setExhausted] = useState(false);
  const [ready, setReady] = useState(false);
  const gridId = useId();
  const lock = useRef(false);
  const mounted = useRef(false);
  const request = useRef<AbortController | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = !exhausted && page < 1000 && page * 24 < currentTotal;
  useEffect(() => {
    mounted.current = true;
    setReady(true);
    return () => {
      mounted.current = false;
      request.current?.abort();
      request.current = null;
      lock.current = false;
    };
  }, []);
  const load = useCallback(
    async (auto = false) => {
      if (!mounted.current || lock.current || !hasMore) return;
      lock.current = true;
      const controller = new AbortController();
      request.current = controller;
      const current = () => mounted.current && request.current === controller;
      const timeout = setTimeout(() => controller.abort(), 12000);
      setBusy(true);
      setFailed(false);
      const startedAt = performance.now();
      const analytics = {
        locale,
        market,
        page_number: page + 1,
        trigger: auto ? 'automatic' : 'manual',
        source: filters.q ? 'search' : 'catalog',
      };
      trackEvent('catalog_load_more', analytics);
      try {
        const params = new URLSearchParams({
          locale,
          market,
          page: String(page + 1),
        });
        for (const [key, value] of Object.entries(filters))
          if (key !== 'page' && value !== undefined && value !== '')
            params.set(
              key,
              Array.isArray(value) ? value.join(',') : String(value),
            );
        const response = await fetch('/api/catalog/?' + params.toString(), {
          signal: controller.signal,
        });
        if (!current()) return;
        if (!response.ok) throw Error('load');
        const data: { items: CardItem[]; page: number; total: number } =
          await response.json();
        if (!current()) return;
        if (controller.signal.aborted) throw Error('timeout');
        if (
          data.page !== page + 1 ||
          !Array.isArray(data.items) ||
          !Number.isSafeInteger(data.total) ||
          data.total < 0
        )
          throw Error('page');
        setItems((current) => [
          ...new Map(
            [...current, ...data.items].map((item) => [item.id, item]),
          ).values(),
        ]);
        setPage(data.page);
        // A successful empty page can follow a shrinking live catalogue. Its
        // window-count total may be zero; finish without discarding loaded cards.
        if (!data.items.length) setExhausted(true);
        else setCurrentTotal(data.total);
        trackEvent('catalog_load_success', {
          ...analytics,
          result_count: data.items.length,
          duration_ms: Math.round(performance.now() - startedAt),
        });
      } catch {
        if (!current()) return;
        setFailed(true);
        trackEvent('catalog_load_error', {
          ...analytics,
          duration_ms: Math.round(performance.now() - startedAt),
          error_code: 'load_failed',
        });
      } finally {
        clearTimeout(timeout);
        if (current()) {
          request.current = null;
          lock.current = false;
          setBusy(false);
        }
      }
    },
    [filters, hasMore, locale, market, page],
  );
  useEffect(() => {
    if (
      !sentinel.current ||
      !hasMore ||
      busy ||
      failed ||
      !('IntersectionObserver' in window)
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void load(true);
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [load, hasMore, failed, busy]);
  return (
    <>
      <div className="poster-grid" id={gridId} aria-busy={busy}>
        {items.map((item, index) => (
          <PosterCard
            key={item.id}
            item={item}
            index={index % 24}
            position={((filters.page || 1) - 1) * 24 + index + 1}
            locale={locale}
            market={market}
          />
        ))}
      </div>
      <div className="catalog-continuation">
        <div
          className="load-more"
          ref={sentinel}
          data-catalog-state={
            failed ? 'error' : busy ? 'loading' : hasMore ? 'idle' : 'complete'
          }
        >
          <p role="status" aria-live="polite" aria-atomic="true">
            {failed
              ? t(locale, 'loadFailed')
              : exhausted
                ? t(locale, 'catalogEnd')
                : t(locale, 'loadedCount', {
                    loaded: items.length,
                    total: Math.max(currentTotal, items.length),
                  })}
          </p>
          {hasMore && (
            <button
              type="button"
              className="button"
              aria-controls={gridId}
              disabled={!ready || busy}
              onClick={() => void load()}
            >
              {busy
                ? t(locale, 'loading')
                : t(locale, failed ? 'retry' : 'loadMore')}
            </button>
          )}
        </div>
        {navigation}
      </div>
    </>
  );
}

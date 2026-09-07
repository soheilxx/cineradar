'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
}: {
  initialItems: CardItem[];
  total: number;
  locale: Locale;
  market: string;
  filters: Filters;
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(filters.page || 1);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [automatic, setAutomatic] = useState(0);
  const lock = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = page * 24 < total;
  const load = useCallback(
    async (auto = false) => {
      if (lock.current || !hasMore) return;
      lock.current = true;
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
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw Error('load');
        const data: { items: CardItem[]; page: number } = await response.json();
        if (data.page !== page + 1 || !data.items.length) throw Error('page');
        setItems((current) => [
          ...new Map(
            [...current, ...data.items].map((item) => [item.id, item]),
          ).values(),
        ]);
        setPage(data.page);
        setAutomatic((current) => (auto ? current + 1 : 0));
        trackEvent('catalog_load_success', {
          ...analytics,
          result_count: data.items.length,
          duration_ms: Math.round(performance.now() - startedAt),
        });
      } catch {
        setFailed(true);
        trackEvent('catalog_load_error', {
          ...analytics,
          duration_ms: Math.round(performance.now() - startedAt),
          error_code: 'load_failed',
        });
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [filters, hasMore, locale, market, page],
  );
  useEffect(() => {
    if (
      !sentinel.current ||
      !hasMore ||
      failed ||
      automatic >= 3 ||
      !('IntersectionObserver' in window)
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void load(true);
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [load, hasMore, failed, automatic]);
  return (
    <>
      <div className="poster-grid">
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
      <div className="load-more" ref={sentinel}>
        <p role="status" aria-live="polite">
          {failed
            ? t(locale, 'loadFailed')
            : t(locale, 'loadedCount', { loaded: items.length, total })}
        </p>
        {hasMore && (
          <button
            className="button"
            disabled={busy}
            onClick={() => void load()}
          >
            {busy ? t(locale, 'loading') : t(locale, 'loadMore')}
          </button>
        )}
      </div>
    </>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { trackEvent } from '@/lib/analytics';
const saved = z
  .array(
    z.object({
      id: z.string().regex(/^(movie|tv):\d+$/),
      market: z.string().regex(/^[a-z]{2}$/),
      at: z.iso.datetime(),
      providers: z.array(z.string()).default([]),
    }),
  )
  .max(100);
export type Saved = z.infer<typeof saved>[number];
export function readSaved(): Saved[] {
  try {
    return saved.parse(
      JSON.parse(localStorage.getItem('cineradar:watchlist') || '[]'),
    );
  } catch {
    return [];
  }
}
export function readProviders(market: string): string[] {
  try {
    return z
      .array(z.string().max(100))
      .max(100)
      .parse(
        JSON.parse(
          localStorage.getItem('cineradar:providers:' + market) || '[]',
        ),
      );
  } catch {
    return [];
  }
}
export function useSaved() {
  const [items, set] = useState<Saved[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const update = () => set(readSaved());
    update();
    window.addEventListener('storage', update);
    window.addEventListener('cineradar:saved', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('cineradar:saved', update);
    };
  }, []);
  function toggle(id: string, market: string) {
    try {
      const current = readSaved();
      const next = current.some((x) => x.id === id && x.market === market)
        ? current.filter((x) => x.id !== id || x.market !== market)
        : [
            ...current,
            {
              id,
              market,
              at: new Date().toISOString(),
              providers: readProviders(market),
            },
          ];
      saved.parse(next);
      localStorage.setItem('cineradar:watchlist', JSON.stringify(next));
      set(next);
      setError(false);
      trackEvent(
        next.length > current.length ? 'watchlist_add' : 'watchlist_remove',
        {
          title_id: id,
          media_type: id.split(':')[0],
          market,
          item_count: next.filter((item) => item.market === market).length,
        },
      );
      window.dispatchEvent(new Event('cineradar:saved'));
    } catch {
      setError(true);
      trackEvent('watchlist_error', {
        title_id: id,
        market,
        error_code: 'storage_error',
      });
    }
  }
  return { items, toggle, error };
}

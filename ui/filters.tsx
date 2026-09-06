'use client';
import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Choice } from './select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import type { Filters, Provider } from '@/domain/types';
import type { Locale } from '@/i18n/config';
import { languageNames, locales } from '@/i18n/config';
import { t, type MessageKey } from '@/i18n/messages';
export function FilterControls({
  locale,
  initial,
  providers,
  finder = false,
}: {
  locale: Locale;
  initial: Filters;
  providers: Provider[];
  finder?: boolean;
}) {
  const [v, set] = useState<Record<string, string>>({
    type: initial.type || '',
    provider: initial.provider || '',
    genre: initial.genre || '',
    offerType: initial.offerType || '',
    quality: initial.quality || '',
    audio: initial.audio || '',
    subtitles: initial.subtitles || '',
    maxMinutes: initial.maxMinutes ? String(initial.maxMinutes) : '',
    sort: initial.sort || 'relevance',
  });
  const [open, setOpen] = useState(false);
  function submit() {
    const p = new URLSearchParams(window.location.search);
    p.delete('page');
    for (const [k, value] of Object.entries(v)) {
      if (value) p.set(k, value);
      else p.delete(k);
    }
    window.location.assign(
      window.location.pathname + (p.size ? '?' + p.toString() : ''),
    );
  }
  function reset() {
    window.location.assign(
      window.location.pathname +
        (initial.q ? '?q=' + encodeURIComponent(initial.q) : ''),
    );
  }
  const select = (
    name: string,
    label: MessageKey,
    options: { value: string; label: string }[],
  ) => (
    <Choice
      key={name}
      label={t(locale, label)}
      value={v[name]}
      options={options}
      onChange={(value) => set({ ...v, [name]: value })}
    />
  );
  const all = { value: '', label: t(locale, 'all') };
  const contents = (
    <>
      {select('type', 'movies', [
        all,
        { value: 'movie', label: t(locale, 'movies') },
        { value: 'tv', label: t(locale, 'series') },
      ])}
      {select('provider', 'providers', [
        all,
        ...providers.map((p) => ({ value: p.id, label: p.name })),
      ])}
      {select('genre', 'genre', [
        all,
        ...(
          [
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
          ] as const
        ).map((value) => ({ value, label: t(locale, value) })),
      ])}
      {select('offerType', 'offerType', [
        all,
        ...(['subscription', 'addon', 'free', 'rent', 'buy'] as const).map(
          (value) => ({ value, label: t(locale, value) }),
        ),
      ])}
      {select('maxMinutes', 'duration', [
        { value: '', label: t(locale, 'unlimited') },
        ...[90, 120, 150, 180].map((n) => ({
          value: String(n),
          label: t(locale, 'maxMinutes', { count: n }),
        })),
      ])}
      {select('quality', 'quality', [
        all,
        ...['sd', 'hd', 'qhd', 'uhd'].map((value) => ({
          value,
          label: value.toUpperCase(),
        })),
      ])}
      {select('audio', 'audio', [
        all,
        ...locales.map((value) => ({ value, label: languageNames[value] })),
      ])}
      {select('subtitles', 'subtitles', [
        all,
        ...locales.map((value) => ({ value, label: languageNames[value] })),
      ])}
      {select(
        'sort',
        'sort',
        (['relevance', 'title', 'year'] as const).map((value) => ({
          value,
          label: t(
            locale,
            value === 'title'
              ? 'titleSort'
              : value === 'year'
                ? 'yearSort'
                : 'relevance',
          ),
        })),
      )}
      <div className="filter-actions">
        <button className="button primary" onClick={submit}>
          {t(locale, 'apply')}
        </button>
        <button className="text-button" onClick={reset}>
          {t(locale, 'reset')}
        </button>
      </div>
    </>
  );
  return (
    <>
      <aside className={'filter-sidebar ' + (finder ? 'finder-filters' : '')}>
        <h2>
          <SlidersHorizontal size={18} />
          {t(locale, 'filters')}
        </h2>
        {contents}
      </aside>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className="button mobile-filters">
          <SlidersHorizontal size={18} />
          {t(locale, 'filters')}
        </DialogTrigger>
        <DialogContent className="filter-dialog" showCloseButton={false}>
          <DialogTitle>{t(locale, 'filters')}</DialogTitle>
          <DialogClose className="dialog-close" aria-label={t(locale, 'close')}>
            <X />
          </DialogClose>
          {contents}
        </DialogContent>
      </Dialog>
    </>
  );
}

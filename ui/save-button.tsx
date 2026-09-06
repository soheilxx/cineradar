'use client';
import { Bookmark, Check } from 'lucide-react';
import { useSaved } from './preferences';
import { useHydrated } from './use-hydrated';
import { t } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';
export function SaveButton({
  id,
  market,
  locale,
  compact = false,
}: {
  id: string;
  market: string;
  locale: Locale;
  compact?: boolean;
}) {
  const { items, toggle, error } = useSaved();
  const ready = useHydrated();
  const active = items.some((x) => x.id === id && x.market === market);
  return (
    <>
      <button
        disabled={!ready}
        className={compact ? 'save-icon' : 'button save-button'}
        onClick={() => toggle(id, market)}
        aria-label={t(locale, active ? 'remove' : 'save')}
        aria-pressed={active}
      >
        {active ? <Check size={19} /> : <Bookmark size={19} />}{' '}
        {!compact && t(locale, active ? 'saved' : 'save')}
      </button>
      {error && (
        <span role="alert" className="hint">
          {t(locale, 'storageError')}
        </span>
      )}
    </>
  );
}

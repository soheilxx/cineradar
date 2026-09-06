'use client';
import { useState } from 'react';
import { t } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';
export function SearchMore({
  locale,
  query,
  enabled,
}: {
  locale: Locale;
  query: string;
  enabled: boolean;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>(
    'idle',
  );
  if (!query || !enabled) return null;
  return (
    <div className="notice">
      <button
        className="text-button"
        disabled={state === 'busy' || state === 'done'}
        onClick={async () => {
          setState('busy');
          try {
            const r = await fetch('/api/search-more', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ locale, query }),
            });
            if (!r.ok) throw Error();
            setState('done');
          } catch {
            setState('error');
          }
        }}
      >
        {t(locale, state === 'busy' ? 'loading' : 'searchMore')}
      </button>
      <p role="status">
        {state === 'done'
          ? t(locale, 'searchPending')
          : state === 'error'
            ? t(locale, 'error')
            : ''}
      </p>
    </div>
  );
}

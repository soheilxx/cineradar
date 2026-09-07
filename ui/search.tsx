'use client';
import { useEffect, useRef, useState } from 'react';
import { Search as SearchIcon, ArrowRight } from 'lucide-react';
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { t } from '@/i18n/messages';
import { path } from '@/i18n/routes';
import type { Locale } from '@/i18n/config';
import { trackEvent } from '@/lib/analytics';
import { useHydrated } from './use-hydrated';
interface Suggestion {
  id: string;
  label: string;
  href: string;
  year: number | null;
  type: 'movie' | 'tv';
}
export function Search({
  locale,
  market,
  initial = '',
  inputId,
  buttonLabel,
  onSearch,
}: {
  locale: Locale;
  market: string;
  initial?: string;
  inputId?: string;
  buttonLabel?: string;
  onSearch?: () => void;
}) {
  const [query, setQuery] = useState(initial);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const ready = useHydrated();
  function submitSearch() {
    trackEvent('search_submit', {
      locale,
      market,
      query_length: query.trim().length,
      result_count: items.length,
    });
    onSearch?.();
    window.location.assign(
      path(locale, market, 'search') + '?q=' + encodeURIComponent(query),
    );
  }
  useEffect(() => {
    const n = ++seq.current;
    const controller = new AbortController();
    if (query.trim().length < 2) {
      setItems([]);
      return;
    }
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(
          `/api/search?locale=${locale}&market=${market}&q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const d = (await r.json()) as { items: Suggestion[] };
        if (seq.current === n) {
          setItems(r.ok ? d.items : []);
          trackEvent(
            r.ok ? 'search_suggestions_view' : 'search_suggestions_error',
            {
              locale,
              market,
              query_length: query.trim().length,
              result_count: r.ok ? d.items.length : 0,
              error_code: r.ok ? undefined : 'http_error',
            },
          );
        }
      } catch {
        if (seq.current === n && !controller.signal.aborted) {
          setItems([]);
          trackEvent('search_suggestions_error', {
            locale,
            market,
            query_length: query.trim().length,
            error_code: 'network_error',
          });
        }
      } finally {
        if (seq.current === n) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, locale, market]);
  return (
    <form
      className="search-box"
      action={path(locale, market, 'search')}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        submitSearch();
      }}
    >
      <SearchIcon className="search-symbol" size={23} />
      <Combobox<Suggestion>
        modal={false}
        items={items}
        filter={null}
        inputValue={query}
        onInputValueChange={(value, details) => {
          if (
            details.reason === 'input-change' ||
            details.reason === 'clear-press'
          )
            setQuery(value);
        }}
        itemToStringLabel={(x) => x.label}
        onValueChange={(value) => {
          if (value) {
            trackEvent('search_suggestion_select', {
              locale,
              market,
              query_length: query.trim().length,
              result_count: items.length,
              title_id: value.id,
              media_type: value.type,
              position: items.findIndex((item) => item.id === value.id) + 1,
            });
            onSearch?.();
            window.location.assign(value.href);
          }
        }}
      >
        <ComboboxInput
          disabled={!ready}
          name="q"
          id={inputId}
          maxLength={120}
          aria-label={t(locale, 'searchHint')}
          placeholder={t(locale, 'searchHint')}
          showTrigger={false}
          autoComplete="off"
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !document.querySelector(
                '[data-slot="combobox-item"][data-highlighted]',
              )
            ) {
              e.preventDefault();
              submitSearch();
            }
          }}
        >
          {!buttonLabel && (
            <button
              disabled={!ready}
              type="submit"
              className="search-submit"
              aria-label={buttonLabel || t(locale, 'search')}
            >
              <span>{buttonLabel || t(locale, 'search')}</span>
              <ArrowRight size={20} />
            </button>
          )}
        </ComboboxInput>
        <ComboboxContent>
          <ComboboxList>
            {(item: Suggestion) => (
              <ComboboxItem key={item.id} value={item}>
                <div>
                  <strong>{item.label}</strong>
                  <span className="hint">
                    {' '}
                    {item.year} · {t(locale, item.type)}
                  </span>
                </div>
                <ArrowRight size={16} />
              </ComboboxItem>
            )}
          </ComboboxList>
          <button type="button" className="search-all" onClick={submitSearch}>
            {t(locale, 'search')} <ArrowRight size={16} />
          </button>
        </ComboboxContent>
      </Combobox>
      {buttonLabel && (
        <button
          type="submit"
          className="button primary comparison-search-submit"
          disabled={!ready}
        >
          {buttonLabel}
          <ArrowRight size={18} />
        </button>
      )}
      <span className="sr-only" role="status">
        {busy ? t(locale, 'loading') : ''}
      </span>
    </form>
  );
}

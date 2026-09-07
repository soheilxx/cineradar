'use client';
import { useEffect, useState } from 'react';
import { t, type MessageKey } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';
import { fold } from '@/domain/search';
import { trackEvent } from '@/lib/analytics';

type SearchState = 'queued' | 'running' | 'complete' | 'deferred' | 'failed';
type SearchStatus = {
  state: SearchState;
  statusKey?: string;
  resultsAvailable?: boolean;
};
type StoredSearch = SearchStatus & {
  partialReloaded?: boolean;
  completedReloaded?: boolean;
};
const states: SearchState[] = [
  'queued',
  'running',
  'complete',
  'deferred',
  'failed',
];

function readStored(key: string): StoredSearch | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(key) || 'null',
    ) as StoredSearch | null;
    return value && states.includes(value.state) ? value : null;
  } catch {
    return null;
  }
}
function saveStored(key: string, value: StoredSearch) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function pause(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, 2000);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

export function SearchMore({
  locale,
  market,
  query,
  enabled,
}: {
  locale: Locale;
  market: string;
  query: string;
  enabled: boolean;
}) {
  const [state, setState] = useState<SearchState | 'idle'>('idle');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || query.trim().length < 2) return;
    const key = [
      'cr_search',
      locale,
      market,
      new Date().toISOString().slice(0, 10),
      fold(query),
    ].join(':');
    let stored = readStored(key);
    if (attempt === 0 && stored) {
      setState(
        stored.state === 'queued' || stored.state === 'running'
          ? 'deferred'
          : stored.state,
      );
      return;
    }
    const controller = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const update = (next: SearchStatus) => {
      if (
        stored?.state !== next.state ||
        stored?.resultsAvailable !== next.resultsAvailable
      ) {
        trackEvent('search_more_status', {
          locale,
          market,
          query_length: query.trim().length,
          status: next.state,
          results_available: !!next.resultsAvailable,
        });
      }
      stored = { ...stored, ...next };
      saveStored(key, stored);
      setState(next.state);
    };
    async function check() {
      let statusKey = stored?.statusKey;
      try {
        while (!controller.signal.aborted) {
          const response = await fetch(
            statusKey
              ? `/api/search-more?key=${encodeURIComponent(statusKey)}`
              : '/api/search-more',
            statusKey
              ? { signal: controller.signal, cache: 'no-store' }
              : {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ locale, market, query }),
                  signal: controller.signal,
                  cache: 'no-store',
                },
          );
          const result = (await response
            .json()
            .catch(() => null)) as SearchStatus | null;
          if (controller.signal.aborted) return;
          if (!response.ok) {
            update({
              state:
                response.status === 429 || response.status === 503
                  ? 'deferred'
                  : 'failed',
            });
            return;
          }
          if (!result || !states.includes(result.state)) {
            update({ state: 'failed' });
            return;
          }
          if (typeof result.statusKey === 'string')
            statusKey = result.statusKey;
          update({
            state: result.state,
            resultsAvailable: result.resultsAvailable,
            ...(statusKey ? { statusKey } : {}),
          });
          if (
            result.state === 'complete' ||
            (result.state === 'deferred' && result.resultsAvailable)
          ) {
            // Show partial imports once, then refresh once more when the rest
            // finish. A partial refresh must not hide later completed results.
            const reloadFlag =
              result.state === 'complete'
                ? 'completedReloaded'
                : 'partialReloaded';
            if (!stored?.[reloadFlag]) {
              saveStored(key, {
                ...stored,
                state: result.state,
                [reloadFlag]: true,
              });
              window.location.reload();
            }
            return;
          }
          if (result.state === 'deferred' || result.state === 'failed') return;
          if (!statusKey) {
            update({ state: 'deferred' });
            return;
          }
          await pause(controller.signal);
        }
      } catch {
        if (!controller.signal.aborted) update({ state: 'failed' });
      } finally {
        clearTimeout(deadline);
      }
    }
    // A deferred start lets React's effect cleanup cancel an unused mount before
    // its request and storage marker are created. Persist before the request so
    // later remounts cannot create a loop; blocked storage requires a button click.
    const kickoff = setTimeout(() => {
      if (!saveStored(key, stored || { state: 'queued' }) && attempt === 0)
        return;
      trackEvent('search_more_start', {
        locale,
        market,
        query_length: query.trim().length,
        trigger: attempt === 0 ? 'automatic' : 'manual',
        source: stored?.statusKey ? 'status_check' : 'title_discovery',
      });
      setState('queued');
      deadline = setTimeout(() => {
        update({ state: 'deferred' });
        controller.abort();
      }, 60000);
      void check();
    }, 0);
    return () => {
      clearTimeout(kickoff);
      clearTimeout(deadline);
      controller.abort();
    };
  }, [attempt, enabled, locale, market, query]);

  if (!enabled || query.trim().length < 2) return null;
  const busy = state === 'queued' || state === 'running';
  const message: MessageKey = busy
    ? 'searchPending'
    : state === 'deferred'
      ? 'searchDeferred'
      : state === 'failed'
        ? 'searchFailed'
        : state === 'complete'
          ? 'searchComplete'
          : 'searchMoreIntro';
  return (
    <div className="notice" aria-busy={busy}>
      <p role="status" aria-live="polite">
        {t(locale, message)}
      </p>
      {state !== 'complete' && (
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => setAttempt((value) => value + 1)}
        >
          {t(
            locale,
            busy
              ? 'loading'
              : state === 'deferred' || state === 'failed'
                ? 'searchCheck'
                : 'searchMore',
          )}
        </button>
      )}
    </div>
  );
}

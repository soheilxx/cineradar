'use client';
import { AppLink } from './app-link';
import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useSaved } from './preferences';
import { PosterGrid } from './cards';
import { Choice } from './select';
import { t } from '@/i18n/messages';
import { path } from '@/i18n/routes';
import type { Locale } from '@/i18n/config';
import type { CatalogItem, Change } from '@/domain/types';
import { trackEvent } from '@/lib/analytics';
export function Watchlist({
  locale,
  market,
}: {
  locale: Locale;
  market: string;
}) {
  const { items } = useSaved();
  const [data, setData] = useState<CatalogItem[]>([]);
  const [events, setEvents] = useState<Change[]>([]);
  const [sort, setSort] = useState('saved');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const selected = items.filter((x) => x.market === market);
    if (!selected.length) {
      setData([]);
      setEvents([]);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale, market, items: selected }),
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const d = (await r.json()) as {
          items: CatalogItem[];
          changes: Change[];
        };
        setData(d.items);
        setEvents(d.changes);
        setFailed(false);
        trackEvent('watchlist_load_success', {
          market,
          result_count: d.items.length,
          change_count: d.changes.length,
        });
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setFailed(true);
          trackEvent('watchlist_load_error', {
            market,
            error_code: 'load_failed',
          });
        }
      })
      .finally(() => setBusy(false));
    return () => controller.abort();
  }, [items, market, locale]);
  const ordered = [...data].sort((a, b) =>
    sort === 'title'
      ? a.title.localizations[locale].title.localeCompare(
          b.title.localizations[locale].title,
          locale,
        )
      : items.findIndex((x) => x.id === b.title.id) -
        items.findIndex((x) => x.id === a.title.id),
  );
  return (
    <>
      <div className="page-toolbar">
        <p className="muted">{t(locale, 'deviceOnly')}</p>
        <Choice
          label={t(locale, 'sort')}
          value={sort}
          onChange={(value) => {
            setSort(value);
            trackEvent('watchlist_sort_change', {
              market,
              filter_value: value,
              item_count: data.length,
            });
          }}
          options={[
            { value: 'saved', label: t(locale, 'dateSaved') },
            { value: 'title', label: t(locale, 'titleSort') },
          ]}
        />
      </div>
      {busy && <p role="status">{t(locale, 'loading')}</p>}
      {failed && <p role="alert">{t(locale, 'error')}</p>}
      {ordered.length ? (
        <PosterGrid items={ordered} locale={locale} market={market} />
      ) : (
        !busy && (
          <div className="empty-state">
            <Bookmark size={38} />
            <h2>{t(locale, 'watchlist')}</h2>
            <p>{t(locale, 'emptyWatchlist')}</p>
            <AppLink className="button primary" href={path(locale, market)}>
              {t(locale, 'browseAll')}
            </AppLink>
          </div>
        )
      )}
      <section className="section">
        <h2>{t(locale, 'changes')}</h2>
        {events.length ? (
          <ul className="change-list">
            {events.map((e) => (
              <li key={e.id}>
                <span>
                  {
                    data.find((d) => d.title.id === e.titleId)?.title
                      .localizations[locale].title
                  }
                </span>
                <span>
                  {t(
                    locale,
                    e.kind === 'added'
                      ? 'changeAdded'
                      : e.kind === 'removed'
                        ? 'changeRemoved'
                        : 'changeUpdated',
                  )}{' '}
                  · {e.provider}
                </span>
                <time>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                  }).format(new Date(e.at))}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t(locale, 'noChanges')}</p>
        )}
      </section>
    </>
  );
}

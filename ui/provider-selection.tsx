'use client';
import { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { t } from '@/i18n/messages';
import { path } from '@/i18n/routes';
import type { Locale } from '@/i18n/config';
import type { Provider } from '@/domain/types';
import { readProviders } from './preferences';
import { trackEvent } from '@/lib/analytics';
export function ProviderSelection({
  providers,
  locale,
  market,
  full = false,
}: {
  providers: Provider[];
  locale: Locale;
  market: string;
  full?: boolean;
}) {
  const [selection, setSelection] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setSelection(readProviders(market)), [market]);
  function change(key: string) {
    const next = selection.includes(key)
      ? selection.filter((x) => x !== key)
      : [...selection, key];
    try {
      localStorage.setItem(
        'cineradar:providers:' + market,
        JSON.stringify(next),
      );
      setSelection(next);
      setError(false);
      trackEvent('provider_selection_change', {
        provider_id: key.split(':')[0],
        selected: next.includes(key),
        selected_count: next.length,
        source: key.includes(':') ? 'addon' : 'provider',
        market,
      });
      window.dispatchEvent(new Event('cineradar:providers'));
    } catch {
      setError(true);
      trackEvent('provider_selection_error', {
        market,
        error_code: 'storage_error',
      });
    }
  }
  const controls = (
    <>
      <p className="muted">{t(locale, 'addonHelp')}</p>
      <div className="provider-options">
        {providers.map((p) => (
          <div key={p.id}>
            <label className="provider-option">
              <Checkbox
                checked={selection.includes(p.id)}
                onCheckedChange={() => change(p.id)}
              />
              {p.logo && <img src={p.logo} width="64" height="32" alt="" />}
              <span>{p.name}</span>
            </label>
            {p.addons.map((a) => (
              <label className="provider-option addon-option" key={a.id}>
                <Checkbox
                  checked={selection.includes(p.id + ':' + a.id)}
                  onCheckedChange={() => change(p.id + ':' + a.id)}
                />
                <span>
                  {a.name} <small>{t(locale, 'addon')}</small>
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
      {!providers.length && <p>{t(locale, 'setup')}</p>}
      <p className="hint">{t(locale, 'deviceOnly')}</p>
      {error && <p role="alert">{t(locale, 'storageError')}</p>}
    </>
  );
  if (full) return <section className="panel">{controls}</section>;
  return (
    <div className="provider-strip">
      <div className="strip-label">
        <span className="eyebrow">{t(locale, 'myProviders')}</span>
        <span className="hint">
          {t(locale, 'selected', { count: selection.length })}
        </span>
      </div>
      <div className="provider-chips">
        {[...providers]
          .sort((a, b) => {
            const order = [
              'netflix',
              'prime',
              'disney',
              'apple',
              'hbo',
              'hulu',
            ];
            const rank = (id: string) =>
              order.includes(id) ? order.indexOf(id) : order.length;
            return rank(a.id) - rank(b.id);
          })
          .slice(0, 5)
          .map((p) => (
            <button
              key={p.id}
              aria-pressed={selection.includes(p.id)}
              className={'provider-chip provider-' + p.id}
              onClick={() => change(p.id)}
            >
              {p.logo ? (
                <img src={p.logo} alt={p.name} width="92" height="36" />
              ) : (
                <span>{p.name}</span>
              )}
              {selection.includes(p.id) && <Check size={14} />}
            </button>
          ))}
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          trackEvent(next ? 'provider_dialog_open' : 'provider_dialog_close', {
            market,
            selected_count: selection.length,
          });
        }}
      >
        <DialogTrigger
          className="button provider-manage"
          aria-label={t(locale, 'manage')}
        >
          <Plus size={18} />
          <span>{t(locale, 'manage')}</span>
        </DialogTrigger>
        <DialogContent className="providers-dialog" showCloseButton={false}>
          <DialogTitle>{t(locale, 'myProviders')}</DialogTitle>
          <DialogDescription>{t(locale, 'deviceOnly')}</DialogDescription>
          <DialogClose className="dialog-close" aria-label={t(locale, 'close')}>
            <X />
          </DialogClose>
          {controls}
          <DialogClose className="button primary">
            {t(locale, 'apply')}
          </DialogClose>
        </DialogContent>
      </Dialog>
      {selection.length > 0 && (
        <a
          className="my-filter"
          href={
            path(locale, market, 'movies') +
            '?mine=' +
            encodeURIComponent(selection.join(','))
          }
        >
          {t(locale, 'inMine')} →
        </a>
      )}
    </div>
  );
}

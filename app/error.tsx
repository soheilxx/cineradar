'use client';
import { t } from '@/i18n/messages';
import { isLocale } from '@/i18n/config';
export default function ErrorPage({ reset }: { reset: () => void }) {
  const raw =
    typeof window === 'undefined'
      ? 'en'
      : window.location.pathname.split('/')[1];
  const locale = isLocale(raw) ? raw : 'en';
  return (
    <main className="container not-found">
      <h1>{t(locale, 'error')}</h1>
      <button className="button primary" onClick={reset}>
        {t(locale, 'retry')}
      </button>
    </main>
  );
}

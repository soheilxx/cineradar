'use client';
import { useState } from 'react';
import { t } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';
export function ContactForm({
  locale,
  market,
  enabled,
  titleId,
}: {
  locale: Locale;
  market: string;
  enabled: boolean;
  titleId?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  return (
    <form
      className="contact-form panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus('sending');
        const form = e.currentTarget;
        const data = new FormData(form);
        try {
          const r = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              locale,
              market,
              titleId,
              message: data.get('message'),
              email: data.get('email') || undefined,
              website: data.get('website'),
            }),
          });
          if (!r.ok) throw Error();
          setStatus('sent');
          form.reset();
        } catch {
          setStatus('error');
        }
      }}
    >
      <label>
        {t(locale, 'message')}
        <textarea
          name="message"
          minLength={10}
          maxLength={3000}
          required
          rows={6}
        />
      </label>
      <label>
        {t(locale, 'email')}
        <input name="email" type="email" maxLength={254} />
      </label>
      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {!enabled && <p>{t(locale, 'unavailableContact')}</p>}
      <button
        className="button primary"
        disabled={!enabled || status === 'sending'}
      >
        {t(locale, status === 'sending' ? 'loading' : 'send')}
      </button>
      <p role="status">
        {status === 'sent'
          ? t(locale, 'sent')
          : status === 'error'
            ? t(locale, 'sendError')
            : ''}
      </p>
    </form>
  );
}

'use client';
import { useRef, useState } from 'react';
import { t } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';
import { contactCopy as copy } from '@/content/contact';
import { path } from '@/i18n/routes';
import { trackEvent } from '@/lib/analytics';
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
  const started = useRef(false);
  const formId = titleId ? 'report' : 'contact';
  return (
    <form
      className="contact-form panel"
      data-analytics-form-id={formId}
      onFocusCapture={() => {
        if (!started.current) {
          started.current = true;
          trackEvent('contact_start', { form_id: formId });
        }
      }}
      onInvalidCapture={() => {
        trackEvent('contact_validation_error', {
          form_id: formId,
          error_code: 'browser_validation',
        });
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (status === 'sending' || !enabled) return;
        setStatus('sending');
        trackEvent('contact_submit', { form_id: formId });
        const startedAt = performance.now();
        const form = e.currentTarget;
        const data = new FormData(form);
        let errorCode = 'network_error';
        try {
          const r = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              locale,
              market,
              titleId,
              name: data.get('name'),
              subject: data.get('subject'),
              message: data.get('message'),
              email: data.get('email'),
              website: data.get('website'),
            }),
          });
          if (!r.ok) {
            errorCode =
              r.status === 429 ? 'rate_limited' : 'submission_rejected';
            throw Error();
          }
          setStatus('sent');
          trackEvent('contact_success', {
            form_id: formId,
            status: 'stored',
            duration_ms: Math.round(performance.now() - startedAt),
          });
          form.reset();
        } catch {
          setStatus('error');
          trackEvent('contact_error', {
            form_id: formId,
            error_code: errorCode,
            duration_ms: Math.round(performance.now() - startedAt),
          });
        }
      }}
    >
      <div className="contact-form-heading">
        <h2>{copy.formTitle[locale]}</h2>
        <p>{copy.required[locale]}</p>
      </div>
      <div className="contact-fields">
        <label>
          {copy.name[locale]} *
          <input
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <label>
          {copy.email[locale]} *
          <input
            name="email"
            type="email"
            maxLength={254}
            required
            autoComplete="email"
            inputMode="email"
          />
        </label>
      </div>
      <label>
        {copy.subject[locale]} *
        <input name="subject" required minLength={3} maxLength={160} />
      </label>
      <label>
        {t(locale, 'message')} *
        <textarea
          name="message"
          minLength={10}
          maxLength={3000}
          required
          rows={6}
          aria-describedby="message-help"
        />
      </label>
      <p className="contact-field-help" id="message-help">
        {copy.details[locale]}
      </p>
      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {!enabled && <p>{t(locale, 'unavailableContact')}</p>}
      <p className="contact-privacy">
        {copy.privacy[locale]}{' '}
        <a href={path(locale, market, 'privacy')}>{t(locale, 'privacy')}</a>.
      </p>
      <button
        className="button primary"
        disabled={!enabled || status === 'sending'}
      >
        {t(locale, status === 'sending' ? 'loading' : 'send')}
      </button>
      <p role="status">
        {status === 'sent'
          ? copy.stored[locale]
          : status === 'error'
            ? t(locale, 'sendError')
            : ''}
      </p>
    </form>
  );
}

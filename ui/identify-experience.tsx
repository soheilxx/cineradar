'use client';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import {
  ArrowRight,
  Check,
  LoaderCircle,
  RotateCcw,
  ScanSearch,
  SlidersHorizontal,
  ChevronDown,
  X,
} from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { IdentifyRequest, IdentifyResponse } from '@/domain/identify';
import {
  identifyCopy,
  identifyExampleLabels,
  identifyClearExclusions,
} from '@/content/identify';
import { trackEvent } from '@/lib/analytics';
import { path } from '@/i18n/routes';
import { t } from '@/i18n/messages';
import { Artwork } from './artwork';
import { AppLink } from './app-link';
import { VoiceInput } from './voice-input';
import { useHydrated } from './use-hydrated';

export function IdentifyExperience({
  locale,
  market,
  aiEnabled,
  examples,
  variant = 'page',
  active = true,
}: {
  locale: Locale;
  market: string;
  aiEnabled: boolean;
  examples: readonly string[];
  variant?: 'page' | 'home';
  active?: boolean;
}) {
  const c = identifyCopy[locale];
  const inputId =
    variant === 'home' ? 'home-scene-description' : 'scene-description';
  const countId = `${inputId}-count`;
  const resultsId =
    variant === 'home'
      ? 'home-identify-results-heading'
      : 'identify-results-heading';
  const ready = useHydrated();
  const [description, setDescription] = useState('');
  const [mediaType, setMediaType] =
    useState<NonNullable<IdentifyRequest['mediaType']>>('all');
  const [decade, setDecade] = useState('');
  const [excluded, setExcluded] = useState<string[]>([]);
  const [response, setResponse] = useState<IdentifyResponse | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceKey, setVoiceKey] = useState(0);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const revealSubmit = useRef(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const displayedResponse = useRef<IdentifyResponse | null>(null);
  const started = useRef(false);
  const source = useRef('text');
  const busy = loading || voiceBusy || !ready || !active;
  useEffect(() => {
    if (active) return;
    const pending = request.current;
    request.current = null;
    pending?.abort();
    setLoading(false);
    setVoiceBusy(false);
    revealSubmit.current = false;
    if (pending)
      trackEvent('identify_cancel', { locale, market, trigger: 'mode_change' });
  }, [active, locale, market]);
  useEffect(() => {
    if (!active) {
      revealSubmit.current = false;
      return;
    }
    if (!voiceBusy && revealSubmit.current) {
      revealSubmit.current = false;
      submitButton.current?.scrollIntoView({
        block: 'nearest',
        behavior: 'instant',
      });
    }
  }, [description, voiceBusy, active]);
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );
  function begin() {
    if (!started.current) {
      started.current = true;
      trackEvent('identify_start', { source: 'identify', locale, market });
    }
  }
  function cancel() {
    request.current?.abort();
    request.current = null;
    setLoading(false);
    trackEvent('identify_cancel', { locale, market });
  }
  function reset() {
    request.current?.abort();
    request.current = null;
    setLoading(false);
    setVoiceBusy(false);
    setVoiceKey((v) => v + 1);
    setDescription('');
    setResponse(null);
    setExcluded([]);
    setConfirmed(null);
    setError('');
    setDecade('');
    setMediaType('all');
    source.current = 'text';
    revealSubmit.current = false;
    textarea.current?.focus();
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (description.trim().length < 15) {
      setError(c.tooShort);
      textarea.current?.focus();
      return;
    }
    begin();
    setError('');
    setLoading(true);
    setConfirmed(null);
    setResponse(null);
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 45000);
    const began = performance.now();
    trackEvent('identify_submit', {
      locale,
      market,
      source: source.current,
      query_length: description.trim().length,
      media_type: mediaType,
      selected_count: excluded.length,
    });
    try {
      const result = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          locale,
          market,
          mediaType,
          ...(decade ? { decade: Number(decade) } : {}),
          excludedIds: excluded,
        }),
        signal: controller.signal,
      });
      if (request.current !== controller) return;
      if (!result.ok) {
        setError(result.status === 429 ? c.limit : c.error);
        trackEvent('identify_error', {
          error_code: String(result.status),
          locale,
          market,
        });
        return;
      }
      const data: IdentifyResponse = await result.json();
      if (request.current !== controller || controller.signal.aborted) return;
      if (!Array.isArray(data.items) || !['ai', 'catalog'].includes(data.mode))
        throw new Error('Invalid response');
      setResponse(data);
      trackEvent(data.items.length ? 'identify_results' : 'identify_no_match', {
        result_count: data.items.length,
        status: data.status,
        source: data.mode,
        duration_ms: Math.round(performance.now() - began),
        locale,
        market,
      });
    } catch {
      if (request.current !== controller) return;
      if (!controller.signal.aborted || timedOut) {
        setError(c.error);
        trackEvent('identify_error', {
          error_code: timedOut ? 'timeout' : 'network',
          locale,
          market,
        });
      }
    } finally {
      clearTimeout(timer);
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }
  useEffect(() => {
    if (response === displayedResponse.current) return;
    displayedResponse.current = response;
    if (active && response) {
      resultHeading.current?.focus({ preventScroll: true });
      resultHeading.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    }
  }, [response, active]);
  const visibleItems =
    response?.items.filter((item) => !excluded.includes(item.card.id)) || [];
  return (
    <div className={`identify-experience identify-experience-${variant}`}>
      <form
        className="identify-form"
        method="post"
        onSubmit={submit}
        noValidate
        aria-busy={loading}
      >
        <div className="identify-form-title">
          <label htmlFor={inputId}>{c.label}</label>
          <span className="identify-mode">
            <span aria-hidden="true" />
            {aiEnabled ? c.ai : c.catalog}
          </span>
        </div>
        <div className="identify-input-wrap">
          <textarea
            ref={textarea}
            id={inputId}
            rows={3}
            minLength={15}
            maxLength={1600}
            required
            disabled={loading || !ready || !active}
            placeholder={c.placeholder}
            value={description}
            onFocus={begin}
            onChange={(event) => {
              setDescription(event.target.value);
              source.current = 'text';
              setError('');
            }}
            aria-describedby={countId}
            aria-invalid={Boolean(error && description.trim().length < 15)}
          />
          <div className="identify-input-tools">
            {active && (
              <VoiceInput
                key={voiceKey}
                locale={locale}
                routeKey={`${locale}:${market}:identify`}
                valueLength={description.length}
                maxChars={1600}
                serverEnabled={aiEnabled}
                disabled={loading}
                onTranscript={(text) => {
                  begin();
                  source.current = 'voice';
                  revealSubmit.current = true;
                  setDescription((value) =>
                    `${value.trim()}${value.trim() ? ' ' : ''}${text}`.slice(
                      0,
                      1600,
                    ),
                  );
                  setError('');
                }}
                onBusyChange={setVoiceBusy}
              />
            )}
            <span id={countId} className="identify-count">
              {description.length} / 1600
            </span>
          </div>
        </div>
        {excluded.length > 0 && (
          <p className="identify-excluded">
            {excluded.length} {c.excluded}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setExcluded([]);
                trackEvent('identify_exclusions_reset', { locale, market });
              }}
            >
              {identifyClearExclusions[locale]}
            </button>
          </p>
        )}
        {error && (
          <p role="alert" className="identify-error">
            {error}
          </p>
        )}
        <div className="identify-submit-row">
          <button
            ref={submitButton}
            className="identify-submit"
            type="submit"
            disabled={busy}
          >
            {loading ? (
              <LoaderCircle className="identify-spinner" size={19} />
            ) : (
              <ScanSearch size={20} />
            )}
            {loading ? c.loading : c.submit}
            {!loading && <ArrowRight size={19} />}
          </button>
          {loading ? (
            <button className="identify-reset" type="button" onClick={cancel}>
              <X size={16} />
              {c.cancel}
            </button>
          ) : description ||
            response ||
            excluded.length ||
            decade ||
            mediaType !== 'all' ? (
            <button className="identify-reset" type="button" onClick={reset}>
              <RotateCcw size={15} />
              {c.reset}
            </button>
          ) : null}
        </div>
        <div className="identify-options-row">
          <details className="identify-options">
            <summary>
              <SlidersHorizontal size={15} aria-hidden="true" />
              {c.filters}
              {(mediaType !== 'all' || decade) && (
                <span className="identify-filter-count">
                  {Number(mediaType !== 'all') + Number(Boolean(decade))}
                </span>
              )}
              <ChevronDown
                size={14}
                className="identify-options-chevron"
                aria-hidden="true"
              />
            </summary>
            <div className="identify-filters">
              <fieldset disabled={busy}>
                <legend>{c.type}</legend>
                <div>
                  {(['all', 'movie', 'tv'] as const).map((type) => (
                    <label key={type}>
                      <input
                        type="radio"
                        name={`${inputId}-media-type`}
                        value={type}
                        checked={mediaType === type}
                        onChange={() => setMediaType(type)}
                      />
                      <span>{c[type]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="identify-decade">
                {c.decade}
                <select
                  value={decade}
                  onChange={(event) => setDecade(event.target.value)}
                  disabled={busy}
                >
                  <option value="">{c.anyDecade}</option>
                  {[
                    2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1940, 1930,
                    1920,
                  ].map((year) => (
                    <option key={year} value={year}>
                      {year}–{year + 9}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </details>
          <AppLink
            className="identify-privacy-link"
            href={path(locale, market, 'privacy')}
          >
            {t(locale, 'privacy')}
          </AppLink>
        </div>
        <div className="sr-only" role="status">
          {loading ? c.loading : ''}
        </div>
      </form>
      <div className="identify-examples">
        <span>{c.examples}</span>
        <div>
          {examples.map((example, i) => (
            <button
              type="button"
              key={example}
              disabled={busy}
              onClick={() => {
                begin();
                source.current = 'example';
                setDescription(example);
                setError('');
                setExcluded([]);
                setResponse(null);
                textarea.current?.focus();
              }}
            >
              <span aria-hidden="true">0{i + 1}</span>
              {identifyExampleLabels[locale][i]}
            </button>
          ))}
        </div>
      </div>
      {response && (
        <section className="identify-results" aria-labelledby={resultsId}>
          <p className="eyebrow gold">02 — Cineradar</p>
          <h2 id={resultsId} ref={resultHeading} tabIndex={-1}>
            {visibleItems.length ? c.results : c.empty}
          </h2>
          {response.notice === 'ai_unavailable' && (
            <p className="identify-notice">{c.unavailable}</p>
          )}
          {response.mode === 'catalog' &&
            aiEnabled &&
            response.notice !== 'ai_unavailable' && (
              <p className="identify-notice">{c.catalog}</p>
            )}
          <div className="identify-results-grid">
            {visibleItems.map(({ card, reasons, match }, index) => (
              <article
                key={card.id}
                className={`identify-result${confirmed === card.id ? ' is-confirmed' : ''}`}
              >
                <AppLink
                  href={path(locale, market, card.type, card.slug)}
                  className="identify-result-art"
                  aria-label={card.title}
                  data-analytics-title-id={card.id}
                  data-analytics-media-type={card.type}
                  data-analytics-position={index + 1}
                  data-analytics-source="identify"
                >
                  <Artwork
                    src={card.poster}
                    alt=""
                    width={185}
                    height={278}
                    loading="lazy"
                  />
                </AppLink>
                <div className="identify-result-copy">
                  <span className="identify-match">
                    {confirmed === card.id ? (
                      <>
                        <Check size={14} />
                        {c.confirmed}
                      </>
                    ) : match === 'strong' ? (
                      c.strong
                    ) : (
                      c.possible
                    )}
                  </span>
                  <h3>
                    <AppLink
                      href={path(locale, market, card.type, card.slug)}
                      data-analytics-title-id={card.id}
                      data-analytics-media-type={card.type}
                      data-analytics-position={index + 1}
                      data-analytics-source="identify"
                    >
                      {card.title}
                    </AppLink>
                  </h3>
                  <p className="identify-result-meta">
                    {c[card.type]}
                    {card.year ? ` · ${card.year}` : ''}
                  </p>
                  {reasons.length > 0 && (
                    <div className="identify-reasons">
                      <span>{c.why}</span>
                      <ul>
                        {reasons.slice(0, 2).map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {card.providers.length > 0 && (
                    <p className="identify-providers">
                      {card.providers
                        .slice(0, 3)
                        .map((provider) => provider.name)
                        .join(' · ')}
                    </p>
                  )}
                  <AppLink
                    className="identify-detail-link"
                    href={path(locale, market, card.type, card.slug)}
                    data-analytics-title-id={card.id}
                    data-analytics-media-type={card.type}
                    data-analytics-position={index + 1}
                    data-analytics-source="identify"
                  >
                    {c.details}
                    <ArrowRight size={16} />
                  </AppLink>
                  <div className="identify-result-actions">
                    <button
                      type="button"
                      disabled={confirmed === card.id}
                      onClick={() => {
                        setConfirmed(card.id);
                        trackEvent('identify_confirm', {
                          title_id: card.id,
                          media_type: card.type,
                          position: index + 1,
                          locale,
                          market,
                        });
                      }}
                    >
                      <Check size={16} />
                      {c.found}
                    </button>
                    <button
                      type="button"
                      disabled={excluded.length >= 6}
                      onClick={() => {
                        setExcluded((ids) => [...ids, card.id].slice(0, 6));
                        resultHeading.current?.focus({ preventScroll: true });
                        if (confirmed === card.id) setConfirmed(null);
                        trackEvent('identify_exclude', {
                          title_id: card.id,
                          position: index + 1,
                          locale,
                          market,
                        });
                      }}
                    >
                      <X size={15} />
                      {c.notThis}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {(response.followUp ||
            !visibleItems.length ||
            excluded.length > 0) && (
            <div className="identify-followup">
              <p>{c.followUp[response.followUp || 'detail']}</p>
              <button
                type="button"
                onClick={() => {
                  textarea.current?.focus();
                  textarea.current?.scrollIntoView({
                    block: 'center',
                    behavior: window.matchMedia(
                      '(prefers-reduced-motion: reduce)',
                    ).matches
                      ? 'instant'
                      : 'smooth',
                  });
                }}
              >
                {c.refine}
                <ArrowRight size={17} />
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

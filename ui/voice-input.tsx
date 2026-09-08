'use client';
import { useId } from 'react';
import { Mic, Square, X, LoaderCircle, Check, Info } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { VoiceErrorCode } from '@/lib/voice-controller';
import { voiceCopy as copy } from '@/content/voice-input';
import { useVoiceInput } from './use-voice-input';

function errorText(error: VoiceErrorCode, locale: Locale) {
  switch (error) {
    case 'unsupported':
      return copy.unsupported[locale];
    case 'insecure':
      return copy.insecure[locale];
    case 'policy_blocked':
    case 'permission_blocked':
      return copy.permission[locale];
    case 'audio_unavailable':
      return copy.microphone[locale];
    case 'no_speech':
      return copy.noSpeech[locale];
    case 'language_unsupported':
      return copy.language[locale];
    case 'rate_limited':
    case 'budget_exhausted':
    case 'service_unavailable':
      return copy.busy[locale];
    case 'too_large':
      return copy.tooLarge[locale];
    case 'text_full':
      return copy.full[locale];
    default:
      return copy.failed[locale];
  }
}
export function VoiceInput({
  locale,
  routeKey,
  valueLength,
  maxChars = 1600,
  serverEnabled,
  disabled,
  onTranscript,
  onBusyChange,
}: {
  locale: Locale;
  routeKey: string;
  valueLength: number;
  maxChars?: number;
  serverEnabled: boolean;
  disabled: boolean;
  onTranscript: (text: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const voice = useVoiceInput({
    locale,
    routeKey,
    serverEnabled,
    onTranscript,
    onBusyChange,
  });
  const id = useId();
  const remaining = Math.max(
    0,
    maxChars - valueLength - (valueLength > 0 ? 1 : 0),
  );
  const waiting = ['starting', 'stopping', 'transcribing'].includes(
    voice.status,
  );
  const elapsedSeconds = Math.min(60, Math.floor(voice.elapsedMs / 1000));
  const message = voice.error
    ? errorText(voice.error, locale)
    : voice.status === 'idle' || voice.status === 'error'
      ? ''
      : copy[voice.status][locale];
  return (
    <section
      className={`voice-input${voice.busy ? ' voice-input-active' : ''}`}
      aria-label={copy.title[locale]}
    >
      <div className="voice-actions">
        {!voice.busy ? (
          <button
            type="button"
            className="voice-start"
            disabled={
              !voice.ready ||
              disabled ||
              !remaining ||
              voice.mode === 'unsupported'
            }
            onClick={() => voice.start(remaining)}
            data-analytics-control="voice_start"
          >
            <Mic size={17} />
            {copy.start[locale]}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="voice-stop"
              onClick={voice.stop}
              disabled={voice.status !== 'listening'}
              data-analytics-control="voice_stop"
            >
              {waiting ? (
                <LoaderCircle size={17} className="voice-spinner" />
              ) : (
                <Square size={15} />
              )}
              {copy.stop[locale]}
            </button>
            <button
              type="button"
              className="voice-cancel"
              onClick={voice.cancel}
              data-analytics-control="voice_cancel"
            >
              <X size={17} />
              {voice.status === 'transcribing'
                ? copy.cancelRequest[locale]
                : copy.cancel[locale]}
            </button>
          </>
        )}
        {voice.status === 'listening' && (
          <span className="voice-levels" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((n) => (
              <i key={n} />
            ))}
          </span>
        )}
        {voice.busy && (
          <span className="voice-time" aria-hidden="true">
            {Math.floor(elapsedSeconds / 60)}:
            {String(elapsedSeconds % 60).padStart(2, '0')} / 1:00
          </span>
        )}
        <details className="voice-info">
          <summary aria-controls={`${id}-notice`}>
            <Info size={17} aria-hidden="true" />
            <span className="sr-only">{copy.infoLabel[locale]}</span>
          </summary>
          <p id={`${id}-notice`} className="voice-note">
            {voice.mode === 'server'
              ? copy.serverInfo[locale]
              : copy.browserInfo[locale]}
          </p>
        </details>
      </div>
      {voice.ready && voice.mode === 'unsupported' && !voice.error && (
        <p className="voice-note">{copy.unsupported[locale]}</p>
      )}
      {!remaining && !voice.busy && (
        <p className="voice-note">{copy.full[locale]}</p>
      )}
      <p
        className={`voice-status${voice.error ? ' voice-error' : ''}`}
        role="status"
        aria-live="polite"
      >
        {voice.status === 'success' && <Check size={16} aria-hidden="true" />}
        {message}
      </p>
      {voice.interim && (
        <div className="voice-preview" data-analytics-ignore="true">
          <span>{copy.preview[locale]}</span>
          <p>{voice.interim}</p>
        </div>
      )}
    </section>
  );
}

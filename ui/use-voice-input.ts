'use client';
import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { trackEvent } from '@/lib/analytics';
import {
  VoiceController,
  VoiceInputError,
  type VoiceEnvironment,
  type VoiceRecognition,
  type VoiceRecorder,
  type VoiceState,
} from '@/lib/voice-controller';

type SpeechWindow = Window & {
  SpeechRecognition?: new () => VoiceRecognition;
  webkitSpeechRecognition?: new () => VoiceRecognition;
};
function environment(serverEnabled: boolean): VoiceEnvironment {
  const speechWindow = window as SpeechWindow;
  const Recognition =
    speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
  const mime =
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function'
      ? [
          'audio/webm;codecs=opus',
          'audio/mp4',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/ogg',
        ].find((type) => MediaRecorder.isTypeSupported(type))
      : undefined;
  const policy = document as Document & {
    featurePolicy?: { allowsFeature(name: string): boolean };
  };
  return {
    secure: window.isSecureContext,
    policyAllowed: policy.featurePolicy?.allowsFeature('microphone') !== false,
    serverEnabled,
    getUserMedia: navigator.mediaDevices?.getUserMedia
      ? () => navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      : undefined,
    createRecorder: mime
      ? (stream) =>
          new MediaRecorder(stream as MediaStream, {
            mimeType: mime,
            audioBitsPerSecond: 64_000,
          }) as unknown as VoiceRecorder
      : undefined,
    createRecognition:
      typeof Recognition === 'function' ? () => new Recognition() : undefined,
    transcribe: async (audio, locale, signal) => {
      const body = new FormData();
      const extension = audio.type.includes('mp4')
        ? 'mp4'
        : audio.type.includes('ogg')
          ? 'ogg'
          : 'webm';
      body.set('file', audio, `recording.${extension}`);
      body.set('locale', locale);
      const response = await fetch('/api/identify/transcribe', {
        method: 'POST',
        body,
        signal,
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const code =
          data && typeof data === 'object' && 'error' in data ? data.error : '';
        switch (code) {
          case 'rate_limited':
          case 'budget_exhausted':
          case 'too_large':
          case 'timeout':
          case 'network':
          case 'no_speech':
          case 'invalid_response':
            throw new VoiceInputError(code);
          default:
            throw new VoiceInputError('service_unavailable');
        }
      }
      if (
        !data ||
        typeof data !== 'object' ||
        !('text' in data) ||
        typeof data.text !== 'string' ||
        data.text.length > 1600
      )
        throw new VoiceInputError('invalid_response');
      return data.text;
    },
  };
}
const initial: VoiceState = {
  mode: 'unsupported',
  status: 'idle',
  error: null,
  elapsedMs: 0,
  interim: '',
};
export function useVoiceInput({
  locale,
  routeKey,
  serverEnabled,
  onTranscript,
  onBusyChange,
}: {
  locale: Locale;
  routeKey: string;
  serverEnabled: boolean;
  onTranscript: (text: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [state, setState] = useState(initial);
  const [ready, setReady] = useState(false);
  const controller = useRef<VoiceController | null>(null);
  const callbacks = useRef({ onTranscript, onBusyChange });
  useEffect(() => {
    callbacks.current = { onTranscript, onBusyChange };
  }, [onTranscript, onBusyChange]);
  useEffect(() => {
    const voice = new VoiceController(environment(serverEnabled), locale, {
      state: setState,
      transcript: (text) => callbacks.current.onTranscript(text),
      event: (name, params) => trackEvent(name, params),
    });
    controller.current = voice;
    setState(voice.snapshot);
    setReady(true);
    const hidden = () => {
      if (document.hidden) voice.cancel('hidden');
    };
    const pagehide = () => voice.cancel('navigation');
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', pagehide);
    return () => {
      voice.dispose();
      controller.current = null;
      callbacks.current.onBusyChange?.(false);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', pagehide);
    };
  }, [locale, routeKey, serverEnabled]);
  const busy = ['starting', 'listening', 'stopping', 'transcribing'].includes(
    state.status,
  );
  useEffect(() => {
    callbacks.current.onBusyChange?.(busy);
  }, [busy]);
  return {
    ...state,
    ready,
    busy,
    start: (remaining: number) => controller.current?.start(remaining),
    stop: () => controller.current?.stop(),
    cancel: () => controller.current?.cancel(),
  };
}

import type { Locale } from '../i18n/config';

export const VOICE_MAX_BYTES = 3 * 1024 * 1024;
export const VOICE_MAX_MS = 60_000;
export const voiceLanguages: Record<Locale, string> = {
  de: 'de-DE',
  fr: 'fr-FR',
  it: 'it-IT',
  es: 'es-ES',
  en: 'en-US',
};
export type VoiceErrorCode =
  | 'unsupported'
  | 'insecure'
  | 'policy_blocked'
  | 'permission_blocked'
  | 'audio_unavailable'
  | 'network'
  | 'no_speech'
  | 'language_unsupported'
  | 'service_unavailable'
  | 'timeout'
  | 'too_large'
  | 'text_full'
  | 'rate_limited'
  | 'budget_exhausted'
  | 'invalid_response'
  | 'unknown';
export class VoiceInputError extends Error {
  constructor(public code: VoiceErrorCode) {
    super(code);
  }
}
export type VoiceMode = 'server' | 'browser' | 'unsupported';
export type VoiceStatus =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'stopping'
  | 'transcribing'
  | 'success'
  | 'error';
export interface VoiceState {
  mode: VoiceMode;
  status: VoiceStatus;
  error: VoiceErrorCode | null;
  elapsedMs: number;
  interim: string;
}
export interface VoiceStream {
  getTracks(): Array<{ stop(): void }>;
}
export interface VoiceRecorder {
  state: string;
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}
export interface VoiceRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult:
    | ((event: {
        results: ArrayLike<{
          isFinal: boolean;
          [index: number]: { transcript: string };
        }>;
      }) => void)
    | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export interface VoiceEnvironment {
  secure: boolean;
  policyAllowed: boolean;
  serverEnabled: boolean;
  getUserMedia?: () => Promise<VoiceStream>;
  createRecorder?: (stream: VoiceStream) => VoiceRecorder;
  createRecognition?: () => VoiceRecognition;
  transcribe: (
    audio: Blob,
    locale: Locale,
    signal: AbortSignal,
  ) => Promise<string>;
  now?: () => number;
}
export interface VoiceEvents {
  state: (state: VoiceState) => void;
  transcript: (text: string) => void;
  event: (name: string, params: Record<string, string | number>) => void;
}
interface Session {
  limit: number;
  startedAt: number;
  captured: boolean;
  stream?: VoiceStream;
  recorder?: VoiceRecorder;
  recognition?: VoiceRecognition;
  chunks: Blob[];
  bytes: number;
  final: string;
  abort: AbortController;
  timer?: ReturnType<typeof setTimeout>;
  tick?: ReturnType<typeof setInterval>;
}
export function voiceError(error: unknown): VoiceErrorCode {
  if (error instanceof VoiceInputError) return error.code;
  const name =
    error && typeof error === 'object' && 'name' in error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'permission_blocked';
  if (
    name === 'NotFoundError' ||
    name === 'NotReadableError' ||
    name === 'OverconstrainedError'
  )
    return 'audio_unavailable';
  if (name === 'TimeoutError') return 'timeout';
  return 'unknown';
}
export function speechError(code: string): VoiceErrorCode {
  switch (code) {
    case 'not-allowed':
      return 'permission_blocked';
    case 'service-not-allowed':
      return 'service_unavailable';
    case 'audio-capture':
      return 'audio_unavailable';
    case 'network':
      return 'network';
    case 'no-speech':
      return 'no_speech';
    case 'language-not-supported':
      return 'language_unsupported';
    default:
      return 'unknown';
  }
}

// No browser globals, persistence or microphone access until an explicit start.
// The small environment port also lets tests simulate devices without recording.
export class VoiceController {
  private current: Session | null = null;
  private disposed = false;
  private state: VoiceState;
  constructor(
    private env: VoiceEnvironment,
    private locale: Locale,
    private events: VoiceEvents,
  ) {
    const mode: VoiceMode =
      env.serverEnabled && env.getUserMedia && env.createRecorder
        ? 'server'
        : env.createRecognition
          ? 'browser'
          : 'unsupported';
    this.state = {
      mode,
      status: 'idle',
      error: null,
      elapsedMs: 0,
      interim: '',
    };
  }
  get snapshot() {
    return this.state;
  }
  private now() {
    return this.env.now?.() ?? Date.now();
  }
  private update(patch: Partial<VoiceState>) {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) this.events.state(this.state);
  }
  private active(session: Session) {
    return !this.disposed && this.current === session;
  }
  private clearTimers(session: Session) {
    clearTimeout(session.timer);
    clearInterval(session.tick);
  }
  private tracks(session: Session) {
    session.stream?.getTracks().forEach((track) => track.stop());
  }
  private clean(session: Session) {
    this.clearTimers(session);
    session.abort.abort();
    if (session.recorder) {
      session.recorder.ondataavailable =
        session.recorder.onstop =
        session.recorder.onerror =
          null;
      try {
        if (session.recorder.state !== 'inactive') session.recorder.stop();
      } catch {}
    }
    if (session.recognition) {
      session.recognition.onstart =
        session.recognition.onend =
        session.recognition.onerror =
        session.recognition.onresult =
          null;
      try {
        session.recognition.abort();
      } catch {}
    }
    this.tracks(session);
    session.chunks = [];
    session.final = '';
  }
  private telemetry(
    name: string,
    session: Session,
    extra: Record<string, string | number> = {},
  ) {
    this.events.event(name, {
      source: 'voice',
      duration_ms: Math.max(0, this.now() - session.startedAt),
      ...extra,
    });
  }
  private fail(code: VoiceErrorCode, session?: Session) {
    if (session && !this.active(session)) return;
    if (session) {
      this.current = null;
      this.clean(session);
      this.telemetry('voice_error', session, { error_code: code });
    }
    this.update({ status: 'error', error: code, interim: '' });
  }
  private listening(session: Session) {
    if (!this.active(session)) return;
    session.captured = true;
    session.startedAt = this.now();
    this.clearTimers(session);
    this.update({ status: 'listening', elapsedMs: 0 });
    this.telemetry('voice_start', session);
    session.timer = setTimeout(() => this.stop('limit'), VOICE_MAX_MS);
    session.tick = setInterval(() => {
      if (this.active(session))
        this.update({
          elapsedMs: Math.min(VOICE_MAX_MS, this.now() - session.startedAt),
        });
    }, 1000);
  }
  private finish(session: Session, text: string) {
    if (!this.active(session)) return;
    const transcript = text.trim().slice(0, session.limit).trim();
    if (!transcript) {
      this.fail('no_speech', session);
      return;
    }
    this.current = null;
    this.clean(session);
    this.update({ status: 'success', error: null, interim: '' });
    this.telemetry('voice_result', session, {
      query_length: transcript.length,
    });
    this.events.transcript(transcript);
  }
  start(remainingChars = 1600) {
    if (this.disposed || this.current) return;
    if (!this.env.secure) {
      this.fail('insecure');
      return;
    }
    if (!this.env.policyAllowed) {
      this.fail('policy_blocked');
      return;
    }
    if (this.state.mode === 'unsupported') {
      this.fail('unsupported');
      return;
    }
    if (remainingChars < 1) {
      this.fail('text_full');
      return;
    }
    const session: Session = {
      limit: Math.min(1600, remainingChars),
      startedAt: this.now(),
      captured: false,
      chunks: [],
      bytes: 0,
      final: '',
      abort: new AbortController(),
    };
    this.current = session;
    this.update({ status: 'starting', error: null, elapsedMs: 0, interim: '' });
    session.timer = setTimeout(() => this.fail('timeout', session), 20_000);
    if (this.state.mode === 'server') void this.record(session);
    else this.recognize(session);
  }
  private async record(session: Session) {
    try {
      const stream = await this.env.getUserMedia!();
      // A permission prompt can resolve after cancellation. Release that device.
      if (!this.active(session)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      session.stream = stream;
      const recorder = this.env.createRecorder!(stream);
      session.recorder = recorder;
      recorder.ondataavailable = ({ data }) => {
        if (!this.active(session) || !data.size) return;
        session.bytes += data.size;
        if (session.bytes > VOICE_MAX_BYTES) {
          this.fail('too_large', session);
          return;
        }
        session.chunks.push(data);
      };
      recorder.onerror = () => this.fail('audio_unavailable', session);
      recorder.onstop = () => {
        void this.upload(session);
      };
      recorder.start(1000);
      this.listening(session);
    } catch (error) {
      this.fail(voiceError(error), session);
    }
  }
  private async upload(session: Session) {
    if (!this.active(session) || this.state.status === 'transcribing') return;
    if (this.state.status === 'listening')
      this.telemetry('voice_stop', session, { trigger: 'engine' });
    if (session.recorder) session.recorder.onstop = null;
    this.clearTimers(session);
    this.tracks(session);
    const audio = new Blob(session.chunks, {
      type: session.recorder?.mimeType || '',
    });
    session.chunks = [];
    if (!audio.size) {
      this.fail('no_speech', session);
      return;
    }
    if (audio.size > VOICE_MAX_BYTES) {
      this.fail('too_large', session);
      return;
    }
    this.update({ status: 'transcribing' });
    session.timer = setTimeout(() => this.fail('timeout', session), 25_000);
    try {
      this.finish(
        session,
        await this.env.transcribe(audio, this.locale, session.abort.signal),
      );
    } catch (error) {
      this.fail(
        error instanceof VoiceInputError ? error.code : 'network',
        session,
      );
    }
  }
  private recognize(session: Session) {
    try {
      const recognition = this.env.createRecognition!();
      session.recognition = recognition;
      recognition.lang = voiceLanguages[this.locale];
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => this.listening(session);
      recognition.onerror = ({ error }) =>
        this.fail(speechError(error), session);
      recognition.onresult = ({ results }) => {
        if (!this.active(session)) return;
        const final: string[] = [],
          interim: string[] = [];
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          (result.isFinal ? final : interim).push(result[0]?.transcript || '');
        }
        session.final = final.join(' ').trim().slice(0, session.limit);
        this.update({
          interim: [...final, ...interim]
            .join(' ')
            .trim()
            .slice(0, session.limit),
        });
        if (session.final.length >= session.limit) this.stop('limit');
      };
      recognition.onend = () => {
        if (this.active(session) && this.state.status === 'listening')
          this.telemetry('voice_stop', session, { trigger: 'engine' });
        this.finish(session, session.final);
      };
      recognition.start();
    } catch (error) {
      this.fail(voiceError(error), session);
    }
  }
  stop(trigger = 'user') {
    const session = this.current;
    if (!session || !session.captured || this.state.status !== 'listening')
      return;
    this.clearTimers(session);
    this.update({
      status: 'stopping',
      elapsedMs: this.now() - session.startedAt,
    });
    this.telemetry('voice_stop', session, { trigger });
    session.timer = setTimeout(() => this.fail('timeout', session), 5_000);
    try {
      if (session.recorder) {
        session.recorder.stop();
        this.tracks(session);
      } else session.recognition?.stop();
    } catch (error) {
      this.fail(voiceError(error), session);
    }
  }
  cancel(trigger = 'user') {
    const session = this.current;
    if (!session) return;
    this.current = null;
    this.clean(session);
    this.telemetry('voice_cancel', session, { trigger });
    this.update({ status: 'idle', error: null, interim: '' });
  }
  dispose() {
    this.disposed = true;
    this.cancel('navigation');
  }
}

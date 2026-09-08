import { isLocale } from '../i18n/config';
import { VOICE_MAX_BYTES } from './voice-controller';

type TranscribeCode =
  | 'unavailable'
  | 'invalid_request'
  | 'too_large'
  | 'unsupported_format'
  | 'rate_limited'
  | 'budget_exhausted'
  | 'timeout'
  | 'network'
  | 'no_speech'
  | 'invalid_response';
class TranscribeError extends Error {
  constructor(
    public code: TranscribeCode,
    public status: number,
  ) {
    super(code);
  }
}
export interface TranscribeDependencies {
  enabled: boolean;
  apiKey?: string;
  model: string;
  sameOrigin: (request: Request) => boolean;
  rate: (request: Request) => Promise<boolean>;
  reserve: () => Promise<boolean>;
  fetcher?: typeof fetch;
}
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
async function boundedBytes(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
  signal: AbortSignal,
) {
  if (!body) throw new TranscribeError('invalid_request', 400);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    for (;;) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new TranscribeError('too_large', 413);
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener('abort', abort);
    await reader.cancel().catch(() => undefined);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return data;
}
export async function audioExtension(file: File): Promise<string> {
  const type = file.type.split(';')[0].trim().toLowerCase();
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const text = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (
    type === 'audio/webm' &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
    return 'webm';
  if (type === 'audio/mp4' && text(4, 8) === 'ftyp') return 'mp4';
  if (type === 'audio/ogg' && text(0, 4) === 'OggS') return 'ogg';
  if (
    ['audio/wav', 'audio/x-wav'].includes(type) &&
    text(0, 4) === 'RIFF' &&
    text(8, 12) === 'WAVE'
  )
    return 'wav';
  if (
    type === 'audio/mpeg' &&
    (text(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))
  )
    return 'mp3';
  throw new TranscribeError('unsupported_format', 415);
}

// Ephemeral bounded multipart processing; neither audio nor transcript is logged.
export async function handleVoiceTranscription(
  request: Request,
  dependencies: TranscribeDependencies,
) {
  if (!dependencies.sameOrigin(request))
    return reply({ error: 'invalid_request' }, 403);
  if (!dependencies.enabled || !dependencies.apiKey)
    return reply({ error: 'unavailable' }, 503);
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 20_000);
  const signal = AbortSignal.any([request.signal, timeout.signal]);
  try {
    signal.throwIfAborted();
    const contentType = request.headers.get('content-type') || '';
    if (!/^multipart\/form-data;\s*boundary=/i.test(contentType))
      throw new TranscribeError('invalid_request', 400);
    const length = request.headers.get('content-length');
    if (
      length &&
      (!/^\d+$/.test(length) || Number(length) > VOICE_MAX_BYTES + 64 * 1024)
    )
      throw new TranscribeError('too_large', 413);
    if (!(await dependencies.rate(request)))
      throw new TranscribeError('rate_limited', 429);
    const bytes = await boundedBytes(
      request.body,
      VOICE_MAX_BYTES + 64 * 1024,
      signal,
    );
    let form: FormData;
    try {
      form = await new Response(bytes, {
        headers: { 'Content-Type': contentType },
      }).formData();
    } catch {
      throw new TranscribeError('invalid_request', 400);
    }
    const keys = [...form.keys()];
    const file = form.get('file');
    const locale = form.get('locale');
    if (
      keys.length !== 2 ||
      !keys.includes('file') ||
      !keys.includes('locale') ||
      !(file instanceof File) ||
      typeof locale !== 'string' ||
      !isLocale(locale)
    )
      throw new TranscribeError('invalid_request', 400);
    if (!file.size) throw new TranscribeError('no_speech', 400);
    if (file.size > VOICE_MAX_BYTES)
      throw new TranscribeError('too_large', 413);
    const extension = await audioExtension(file);
    signal.throwIfAborted();
    if (!(await dependencies.reserve()))
      throw new TranscribeError('budget_exhausted', 429);
    signal.throwIfAborted();
    const upstream = new FormData();
    upstream.set('file', file, `recording.${extension}`);
    upstream.set('language', locale);
    upstream.set('model', dependencies.model);
    upstream.set('response_format', 'json');
    const response = await (dependencies.fetcher ?? fetch)(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${dependencies.apiKey}` },
        body: upstream,
        signal,
        cache: 'no-store',
        redirect: 'error',
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new TranscribeError('unavailable', 502);
    }
    let data: unknown;
    try {
      data = JSON.parse(
        new TextDecoder().decode(
          await boundedBytes(response.body, 16 * 1024, signal),
        ),
      );
    } catch (error) {
      if (signal.aborted) throw error;
      throw new TranscribeError('invalid_response', 502);
    }
    if (
      !data ||
      typeof data !== 'object' ||
      !('text' in data) ||
      typeof data.text !== 'string' ||
      data.text.length > 1600
    )
      throw new TranscribeError('invalid_response', 502);
    const text = data.text.trim();
    if (!text) throw new TranscribeError('no_speech', 422);
    return reply({ text });
  } catch (error) {
    if (signal.aborted) return reply({ error: 'timeout' }, 408);
    if (error instanceof TranscribeError)
      return reply({ error: error.code }, error.status);
    return reply({ error: 'network' }, 502);
  } finally {
    clearTimeout(timer);
  }
}

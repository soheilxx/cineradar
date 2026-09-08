import { z } from 'zod';
import { locales, markets } from '../i18n/config';
import type { CardItem } from './cards';

export const identifyRequestSchema = z
  .object({
    description: z.string().trim().min(15).max(1600),
    locale: z.enum(locales),
    market: z.enum(markets),
    mediaType: z.enum(['all', 'movie', 'tv']).optional(),
    decade: z
      .number()
      .int()
      .min(1900)
      .max(2030)
      .refine((year) => year % 10 === 0)
      .optional(),
    excludedIds: z
      .array(z.string().regex(/^(movie|tv):[1-9]\d{0,9}$/))
      .max(6)
      .optional(),
  })
  .strict();
export type IdentifyRequest = z.infer<typeof identifyRequestSchema>;
export type IdentifyFollowUp = 'scene' | 'person' | 'setting' | 'detail' | null;
export interface IdentifyItem {
  card: CardItem;
  reasons: string[];
  match: 'strong' | 'possible';
}
export interface IdentifyResponse {
  mode: 'ai' | 'catalog';
  status: 'matches' | 'needs_clues' | 'no_match';
  items: IdentifyItem[];
  followUp: IdentifyFollowUp;
  notice?: 'ai_unavailable' | 'catalog_only' | 'limited_catalog';
}

/** A streaming byte cap also covers chunked requests without Content-Length. */
export async function readIdentifyBody(request: Request): Promise<unknown> {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
    'application/json'
  )
    throw new Error('invalid_request');
  const length = Number(request.headers.get('content-length') ?? 0);
  if (!Number.isFinite(length) || length < 0 || length > 8192)
    throw new Error('invalid_request');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid_request');
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
  let rejectAbort: (reason: unknown) => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const abort = () => {
    rejectAbort(signal.reason);
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', abort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const { value, done } = await Promise.race([reader.read(), aborted]);
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) throw new Error('invalid_request');
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener('abort', abort);
    void reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

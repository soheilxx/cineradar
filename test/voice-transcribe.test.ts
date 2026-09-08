import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleVoiceTranscription,
  type TranscribeDependencies,
} from '../lib/voice-transcribe';
import { VOICE_MAX_BYTES } from '../lib/voice-controller';

const origin = 'https://cineradar.test';
function request(
  options: {
    locale?: string;
    bytes?: Uint8Array;
    mime?: string;
    origin?: string;
    signal?: AbortSignal;
    extra?: boolean;
  } = {},
) {
  const body = new FormData();
  body.set('locale', options.locale ?? 'de');
  body.set(
    'file',
    new Blob(
      [new Uint8Array(options.bytes ?? [0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4])],
      { type: options.mime ?? 'audio/webm;codecs=opus' },
    ),
    'private-person-name.webm',
  );
  if (options.extra) body.append('locale', 'en');
  return new Request(origin + '/api/identify/transcribe', {
    method: 'POST',
    body,
    headers: { Origin: options.origin ?? origin },
    signal: options.signal,
  });
}
function dependencies(overrides: Partial<TranscribeDependencies> = {}) {
  const counts = { rate: 0, reserve: 0, fetch: 0 };
  const deps: TranscribeDependencies = {
    enabled: true,
    apiKey: 'test-key',
    model: 'gpt-4o-mini-transcribe',
    sameOrigin: (req) => req.headers.get('origin') === origin,
    rate: async () => {
      counts.rate++;
      return true;
    },
    reserve: async () => {
      counts.reserve++;
      return true;
    },
    fetcher: async () => {
      counts.fetch++;
      return Response.json({
        text: 'Eine Stadt unter einer Kuppel',
        usage: { total_tokens: 10 },
      });
    },
    ...overrides,
  };
  return { deps, counts };
}
test('Transcription forwards only a validated file, locale and model with a generated filename and no retained response', async () => {
  let calls = 0;
  const { deps, counts } = dependencies({
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/audio/transcriptions');
      assert.equal(options?.redirect, 'error');
      assert.equal(options?.cache, 'no-store');
      const form = options?.body as FormData;
      assert.equal(form.get('language'), 'de');
      assert.equal(form.get('response_format'), 'json');
      assert.equal(form.get('model'), 'gpt-4o-mini-transcribe');
      assert.equal((form.get('file') as File).name, 'recording.webm');
      assert.equal(form.has('prompt'), false);
      return Response.json({
        text: 'Eine Stadt unter einer Kuppel',
        usage: { total_tokens: 10 },
      });
    },
  });
  const response = await handleVoiceTranscription(request(), deps);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), {
    text: 'Eine Stadt unter einer Kuppel',
  });
  assert.equal(counts.reserve, 1);
  assert.equal(calls, 1);
});
test('Origin, disabled provider, rate and budget gates prevent paid requests', async () => {
  for (const [overrides, incoming, code] of [
    [{}, request({ origin: 'https://other.test' }), 403],
    [{ enabled: false }, request(), 503],
    [{ apiKey: undefined }, request(), 503],
    [{ rate: async () => false }, request(), 429],
    [{ reserve: async () => false }, request(), 429],
  ] as Array<[Partial<TranscribeDependencies>, Request, number]>) {
    const { deps, counts } = dependencies(overrides);
    const response = await handleVoiceTranscription(incoming, deps);
    assert.equal(response.status, code);
    assert.equal(counts.fetch, 0);
  }
});
test('Malformed locale, duplicate fields, oversized files and spoofed audio are rejected before budget reservation', async () => {
  for (const [incoming, code] of [
    [request({ locale: 'xx' }), 400],
    [request({ extra: true }), 400],
    [request({ bytes: new Uint8Array(VOICE_MAX_BYTES + 1) }), 413],
    [
      request({
        bytes: new TextEncoder().encode('<script>not audio</script>'),
      }),
      415,
    ],
    [request({ mime: 'text/plain' }), 415],
  ] as Array<[Request, number]>) {
    const { deps, counts } = dependencies();
    const response = await handleVoiceTranscription(incoming, deps);
    assert.equal(response.status, code);
    assert.equal(counts.reserve, 0);
    assert.equal(counts.fetch, 0);
  }
});
test('Upload streaming is bounded even without a Content-Length header', async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(VOICE_MAX_BYTES + 64 * 1024 + 1));
      controller.close();
    },
  });
  const incoming = new Request(origin, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'multipart/form-data; boundary=test',
    },
    body,
    duplex: 'half',
  } as RequestInit);
  assert.equal(incoming.headers.get('content-length'), null);
  const { deps, counts } = dependencies();
  const response = await handleVoiceTranscription(incoming, deps);
  assert.equal(response.status, 413);
  assert.equal(counts.reserve, 0);
});
test('Untrusted provider responses are bounded and expose only fixed errors', async () => {
  for (const upstream of [
    Response.json(
      { text: 'private@example.test', detail: 'upstream secret' },
      { status: 500 },
    ),
    new Response('not-json'),
    Response.json({ text: 22 }),
    Response.json({ text: 'x'.repeat(1601) }),
    new Response('x'.repeat(17 * 1024)),
    Response.json({ text: '   ' }),
  ]) {
    const { deps } = dependencies({ fetcher: async () => upstream });
    const response = await handleVoiceTranscription(request(), deps);
    assert.ok(response.status >= 400);
    const text = await response.text();
    assert.ok(!text.includes('private@example.test'));
    assert.ok(!text.includes('secret'));
    assert.match(text, /^\{"error":"[a-z_]+"\}$/);
  }
});
test('The twenty-second deadline aborts a stalled provider request', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal: AbortSignal | undefined;
  let called!: () => void;
  const started = new Promise<void>((resolve) => {
    called = resolve;
  });
  const { deps } = dependencies({
    fetcher: async (_url, options) => {
      signal = options?.signal as AbortSignal;
      called();
      return new Promise<Response>((_resolve, reject) =>
        signal!.addEventListener(
          'abort',
          () => reject(new Error('private upstream')),
          { once: true },
        ),
      );
    },
  });
  const pending = handleVoiceTranscription(request(), deps);
  await started;
  t.mock.timers.tick(20_000);
  const response = await pending;
  assert.equal(signal?.aborted, true);
  assert.equal(response.status, 408);
  assert.deepEqual(await response.json(), { error: 'timeout' });
});
test('An already cancelled request never reserves a provider call', async () => {
  const abort = new AbortController();
  abort.abort();
  const { deps, counts } = dependencies();
  const response = await handleVoiceTranscription(
    request({ signal: abort.signal }),
    deps,
  );
  assert.equal(response.status, 408);
  assert.equal(counts.reserve, 0);
});

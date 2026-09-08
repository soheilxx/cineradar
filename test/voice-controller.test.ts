import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VoiceController,
  VOICE_MAX_BYTES,
  VOICE_MAX_MS,
  speechError,
  type VoiceEnvironment,
  type VoiceRecorder,
  type VoiceRecognition,
  type VoiceState,
} from '../lib/voice-controller';

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};
class Recorder implements VoiceRecorder {
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: VoiceRecorder['ondataavailable'] = null;
  onstop: VoiceRecorder['onstop'] = null;
  onerror: VoiceRecorder['onerror'] = null;
  starts = 0;
  stops = 0;
  start() {
    this.starts++;
    this.state = 'recording';
  }
  stop() {
    this.stops++;
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob(['sound'], { type: this.mimeType }),
    });
    this.onstop?.();
  }
}
class Recognition implements VoiceRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: VoiceRecognition['onstart'] = null;
  onend: VoiceRecognition['onend'] = null;
  onerror: VoiceRecognition['onerror'] = null;
  onresult: VoiceRecognition['onresult'] = null;
  starts = 0;
  stops = 0;
  aborts = 0;
  start() {
    this.starts++;
    this.onstart?.();
  }
  stop() {
    this.stops++;
    this.onend?.();
  }
  abort() {
    this.aborts++;
  }
}
function setup(
  overrides: Partial<VoiceEnvironment> = {},
  locale: 'de' | 'fr' | 'it' | 'es' | 'en' = 'de',
) {
  const recorder = new Recorder();
  const recognition = new Recognition();
  const counts = { permissions: 0, releases: 0, uploads: 0 };
  const stream = { getTracks: () => [{ stop: () => counts.releases++ }] };
  const states: VoiceState[] = [],
    transcripts: string[] = [];
  const events: Array<{
    name: string;
    params: Record<string, string | number>;
  }> = [];
  const controller = new VoiceController(
    {
      secure: true,
      policyAllowed: true,
      serverEnabled: true,
      getUserMedia: async () => {
        counts.permissions++;
        return stream;
      },
      createRecorder: () => recorder,
      createRecognition: () => recognition,
      transcribe: async () => {
        counts.uploads++;
        return 'Eine Erinnerung an einen Film';
      },
      ...overrides,
    },
    locale,
    {
      state: (state) => states.push(state),
      transcript: (text) => transcripts.push(text),
      event: (name, params) => events.push({ name, params }),
    },
  );
  return {
    controller,
    recorder,
    recognition,
    counts,
    stream,
    states,
    transcripts,
    events,
  };
}
test('Voice requires an explicit start, ignores a second start and releases audio before transcription', async () => {
  const s = setup();
  try {
    assert.equal(s.counts.permissions, 0);
    assert.equal(s.recorder.starts, 0);
    s.controller.start();
    s.controller.start();
    await flush();
    assert.equal(s.counts.permissions, 1);
    assert.equal(s.recorder.starts, 1);
    assert.equal(s.controller.snapshot.status, 'listening');
    const lateStop = s.recorder.onstop;
    s.controller.stop();
    lateStop?.();
    await flush();
    assert.equal(s.counts.uploads, 1);
    assert.ok(s.counts.releases > 0);
    assert.deepEqual(s.transcripts, ['Eine Erinnerung an einen Film']);
    assert.equal(s.controller.snapshot.status, 'success');
    assert.ok(!JSON.stringify(s.events).includes('Erinnerung'));
  } finally {
    s.controller.dispose();
  }
});
test('Cancel during a permission prompt releases the late device without recording or uploading', async () => {
  let grant!: (stream: { getTracks(): { stop(): void }[] }) => void;
  const pending = new Promise<{ getTracks(): { stop(): void }[] }>(
    (resolve) => {
      grant = resolve;
    },
  );
  const s = setup({ getUserMedia: () => pending });
  s.controller.start();
  s.controller.cancel();
  grant(s.stream);
  await flush();
  assert.equal(s.counts.releases, 1);
  assert.equal(s.recorder.starts, 0);
  assert.equal(s.counts.uploads, 0);
  assert.deepEqual(s.transcripts, []);
  s.controller.dispose();
});
test('Cancellation discards recorded chunks and aborts an in-flight transcription with no late text', async () => {
  const first = setup();
  first.controller.start();
  await flush();
  first.recorder.ondataavailable?.({ data: new Blob(['audio']) });
  first.controller.cancel();
  await flush();
  assert.equal(first.counts.uploads, 0);
  assert.ok(first.counts.releases > 0);
  first.controller.dispose();
  let complete!: (text: string) => void;
  let signal: AbortSignal | undefined;
  const pending = new Promise<string>((resolve) => {
    complete = resolve;
  });
  const second = setup({
    transcribe: async (_blob, _locale, current) => {
      signal = current;
      return pending;
    },
  });
  second.controller.start();
  await flush();
  second.controller.stop();
  await flush();
  assert.equal(second.controller.snapshot.status, 'transcribing');
  second.controller.cancel('hidden');
  assert.equal(signal?.aborted, true);
  complete('Text that must never reach the form');
  await flush();
  assert.deepEqual(second.transcripts, []);
  second.controller.dispose();
});
test('Capture stops at 60 seconds and a hung provider cannot keep the voice input busy', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 });
  const s = setup({ transcribe: () => new Promise(() => {}) });
  s.controller.start();
  await flush();
  t.mock.timers.tick(VOICE_MAX_MS - 1);
  assert.equal(s.recorder.stops, 0);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(s.recorder.stops, 1);
  assert.ok(s.counts.releases > 0);
  t.mock.timers.tick(25_000);
  assert.equal(s.controller.snapshot.error, 'timeout');
  s.controller.dispose();
});
test('Oversized recordings are discarded before upload; blocked contexts never request a device', async () => {
  const s = setup();
  s.controller.start();
  await flush();
  s.recorder.ondataavailable?.({
    data: new Blob([new Uint8Array(VOICE_MAX_BYTES + 1)]),
  });
  assert.equal(s.controller.snapshot.error, 'too_large');
  assert.equal(s.counts.uploads, 0);
  assert.ok(s.counts.releases > 0);
  s.controller.dispose();
  for (const option of [{ secure: false }, { policyAllowed: false }]) {
    const denied = setup(option);
    denied.controller.start();
    await flush();
    assert.equal(denied.counts.permissions, 0);
    denied.controller.dispose();
  }
});
test('Browser recognition replaces repeated result lists, ignores interim words and uses five explicit languages', () => {
  for (const [locale, language] of Object.entries({
    de: 'de-DE',
    fr: 'fr-FR',
    it: 'it-IT',
    es: 'es-ES',
    en: 'en-US',
  })) {
    const s = setup({ serverEnabled: false }, locale as 'de');
    s.controller.start(1600);
    assert.equal(s.recognition.lang, language);
    const results = [
      { isFinal: true, 0: { transcript: 'Ein Film' } },
      { isFinal: false, 0: { transcript: 'privater Entwurf' } },
    ];
    s.recognition.onresult?.({ results });
    s.recognition.onresult?.({ results });
    assert.equal(s.transcripts.length, 0);
    s.controller.stop();
    assert.deepEqual(s.transcripts, ['Ein Film']);
    assert.equal(s.counts.permissions, 0);
    assert.ok(!JSON.stringify(s.events).includes('privater'));
    s.controller.dispose();
  }
});
test('Disposal aborts recognition, ignores stale callbacks, and never restarts; service errors have fixed codes', () => {
  const s = setup({ serverEnabled: false });
  s.controller.start();
  const late = s.recognition.onresult,
    end = s.recognition.onend;
  s.controller.dispose();
  late?.({ results: [{ isFinal: true, 0: { transcript: 'Late result' } }] });
  end?.();
  assert.equal(s.recognition.aborts, 1);
  assert.equal(s.recognition.starts, 1);
  assert.deepEqual(s.transcripts, []);
  assert.equal(speechError('not-allowed'), 'permission_blocked');
  assert.equal(speechError('private@example.test'), 'unknown');
});

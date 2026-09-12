import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../app/api/admin/providers/route';

const saved = { ...process.env };
const secret = 'providers-test-secret';
function restoreEnv() {
  for (const key of Object.keys(process.env))
    if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
}
beforeEach(() => {
  restoreEnv();
  Object.assign(process.env, {
    APP_MODE: 'unconfigured',
    DEPLOYMENT_ENV: 'local',
    SITE_URL: 'http://localhost:3000',
    TVMAZE_ENABLED: 'false',
    OMDB_ENABLED: 'false',
    SYNC_ENABLED: 'false',
    CRON_SECRET: secret,
  });
  delete process.env.DATABASE_URL;
});
after(restoreEnv);
const request = (body: string, authorization = `Bearer ${secret}`) =>
  new Request('http://localhost:3000/api/admin/providers', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body,
  });

test('Provider administration requires the exact configured bearer secret before reads or work', async (t) => {
  let network = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    network++;
    throw new Error('Unexpected provider request');
  });
  for (const authorization of [
    '',
    'Bearer wrong-secret',
    secret,
    `Basic ${secret}`,
  ]) {
    const get = await GET(
      new Request('http://localhost:3000/api/admin/providers', {
        headers: { authorization },
      }),
    );
    const post = await POST(request('{malformed', authorization));
    for (const response of [get, post]) {
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.deepEqual(await response.json(), {});
    }
  }
  delete process.env.CRON_SECRET;
  assert.equal((await POST(request('{"source":"tvmaze"}'))).status, 401);
  assert.equal(network, 0);
});

test('An unauthorized provider request is rejected before its body is consumed', async (t) => {
  const incoming = request('{"source":"omdb"}', 'Bearer wrong-secret');
  let reads = 0;
  t.mock.method(incoming, 'json', async () => {
    reads++;
    throw new Error('Should not parse');
  });
  assert.equal((await POST(incoming)).status, 401);
  assert.equal(reads, 0);
});

test('Malformed provider inputs, especially arrays that stringify to a source name, cannot trigger discovery', async (t) => {
  let network = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    network++;
    throw new Error('Unexpected provider request');
  });
  const invalid: unknown[] = [
    null,
    true,
    1,
    'omdb',
    [],
    {},
    { source: null },
    { source: 1 },
    { source: 'unknown' },
    { source: 'OMDB' },
    { source: ['omdb'] },
    { source: ['tvmaze'] },
    { source: ['discovery'] },
    { source: { value: 'omdb' } },
  ];
  for (const input of invalid) {
    const response = await POST(request(JSON.stringify(input)));
    assert.equal(response.status, 400, JSON.stringify(input));
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  for (const body of ['', '{invalid', '{"source":'])
    assert.equal((await POST(request(body))).status, 400);
  assert.equal(network, 0);
});

test('All valid source names respect disabled providers and cannot override worker limits from JSON', async (t) => {
  let network = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    network++;
    throw new Error('Unexpected provider request');
  });
  for (const source of ['tvmaze', 'omdb', 'discovery']) {
    const response = await POST(
      request(
        JSON.stringify({
          source,
          maxDurationMs: 999999999,
          maxJobs: 999999999,
        }),
      ),
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).enabled, false);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal(network, 0);
});

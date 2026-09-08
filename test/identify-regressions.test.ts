import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { fixtureCatalog } from './fixtures/catalog';
import { identifyCandidates } from '../data/repositories/identify';
import { executeIdentify } from '../domain/identify-search';
import { readIdentifyBody, type IdentifyRequest } from '../domain/identify';

const previousEnvironment = { ...process.env };
let database: PGlite;
const adapter = {
  async query<T>(sql: string, params: unknown[] = []) {
    return { rows: (await database.query<T>(sql, params)).rows };
  },
};
const request: IdentifyRequest = {
  description: 'A distinctive remembered film scene',
  locale: 'en',
  market: 'us',
};

before(async () => {
  process.env.APP_MODE = 'unconfigured';
  process.env.DEPLOYMENT_ENV = 'local';
  database = new PGlite({ extensions: { pg_trgm, unaccent } });
  for (const file of (await readdir('db/migrations')).sort())
    await database.exec(await readFile(`db/migrations/${file}`, 'utf8'));
  const title = structuredClone(fixtureCatalog()[0].title);
  Object.assign(title, {
    id: 'movie:9999901',
    tmdbId: 9999901,
    type: 'movie',
    originalTitle: 'Accent Case',
    cast: ['José García Martínez'],
  });
  for (const localization of Object.values(title.localizations))
    Object.assign(localization, {
      title: 'Accent Case',
      overview: '',
      slug: 'accent-case-9999901',
    });
  title.localizations.fr.overview =
    'Un rêve étrange dans un hôpital proche de cette école.';
  title.localizations.es.overview =
    'Una policía descubre un corazón dentro de un camión.';
  await database.query('SELECT save_title($1)', [JSON.stringify(title)]);
});

after(async () => {
  await database?.close();
  for (const key of Object.keys(process.env))
    if (!(key in previousEnvironment)) delete process.env[key];
  Object.assign(process.env, previousEnvironment);
});

test('French accents and Spanish accent-sensitive stems match the generated index', async () => {
  for (const [locale, description, expected] of [
    ['fr', 'rêve hôpital école', ['reve', 'hopital', 'ecole']],
    ['es', 'policía corazón camión', ['policia', 'corazon', 'camion']],
  ] as const) {
    const candidates = await identifyCandidates(
      { ...request, locale, description },
      undefined,
      adapter,
    );
    assert.equal(candidates[0]?.item.title.id, 'movie:9999901', locale);
    for (const term of expected)
      assert.ok(candidates[0].matched.includes(term), `${locale}: ${term}`);
  }
});

test('Accented cast names are normalized consistently with description terms', async () => {
  const candidates = await identifyCandidates(
    { ...request, description: 'José García Martínez' },
    undefined,
    adapter,
  );
  assert.equal(candidates[0]?.item.title.id, 'movie:9999901');
  assert.deepEqual([...candidates[0].matched].sort(), [
    'garcia',
    'jose',
    'martinez',
  ]);
});

test('A failed catalogue is an unavailable service, not a successful empty search', async () => {
  const databaseFailure = new Error('database_connection_failed');
  const dependencies = {
    enabled: false,
    retrieve: async () => {
      throw databaseFailure;
    },
    interpret: async () => {
      throw new Error('provider_unavailable');
    },
    rank: async () => {
      throw new Error('provider_unavailable');
    },
  };
  await assert.rejects(executeIdentify(request, dependencies));
  await assert.rejects(
    executeIdentify(request, { ...dependencies, enabled: true }),
  );
});

test('Cancelling an incomplete JSON upload promptly releases the body reader', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const upload = new Request('https://cineradar.tv/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: new ReadableStream({
      cancel() {
        cancelled = true;
      },
    }),
    signal: controller.signal,
    duplex: 'half',
  } as RequestInit);
  const reading = readIdentifyBody(upload);
  controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      reading.then(
        () => 'resolved',
        () => 'rejected',
      ),
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve('pending'), 250);
      }),
    ]);
    assert.equal(result, 'rejected');
    assert.equal(cancelled, true);
  } finally {
    clearTimeout(timer);
  }
});

test(
  'A stalled JSON upload has its own deadline before expensive work starts',
  { timeout: 10_000 },
  async () => {
    let cancelled = false;
    const upload = new Request('https://cineradar.tv/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
      duplex: 'half',
    } as RequestInit);
    const reading = readIdentifyBody(upload);
    await assert.rejects(reading);
    assert.equal(cancelled, true);
  },
);

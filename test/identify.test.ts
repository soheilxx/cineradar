import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { fixtureCatalog } from './fixtures/catalog';
import { identifyCandidates } from '../data/repositories/identify';
import {
  executeIdentify,
  rankIdentifyCorpus,
  verifiedRanking,
  identifyQueryTerms,
  identifyPhrases,
  type IdentifyCandidate,
} from '../domain/identify-search';
import {
  identifyRequestSchema,
  readIdentifyBody,
  type IdentifyRequest,
} from '../domain/identify';
import {
  interpretDescription,
  rankIdentifyCandidates,
  reserveIdentifyCall,
  type IdentifyInterpretation,
} from '../data/providers/openai';
import { config } from '../lib/config';

const savedEnv = { ...process.env };
let database: PGlite;
const adapter = {
  async query<T>(sql: string, params: unknown[] = []) {
    return { rows: (await database.query<T>(sql, params)).rows };
  },
};
function entry(
  id: number,
  name: string,
  overview: string,
  votes = 1,
  type: 'movie' | 'tv' = 'movie',
) {
  const item = structuredClone(fixtureCatalog()[0]);
  Object.assign(item.title, {
    id: `${type}:${id}`,
    type,
    tmdbId: id,
    originalTitle: name,
    votes,
    year: 2010,
    cast: [],
  });
  for (const localization of Object.values(item.title.localizations))
    Object.assign(localization, {
      title: name,
      overview,
      slug: `${id}-${localization.locale}`,
      source: 'tmdb',
    });
  item.snapshot.offers = [];
  return item;
}
const target = entry(
  27205,
  'Inception',
  'A thief enters dreams and steals secrets from the subconscious. A spinning top signals reality.',
  100,
);
target.title.localizations.de.overview =
  'Ein Dieb dringt in Träume ein und stiehlt Geheimnisse aus dem Unterbewusstsein. Ein Kreisel zeigt die Realität.';
target.title.cast = ['Leonardo DiCaprio', 'Joseph Gordon-Levitt'];
const space = entry(
  157336,
  'Interstellar',
  'Explorers travel through a wormhole beyond this galaxy to discover whether mankind has a future among the stars.',
  500,
);
space.title.localizations.it.overview = '';
const popular = entry(
  90001,
  'Dream Lovers',
  'Dreams dreams dreams. Friends find romance and happiness in a small town.',
  1000000,
);
const show = entry(
  63174,
  'Lucifer',
  'The Devil leaves Hell for Los Angeles and helps detective Chloe solve murders.',
  16000,
  'tv',
);
const rows = [
  popular,
  target,
  space,
  show,
  entry(90002, 'Dream Home', 'Dreams of a family house.'),
  entry(90003, 'Secrets', 'Family secrets cause trouble.'),
];
const request: IdentifyRequest = {
  description: 'thief enters dreams subconscious spinning top',
  locale: 'en',
  market: 'us',
};
const interpretation: IdentifyInterpretation = {
  clues: ['thief', 'dreams', 'spinning top'],
  englishClues: ['subconscious'],
  hypotheses: [{ title: 'Inception', type: 'movie', year: 2010 }],
  followUp: null,
};
before(async () => {
  Object.assign(process.env, {
    APP_MODE: 'unconfigured',
    DEPLOYMENT_ENV: 'local',
    SITE_URL: 'http://localhost:3000',
    OPENAI_API_KEY: 'mock-key',
    IDENTIFY_AI_ENABLED: 'true',
    IDENTIFY_DAILY_LIMIT: '5',
    IDENTIFY_MONTHLY_LIMIT: '8',
  });
  database = new PGlite({ extensions: { pg_trgm, unaccent } });
  for (const file of (await readdir('db/migrations')).sort())
    await database.exec(await readFile(`db/migrations/${file}`, 'utf8'));
  for (const row of rows)
    await database.query('SELECT save_title($1)', [JSON.stringify(row.title)]);
});
after(async () => {
  await database?.close();
  for (const key of Object.keys(process.env))
    if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
});

test('Description API validates bounds, filters and public identifiers', () => {
  assert(identifyRequestSchema.safeParse(request).success);
  for (const input of [
    { ...request, description: 'too short' },
    { ...request, description: 'x'.repeat(1601) },
    { ...request, locale: 'xx' },
    { ...request, market: 'gb' },
    { ...request, decade: 2015 },
    { ...request, excludedIds: ['movie:1;DROP TABLE titles'] },
    { ...request, excludedIds: Array(7).fill('tv:1') },
    { ...request, url: 'https://example.com' },
  ])
    assert.equal(identifyRequestSchema.safeParse(input).success, false);
});

test('JSON reader enforces content type and byte cap including chunked requests', async () => {
  const valid = new Request('https://example.com/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  assert.deepEqual(await readIdentifyBody(valid), request);
  for (const body of ['x'.repeat(8193), '{not JSON'])
    await assert.rejects(
      readIdentifyBody(
        new Request('https://example.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
      ),
    );
  await assert.rejects(
    readIdentifyBody(
      new Request('https://example.com', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
    ),
  );
});

test('Distinctive shared clues beat repeated generic words and popularity in SQL and fixtures', async () => {
  assert.equal(
    (await identifyCandidates(request, undefined, adapter))[0].item.title.id,
    target.title.id,
  );
  assert.equal(
    rankIdentifyCorpus(rows, request)[0].item.title.id,
    target.title.id,
  );
  const german = await identifyCandidates(
    {
      ...request,
      locale: 'de',
      description: 'Dieb Traum Unterbewusstsein Kreisel Realität',
    },
    undefined,
    adapter,
  );
  assert.equal(german[0].item.title.id, target.title.id);
  assert(
    german[0].matched.includes('traum'),
    'German stemmer handles Träume/Traum',
  );
});

test('English overview fallback and cast find titles without local synopsis or offers', async () => {
  const found = await identifyCandidates(
    {
      ...request,
      locale: 'it',
      market: 'it',
      description: 'wormhole galaxy mankind stars',
    },
    undefined,
    adapter,
  );
  assert.equal(found[0].item.title.id, space.title.id);
  assert.equal(found[0].item.snapshot.availability, 'unchecked');
  assert.deepEqual(found[0].item.snapshot.offers, []);
  assert.equal(
    (
      await identifyCandidates(
        { ...request, description: 'Leonardo DiCaprio subconscious' },
        undefined,
        adapter,
      )
    )[0].item.title.id,
    target.title.id,
  );
});

test('Type, decade and exclusions hold for metadata and model hypotheses', async () => {
  assert.equal(
    (
      await identifyCandidates(
        { ...request, mediaType: 'tv' },
        interpretation,
        adapter,
      )
    ).some((candidate) => candidate.item.title.type === 'movie'),
    false,
  );
  assert.equal(
    (
      await identifyCandidates(
        { ...request, decade: 1990 },
        interpretation,
        adapter,
      )
    ).length,
    0,
  );
  assert.equal(
    (
      await identifyCandidates(
        { ...request, excludedIds: [target.title.id] },
        interpretation,
        adapter,
      )
    ).some((candidate) => candidate.item.title.id === target.title.id),
    false,
  );
  const unknown = await identifyCandidates(
    { ...request, description: 'xyzzymemory without matching vocabulary' },
    {
      clues: [],
      englishClues: [],
      hypotheses: [
        { title: 'Never existed movie', type: 'unknown', year: null },
      ],
    },
    adapter,
  );
  assert.equal(unknown.length, 0);
});

test('Descriptions and hypothesis names stay SQL data, and vector updates follow normal imports', async () => {
  await identifyCandidates(
    { ...request, description: "';DROP TABLE titles; -- movie memories" },
    {
      ...interpretation,
      hypotheses: [
        { title: "'; SELECT * FROM titles; --", type: 'unknown', year: null },
      ],
    },
    adapter,
  );
  assert.equal(
    (await database.query('SELECT id FROM titles')).rows.length,
    rows.length,
  );
  const changed = structuredClone(space.title);
  changed.localizations.en.overview += ' A rare celadon spaceship appears.';
  await database.query('SELECT save_title($1)', [JSON.stringify(changed)]);
  assert.equal(
    (
      await identifyCandidates(
        { ...request, description: 'celadon spaceship appears' },
        undefined,
        adapter,
      )
    )[0].item.title.id,
    space.title.id,
  );
});

test('Model English clues remain eligible after a long original description', () => {
  const terms = identifyQueryTerms(
    {
      ...request,
      description: Array.from(
        { length: 40 },
        (_, i) => 'rememberedword' + i,
      ).join(' '),
    },
    interpretation,
  );
  assert(terms.includes('subconscious'));
  assert(terms.length <= 28);
});

test('Country names retain language-specific words and compound places get phrase matching', async () => {
  const german = {
    ...request,
    locale: 'de' as const,
    description:
      'Der Teufel verlässt die Hölle und hilft einer Polizistin in Los Angeles.',
  };
  assert(identifyQueryTerms(german).includes('los'));
  assert(identifyPhrases(german).includes('los angeles'));
  assert.equal(
    identifyQueryTerms({
      ...german,
      locale: 'es',
      description: 'Los policías buscan al asesino.',
    }).includes('los'),
    false,
  );
  const result = await identifyCandidates(
    { ...request, description: 'Devil Hell Los Angeles' },
    undefined,
    adapter,
  );
  assert.equal(result[0].item.title.id, show.title.id);
});

test('Repeated inflections of one clue cannot create several independent matches', async () => {
  const result = await identifyCandidates(
    { ...request, description: 'dream dreams dreaming dreamed' },
    undefined,
    adapter,
  );
  assert(result.length > 0);
  for (const candidate of result) assert.equal(candidate.matched.length, 1);
});

test('Atomic AI quota caps concurrent reservations independently of SAA', async () => {
  const results = await Promise.all(
    Array.from({ length: 20 }, () => reserveIdentifyCall(adapter)),
  );
  assert.equal(results.filter(Boolean).length, 5);
  assert.equal(
    Number(
      (
        await database.query<{ consumed: number }>(
          "SELECT consumed FROM budgets WHERE service='openai-identify' AND length(period)=7",
        )
      ).rows[0].consumed,
    ),
    5,
  );
  assert.equal(
    (await database.query("SELECT * FROM budgets WHERE service='saa'")).rows
      .length,
    0,
  );
});

test('OpenAI is explicitly gated by both key and switch', () => {
  assert.equal(config({}).identifyAiEnabled, false);
  assert.equal(
    config({ IDENTIFY_AI_ENABLED: 'true' }).identifyAiEnabled,
    false,
  );
  assert.equal(config({ OPENAI_API_KEY: 'key' }).identifyAiEnabled, false);
  assert.equal(
    config({ OPENAI_API_KEY: 'key', IDENTIFY_AI_ENABLED: 'true' })
      .identifyAiEnabled,
    true,
  );
});

function completion(value: unknown) {
  return Response.json({
    status: 'completed',
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', text: JSON.stringify(value) }],
      },
    ],
  });
}
test('Responses adapter uses strict schemas, store false, a fixed endpoint and no tools', async () => {
  let calls = 0;
  const result = await interpretDescription(
    { description: request.description },
    {
      signal: new AbortController().signal,
      reserve: async () => true,
      fetcher: async (url, init) => {
        calls++;
        assert.equal(url, 'https://api.openai.com/v1/responses');
        assert.equal(typeof init?.body, 'string');
        const body = JSON.parse(init?.body as string);
        assert.equal(body.store, false);
        assert.equal(body.model, 'gpt-5.4-mini');
        assert.equal(body.text.format.type, 'json_schema');
        assert.equal(body.text.format.strict, true);
        assert.equal(body.tools, undefined);
        assert.equal(init?.redirect, 'error');
        assert.equal(body.max_output_tokens, 2000);
        return completion(interpretation);
      },
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(result, interpretation);
});

test('Provider refusal, incomplete, invalid and budget exhausted responses do not retry', async () => {
  for (const response of [
    Response.json({ status: 'incomplete', output: [] }),
    Response.json({
      status: 'completed',
      output: [
        { type: 'message', content: [{ type: 'refusal', refusal: 'No' }] },
      ],
    }),
    completion({ ...interpretation, externalUrl: 'https://evil.invalid' }),
    new Response('upstream error', { status: 429 }),
  ]) {
    let calls = 0;
    await assert.rejects(
      interpretDescription(
        {},
        {
          signal: new AbortController().signal,
          reserve: async () => true,
          fetcher: async () => {
            calls++;
            return response;
          },
        },
      ),
    );
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(
    interpretDescription(
      {},
      {
        signal: new AbortController().signal,
        reserve: async () => false,
        fetcher: async () => {
          calls++;
          return completion(interpretation);
        },
      },
    ),
  );
  assert.equal(calls, 0);
});

test('Only supplied IDs and exact public evidence survive model reranking', async () => {
  const candidates = await identifyCandidates(request, interpretation, adapter);
  const response = verifiedRanking(
    {
      items: [
        {
          id: 'movie:9999999',
          match: 'strong',
          evidence: [{ source: 'overview', quote: 'invented' }],
        },
        {
          id: target.title.id,
          match: 'strong',
          evidence: [{ source: 'overview', quote: 'A thief enters dreams' }],
        },
        {
          id: target.title.id,
          match: 'strong',
          evidence: [{ source: 'overview', quote: 'Duplicate' }],
        },
        {
          id: popular.title.id,
          match: 'strong',
          evidence: [
            { source: 'overview', quote: 'a spinning top proves this movie' },
          ],
        },
      ],
      followUp: null,
    },
    candidates,
    request,
  );
  assert.equal(response.items.length, 1);
  assert.equal(response.items[0].card.id, target.title.id);
  assert.deepEqual(response.items[0].reasons, ['A thief enters dreams']);
});

test('Catalog fallback is honest and a provider failure preserves useful baseline matches', async () => {
  const candidates = await identifyCandidates(request, undefined, adapter);
  let calls = 0;
  const dependencies = {
    enabled: false,
    retrieve: async () => candidates,
    interpret: async () => {
      calls++;
      throw new Error('provider');
    },
    rank: async () => {
      calls++;
      throw new Error('provider');
    },
  };
  const local = await executeIdentify(request, dependencies);
  assert.equal(local.mode, 'catalog');
  assert.equal(local.notice, 'catalog_only');
  assert.equal(calls, 0);
  assert.equal(local.items[0].card.id, target.title.id);
  const failed = await executeIdentify(request, {
    ...dependencies,
    enabled: true,
  });
  assert.equal(failed.mode, 'catalog');
  assert.equal(failed.notice, 'ai_unavailable');
  assert.equal(calls, 1);
});

test('Two-stage engine caps candidates and never forwards artwork or provider URLs', async () => {
  const candidates = await identifyCandidates(request, interpretation, adapter);
  let calls = 0;
  const response = await executeIdentify(request, {
    enabled: true,
    retrieve: async () => Array(30).fill(candidates[0]) as IdentifyCandidate[],
    interpret: async () => {
      calls++;
      return interpretation;
    },
    rank: async (input) => {
      calls++;
      const context = input as { candidates: Record<string, unknown>[] };
      assert.equal(context.candidates.length, 24);
      assert.equal(context.candidates[0].poster, undefined);
      assert.equal(context.candidates[0].offers, undefined);
      assert(String(context.candidates[0].overview).length <= 1200);
      return {
        items: [
          {
            id: target.title.id,
            match: 'strong',
            evidence: [{ source: 'overview', quote: 'A thief enters dreams' }],
          },
        ],
        followUp: null,
      };
    },
  });
  assert.equal(calls, 2);
  assert.equal(response.mode, 'ai');
  assert.equal(response.items.length, 1);
});

test('Client cancellation aborts orchestration rather than returning stale results', async () => {
  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  await assert.rejects(
    executeIdentify(request, {
      enabled: true,
      signal: controller.signal,
      retrieve: async () => [],
      interpret: async () => interpretation,
      rank: async () => ({ items: [], followUp: 'scene' }),
    }),
  );
});

test('Reranking adapter validates evidence and does not accept arbitrary model URLs', async () => {
  await assert.rejects(
    rankIdentifyCandidates(
      {},
      {
        signal: new AbortController().signal,
        reserve: async () => true,
        fetcher: async () =>
          completion({
            items: [
              { id: 'https://evil.invalid', match: 'strong', evidence: [] },
            ],
            followUp: null,
          }),
      },
    ),
  );
});

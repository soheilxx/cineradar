import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from '../data/db';
import type { MediaJob, ProcessedMedia } from '../domain/media';
import {
  claimMedia,
  failMedia,
  findMediaVariant,
  finishMedia,
  getMediaForTitles,
  mediaStats,
  registerMediaSources,
  renewMedia,
} from '../data/media/repository';

let database: PGlite;
const adapter: Database = {
  async query<T>(sql: string, parameters: unknown[] = []) {
    return { rows: (await database.query<T>(sql, parameters)).rows };
  },
};
const source = (name = 'inception', size = 'w500') =>
  `https://image.tmdb.org/t/p/${size}/${name}.jpg`;

before(async () => {
  database = new PGlite();
  await database.exec(
    'CREATE TABLE titles(id text PRIMARY KEY,data jsonb NOT NULL)',
  );
  await database.exec(await readFile('db/migrations/009_media.sql', 'utf8'));
});
after(async () => database.close());
beforeEach(async () => {
  await database.exec(
    'TRUNCATE title_media,media_variants,media_rate_windows,media_assets,titles CASCADE',
  );
});

async function title(id = 'movie:27205', poster: string | null = source()) {
  await adapter.query('INSERT INTO titles(id,data) VALUES($1,$2::jsonb)', [
    id,
    JSON.stringify({
      originalTitle: 'Inception',
      year: 2010,
      localizations: { en: { title: 'Inception', slug: 'inception-27205' } },
      poster,
      backdrop: null,
    }),
  ]);
}
async function updatePoster(poster: string | null, id = 'movie:27205') {
  await adapter.query(
    "UPDATE titles SET data=jsonb_set(data,'{poster}',$2::jsonb) WHERE id=$1",
    [id, JSON.stringify(poster)],
  );
}
async function claim() {
  const job = await claimMedia(adapter);
  assert.ok(job, 'a due, linked asset should be claimable');
  return job;
}
function processed(job: MediaJob, revision = 'a'.repeat(24)): ProcessedMedia {
  const publicPath = `/media/${job.id}/${revision}/${job.filename}-500.webp`;
  return {
    revision,
    originalPathname: `cineradar/originals/${'b'.repeat(64)}.jpg`,
    originalHash: 'b'.repeat(64),
    originalMime: 'image/jpeg',
    originalBytes: 1000,
    width: 1000,
    height: 1500,
    variants: [
      {
        pathname: `cineradar${publicPath}`,
        publicPath,
        width: 500,
        height: 750,
        bytes: 100,
        hash: 'c'.repeat(64),
      },
    ],
  };
}

test('media source registration detects JSON changes without a title timestamp and deduplicates aliases', async () => {
  await title();
  assert.equal(await registerMediaSources(adapter), 1);
  assert.equal(await registerMediaSources(adapter), 0);
  const original = await claim();
  assert.equal(original.filename, 'inception-2010-poster');
  assert.equal(original.source_url, source('inception', 'original'));
  await title('movie:2', source('inception', 'w780'));
  assert.equal(await registerMediaSources(adapter), 1);
  assert.equal(await claimMedia(adapter), null);
  assert.equal((await mediaStats(adapter))[0].count, 1);
  await updatePoster(source('replacement'));
  assert.equal(await registerMediaSources(adapter), 1);
  const replacement = await claim();
  assert.notEqual(replacement.id, original.id);
  assert.equal(replacement.source_url, source('replacement', 'original'));
});

test('filenames preserve readable names and years with safe fallbacks for empty, non-Latin and long titles', async () => {
  const cases = [
    {
      id: 'movie:1',
      english: 'Amélie & the Café',
      original: 'Le Fabuleux Destin',
      expected: 'amelie-the-cafe-2001-poster',
    },
    {
      id: 'movie:2',
      english: '   ',
      original: 'The Wolf Brigade',
      expected: 'the-wolf-brigade-2001-poster',
    },
    {
      id: 'movie:3',
      english: '人狼',
      original: 'The Wolf Brigade',
      expected: 'the-wolf-brigade-2001-poster',
    },
    {
      id: 'movie:4',
      english: '人狼',
      original: '人狼',
      expected: 'movie-4-2001-poster',
    },
    {
      id: 'movie:5',
      english: `${'a'.repeat(89)} and more text`,
      original: 'Original title',
      expected: `${'a'.repeat(89)}-2001-poster`,
    },
  ];
  for (const entry of cases) {
    await adapter.query('INSERT INTO titles(id,data) VALUES($1,$2::jsonb)', [
      entry.id,
      JSON.stringify({
        originalTitle: entry.original,
        year: 2001,
        localizations: { en: { title: entry.english } },
        poster: source(`poster-${entry.id.split(':')[1]}`),
      }),
    ]);
  }
  assert.equal(await registerMediaSources(adapter), cases.length);
  const names = await adapter.query<{ title_id: string; filename: string }>(
    'SELECT m.title_id,a.filename FROM title_media m JOIN media_assets a ON a.id=m.asset_id ORDER BY m.title_id',
  );
  assert.deepEqual(
    names.rows,
    cases.map((entry) => ({ title_id: entry.id, filename: entry.expected })),
  );
  assert.ok(names.rows.every((row) => row.filename.length <= 120));
});

test('registration rechecks source changes before linking the selected batch', async () => {
  await title();
  let changedSource = false;
  const racingAdapter: Database = {
    async query<T>(sql: string, parameters: unknown[] = []) {
      if (sql.startsWith('WITH incoming AS') && !changedSource) {
        changedSource = true;
        await updatePoster(source('concurrent-replacement'));
      }
      return adapter.query<T>(sql, parameters);
    },
  };
  assert.equal(await registerMediaSources(racingAdapter), 0);
  assert.deepEqual(await getMediaForTitles(['movie:27205'], adapter), []);
  assert.deepEqual(await mediaStats(adapter), []);
  assert.equal(await registerMediaSources(adapter), 1);
  const current = await claim();
  assert.equal(
    current.source_url,
    source('concurrent-replacement', 'original'),
  );
});

test('claims have distinct ownership and stale lease holders cannot renew, finish or fail', async () => {
  await title();
  await title('movie:2', source('another'));
  await registerMediaSources(adapter);
  const [first, second] = await Promise.all([claim(), claim()]);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.lock_token, second.lock_token);
  assert.equal(await claimMedia(adapter), null);
  assert.equal(await renewMedia(first, adapter), true);
  await adapter.query(
    "UPDATE media_assets SET lock_until=now()-interval '1 second' WHERE id=$1",
    [first.id],
  );
  const successor = await claim();
  assert.equal(successor.id, first.id);
  assert.notEqual(successor.lock_token, first.lock_token);
  assert.equal(await renewMedia(first, adapter), false);
  assert.equal(await finishMedia(first, processed(first), adapter), false);
  assert.equal(await failMedia(first, 'source_timeout', false, adapter), false);
  assert.equal(
    await finishMedia(successor, processed(successor), adapter),
    true,
  );
});

test('finishing an obsolete download never remaps a title to its previous source', async () => {
  await title();
  await registerMediaSources(adapter);
  const obsolete = await claim();
  await updatePoster(source('new-poster'));
  await registerMediaSources(adapter);
  await finishMedia(obsolete, processed(obsolete), adapter);
  const rows = await getMediaForTitles(['movie:27205'], adapter);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, source('new-poster'));
  assert.equal(rows[0].state, 'queued');
  assert.deepEqual(rows[0].variants, []);
  const current = await claim();
  assert.notEqual(current.id, obsolete.id);
  assert.equal(await finishMedia(current, processed(current), adapter), true);
  const [ready] = await getMediaForTitles(['movie:27205'], adapter);
  assert.equal(
    ready.variants[0].publicPath,
    processed(current).variants[0].publicPath,
  );
});

test('a removed or unsupported source cannot retain a published title image', async () => {
  await title();
  await registerMediaSources(adapter);
  const job = await claim();
  await finishMedia(job, processed(job), adapter);
  await updatePoster(null);
  assert.equal(await registerMediaSources(adapter), 1);
  assert.deepEqual(await getMediaForTitles(['movie:27205'], adapter), []);
  await updatePoster('https://internal.example/private.jpg');
  await registerMediaSources(adapter);
  const [unsupported] = await getMediaForTitles(['movie:27205'], adapter);
  assert.equal(unsupported.state, 'failed');
  assert.deepEqual(unsupported.variants, []);
  assert.equal(await claimMedia(adapter), null);
});

test('withdrawal survives source size aliases and transformation profile changes', async () => {
  await title();
  await registerMediaSources(adapter);
  const job = await claim();
  assert.equal(await failMedia(job, 'withdrawn', true, adapter), true);
  await adapter.query('DELETE FROM title_media');
  await adapter.query(
    "UPDATE media_assets SET profile='webp-v0',id='ffffffffffffffffffffffff' WHERE id=$1",
    [job.id],
  );
  await updatePoster(source('inception', 'w780'));
  await registerMediaSources(adapter);
  const [row] = await getMediaForTitles(['movie:27205'], adapter);
  assert.equal(row.state, 'withdrawn');
  assert.deepEqual(row.variants, []);
  assert.equal(await claimMedia(adapter), null);
  assert.equal(
    (await mediaStats(adapter)).find((entry) => entry.state === 'withdrawn')
      ?.count,
    2,
  );
});

test('published variants expire within 180 days and renewal is queued before expiry', async () => {
  await title();
  await registerMediaSources(adapter);
  const job = await claim();
  const media = processed(job);
  await finishMedia(job, media, adapter);
  assert.deepEqual(await mediaStats(adapter), [
    { state: 'ready', count: 1, bytes: 1100, nextRun: null },
  ]);
  const timing = await adapter.query<{ ttl: number }>(
    'SELECT extract(epoch from (expires_at-verified_at))::double precision AS ttl FROM media_assets WHERE id=$1',
    [job.id],
  );
  assert.ok(timing.rows[0].ttl > 0 && timing.rows[0].ttl <= 180 * 86400);
  assert.ok(await findMediaVariant(media.variants[0].publicPath, adapter));
  await assert.rejects(
    adapter.query(
      "UPDATE media_assets SET expires_at=verified_at+interval '181 days' WHERE id=$1",
      [job.id],
    ),
  );
  await adapter.query(
    "UPDATE media_assets SET expires_at=now()+interval '6 days' WHERE id=$1",
    [job.id],
  );
  assert.equal(await registerMediaSources(adapter), 1);
  assert.equal((await claim()).id, job.id);
});

test('expired and withdrawn variants are unavailable even with their exact public path', async () => {
  await title();
  await registerMediaSources(adapter);
  const job = await claim();
  const media = processed(job);
  await finishMedia(job, media, adapter);
  await adapter.query(
    "UPDATE media_assets SET expires_at=now()-interval '1 second' WHERE id=$1",
    [job.id],
  );
  await adapter.query(
    "UPDATE media_variants SET expires_at=now()-interval '1 second' WHERE asset_id=$1",
    [job.id],
  );
  assert.equal(
    await findMediaVariant(media.variants[0].publicPath, adapter),
    null,
  );
  assert.deepEqual(
    (await getMediaForTitles(['movie:27205'], adapter))[0].variants,
    [],
  );
  await adapter.query(
    "UPDATE media_assets SET state='withdrawn',expires_at=now()+interval '1 day' WHERE id=$1",
    [job.id],
  );
  await adapter.query(
    "UPDATE media_variants SET expires_at=now()+interval '1 day' WHERE asset_id=$1",
    [job.id],
  );
  assert.equal(
    await findMediaVariant(media.variants[0].publicPath, adapter),
    null,
  );
});

test('lookup publishes only registered WebP variants, never originals or invented slugs and widths', async () => {
  await title();
  await registerMediaSources(adapter);
  const job = await claim();
  const media = processed(job);
  await finishMedia(job, media, adapter);
  const path = media.variants[0].publicPath;
  const found = await findMediaVariant(path, adapter);
  assert.equal(found?.variant.pathname, media.variants[0].pathname);
  for (const unavailable of [
    media.originalPathname,
    path.replace('500.webp', '501.webp'),
    path.replace('inception', 'different'),
    path.replace('.webp', '.jpg'),
    path.replace(media.revision, 'd'.repeat(24)),
    `${path}?source=https://example.org/a.jpg`,
  ]) {
    assert.equal(
      await findMediaVariant(unavailable, adapter),
      null,
      unavailable,
    );
  }
});

test('transient failures are delayed, permanent errors are not retried, and sensitive error strings are discarded', async () => {
  await title();
  await registerMediaSources(adapter);
  const first = await claim();
  assert.equal(await failMedia(first, 'source_timeout', false, adapter), true);
  assert.equal(await claimMedia(adapter), null);
  const delay = await adapter.query<{ delay: number }>(
    'SELECT extract(epoch from (run_at-now()))::double precision AS delay FROM media_assets WHERE id=$1',
    [first.id],
  );
  assert.ok(delay.rows[0].delay > 20 && delay.rows[0].delay <= 37);
  await adapter.query(
    "UPDATE media_assets SET run_at=now()-interval '1 second' WHERE id=$1",
    [first.id],
  );
  const retry = await claim();
  assert.equal(retry.attempts, 2);
  await failMedia(
    retry,
    'https://private.example/?token=secret',
    true,
    adapter,
  );
  assert.equal(await claimMedia(adapter), null);
  const failure = await adapter.query<{ state: string; error_code: string }>(
    'SELECT state,error_code FROM media_assets WHERE id=$1',
    [first.id],
  );
  assert.deepEqual(failure.rows[0], {
    state: 'failed',
    error_code: 'internal',
  });
});

test('bulk media lookup retains every requested title beyond 500 and deduplicates repeated IDs', async () => {
  const ids = Array.from({ length: 601 }, (_, index) => `movie:${index + 1}`);
  await adapter.query(
    "INSERT INTO titles(id,data) SELECT id,jsonb_build_object('originalTitle','Shared image','poster',$2::text) FROM unnest($1::text[]) AS id",
    [ids, source()],
  );
  assert.equal(await registerMediaSources(adapter, 1000), 601);
  const job = await claim();
  await finishMedia(job, processed(job), adapter);
  const rows = await getMediaForTitles([...ids, ids[0], ids[600]], adapter);
  assert.equal(rows.length, 601);
  assert.deepEqual(new Set(rows.map((row) => row.titleId)), new Set(ids));
  assert.ok(
    rows.every((row) => row.state === 'ready' && row.variants.length === 1),
  );
});

test('the shared per-minute allowance caps overlapping claims and resets in the following minute', async () => {
  for (let index = 0; index < 6; index++)
    await title(`movie:${index}`, source(`poster-${index}`));
  await registerMediaSources(adapter);
  const minute = Math.ceil(Date.now() / 60000) * 60000;
  const reserve = (token: string, time = minute) =>
    adapter.query<{ id: string }>(
      'SELECT id FROM claim_media($1,2,$2::timestamptz)',
      [token, new Date(time).toISOString()],
    );
  const attempts = await Promise.all(
    Array.from({ length: 6 }, (_, index) => reserve(`worker-${index}`)),
  );
  const claimedIds = attempts.flatMap((attempt) =>
    attempt.rows.map((row) => row.id),
  );
  assert.equal(claimedIds.length, 2);
  assert.equal(new Set(claimedIds).size, 2);
  assert.equal((await reserve('still-limited')).rows.length, 0);
  const next = await Promise.all([
    reserve('next-worker-a', minute + 60000),
    reserve('next-worker-b', minute + 60000),
  ]);
  const nextIds = next.flatMap((attempt) => attempt.rows.map((row) => row.id));
  assert.equal(nextIds.length, 2);
  assert.equal(new Set([...claimedIds, ...nextIds]).size, 4);
  const windows = await adapter.query<{ claimed: number }>(
    'SELECT claimed FROM media_rate_windows ORDER BY window_start',
  );
  assert.deepEqual(windows.rows, [{ claimed: 2 }, { claimed: 2 }]);
});

test('an empty queue does not spend download allowance and invalid limits fail closed', async () => {
  await adapter.query(
    "INSERT INTO media_rate_windows(window_start) VALUES(now()-interval '3 days')",
  );
  const now = new Date().toISOString();
  assert.equal(
    (
      await adapter.query('SELECT id FROM claim_media($1,2,$2::timestamptz)', [
        'empty',
        now,
      ])
    ).rows.length,
    0,
  );
  assert.deepEqual(
    (await adapter.query('SELECT claimed FROM media_rate_windows')).rows,
    [{ claimed: 0 }],
  );
  await assert.rejects(
    adapter.query('SELECT id FROM claim_media($1,0,$2::timestamptz)', [
      'invalid',
      now,
    ]),
  );
});

test('a valid published image remains available throughout queued, running and failed refreshes', async () => {
  await title();
  await registerMediaSources(adapter);
  const initial = await claim();
  const media = processed(initial);
  await finishMedia(initial, media, adapter);
  await adapter.query(
    "UPDATE media_assets SET expires_at=now()+interval '6 days' WHERE id=$1",
    [initial.id],
  );
  await adapter.query(
    "UPDATE media_variants SET expires_at=now()+interval '6 days' WHERE asset_id=$1",
    [initial.id],
  );
  const assertPublished = async () => {
    const [row] = await getMediaForTitles(['movie:27205'], adapter);
    assert.equal(row.state, 'ready');
    assert.equal(row.variants[0].publicPath, media.variants[0].publicPath);
    assert.ok(await findMediaVariant(media.variants[0].publicPath, adapter));
  };
  assert.equal(await registerMediaSources(adapter), 1);
  await assertPublished();
  const refresh = await claim();
  await assertPublished();
  await failMedia(refresh, 'source_timeout', false, adapter);
  await assertPublished();
  await adapter.query(
    "UPDATE media_assets SET run_at=now()-interval '1 second' WHERE id=$1",
    [initial.id],
  );
  const retry = await claim();
  await failMedia(retry, 'invalid_image', true, adapter);
  await assertPublished();
  assert.equal((await mediaStats(adapter))[0].state, 'failed');
});

test('a new revision keeps earlier public URLs valid until their own expiry and withdrawal denies both', async () => {
  await title();
  await registerMediaSources(adapter);
  const initial = await claim();
  const oldMedia = processed(initial);
  await finishMedia(initial, oldMedia, adapter);
  await adapter.query(
    "UPDATE media_assets SET expires_at=now()+interval '6 days' WHERE id=$1",
    [initial.id],
  );
  await adapter.query(
    "UPDATE media_variants SET expires_at=now()+interval '6 days' WHERE asset_id=$1",
    [initial.id],
  );
  const oldPath = oldMedia.variants[0].publicPath;
  const oldExpiry = (await findMediaVariant(oldPath, adapter))!.expiresAt;
  await registerMediaSources(adapter);
  const refresh = await claim();
  const newMedia = processed(refresh, 'd'.repeat(24));
  assert.equal(await finishMedia(refresh, newMedia, adapter), true);
  const newPath = newMedia.variants[0].publicPath;
  assert.equal(
    (await findMediaVariant(oldPath, adapter))!.expiresAt,
    oldExpiry,
  );
  assert.ok(
    new Date((await findMediaVariant(newPath, adapter))!.expiresAt).getTime() >
      new Date(oldExpiry).getTime(),
  );
  assert.equal(
    (await getMediaForTitles(['movie:27205'], adapter))[0].variants[0]
      .publicPath,
    newPath,
  );
  await adapter.query(
    "UPDATE media_variants SET expires_at=now()-interval '1 second' WHERE public_path=$1",
    [oldPath],
  );
  assert.equal(await findMediaVariant(oldPath, adapter), null);
  assert.ok(await findMediaVariant(newPath, adapter));
  await adapter.query(
    "UPDATE media_variants SET expires_at=now()+interval '1 day' WHERE public_path=$1",
    [oldPath],
  );
  await adapter.query("UPDATE media_assets SET state='withdrawn' WHERE id=$1", [
    initial.id,
  ]);
  assert.equal(await findMediaVariant(oldPath, adapter), null);
  assert.equal(await findMediaVariant(newPath, adapter), null);
  const [withdrawn] = await getMediaForTitles(['movie:27205'], adapter);
  assert.equal(withdrawn.state, 'withdrawn');
  assert.deepEqual(withdrawn.variants, []);
});

test('revalidating identical bytes renews the existing public URL expiry', async () => {
  await title();
  await registerMediaSources(adapter);
  const initial = await claim();
  const media = processed(initial);
  await finishMedia(initial, media, adapter);
  await adapter.query(
    "UPDATE media_assets SET expires_at=now()+interval '6 days' WHERE id=$1",
    [initial.id],
  );
  await adapter.query(
    "UPDATE media_variants SET expires_at=now()+interval '6 days' WHERE asset_id=$1",
    [initial.id],
  );
  const oldExpiry = (await findMediaVariant(
    media.variants[0].publicPath,
    adapter,
  ))!.expiresAt;
  await registerMediaSources(adapter);
  const refresh = await claim();
  assert.equal(await finishMedia(refresh, media, adapter), true);
  const renewed = await findMediaVariant(media.variants[0].publicPath, adapter);
  assert.ok(renewed);
  assert.ok(
    new Date(renewed.expiresAt).getTime() - new Date(oldExpiry).getTime() >
      170 * 86400000,
  );
  assert.deepEqual(
    (
      await adapter.query(
        'SELECT count(*)::integer AS count FROM media_variants',
      )
    ).rows,
    [{ count: 1 }],
  );
});

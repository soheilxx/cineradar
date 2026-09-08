import { afterEach, test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import dns from 'node:dns/promises';
import https, { type RequestOptions } from 'node:https';
import type { IncomingMessage, ClientRequest } from 'node:http';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { PassThrough } from 'node:stream';
import sharp from 'sharp';
import { BlobAccessError, BlobServiceRateLimited } from '@vercel/blob';
import {
  downloadMedia,
  MediaError,
  normalizeMediaSource,
  publicMediaAddress,
} from '../data/media/source';
import { processMedia } from '../data/media/process';
import { serveMedia } from '../data/media/serve';
import type { MediaJob, MediaVariant } from '../domain/media';
import { storageFailure, type readMediaBlob } from '../data/media/storage';
import { POST as mediaBatchPost } from '../app/api/admin/media/route';

const source = 'https://image.tmdb.org/t/p/w500/inception.jpg';
const digest = (data: Buffer) =>
  createHash('sha256').update(data).digest('hex');
const mediaError = (code: string) => (error: unknown) =>
  error instanceof MediaError && error.code === code;
const savedLimits = {
  MEDIA_MAX_BYTES: process.env.MEDIA_MAX_BYTES,
  MEDIA_MAX_PIXELS: process.env.MEDIA_MAX_PIXELS,
  CRON_SECRET: process.env.CRON_SECRET,
};
afterEach(() => {
  for (const [key, value] of Object.entries(savedLimits)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

class FakeResponse extends PassThrough {
  statusCode = 200;
  headers: Record<string, string> = { 'content-type': 'image/jpeg' };
  complete = false;
}
class FakeRequest extends EventEmitter {
  destroy(error?: Error) {
    if (error) this.emit('error', error);
    this.emit('close');
    return this;
  }
}
function network(
  context: TestContext,
  options: {
    addresses?: { address: string; family: number }[];
    status?: number;
    headers?: Record<string, string>;
    chunks?: Buffer[];
    stall?: boolean;
  } = {},
) {
  const requests: {
    url: URL;
    options: RequestOptions;
    response: FakeResponse;
  }[] = [];
  context.mock.method(
    dns,
    'lookup',
    async () => options.addresses || [{ address: '104.16.61.155', family: 4 }],
  );
  context.mock.method(https, 'get', ((
    url: URL,
    requestOptions: RequestOptions,
    callback: (response: IncomingMessage) => void,
  ) => {
    const request = new FakeRequest();
    const response = new FakeResponse();
    response.statusCode = options.status || 200;
    Object.assign(response.headers, options.headers);
    requests.push({ url, options: requestOptions, response });
    response.on('close', () => request.emit('close'));
    queueMicrotask(() => {
      callback(response as unknown as IncomingMessage);
      if (response.destroyed || options.stall) return;
      for (const chunk of options.chunks || [Buffer.from('jpeg')]) {
        response.write(chunk);
        if (response.destroyed) return;
      }
      response.complete = true;
      response.end();
    });
    return request as unknown as ClientRequest;
  }) as typeof https.get);
  syncBuiltinESMExports();
  context.after(() => {
    context.mock.restoreAll();
    syncBuiltinESMExports();
  });
  return requests;
}

test('media sources reject URL ambiguity and normalize approved size and host aliases', () => {
  assert.equal(
    normalizeMediaSource(source),
    'https://image.tmdb.org/t/p/original/inception.jpg',
  );
  assert.equal(
    normalizeMediaSource(
      'https://media.themoviedb.org/t/p/h632/abc-123_A.webp',
    ),
    'https://image.tmdb.org/t/p/original/abc-123_A.webp',
  );
  for (const url of [
    'http://image.tmdb.org/t/p/w500/a.jpg',
    'https://image.tmdb.org.evil.test/t/p/w500/a.jpg',
    'https://image.tmdb.org@evil.test/t/p/w500/a.jpg',
    'https://user@image.tmdb.org/t/p/w500/a.jpg',
    'https://image.tmdb.org:443/t/p/w500/a.jpg',
    'https://127.0.0.1/t/p/w500/a.jpg',
    'https://image.tmdb.org/t/p/w500/../a.jpg',
    'https://image.tmdb.org/t/p/w500/%2e%2e/a.jpg',
    'https://image.tmdb.org/t/p/w500/a%2fb.jpg',
    `${source}?target=https://127.0.0.1/`,
    `${source}#fragment`,
    'https://image.tmdb.org/t/p/w500/a.svg',
  ])
    assert.equal(normalizeMediaSource(url), null, url);
});

test('private, mapped, link-local and reserved DNS answers cannot reach HTTPS', async (context) => {
  for (const ip of [
    '0.0.0.0',
    '10.0.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.2.3',
    '192.168.1.1',
    '100.64.0.1',
    '192.0.2.2',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '2002:7f00:1::',
    'not-an-ip',
  ]) {
    assert.equal(publicMediaAddress(ip), false, ip);
  }
  assert.equal(publicMediaAddress('104.16.61.155'), true);
  assert.equal(publicMediaAddress('2606:4700::6810:3d9b'), true);
  const requests = network(context, {
    addresses: [
      { address: '104.16.61.155', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ],
  });
  await assert.rejects(
    downloadMedia(source, 100),
    mediaError('source_address_not_allowed'),
  );
  assert.equal(requests.length, 0);
});

test('HTTPS uses the approved hostname and pins the exact validated address', async (context) => {
  const requests = network(context);
  assert.equal((await downloadMedia(source, 100)).toString(), 'jpeg');
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url.href,
    'https://image.tmdb.org/t/p/original/inception.jpg',
  );
  const lookup = requests[0].options.lookup as unknown as (
    hostname: string,
    options: { all?: boolean },
    callback: (error: Error | null, ...answer: unknown[]) => void,
  ) => void;
  lookup('image.tmdb.org', {}, (error, address, family) => {
    assert.equal(error, null);
    assert.equal(address, '104.16.61.155');
    assert.equal(family, 4);
  });
  lookup('image.tmdb.org', { all: true }, (error, addresses) => {
    assert.equal(error, null);
    assert.deepEqual(addresses, [{ address: '104.16.61.155', family: 4 }]);
  });
});

test('redirects are rejected without following their location', async (context) => {
  const requests = network(context, {
    status: 302,
    headers: { location: 'http://169.254.169.254/' },
  });
  await assert.rejects(
    downloadMedia(source, 100),
    mediaError('source_http_302'),
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].response.destroyed, true);
});

test('download stops at both declared and actual byte limits', async (context) => {
  await context.test(
    'declared size is checked before buffering',
    async (subtest) => {
      const requests = network(subtest, {
        headers: { 'content-length': '1000' },
      });
      await assert.rejects(
        downloadMedia(source, 10),
        mediaError('source_too_large'),
      );
      assert.equal(requests[0].response.destroyed, true);
    },
  );
  await context.test(
    'a missing Content-Length cannot bypass the byte limit',
    async (subtest) => {
      const requests = network(subtest, {
        chunks: [Buffer.alloc(6), Buffer.alloc(6)],
      });
      await assert.rejects(
        downloadMedia(source, 10),
        mediaError('source_too_large'),
      );
      assert.equal(requests[0].response.destroyed, true);
    },
  );
  await context.test(
    'a falsely small Content-Length cannot bypass the byte limit',
    async (subtest) => {
      network(subtest, {
        headers: { 'content-length': '4' },
        chunks: [Buffer.alloc(20)],
      });
      await assert.rejects(
        downloadMedia(source, 10),
        mediaError('source_too_large'),
      );
    },
  );
});

test('HTML responses and stalled downloads are rejected', async (context) => {
  await context.test(
    'content type is checked before decoding',
    async (subtest) => {
      network(subtest, { headers: { 'content-type': 'text/html' } });
      await assert.rejects(
        downloadMedia(source, 100),
        mediaError('source_content_type'),
      );
    },
  );
  await context.test('the download has a deadline', async (subtest) => {
    network(subtest, { stall: true });
    await assert.rejects(
      downloadMedia(source, 100, 20),
      mediaError('source_timeout'),
    );
  });
});

const job: MediaJob = {
  id: 'a'.repeat(24),
  source_url: source,
  kind: 'poster',
  filename: 'inception-2010-poster',
  profile: 'webp-v1',
  attempts: 1,
  lock_token: 'test-worker',
};

test('image processing preserves original bytes and produces bounded WebP variants with the SEO filename', async () => {
  const original = await sharp({
    create: { width: 300, height: 450, channels: 3, background: '#336699' },
  })
    .jpeg()
    .toBuffer();
  const uploads = new Map<string, { data: Buffer; type: string }>();
  const processed = await processMedia(job, {
    download: async () => original,
    storage: {
      async put(pathname, data, type) {
        uploads.set(pathname, { data, type });
      },
    },
  });
  assert.equal(processed.originalHash, digest(original));
  assert.equal(processed.originalMime, 'image/jpeg');
  assert.deepEqual(uploads.get(processed.originalPathname)?.data, original);
  assert.ok(processed.originalPathname.startsWith('cineradar/originals/'));
  assert.deepEqual(
    processed.variants.map((variant) => variant.width),
    [185, 300],
  );
  assert.equal(uploads.size, 3);
  for (const variant of processed.variants) {
    assert.equal(
      variant.publicPath,
      `/media/${job.id}/${processed.revision}/inception-2010-poster-${variant.width}.webp`,
    );
    const stored = uploads.get(variant.pathname)!;
    assert.equal(stored.type, 'image/webp');
    assert.equal(digest(stored.data), variant.hash);
    assert.equal(stored.data.length, variant.bytes);
    const metadata = await sharp(stored.data).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, variant.width);
    assert.equal(metadata.height, variant.height);
    assert.ok(variant.width <= 300);
  }
});

test('image validation rejects unsupported content, pixel bombs and oversized downloads before upload', async () => {
  process.env.MEDIA_MAX_BYTES = '100000';
  process.env.MEDIA_MAX_PIXELS = '1000000';
  let writes = 0;
  const storage = {
    async put() {
      writes++;
    },
  };
  const large = await sharp({
    create: { width: 1001, height: 1001, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer();
  for (const bytes of [
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    ),
    Buffer.from('not-an-image'),
    large,
  ]) {
    await assert.rejects(
      processMedia(job, { download: async () => bytes, storage }),
      mediaError('invalid_image'),
    );
  }
  for (const bytes of [Buffer.alloc(0), Buffer.alloc(100001)]) {
    await assert.rejects(
      processMedia(job, { download: async () => bytes, storage }),
      mediaError('source_too_large'),
    );
  }
  assert.equal(writes, 0);
});

test('AVIF is recognized by its decoded compression and retains its original MIME type', async () => {
  const original = await sharp({
    create: { width: 60, height: 90, channels: 3, background: '#336699' },
  })
    .avif()
    .toBuffer();
  const result = await processMedia(job, {
    download: async () => original,
    storage: { async put() {} },
  });
  assert.equal(result.originalMime, 'image/avif');
  assert.ok(result.originalPathname.endsWith('.avif'));
});

test('animated WebP is rejected before creating stored objects', async () => {
  const first = Buffer.alloc(12 * 12 * 3, 0);
  const second = Buffer.alloc(12 * 12 * 3, 255);
  const animated = await sharp(Buffer.concat([first, second]), {
    raw: { width: 12, height: 24, channels: 3, pageHeight: 12 },
  })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  let writes = 0;
  await assert.rejects(
    processMedia(job, {
      download: async () => animated,
      storage: {
        async put() {
          writes++;
        },
      },
    }),
    mediaError('invalid_image'),
  );
  assert.equal(writes, 0);
});

test('a partial storage failure cannot return a publishable manifest and exposes only a safe retry code', async () => {
  const original = await sharp({
    create: { width: 80, height: 120, channels: 3, background: '#336699' },
  })
    .jpeg()
    .toBuffer();
  let writes = 0;
  const failure = new BlobAccessError();
  await assert.rejects(
    processMedia(job, {
      download: async () => original,
      storage: {
        async put() {
          if (++writes > 1) throw failure;
        },
      },
    }),
    (error: unknown) =>
      error instanceof MediaError &&
      error.code === 'storage_auth' &&
      !error.permanent,
  );
  assert.equal(writes, 2);
  const diagnostic = storageFailure(
    new Error('https://private.invalid/?token=secret'),
  );
  assert.equal(diagnostic.message, 'storage_failed');
  assert.equal(diagnostic.permanent, false);
  assert.equal(
    storageFailure(new BlobServiceRateLimited(60)).code,
    'storage_rate_limited',
  );
});

test('the media batch endpoint rejects unauthenticated and malformed requests before any work', async () => {
  process.env.CRON_SECRET = 'media-test-key';
  const url = 'https://cineradar.tv/api/admin/media';
  assert.equal(
    (await mediaBatchPost(new Request(url, { method: 'POST', body: '{}' })))
      .status,
    401,
  );
  for (const body of [
    'null',
    '[]',
    '"invalid"',
    '{',
    '{"maxJobs":0}',
    '{"maxJobs":61}',
    '{"maxJobs":1.5}',
  ]) {
    const response = await mediaBatchPost(
      new Request(url, {
        method: 'POST',
        body,
        headers: {
          Authorization: 'Bearer media-test-key',
          'Content-Type': 'application/json',
        },
      }),
    );
    assert.equal(response.status, 400, body);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
});

const publicPath = `/media/${'a'.repeat(24)}/${'b'.repeat(24)}/inception-2010-poster-500.webp`;
const variant: MediaVariant = {
  publicPath,
  pathname: `cineradar${publicPath}`,
  hash: 'c'.repeat(64),
  bytes: 4,
  width: 500,
  height: 750,
};
const found = () => ({
  variant,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
});
const request = (path = publicPath, init?: RequestInit) =>
  new Request(`https://cineradar.tv${path}`, init);

test('media serving denies original paths, unregistered files and expired assets without a Blob request', async () => {
  let reads = 0;
  let lookups = 0;
  const read: typeof readMediaBlob = async () => {
    reads++;
    return null;
  };
  for (const path of [
    '/media/originals/private.jpg',
    '/media/https://example.org/a.webp',
    publicPath.replace('.webp', '.jpg'),
    publicPath.replace('inception', '../inception'),
  ]) {
    const response = await serveMedia(request(), path, {
      find: async () => {
        lookups++;
        return found();
      },
      read,
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(lookups, 0);
  assert.equal(
    (await serveMedia(request(), publicPath, { find: async () => null, read }))
      .status,
    404,
  );
  assert.equal(
    (
      await serveMedia(request(), publicPath, {
        find: async () => ({
          ...found(),
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        }),
        read,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await serveMedia(request(), publicPath, {
        find: async () => ({
          ...found(),
          variant: { ...variant, pathname: 'cineradar/originals/private.jpg' },
        }),
        read,
      })
    ).status,
    404,
  );
  assert.equal(reads, 0);
});

test('conditional and HEAD responses validate publication first and retain bounded cache lifetime', async () => {
  const read: typeof readMediaBlob = async () => {
    throw new Error('HEAD and conditional hits must not read storage');
  };
  const head = await serveMedia(
    request(publicPath, { method: 'HEAD' }),
    publicPath,
    { find: async () => found(), read },
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('content-type'), 'image/webp');
  assert.equal(head.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(
    head.headers.get('cache-control'),
    'public, max-age=300, s-maxage=300',
  );
  const conditional = request(publicPath, {
    headers: { 'If-None-Match': `W/"${variant.hash}"` },
  });
  assert.equal(
    (
      await serveMedia(conditional, publicPath, {
        find: async () => found(),
        read,
      })
    ).status,
    304,
  );
  assert.equal(
    (
      await serveMedia(conditional, publicPath, {
        find: async () => null,
        read,
      })
    ).status,
    404,
  );
  const short = await serveMedia(
    request(publicPath, { method: 'HEAD' }),
    publicPath,
    {
      find: async () => ({
        ...found(),
        expiresAt: new Date(Date.now() + 30000).toISOString(),
      }),
      read,
    },
  );
  const ttl = Number(
    short.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1],
  );
  assert.ok(ttl > 0 && ttl <= 30);
});

test('the public image response uses only the registered private pathname and never exposes Blob URLs', async () => {
  let pathname = '';
  const read: typeof readMediaBlob = async (path) => {
    pathname = path;
    return {
      statusCode: 200,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(Buffer.from('webp'));
          controller.close();
        },
      }),
      headers: new Headers({ authorization: 'Bearer never-forward' }),
      blob: {
        url: 'https://private.blob.vercel-storage.com/private',
        downloadUrl: 'https://private.blob.vercel-storage.com/download',
        pathname: path,
        contentDisposition: '',
        cacheControl: 'private',
        uploadedAt: new Date(),
        etag: 'private-etag',
        contentType: 'image/webp',
        size: 4,
      },
    };
  };
  const response = await serveMedia(request(), publicPath, {
    find: async () => found(),
    read,
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'webp');
  assert.equal(pathname, variant.pathname);
  assert.equal(response.headers.get('authorization'), null);
  assert.equal(response.headers.get('etag'), `"${variant.hash}"`);
  assert.ok(
    !JSON.stringify([...response.headers]).includes('blob.vercel-storage.com'),
  );
});

test('missing storage objects and database failures are temporary non-cacheable failures', async () => {
  for (const dependencies of [
    { find: async () => found(), read: async () => null },
    {
      find: async () => {
        throw new Error('database unavailable');
      },
      read: async () => null,
    },
  ]) {
    const response = await serveMedia(request(), publicPath, dependencies);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('retry-after'), '60');
  }
});

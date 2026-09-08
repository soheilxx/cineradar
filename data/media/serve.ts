import { findMediaVariant } from './repository';
import { readMediaBlob } from './storage';

export async function serveMedia(
  request: Request,
  path: string,
  dependencies: {
    find?: typeof findMediaVariant;
    read?: typeof readMediaBlob;
  } = {},
) {
  const notFound = () =>
    new Response(null, {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  if (
    !/^\/media\/[a-f0-9]{24}\/[a-f0-9]{24}\/[a-z0-9]+(?:-[a-z0-9]+)*-\d{1,4}\.webp$/.test(
      path,
    ) ||
    path.length > 240
  )
    return notFound();
  try {
    const found = await (dependencies.find || findMediaVariant)(path);
    if (!found) return notFound();
    // Only the registry's published derivatives are readable, never original paths or a supplied URL.
    const { variant, expiresAt } = found;
    if (
      variant.publicPath !== path ||
      variant.pathname !== 'cineradar' + path ||
      !/^[a-f0-9]{64}$/.test(variant.hash)
    )
      return notFound();
    const remaining = Math.floor(
      (new Date(expiresAt).getTime() - Date.now()) / 1000,
    );
    if (!Number.isFinite(remaining) || remaining <= 0) return notFound();
    const headers = new Headers({
      'Content-Type': 'image/webp',
      'Content-Length': String(variant.bytes),
      'Content-Disposition': `inline; filename="${path.split('/').at(-1)}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': `public, max-age=${Math.min(300, remaining)}, s-maxage=${Math.min(300, remaining)}`,
      ETag: `"${variant.hash}"`,
    });
    const candidate = request.headers.get('if-none-match');
    if (
      candidate
        ?.split(',')
        .some(
          (value) => value.trim().replace(/^W\//, '') === headers.get('etag'),
        )
    ) {
      headers.delete('content-length');
      return new Response(null, { status: 304, headers });
    }
    if (request.method === 'HEAD') return new Response(null, { headers });
    const blob = await (dependencies.read || readMediaBlob)(variant.pathname);
    if (
      !blob ||
      blob.statusCode !== 200 ||
      blob.blob.contentType !== 'image/webp' ||
      blob.blob.size !== variant.bytes
    ) {
      if (blob?.stream) await blob.stream.cancel().catch(() => {});
      return new Response(null, {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
      });
    }
    return new Response(blob.stream, { headers });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
    });
  }
}

import { createHash } from 'node:crypto';
import { unstable_cache } from 'next/cache';

/** Only public, JSON-serializable data belongs here. Search text and user
 * preferences must bypass this cache, and artwork approval is checked after it.
 * Keep nonce-based HTML dynamic; the Next Data Cache is shared on Vercel.
 */
export async function sharedPublicCache<T>(
  key: string,
  loader: () => Promise<T>,
  freshSeconds = 300,
  maxAgeSeconds = 900,
): Promise<T> {
  // CLI workers and unit tests have no Next incremental-cache request context.
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.APP_MODE !== 'live')
    return loader();
  const namespace = createHash('sha256')
    .update(JSON.stringify([
      process.env.DATABASE_URL,
      process.env.SITE_URL,
      process.env.DEPLOYMENT_ENV,
    ]))
    .digest('hex');
  let pending: Promise<T> | undefined;
  const fresh = () => (pending ??= loader());
  const entry = await unstable_cache(
    async () => ({ value: await fresh(), createdAt: Date.now() }),
    ['cineradar-public-v2', namespace, key, String(freshSeconds)],
    { revalidate: freshSeconds, tags: ['cineradar-public'] },
  )();
  // Next retains stale entries if refresh fails. Never serve an indefinitely
  // old availability/SEO result during an outage. A healthy DB can refresh a
  // long-unvisited entry immediately; coalesce with Next's background refresh.
  if (Date.now() - entry.createdAt >= maxAgeSeconds * 1000)
    return fresh();
  return entry.value;
}

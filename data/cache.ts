// Bounded process cache for public catalogue data; no personal results enter it.
type Entry<T> = {
  value?: T;
  expires: number;
  staleUntil: number;
  promise?: Promise<T>;
};
const entries = new Map<string, Entry<unknown>>();
const counts = { hits: 0, misses: 0, coalesced: 0 };
export async function publicCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttl = 30000,
  stale = 120000,
): Promise<T> {
  const now = Date.now();
  const entry = entries.get(key) as Entry<T> | undefined;
  if (entry?.value !== undefined && entry.expires > now) {
    counts.hits++;
    return entry.value;
  }
  if (entry?.promise) {
    counts.coalesced++;
    return entry.value !== undefined && entry.staleUntil > now
      ? entry.value
      : entry.promise;
  }
  counts.misses++;
  const next: Entry<T> = {
    ...entry,
    expires: entry?.expires || 0,
    staleUntil: entry?.staleUntil || 0,
  };
  const promise = loader()
    .then((value) => {
      entries.set(key, {
        value,
        expires: Date.now() + ttl,
        staleUntil: Date.now() + ttl + stale,
      });
      return value;
    })
    .catch((error) => {
      entries.delete(key);
      if (entry?.value !== undefined && entry.staleUntil > now)
        return entry.value;
      throw error;
    });
  void promise.catch(() => {});
  next.promise = promise;
  entries.set(key, next);
  if (entries.size > 500) entries.delete(entries.keys().next().value!);
  return entry?.value !== undefined && entry.staleUntil > now
    ? entry.value
    : promise;
}
export function cacheStats() {
  return { ...counts, entries: entries.size };
}

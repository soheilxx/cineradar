import type { Offer, Snapshot, Freshness } from './types';
export function freshness(
  checked: string | null,
  now = Date.now(),
  overdue = 36,
  stale = 72,
): Freshness {
  if (!checked) return 'unknown';
  const age = (now - Date.parse(checked)) / 3600000;
  return age > stale ? 'stale' : age > overdue ? 'overdue' : 'fresh';
}
export function activeOffers(offers: Offer[], now = Date.now()) {
  return offers.filter((o) => !o.expiresOn || Date.parse(o.expiresOn) >= now);
}
export function inSubscriptions(o: Offer, selected: string[]) {
  return o.type === 'subscription'
    ? selected.includes(o.provider.id)
    : o.type === 'addon' &&
        !!o.addon &&
        selected.includes(o.provider.id + ':' + o.addon.id);
}
export function comparisonKey(o: Offer) {
  return [
    o.market,
    o.type,
    o.quality ?? 'unknown',
    o.currency,
    o.unit,
    o.season ?? '',
    o.episode ?? '',
  ].join(':');
}
export function lowestPrices(offers: Offer[]) {
  const min = new Map<string, string>();
  for (const o of offers) {
    if (
      !o.price ||
      !o.currency ||
      !['buy', 'rent'].includes(o.type) ||
      !o.quality ||
      (o.unit === 'season' && o.season === null) ||
      (o.unit === 'episode' && (o.season === null || o.episode === null))
    )
      continue;
    const key = comparisonKey(o);
    if (!min.has(key) || compareDecimal(o.price, min.get(key)!) < 0)
      min.set(key, o.price);
  }
  return new Set(
    offers
      .filter((o) => o.price !== null && min.get(comparisonKey(o)) === o.price)
      .map((o) => o.id),
  );
}
export function compareDecimal(a: string, b: string) {
  const [ai, af = ''] = a.split('.'),
    [bi, bf = ''] = b.split('.');
  const width = Math.max(af.length, bf.length);
  const x = BigInt(ai + af.padEnd(width, '0')),
    y = BigInt(bi + bf.padEnd(width, '0'));
  return x < y ? -1 : x > y ? 1 : 0;
}
export function emptySnapshot(titleId: string, market: string): Snapshot {
  return {
    titleId,
    market,
    availability: 'unchecked',
    checkedAt: null,
    attemptAt: null,
    errorCode: null,
    freshness: 'unknown',
    offers: [],
    revision: '0',
  };
}
export function safeHttps(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) &&
      !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}

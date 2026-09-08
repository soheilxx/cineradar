import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { get } from 'node:https';
import { BlockList, isIP } from 'node:net';

export class MediaError extends Error {
  constructor(
    public code: string,
    public permanent = false,
  ) {
    super(code);
    this.name = 'MediaError';
  }
}

export function normalizeMediaSource(value: string): string | null {
  // Reject aliases, query strings, redirects and ambiguous encodings before URL parsing.
  const match =
    /^https:\/\/(?:image\.tmdb\.org|media\.themoviedb\.org)\/t\/p\/(?:original|w\d+|h\d+)\/([A-Za-z0-9_-]+\.(?:jpe?g|png|webp|avif))$/.exec(
      value,
    );
  return match ? `https://image.tmdb.org/t/p/original/${match[1]}` : null;
}

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const)
  blocked.addSubnet(network, prefix, 'ipv6');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
export function publicMediaAddress(address: string) {
  const family = isIP(address);
  return family === 4
    ? !blocked.check(address, 'ipv4')
    : family === 6 &&
        globalV6.check(address, 'ipv6') &&
        !blocked.check(address, 'ipv6');
}

export async function downloadMedia(
  source: string,
  maxBytes: number,
  timeoutMs = 15000,
): Promise<Buffer> {
  const normalized = normalizeMediaSource(source);
  if (!normalized) throw new MediaError('source_not_allowed', true);
  const url = new URL(normalized);
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  let addresses: LookupAddress[];
  try {
    addresses = await Promise.race([
      lookup(url.hostname, { all: true }),
      new Promise<never>((_, reject) => {
        dnsTimer = setTimeout(
          () => reject(new MediaError('dns_timeout')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(dnsTimer);
  }
  if (
    !addresses.length ||
    addresses.some((entry) => !publicMediaAddress(entry.address))
  )
    throw new MediaError('source_address_not_allowed', true);
  const address = addresses[0];
  // Pin the validated address to this TLS request; no second DNS lookup can rebind it.
  return new Promise((resolve, reject) => {
    const request = get(
      url,
      {
        family: address.family,
        lookup: (_host, options, callback) =>
          options.all
            ? callback(null, [address])
            : callback(null, address.address, address.family),
        headers: {
          'User-Agent': 'Cineradar-Media/1.0 (+https://cineradar.tv)',
          Accept: 'image/avif,image/webp,image/png,image/jpeg',
        },
      },
      (response) => {
        const status = response.statusCode || 0;
        if (status !== 200) {
          response.destroy();
          reject(
            new MediaError(
              `source_http_${status}`,
              status >= 300 && status < 500 && status !== 408 && status !== 429,
            ),
          );
          return;
        }
        const mime = (response.headers['content-type'] || '')
          .split(';')[0]
          .trim();
        if (
          ![
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/avif',
          ].includes(mime)
        ) {
          response.destroy();
          reject(new MediaError('source_content_type', true));
          return;
        }
        if (Number(response.headers['content-length'] || 0) > maxBytes) {
          response.destroy();
          reject(new MediaError('source_too_large', true));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            response.destroy(new MediaError('source_too_large', true));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => resolve(Buffer.concat(chunks, bytes)));
        response.on('error', reject);
        response.on('close', () => {
          if (!response.complete) reject(new MediaError('source_incomplete'));
        });
      },
    );
    const timer = setTimeout(
      () => request.destroy(new MediaError('source_timeout')),
      timeoutMs,
    );
    request.on('error', reject);
    request.on('close', () => clearTimeout(timer));
  });
}

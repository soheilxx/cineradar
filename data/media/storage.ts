import {
  put,
  head,
  get,
  BlobAccessError,
  BlobClientTokenExpiredError,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  BlobServiceRateLimited,
  BlobRequestAbortedError,
} from '@vercel/blob';
import { createHash } from 'node:crypto';
import { MediaError } from './source';

export function storageFailure(error: unknown): MediaError {
  if (error instanceof MediaError) return error;
  // Persist only fixed diagnostic codes. SDK messages can contain private URLs or credentials.
  const code =
    error instanceof BlobAccessError ||
    error instanceof BlobClientTokenExpiredError
      ? 'storage_auth'
      : error instanceof BlobStoreNotFoundError
        ? 'storage_missing'
        : error instanceof BlobStoreSuspendedError
          ? 'storage_suspended'
          : error instanceof BlobServiceRateLimited
            ? 'storage_rate_limited'
            : error instanceof BlobRequestAbortedError ||
                (error instanceof Error &&
                  ['AbortError', 'TimeoutError'].includes(error.name))
              ? 'storage_timeout'
              : 'storage_failed';
  return new MediaError(code);
}

export interface MediaStorage {
  put(pathname: string, data: Buffer, contentType: string): Promise<void>;
}

export const mediaStorage: MediaStorage = {
  async put(pathname, data, contentType) {
    try {
      await put(pathname, data, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType,
        cacheControlMaxAge: 300,
        abortSignal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      // Deterministic content-addressed paths make retrying a partial upload safe.
      // Verify an existing object; never overwrite a possibly unrelated object.
      const existing = await head(pathname, {
        abortSignal: AbortSignal.timeout(10000),
      }).catch(() => null);
      if (
        !existing ||
        existing.size !== data.length ||
        existing.contentType !== contentType
      )
        throw error;
      const stored = await get(pathname, {
        access: 'private',
        abortSignal: AbortSignal.timeout(15000),
      });
      if (!stored || stored.statusCode !== 200) throw error;
      const reader = stored.stream.getReader();
      const actual = createHash('sha256');
      let size = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > data.length) throw error;
          actual.update(part.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      if (
        size !== data.length ||
        actual.digest('hex') !== createHash('sha256').update(data).digest('hex')
      )
        throw error;
    }
  },
};

export function readMediaBlob(pathname: string) {
  return get(pathname, {
    access: 'private',
    abortSignal: AbortSignal.timeout(15000),
  });
}

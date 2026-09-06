import { z } from 'zod';
import { log } from '../../observability/log';
export type Failure =
  | 'auth'
  | 'missing'
  | 'quota'
  | 'timeout'
  | 'upstream'
  | 'schema'
  | 'budget'
  | 'network';
export class ProviderError extends Error {
  constructor(
    public code: Failure,
    public retryAfter = 0,
  ) {
    super(code);
    this.name = 'ProviderError';
  }
}
export type Reserve = (
  service: 'tmdb' | 'saa',
  weight: number,
) => Promise<boolean>;
export async function request<T>(
  url: URL,
  headers: Record<string, string>,
  schema: z.ZodType<T>,
  service: 'tmdb' | 'saa',
  reserve: Reserve,
  weight = 1,
): Promise<T> {
  const start = Date.now();
  if (!(await reserve(service, weight))) throw new ProviderError('budget');
  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
  } catch (e) {
    throw new ProviderError(
      e instanceof Error && ['TimeoutError', 'AbortError'].includes(e.name)
        ? 'timeout'
        : 'network',
    );
  }
  if (!response.ok) {
    log('provider_failed', {
      service,
      code: response.status,
      durationMs: Date.now() - start,
    });
    const raw = response.headers.get('retry-after');
    const retry = raw
      ? /^\d+$/.test(raw)
        ? Number(raw) * 1000
        : Math.max(0, Date.parse(raw) - Date.now())
      : 0;
    throw new ProviderError(
      response.status === 429
        ? 'quota'
        : response.status === 404
          ? 'missing'
          : [401, 403].includes(response.status)
            ? 'auth'
            : 'upstream',
      retry,
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ProviderError('schema');
  }
  const result = schema.safeParse(data);
  if (!result.success) throw new ProviderError('schema');
  log('provider_success', {
    service,
    units: weight,
    durationMs: Date.now() - start,
  });
  return result.data;
}

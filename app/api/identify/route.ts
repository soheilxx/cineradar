import { identifyRequestSchema, readIdentifyBody } from '@/domain/identify';
import { runIdentify } from '@/data/repositories/identify';
import { config } from '@/lib/config';
import { json, sameOrigin, rate } from '@/lib/security';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'origin' }, 403);
  let input;
  try {
    input = identifyRequestSchema.parse(await readIdentifyBody(request));
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  if (!config().markets.includes(input.market))
    return json({ error: 'unsupported_market' }, 400);
  try {
    if (!(await rate(request, 'identify', 10, 600))) {
      const response = json({ error: 'rate_limited' }, 429);
      response.headers.set('Retry-After', '600');
      return response;
    }
    return json(await runIdentify(input, request.signal));
  } catch {
    return json(
      { error: request.signal.aborted ? 'cancelled' : 'unavailable' },
      request.signal.aborted ? 408 : 503,
    );
  }
}

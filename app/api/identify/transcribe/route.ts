import { config } from '@/lib/config';
import { sameOrigin, rate } from '@/lib/security';
import { reserveIdentifyCall } from '@/data/providers/openai';
import { handleVoiceTranscription } from '@/lib/voice-transcribe';

export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(request: Request) {
  const c = config();
  return handleVoiceTranscription(request, {
    enabled: c.identifyAiEnabled,
    apiKey: c.OPENAI_API_KEY,
    model: c.OPENAI_TRANSCRIBE_MODEL,
    sameOrigin,
    rate: (request) => rate(request, 'identify-transcribe', 6, 600),
    reserve: () => reserveIdentifyCall(),
  });
}

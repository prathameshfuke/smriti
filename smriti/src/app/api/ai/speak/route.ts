import { verifyDeviceTrust } from '@/lib/auth/deviceTrustServer';
import { authenticateRequest } from '@/lib/supabase/server-auth';
import { synthesizeSpeech } from '@/lib/ai/bhashini-client';
import { isUILanguage } from '@/lib/i18n/languages';

interface SpeakRequestBody {
  text?: string;
  language?: string;
  deviceTrustToken?: { patientId: string; issuedAt: number; issuedBy: string; signature: string };
}

/**
 * Same two independent auth paths as /api/ai/transcribe: a kiosk's
 * device-trust token (patient companion, reminder narration) or a
 * caregiver Bearer token — no ownership check needed since speech
 * synthesis touches no patient data, it's a stateless text-to-audio
 * utility. Still gated either way: an open route would let anyone spend
 * this app's rate-limited Bhashini PoC quota.
 */
export async function POST(request: Request) {
  let body: SpeakRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body?.text) return Response.json({ error: 'missing_text' }, { status: 400 });
  const language = isUILanguage(body.language) ? body.language : 'en';

  const deviceAuthorized = Boolean(body.deviceTrustToken && verifyDeviceTrust(body.deviceTrustToken));
  if (!deviceAuthorized) {
    const caregiverAuth = await authenticateRequest(request);
    if (!caregiverAuth) {
      return Response.json({ error: 'invalid_device_token' }, { status: 401 });
    }
  }

  try {
    const result = await synthesizeSpeech(body.text, language);
    return Response.json({ audioBase64: result.audioBase64, audioFormat: result.audioFormat });
  } catch {
    return Response.json({ error: 'synthesis_failed' }, { status: 502 });
  }
}

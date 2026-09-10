import { verifyDeviceTrust } from '@/lib/auth/deviceTrustServer';
import { authenticateRequest } from '@/lib/supabase/server-auth';
import { transcribeAudio } from '@/lib/ai/transcribe-client';
import { transcribeBhashini, supportsBhashiniAsr } from '@/lib/ai/bhashini-asr-client';
import { isUILanguage } from '@/lib/i18n/languages';

/**
 * Two independent auth paths, same shape as /api/ai/complete: a kiosk's
 * device-trust token (patient companion, Prompt 2) or a caregiver Bearer
 * token (Memory Bank "Quick add" mic button, Prompt 4) — no ownership
 * check needed for the caregiver path since transcription alone touches
 * no patient data. Still gated either way, not left open: an
 * unauthenticated route would let anyone spend paid Groq credits.
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'invalid_form_data' }, { status: 400 });
  }

  const audio = formData.get('audio');
  // Duck-typed rather than `instanceof Blob`/`File`: FormData can hand back
  // values constructed against a different global than this module sees,
  // and passing it straight to another FormData is all `transcribeAudio`
  // actually needs.
  if (audio == null || typeof audio === 'string') {
    return Response.json({ error: 'missing_audio' }, { status: 400 });
  }

  const tokenRaw = formData.get('deviceTrustToken');
  let token;
  try {
    token = typeof tokenRaw === 'string' ? JSON.parse(tokenRaw) : null;
  } catch {
    token = null;
  }
  const deviceAuthorized = Boolean(token && verifyDeviceTrust(token));

  if (!deviceAuthorized) {
    const caregiverAuth = await authenticateRequest(request);
    if (!caregiverAuth) {
      return Response.json({ error: 'invalid_device_token' }, { status: 401 });
    }
  }

  // Bhashini ASR first for as/hi — its whole value here (per Task 0
  // verification) — falling through to the existing Groq Whisper path on
  // any failure, same fallback contract as llm-client.ts's Groq→OpenRouter
  // pattern. English never routes to Bhashini: the service ID used for
  // as/hi coverage doesn't support English at all (confirmed empirically),
  // and Groq Whisper is already excellent for English — nothing to fix
  // there. Browser SpeechRecognition (client-side, untouched) stays the
  // final fallback exactly as it was.
  const languageRaw = formData.get('language');
  const language = typeof languageRaw === 'string' && isUILanguage(languageRaw) ? languageRaw : 'en';

  if (supportsBhashiniAsr(language)) {
    try {
      const result = await transcribeBhashini(audio, language);
      return Response.json({ text: result.text });
    } catch {
      // Fall through to Groq Whisper below.
    }
  }

  try {
    const result = await transcribeAudio(audio);
    return Response.json({ text: result.text });
  } catch {
    return Response.json({ error: 'transcription_failed' }, { status: 502 });
  }
}

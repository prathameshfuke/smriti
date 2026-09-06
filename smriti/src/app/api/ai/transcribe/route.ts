import { verifyDeviceTrust } from '@/lib/auth/deviceTrustServer';
import { authenticateRequest } from '@/lib/supabase/server-auth';
import { transcribeAudio } from '@/lib/ai/transcribe-client';

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

  try {
    const result = await transcribeAudio(audio);
    return Response.json({ text: result.text });
  } catch {
    return Response.json({ error: 'transcription_failed' }, { status: 502 });
  }
}

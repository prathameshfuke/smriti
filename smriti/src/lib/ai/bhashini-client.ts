import type { UILanguage } from '@/lib/i18n/languages';

/**
 * Single entry point for Bhashini text-to-speech. Sibling to llm-client.ts
 * and transcribe-client.ts, not merged into either — different endpoint,
 * different auth (a single Authorization header, no Bearer prefix), and a
 * `pipelineResponse` array response shape unique to Bhashini.
 *
 * Server-only: reads BHASHINI_INFERENCE_API_KEY from process.env. Never
 * import this from a Client Component.
 *
 * Endpoint, required `gender` field, and the `pipelineRequestConfig.pipelineId`
 * requirement (needed even though this looks like the "direct" inference
 * endpoint) were confirmed empirically against the real API before writing
 * this — Bhashini's docs describe an older 3-call ULCA flow that doesn't
 * apply to Bhashini-Udyat-issued keys, and omitting either field returns a
 * bare 500 with no detail.
 */

const BHASHINI_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const TTS_SERVICE_ID = 'Bhashini/IITM/TTS';
// "Initial Pipeline Models" — the one pipeline ID Bhashini's own docs list
// as covering ASR, Translation, Transliteration and TTS together.
const PIPELINE_ID = '64392f96daac500b55c543cd';

const BHASHINI_LANGUAGE: Record<UILanguage, string> = {
  en: 'en',
  hi: 'hi',
  as: 'as',
};

/** A hung connection must not block a reminder or companion answer forever. */
const BHASHINI_TIMEOUT_MS = 20_000;

export interface SynthesizeSpeechResult {
  /** Base64-encoded audio, ready to embed as a `data:audio/<format>;base64,` URI. */
  audioBase64: string;
  audioFormat: string;
  model: string;
}

/**
 * Synthesizes one line of text to speech via Bhashini. Throws — never
 * swallows — on a missing key, a non-ok response, or a missing audio
 * payload. The caller (the API route) decides what happens next; the
 * client falls back to browser `speechSynthesis`, same shape as
 * transcribe-client's contract with the companion page.
 */
export async function synthesizeSpeech(
  text: string,
  language: UILanguage,
): Promise<SynthesizeSpeechResult> {
  const apiKey = process.env.BHASHINI_INFERENCE_API_KEY;
  if (!apiKey) {
    throw new Error('BHASHINI_INFERENCE_API_KEY is not configured');
  }

  const response = await fetch(BHASHINI_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      Accept: '*/*',
    },
    body: JSON.stringify({
      pipelineTasks: [
        {
          taskType: 'tts',
          config: {
            language: { sourceLanguage: BHASHINI_LANGUAGE[language] },
            serviceId: TTS_SERVICE_ID,
            gender: 'female',
          },
        },
      ],
      pipelineRequestConfig: { pipelineId: PIPELINE_ID },
      inputData: { input: [{ source: text }] },
    }),
    signal: AbortSignal.timeout(BHASHINI_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Bhashini returned ${response.status}`);
  }

  const body = await response.json();
  const task = body?.pipelineResponse?.[0];
  const audioBase64 = task?.audio?.[0]?.audioContent;
  const audioFormat = task?.config?.audioFormat;
  if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
    throw new Error('Bhashini returned no audio content');
  }

  return { audioBase64, audioFormat: audioFormat ?? 'wav', model: `bhashini/${TTS_SERVICE_ID}` };
}

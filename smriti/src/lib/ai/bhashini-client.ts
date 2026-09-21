import type { UILanguage } from '@/lib/i18n/languages';
import { fetchInferenceAuth, invalidateInferenceAuth } from './bhashini-auth';

/**
 * Single entry point for Bhashini text-to-speech. Sibling to llm-client.ts
 * and transcribe-client.ts, not merged into either — different endpoint,
 * different auth (a dynamic per-call header minted by bhashini-auth.ts's
 * config step, no Bearer prefix), and a `pipelineResponse` array response
 * shape unique to Bhashini.
 *
 * Server-only: bhashini-auth.ts reads BHASHINI_USER_ID/
 * BHASHINI_ULCA_API_KEY from process.env for the primary flow below; the
 * legacy fallback reads BHASHINI_INFERENCE_API_KEY. Never import this from
 * a Client Component.
 *
 * Two-tier lookup, matching bhashini-asr-client.ts: live discovery under
 * the new ULCA account resolves TTS fine for every language tried so far,
 * but ASR discovery has a real gap (see that file's doc comment) — the
 * same static key that covers the ASR gap is confirmed live-working for
 * TTS too (a real 200 with real audio back, tested directly), so the same
 * fallback shape is applied here for consistency and defense-in-depth
 * rather than assuming discovery never regresses.
 */

const BHASHINI_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
// "Initial Pipeline Models" — the one pipeline ID Bhashini's own docs list
// as covering ASR, Translation, Transliteration and TTS together.
const PIPELINE_ID = '64392f96daac500b55c543cd';
// The one service confirmed live-working under the legacy static key —
// used only as the fallback when live discovery under the new ULCA
// account can't resolve a service for this language.
const LEGACY_TTS_SERVICE_ID = 'Bhashini/IITM/TTS';

export const BHASHINI_LANGUAGE: Record<UILanguage, string> = {
  en: 'en',
  hi: 'hi',
  as: 'as',
  brx: 'brx',
  mni: 'mni',
  bn: 'bn',
  // Live-probed (Part 2): Nepali has no discoverable TTS service at all.
  // Still routed through the same call — it fails fast and narrate.ts
  // falls back to browser speech, same as any other Bhashini miss.
  ne: 'ne',
  // Text translation only (see languages.ts); no TTS service exists.
  kha: 'kha',
  lus: 'lus',
};

/** Compute-call timeout — 5s shorter than the old 20s now that a config
 * call (bhashini-auth.ts's own 5s budget) precedes it on the primary path,
 * so the combined Bhashini-attempt budget stays 20s total, same as before
 * this two-step flow existed. The legacy fallback below reuses this same
 * budget for its own single call. */
const BHASHINI_TIMEOUT_MS = 15_000;

class BhashiniHttpError extends Error {
  constructor(readonly status: number) {
    super(`Bhashini returned ${status}`);
  }
}

/** Bhashini's GPU-backed services answer an intermittent 502 (seen repeatedly
 * for Assamese and Bengali TTS in the live probe) that succeeds on the next
 * try; a server error gets exactly one retry, anything else fails at once. */
async function withOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof BhashiniHttpError && err.status >= 500) return fn();
    throw err;
  }
}

export interface SynthesizeSpeechResult {
  /** Base64-encoded audio, ready to embed as a `data:audio/<format>;base64,` URI. */
  audioBase64: string;
  audioFormat: string;
  model: string;
}

async function computeTts(
  text: string,
  sourceLanguage: string,
  headerName: string,
  headerValue: string,
  serviceId: string,
): Promise<SynthesizeSpeechResult> {
  const response = await fetch(BHASHINI_URL, {
    method: 'POST',
    headers: {
      [headerName]: headerValue,
      'Content-Type': 'application/json',
      Accept: '*/*',
    },
    body: JSON.stringify({
      pipelineTasks: [
        {
          taskType: 'tts',
          config: {
            language: { sourceLanguage },
            serviceId,
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
    throw new BhashiniHttpError(response.status);
  }

  const body = await response.json();
  const task = body?.pipelineResponse?.[0];
  const audioBase64 = task?.audio?.[0]?.audioContent;
  const audioFormat = task?.config?.audioFormat;
  if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
    throw new Error('Bhashini returned no audio content');
  }

  return { audioBase64, audioFormat: audioFormat ?? 'wav', model: `bhashini/${serviceId}` };
}

/**
 * Synthesizes one line of text to speech via Bhashini. Throws — never
 * swallows — on a missing key, a non-ok response, or a missing audio
 * payload, once both the primary (new ULCA discovery) and legacy fallback
 * paths are exhausted. The caller (the API route) decides what happens
 * next; the client falls back to browser `speechSynthesis`, same shape as
 * transcribe-client's contract with the companion page.
 */
export async function synthesizeSpeech(
  text: string,
  language: UILanguage,
): Promise<SynthesizeSpeechResult> {
  const sourceLanguage = BHASHINI_LANGUAGE[language];

  try {
    const auth = await fetchInferenceAuth('tts', sourceLanguage);
    try {
      return await withOneRetry(() => computeTts(text, sourceLanguage, auth.name, auth.value, auth.serviceId));
    } catch (err) {
      invalidateInferenceAuth('tts', sourceLanguage);
      throw err;
    }
  } catch {
    const legacyKey = process.env.BHASHINI_INFERENCE_API_KEY;
    if (!legacyKey) {
      throw new Error('Bhashini TTS: no service discovered and no legacy BHASHINI_INFERENCE_API_KEY configured');
    }
    return computeTts(text, sourceLanguage, 'Authorization', legacyKey, LEGACY_TTS_SERVICE_ID);
  }
}

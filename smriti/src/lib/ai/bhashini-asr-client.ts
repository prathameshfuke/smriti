import type { UILanguage } from '@/lib/i18n/languages';
import { fetchInferenceAuth, invalidateInferenceAuth } from './bhashini-auth';

/**
 * Single entry point for Bhashini speech-to-text. Sibling to
 * bhashini-client.ts (TTS) and transcribe-client.ts (Groq Whisper ASR),
 * not merged into either — same endpoint/auth as the TTS client, but a
 * different taskType, request shape (`audio`, not `input`), and response
 * shape (`output[0].source`, not `audio[0].audioContent`).
 *
 * Server-only: bhashini-auth.ts reads BHASHINI_USER_ID/
 * BHASHINI_ULCA_API_KEY from process.env for the primary flow below; the
 * legacy fallback reads BHASHINI_INFERENCE_API_KEY. Never import this from
 * a Client Component.
 *
 * Format: Bhashini's docs list only wav/flac at 16kHz for ASR. Confirmed
 * empirically (real webm/Opus audio — MediaRecorder's actual output, not a
 * converted file — sent through this exact request shape) that webm/Opus
 * works as-is: no format conversion needed. Real test transcripts came
 * back correct for both Assamese and Hindi.
 *
 * Two-tier lookup, not a straight switch to the new ULCA flow: live-probed
 * against the real API, the new ULCA account's discovery has no registered
 * ASR service for Assamese at all (a clean 400 "No supported tasks found"),
 * while the legacy static key's `bhashini/ai4bharat/conformer-multilingual-asr`
 * service demonstrably still works for it (confirmed live: a real 200 with
 * real audio back). Skipping this fallback would silently downgrade
 * Assamese ASR — this app's actual differentiator — to Groq Whisper. Hindi
 * resolves fine under the new account and uses it normally; only a
 * discovery miss falls back. Bengali added after the Part 2 live probe
 * confirmed real ASR coverage for it too (resolves to
 * `ai4bharat/conformer-multilingual-indo_aryan-gpu--t4`). Bodo and Manipuri
 * were NOT added here — the same probe found no discoverable ASR service
 * for either (only TTS + text translation); they stay on Groq Whisper.
 * Neither Bhashini service supports English at all (confirmed: a clean
 * error, not a format issue) — English stays on Groq Whisper, unchanged.
 */

const BHASHINI_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
// "Initial Pipeline Models" — same pipeline ID proven working for TTS.
const PIPELINE_ID = '64392f96daac500b55c543cd';
// The one service proven to work under the legacy static key — used only
// as the fallback when live discovery under the new ULCA account can't
// resolve a service for this language (see file doc comment).
const LEGACY_ASR_SERVICE_ID = 'bhashini/ai4bharat/conformer-multilingual-asr';

export type BhashiniAsrLanguage = 'as' | 'hi' | 'bn';
const BHASHINI_ASR_LANGUAGES: ReadonlySet<string> = new Set<BhashiniAsrLanguage>(['as', 'hi', 'bn']);

/** Container formats Bhashini ASR accepts. Safari's MediaRecorder records
 * `audio/mp4`, which Bhashini rejects — those clips go straight to Groq
 * Whisper instead of spending a doomed Bhashini attempt first. */
export type BhashiniAudioFormat = 'webm' | 'wav' | 'flac' | 'ogg';

export function bhashiniAudioFormat(mimeType: string | undefined): BhashiniAudioFormat | null {
  const base = (mimeType ?? '').split(';')[0].trim().toLowerCase();
  // An empty type comes from recorders that don't report one; every such
  // browser in practice (Chrome, Firefox, Android WebView) records webm.
  if (base === '' || base === 'audio/webm' || base === 'video/webm') return 'webm';
  if (base === 'audio/wav' || base === 'audio/x-wav' || base === 'audio/wave') return 'wav';
  if (base === 'audio/flac') return 'flac';
  if (base === 'audio/ogg') return 'ogg';
  return null;
}

/** Whether Bhashini ASR should even be attempted for this language. */
export function supportsBhashiniAsr(language: UILanguage): language is BhashiniAsrLanguage {
  return BHASHINI_ASR_LANGUAGES.has(language);
}

/** Compute-call timeout — 5s shorter than the old 20s now that a config
 * call (bhashini-auth.ts's own 5s budget) precedes it on the primary path,
 * so the combined Bhashini-attempt budget stays 20s total, same as before
 * this two-step flow existed. The legacy fallback below reuses this same
 * budget for its own single call. */
const BHASHINI_TIMEOUT_MS = 15_000;

export interface TranscribeBhashiniResult {
  text: string;
  model: string;
}

async function computeAsr(
  audioBase64: string,
  language: BhashiniAsrLanguage,
  headerName: string,
  headerValue: string,
  serviceId: string,
  audioFormat: BhashiniAudioFormat,
): Promise<TranscribeBhashiniResult> {
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
          taskType: 'asr',
          config: {
            language: { sourceLanguage: language },
            serviceId,
            audioFormat,
            // Only webm/ogg (Opus) are recorded at 48kHz; wav/flac here
            // come from 16kHz sources, Bhashini's documented rate.
            samplingRate: audioFormat === 'webm' || audioFormat === 'ogg' ? 48000 : 16000,
          },
        },
      ],
      pipelineRequestConfig: { pipelineId: PIPELINE_ID },
      inputData: { audio: [{ audioContent: audioBase64 }] },
    }),
    signal: AbortSignal.timeout(BHASHINI_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Bhashini ASR returned ${response.status}`);
  }

  const body = await response.json();
  const text = body?.pipelineResponse?.[0]?.output?.[0]?.source;
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Bhashini ASR returned an empty transcript');
  }

  return { text, model: `bhashini/${serviceId}` };
}

/**
 * Transcribes one audio clip via Bhashini ASR. Throws — never swallows —
 * on a missing key, a non-ok response, or an empty transcript, once both
 * the primary (new ULCA discovery) and legacy fallback paths are
 * exhausted. There is no third provider to fall through to here, so the
 * caller (the API route) decides what happens next — same contract as
 * transcribe-client.ts's Groq path.
 */
export async function transcribeBhashini(
  audio: Blob,
  language: BhashiniAsrLanguage,
): Promise<TranscribeBhashiniResult> {
  const audioFormat = bhashiniAudioFormat(audio.type) ?? 'webm';
  const audioBase64 = Buffer.from(await audio.arrayBuffer()).toString('base64');

  try {
    const auth = await fetchInferenceAuth('asr', language);
    try {
      return await computeAsr(audioBase64, language, auth.name, auth.value, auth.serviceId, audioFormat);
    } catch (err) {
      invalidateInferenceAuth('asr', language);
      throw err;
    }
  } catch {
    const legacyKey = process.env.BHASHINI_INFERENCE_API_KEY;
    if (!legacyKey) {
      throw new Error('Bhashini ASR: no service discovered and no legacy BHASHINI_INFERENCE_API_KEY configured');
    }
    return computeAsr(audioBase64, language, 'Authorization', legacyKey, LEGACY_ASR_SERVICE_ID, audioFormat);
  }
}

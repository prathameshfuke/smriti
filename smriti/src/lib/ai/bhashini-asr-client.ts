import type { UILanguage } from '@/lib/i18n/languages';

/**
 * Single entry point for Bhashini speech-to-text. Sibling to
 * bhashini-client.ts (TTS) and transcribe-client.ts (Groq Whisper ASR),
 * not merged into either — same endpoint/auth as the TTS client, but a
 * different taskType, request shape (`audio`, not `input`), and response
 * shape (`output[0].source`, not `audio[0].audioContent`).
 *
 * Server-only: reads BHASHINI_INFERENCE_API_KEY from process.env. Never
 * import this from a Client Component.
 *
 * Format: Bhashini's docs list only wav/flac at 16kHz for ASR. Confirmed
 * empirically before writing this (real webm/Opus audio — MediaRecorder's
 * actual output, not a converted file — sent through this exact request
 * shape) that webm/Opus works as-is: no format conversion needed. Real
 * test transcripts came back correct for both Assamese and Hindi.
 *
 * Language: `bhashini/ai4bharat/conformer-multilingual-asr` — chosen for
 * its Assamese/Bodo/Manipuri coverage, this app's actual differentiator —
 * does not support English at all (confirmed: a clean 500, not a format
 * issue). English stays on Groq Whisper, unchanged; only as/hi route here.
 */

const BHASHINI_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const ASR_SERVICE_ID = 'bhashini/ai4bharat/conformer-multilingual-asr';
// "Initial Pipeline Models" — same pipeline ID proven working for TTS.
const PIPELINE_ID = '64392f96daac500b55c543cd';

export type BhashiniAsrLanguage = 'as' | 'hi';
const BHASHINI_ASR_LANGUAGES: ReadonlySet<string> = new Set<BhashiniAsrLanguage>(['as', 'hi']);

/** Whether Bhashini ASR should even be attempted for this language. */
export function supportsBhashiniAsr(language: UILanguage): language is BhashiniAsrLanguage {
  return BHASHINI_ASR_LANGUAGES.has(language);
}

/** A hung connection must not block the companion's recording→thinking flow forever. */
const BHASHINI_TIMEOUT_MS = 20_000;

export interface TranscribeBhashiniResult {
  text: string;
  model: string;
}

/**
 * Transcribes one audio clip via Bhashini ASR. Throws — never swallows —
 * on a missing key, a non-ok response, or an empty transcript. There is no
 * second provider to fall through to here, so the caller (the API route)
 * decides what happens next — same contract as transcribe-client.ts's
 * Groq path.
 */
export async function transcribeBhashini(
  audio: Blob,
  language: BhashiniAsrLanguage,
): Promise<TranscribeBhashiniResult> {
  const apiKey = process.env.BHASHINI_INFERENCE_API_KEY;
  if (!apiKey) {
    throw new Error('BHASHINI_INFERENCE_API_KEY is not configured');
  }

  const audioBase64 = Buffer.from(await audio.arrayBuffer()).toString('base64');

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
          taskType: 'asr',
          config: {
            language: { sourceLanguage: language },
            serviceId: ASR_SERVICE_ID,
            audioFormat: 'webm',
            samplingRate: 48000,
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

  return { text, model: `bhashini/${ASR_SERVICE_ID}` };
}

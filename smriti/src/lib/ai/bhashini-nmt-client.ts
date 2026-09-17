import type { UILanguage } from '@/lib/i18n/languages';
import { fetchInferenceAuth, invalidateInferenceAuth } from './bhashini-auth';
import { BHASHINI_LANGUAGE } from './bhashini-client';

/**
 * Single entry point for Bhashini text translation (NMT). Sibling to
 * bhashini-client.ts (TTS) and bhashini-asr-client.ts (ASR): same endpoint,
 * pipeline and two-step ULCA auth, but a `translation` task whose config
 * carries both a source and a target language and whose response is
 * `output[0].target`.
 *
 * Why the companion needs it: the LLM grounds answers against Memory Bank
 * facts and runs its safety checks in English, but a patient asks and must
 * hear the answer in their own language. Without translation an Assamese
 * question reached the model untranslated and the English answer was then
 * read aloud by an Assamese TTS voice — unintelligible to the patient.
 *
 * Every language this app ships (as, hi, bn, brx, mni, ne) has Bhashini text
 * translation to and from English, per the live capability probe recorded in
 * .claude/plans/multilingual-expansion.plan.md — the one Bhashini task with
 * full coverage.
 *
 * Server-only: reads Bhashini credentials from process.env through
 * bhashini-auth.ts. Never import this from a Client Component.
 */

const BHASHINI_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const PIPELINE_ID = '64392f96daac500b55c543cd';

/** Translation is short text and fast; a tight bound keeps two translations
 * plus the LLM call inside the companion's overall request budget. */
const BHASHINI_NMT_TIMEOUT_MS = 8_000;

export interface TranslateResult {
  text: string;
  model: string;
}

async function computeTranslation(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  headerName: string,
  headerValue: string,
  serviceId: string,
): Promise<TranslateResult> {
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
          taskType: 'translation',
          config: { language: { sourceLanguage, targetLanguage }, serviceId },
        },
      ],
      pipelineRequestConfig: { pipelineId: PIPELINE_ID },
      inputData: { input: [{ source: text }] },
    }),
    signal: AbortSignal.timeout(BHASHINI_NMT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Bhashini translation returned ${response.status}`);
  }

  const body = await response.json();
  const translated = body?.pipelineResponse?.[0]?.output?.[0]?.target;
  if (typeof translated !== 'string' || translated.trim().length === 0) {
    throw new Error('Bhashini translation returned no text');
  }
  return { text: translated.trim(), model: `bhashini/${serviceId}` };
}

/**
 * Translates `text` between two app languages. Same-language calls return
 * the input untouched without a network call. Throws on any failure once
 * discovery is exhausted — the caller decides the fallback (the companion
 * route asks the LLM to answer in the patient's language directly).
 */
export async function translateText(
  text: string,
  source: UILanguage,
  target: UILanguage,
): Promise<TranslateResult> {
  if (source === target || !text.trim()) return { text, model: 'none' };

  const sourceLanguage = BHASHINI_LANGUAGE[source];
  const targetLanguage = BHASHINI_LANGUAGE[target];
  const auth = await fetchInferenceAuth('translation', sourceLanguage, targetLanguage);
  try {
    return await computeTranslation(text, sourceLanguage, targetLanguage, auth.name, auth.value, auth.serviceId);
  } catch (err) {
    invalidateInferenceAuth('translation', sourceLanguage, targetLanguage);
    throw err;
  }
}

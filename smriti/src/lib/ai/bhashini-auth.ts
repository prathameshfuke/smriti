/**
 * The real two-step ULCA auth flow Bhashini's own docs describe: a config
 * call (userID + ulcaApiKey) that resolves which service backs a
 * task/language pair and mints a short-lived, per-pipeline inference key,
 * which the compute call then sends back as its own Authorization-shaped
 * header. Distinct from the older single static-key scheme
 * bhashini-asr-client.ts/bhashini-client.ts used before this.
 *
 * The config call is a DISCOVERY call, not a filter: `serviceId` is
 * something it *returns*, not something you send it — confirmed live
 * against the real API (sending a guessed serviceId made even known-good
 * combinations, like Hindi TTS, fail with a bare 500). The resolved
 * serviceId can differ from any serviceId this app previously hardcoded —
 * e.g. live discovery resolves Hindi ASR to `ai4bharat/conformer-hi-gpu--t4`,
 * not the `bhashini/ai4bharat/conformer-multilingual-asr` id the old
 * static-key scheme used — so the compute call must use whatever this
 * returns, never a caller-supplied guess.
 *
 * Server-only: reads BHASHINI_USER_ID / BHASHINI_ULCA_API_KEY from
 * process.env. Never import this from a Client Component.
 */

const ULCA_CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
// Same "Initial Pipeline Models" pipeline already proven for the direct
// compute calls — the config call needs it too, to resolve which service
// backs this task/language pair.
const PIPELINE_ID = '64392f96daac500b55c543cd';

/** Bounds the config round trip so the compute call's own budget isn't
 * starved — see bhashini-asr-client.ts/bhashini-client.ts's 15s compute
 * timeout: 5s + 15s keeps the combined Bhashini-attempt budget at the same
 * 20s this app has always used, so the documented 35s Bhashini+Groq /
 * 40s client-ceiling contract in companion/page.tsx doesn't change. */
const ULCA_CONFIG_TIMEOUT_MS = 5_000;

export type BhashiniTaskType = 'asr' | 'tts' | 'translation';

/** The inference key ULCA mints is reusable across compute calls, so it is
 * cached per process instead of paying the config round trip (up to 5s) on
 * every question, transcript and spoken line. Callers drop an entry with
 * `invalidateInferenceAuth` when a compute call using it fails, so a revoked
 * or rotated key is replaced on the very next attempt. */
const AUTH_CACHE_TTL_MS = 30 * 60_000;
const authCache = new Map<string, { auth: InferenceAuth; expiresAt: number }>();

function cacheKey(taskType: BhashiniTaskType, sourceLanguage: string, targetLanguage?: string): string {
  return [process.env.BHASHINI_USER_ID ?? '', taskType, sourceLanguage, targetLanguage ?? ''].join('|');
}

export function invalidateInferenceAuth(
  taskType: BhashiniTaskType,
  sourceLanguage: string,
  targetLanguage?: string,
): void {
  authCache.delete(cacheKey(taskType, sourceLanguage, targetLanguage));
}

/** Test isolation only. */
export function clearInferenceAuthCache(): void {
  authCache.clear();
}

export interface InferenceAuth {
  /** The header name the compute call must send this value under —
   * returned by ULCA itself, not assumed, since it need not be
   * "Authorization" (Bhashini's config responses have used other header
   * names for some services). */
  name: string;
  value: string;
  /** The service this task/language pair actually resolved to — pass
   * this straight to the compute call's `config.serviceId`. Never assume
   * it matches any id you already know; live discovery can (and does)
   * resolve to a different service than an older static-key call used. */
  serviceId: string;
}

/**
 * Runs the config call for one task/language and returns the resolved
 * service plus the dynamic header the compute call must use. Throws —
 * never swallows — on missing credentials, a non-ok response (including a
 * clean "no service found for this language" 400, which is a real,
 * expected outcome for a language this ULCA account doesn't have a
 * registered service for), or a response missing the inference key.
 * Callers already treat every Bhashini failure this way and fall through
 * (to an older scheme, then to Groq/browser TTS), so this fits the
 * existing contract without any new error-handling shape.
 */
export async function fetchInferenceAuth(
  taskType: BhashiniTaskType,
  sourceLanguage: string,
  targetLanguage?: string,
): Promise<InferenceAuth> {
  const key = cacheKey(taskType, sourceLanguage, targetLanguage);
  const cached = authCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.auth;

  const auth = await requestInferenceAuth(taskType, sourceLanguage, targetLanguage);
  authCache.set(key, { auth, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
  return auth;
}

async function requestInferenceAuth(
  taskType: BhashiniTaskType,
  sourceLanguage: string,
  targetLanguage?: string,
): Promise<InferenceAuth> {
  const userID = process.env.BHASHINI_USER_ID;
  const ulcaApiKey = process.env.BHASHINI_ULCA_API_KEY;
  if (!userID || !ulcaApiKey) {
    throw new Error('BHASHINI_USER_ID/BHASHINI_ULCA_API_KEY is not configured');
  }

  const response = await fetch(ULCA_CONFIG_URL, {
    method: 'POST',
    headers: {
      userID,
      ulcaApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pipelineTasks: [
        {
          taskType,
          config: { language: targetLanguage ? { sourceLanguage, targetLanguage } : { sourceLanguage } },
        },
      ],
      pipelineRequestConfig: { pipelineId: PIPELINE_ID },
    }),
    signal: AbortSignal.timeout(ULCA_CONFIG_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Bhashini config call returned ${response.status}`);
  }

  const body = await response.json();
  const serviceId = body?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
  const apiKey = body?.pipelineInferenceAPIEndPoint?.inferenceApiKey;
  if (typeof serviceId !== 'string' || typeof apiKey?.name !== 'string' || typeof apiKey?.value !== 'string') {
    throw new Error('Bhashini config call returned no matching service');
  }

  return { name: apiKey.name, value: apiKey.value, serviceId };
}

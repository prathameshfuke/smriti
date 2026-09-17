#!/usr/bin/env node
/**
 * Checks every AI provider Ask Smriti depends on, with the real keys, and
 * prints only status codes, latency and response shape — never keys or
 * response text beyond a short sample.
 *
 *   node --env-file=.env.local scripts/probe-ai.mjs
 *
 * Mirrors the request shapes in src/lib/ai/llm-client.ts and
 * src/lib/ai/bhashini-*.ts, so a failure here is a failure in the app.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ULCA_CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const DHRUVA_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const PIPELINE_ID = '64392f96daac500b55c543cd';

const GROQ_MODEL = process.env.PROBE_GROQ_MODEL ?? 'openai/gpt-oss-20b';
// Free tier: only `:free` slugs are usable without credits (a paid slug
// answers 402), and free capacity is shared, so a 429 here is normal.
const OPENROUTER_MODEL = process.env.PROBE_OPENROUTER_MODEL ?? 'qwen/qwen3.8-27b:free';

const results = [];

async function timed(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    results.push({ check: name, ok: true, ms: Date.now() - start, detail });
  } catch (err) {
    results.push({ check: name, ok: false, ms: Date.now() - start, detail: String(err?.message ?? err).slice(0, 200) });
  }
}

/** Response headers of the last postJson call, for the rate-limit read-out. */
let lastHeaders = null;

async function postJson(url, headers, body, timeoutMs = 20_000) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  lastHeaders = res.headers;
  let json = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON error bodies are reported by status alone.
  }
  if (!res.ok) {
    const message = json?.error?.message ?? json?.message ?? json?.detail ?? '';
    throw new Error(`HTTP ${res.status} ${String(message).slice(0, 160)}`);
  }
  return json;
}

function chatBody(model, extra = {}) {
  return {
    model,
    messages: [
      { role: 'system', content: 'Reply in JSON: {"reply": "..."}. Keep it to one short sentence.' },
      { role: 'user', content: 'Say hello to Aai.' },
    ],
    ...extra,
  };
}

function describeChat(json, headers) {
  const choice = json?.choices?.[0];
  const content = choice?.message?.content ?? '';
  return {
    finish: choice?.finish_reason,
    contentChars: content.length,
    sample: content.slice(0, 60),
    usage: json?.usage
      ? {
          completion: json.usage.completion_tokens,
          reasoning: json.usage.completion_tokens_details?.reasoning_tokens,
        }
      : undefined,
    // Free-tier budget left for this model, straight from the provider.
    limits: headers
      ? {
          requests: `${headers.get('x-ratelimit-remaining-requests') ?? '?'}/${headers.get('x-ratelimit-limit-requests') ?? '?'}`,
          tokensPerMin: `${headers.get('x-ratelimit-remaining-tokens') ?? '?'}/${headers.get('x-ratelimit-limit-tokens') ?? '?'}`,
        }
      : undefined,
  };
}

if (process.env.GROQ_API_KEY) {
  const auth = { Authorization: `Bearer ${process.env.GROQ_API_KEY}` };
  // Exactly what llm-client.ts sends today.
  await timed(`groq ${GROQ_MODEL} (current: max_tokens 300)`, async () =>
    describeChat(await postJson(GROQ_URL, auth, chatBody(GROQ_MODEL, { max_tokens: 300, temperature: 0.3 })), lastHeaders),
  );
  await timed(`groq ${GROQ_MODEL} (reasoning low, json_object)`, async () =>
    describeChat(
      await postJson(
        GROQ_URL,
        auth,
        chatBody(GROQ_MODEL, {
          max_completion_tokens: 800,
          temperature: 0.3,
          reasoning_effort: 'low',
          response_format: { type: 'json_object' },
        }),
      ),
      lastHeaders,
    ),
  );
  await timed('groq models list', async () => {
    const res = await fetch('https://api.groq.com/openai/v1/models', { headers: auth, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const ids = (json.data ?? []).map((m) => m.id);
    return { hasModel: ids.includes(GROQ_MODEL), chatModels: ids.filter((id) => !/whisper|guard|tts/i.test(id)).slice(0, 12) };
  });
} else {
  results.push({ check: 'groq', ok: false, detail: 'GROQ_API_KEY not set' });
}

if (process.env.OPENROUTER_API_KEY) {
  const auth = { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` };
  await timed(`openrouter ${OPENROUTER_MODEL}`, async () =>
    describeChat(await postJson(OPENROUTER_URL, auth, chatBody(OPENROUTER_MODEL, { max_tokens: 300, temperature: 0.3 }))),
  );
} else {
  results.push({ check: 'openrouter', ok: false, detail: 'OPENROUTER_API_KEY not set' });
}

async function bhashiniConfig(taskType, language) {
  return postJson(
    ULCA_CONFIG_URL,
    { userID: process.env.BHASHINI_USER_ID, ulcaApiKey: process.env.BHASHINI_ULCA_API_KEY },
    { pipelineTasks: [{ taskType, config: { language } }], pipelineRequestConfig: { pipelineId: PIPELINE_ID } },
    10_000,
  );
}

const SAMPLES = { hi: 'आपका बेटा राजू है।', as: 'আপোনাৰ পুতেক ৰাজু।', bn: 'আপনার ছেলে রাজু।', ne: 'तपाईंको छोरा राजु हो।', brx: 'नोंनि फिसाजोनाय राजु।', mni: 'নহাক্কী মচানুপা রাজু নি।' };

if (process.env.BHASHINI_USER_ID && process.env.BHASHINI_ULCA_API_KEY) {
  for (const lang of Object.keys(SAMPLES)) {
    for (const [src, tgt] of [[lang, 'en'], ['en', lang]]) {
      await timed(`bhashini translation ${src}→${tgt}`, async () => {
        const config = await bhashiniConfig('translation', { sourceLanguage: src, targetLanguage: tgt });
        const serviceId = config?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
        const key = config?.pipelineInferenceAPIEndPoint?.inferenceApiKey;
        if (!serviceId || !key?.name) throw new Error('config returned no service');
        const text = src === 'en' ? 'Your son is Raju.' : SAMPLES[lang];
        const out = await postJson(
          DHRUVA_URL,
          { [key.name]: key.value },
          {
            pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage: src, targetLanguage: tgt }, serviceId } }],
            pipelineRequestConfig: { pipelineId: PIPELINE_ID },
            inputData: { input: [{ source: text }] },
          },
        );
        return { serviceId, sample: out?.pipelineResponse?.[0]?.output?.[0]?.target?.slice(0, 60) };
      });
    }
    await timed(`bhashini tts ${lang}`, async () => {
      const config = await bhashiniConfig('tts', { sourceLanguage: lang });
      const serviceId = config?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
      const key = config?.pipelineInferenceAPIEndPoint?.inferenceApiKey;
      if (!serviceId || !key?.name) throw new Error('config returned no service');
      const out = await postJson(
        DHRUVA_URL,
        { [key.name]: key.value },
        {
          pipelineTasks: [{ taskType: 'tts', config: { language: { sourceLanguage: lang }, serviceId, gender: 'female' } }],
          pipelineRequestConfig: { pipelineId: PIPELINE_ID },
          inputData: { input: [{ source: SAMPLES[lang] }] },
        },
      );
      return { serviceId, audioChars: out?.pipelineResponse?.[0]?.audio?.[0]?.audioContent?.length ?? 0 };
    });
  }
} else {
  results.push({ check: 'bhashini', ok: false, detail: 'BHASHINI_USER_ID/BHASHINI_ULCA_API_KEY not set' });
}

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.check}${r.ms !== undefined ? ` (${r.ms}ms)` : ''} ${JSON.stringify(r.detail ?? '')}`);
}

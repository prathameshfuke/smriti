#!/usr/bin/env node
/**
 * Asks Bhashini, live, which tasks it can serve for the six Northeast
 * languages the app does not yet cover, and prints one line per check.
 * Prints service ids, status and a short translation sample — never keys.
 *
 *   node --env-file=.env.local scripts/probe-bhashini-languages.mjs
 *
 * Same request shapes as scripts/probe-ai.mjs and src/lib/ai/bhashini-*.ts.
 * Language codes are ISO 639-3 (Khasi kha, Mizo lus, Garo grt, Kokborok trp,
 * Sikkimese/Bhutia sip, Lepcha lep); Bhashini's own catalogue may use others,
 * so a miss on one code is a hint, not proof — see the model list at
 * https://dibd-bhashini.gitbook.io/bhashini-apis/available-models-for-usage
 */

const ULCA_CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const DHRUVA_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const PIPELINE_ID = '64392f96daac500b55c543cd';

const LANGUAGES = { kha: 'Khasi', lus: 'Mizo', grt: 'Garo', trp: 'Kokborok', sip: 'Sikkimese/Bhutia', lep: 'Lepcha' };
const SAMPLE = 'Good morning. Time for your medicine.';

if (!process.env.BHASHINI_USER_ID || !process.env.BHASHINI_ULCA_API_KEY) {
  console.error('BHASHINI_USER_ID / BHASHINI_ULCA_API_KEY not set (use --env-file=.env.local)');
  process.exit(1);
}

async function postJson(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${String(json?.message ?? '').slice(0, 100)}`);
  return json;
}

async function service(taskType, language) {
  const config = await postJson(
    ULCA_CONFIG_URL,
    { userID: process.env.BHASHINI_USER_ID, ulcaApiKey: process.env.BHASHINI_ULCA_API_KEY },
    { pipelineTasks: [{ taskType, config: { language } }], pipelineRequestConfig: { pipelineId: PIPELINE_ID } },
  );
  const serviceId = config?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
  const key = config?.pipelineInferenceAPIEndPoint?.inferenceApiKey;
  if (!serviceId || !key?.name) throw new Error('no service listed');
  return { serviceId, key };
}

async function check(label, fn) {
  try {
    console.log(`OK    ${label}: ${JSON.stringify(await fn())}`);
  } catch (err) {
    console.log(`NONE  ${label}: ${String(err?.message ?? err).slice(0, 120)}`);
  }
}

for (const [code, name] of Object.entries(LANGUAGES)) {
  console.log(`\n== ${name} (${code})`);
  await check('translation en→' + code, async () => {
    const { serviceId, key } = await service('translation', { sourceLanguage: 'en', targetLanguage: code });
    const out = await postJson(DHRUVA_URL, { [key.name]: key.value }, {
      pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage: 'en', targetLanguage: code }, serviceId } }],
      pipelineRequestConfig: { pipelineId: PIPELINE_ID },
      inputData: { input: [{ source: SAMPLE }] },
    });
    return { serviceId, sample: out?.pipelineResponse?.[0]?.output?.[0]?.target };
  });
  await check('translation ' + code + '→en', async () => {
    const { serviceId } = await service('translation', { sourceLanguage: code, targetLanguage: 'en' });
    return { serviceId };
  });
  await check('asr ' + code, async () => ({ serviceId: (await service('asr', { sourceLanguage: code })).serviceId }));
  await check('tts ' + code, async () => ({ serviceId: (await service('tts', { sourceLanguage: code })).serviceId }));
}

// Bhashini's public model list shows Khasi and Mizo under the service
// "bhashini/iiith/nmt-all", which the standard pipeline lookup above does not
// return for this account. Borrow the inference key from a pair that does
// resolve (en→hi) and call that service directly.
console.log('\n== Direct call: bhashini/iiith/nmt-all');
let borrowed;
try {
  borrowed = await service('translation', { sourceLanguage: 'en', targetLanguage: 'hi' });
} catch (err) {
  console.log(`NONE  could not obtain an inference key: ${String(err?.message ?? err).slice(0, 100)}`);
}
for (const serviceId of ['bhashini/iiith/nmt-all']) {
  for (const code of ['kha', 'lus', 'grt']) {
    if (!borrowed) break;
    await check(`${serviceId} en→${code}`, async () => {
      const out = await postJson(DHRUVA_URL, { [borrowed.key.name]: borrowed.key.value }, {
        pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage: 'en', targetLanguage: code }, serviceId } }],
        pipelineRequestConfig: { pipelineId: PIPELINE_ID },
        inputData: { input: [{ source: SAMPLE }] },
      });
      return { sample: out?.pipelineResponse?.[0]?.output?.[0]?.target };
    });
  }
}

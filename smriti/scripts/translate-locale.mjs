#!/usr/bin/env node
/**
 * Machine-translates the English UI catalog into Khasi and/or Mizo with
 * Bhashini's own translation service, and writes src/lib/i18n/locales/<code>.json.
 *
 *   node --env-file=.env.local scripts/translate-locale.mjs kha lus
 *
 * What it will not do, on purpose:
 *  - Translate wording where a wrong word is a safety problem (medicine,
 *    appointment, PIN, distress, disclaimer, sign-in). Those keys stay out of
 *    the file, so the app shows the English line until a native speaker
 *    supplies one.
 *  - Keep a translation whose {placeholders} did not survive, or that came
 *    back empty or unchanged. Those fall back to English too.
 *
 * Also writes docs/translation-review-kha-lus.md: every English line beside
 * its machine translation, for a native reviewer. Nothing here is reviewed.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ULCA_CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const DHRUVA_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const PIPELINE_ID = '64392f96daac500b55c543cd';
const BATCH = 15;

const NAMES = { kha: 'Khasi', lus: 'Mizo' };
/** Keys (or key prefixes) never machine-translated: wording where a mistake can hurt someone. */
const SAFETY_PREFIXES = ['reminder.', 'reminders.', 'reminderType.', 'pin.', 'home.pin', 'companion.distress', 'companion.notSure', 'companion.unavailable', 'disclaimer', 'login.', 'alertPush.', 'alertOptIn.', 'push.', 'lang.'];

const codes = process.argv.slice(2).filter((c) => c in NAMES);
if (codes.length === 0 || !process.env.BHASHINI_USER_ID || !process.env.BHASHINI_ULCA_API_KEY) {
  console.error('usage: node --env-file=.env.local scripts/translate-locale.mjs kha lus');
  process.exit(1);
}

const en = JSON.parse(readFileSync('src/lib/i18n/locales/en.json', 'utf8'));

function flatten(node, prefix = '', out = {}) {
  if (typeof node === 'string') out[prefix] = node;
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}
function unflatten(flat) {
  const root = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let node = root;
    parts.slice(0, -1).forEach((p) => (node = node[p] ??= {}));
    node[parts.at(-1)] = value;
  }
  return root;
}
const placeholders = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

async function postJson(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return json;
}

async function translateAll(code, texts) {
  const language = { sourceLanguage: 'en', targetLanguage: code };
  const config = await postJson(
    ULCA_CONFIG_URL,
    { userID: process.env.BHASHINI_USER_ID, ulcaApiKey: process.env.BHASHINI_ULCA_API_KEY },
    { pipelineTasks: [{ taskType: 'translation', config: { language } }], pipelineRequestConfig: { pipelineId: PIPELINE_ID } },
  );
  const serviceId = config?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
  const key = config?.pipelineInferenceAPIEndPoint?.inferenceApiKey;
  if (!serviceId || !key?.name) throw new Error(`Bhashini lists no en→${code} translation service`);
  const results = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const chunk = texts.slice(i, i + BATCH);
    const out = await postJson(DHRUVA_URL, { [key.name]: key.value }, {
      pipelineTasks: [{ taskType: 'translation', config: { language, serviceId } }],
      pipelineRequestConfig: { pipelineId: PIPELINE_ID },
      inputData: { input: chunk.map((source) => ({ source })) },
    });
    const outputs = out?.pipelineResponse?.[0]?.output ?? [];
    chunk.forEach((_, j) => results.push(typeof outputs[j]?.target === 'string' ? outputs[j].target.trim() : ''));
    process.stdout.write('.');
  }
  return { serviceId, results };
}

const flatEn = flatten(en);
const keys = Object.keys(flatEn).filter((k) => !SAFETY_PREFIXES.some((p) => k.startsWith(p)));
const review = ['# Khasi and Mizo machine-translated text: review sheet', '',
  '**Status: machine translation from Bhashini, not checked by a native speaker.** Lines left out (medicine, appointment, PIN, distress, sign-in wording, and anything whose placeholders were lost) show in English until a reviewer supplies text.', ''];

for (const code of codes) {
  console.log(`\n${NAMES[code]} (${code}): ${keys.length} strings`);
  const { serviceId, results } = await translateAll(code, keys.map((k) => flatEn[k]));
  const kept = {};
  const dropped = [];
  keys.forEach((k, i) => {
    const mt = results[i];
    if (!mt || mt === flatEn[k] || placeholders(mt) !== placeholders(flatEn[k])) dropped.push(k);
    else kept[k] = mt;
  });
  writeFileSync(`src/lib/i18n/locales/${code}.json`, JSON.stringify(unflatten(kept), null, 2) + '\n');
  console.log(`\n  kept ${Object.keys(kept).length}, left in English ${dropped.length} (service ${serviceId})`);
  review.push(`## ${NAMES[code]} (${code}), service \`${serviceId}\``, '', '| Key | English | Machine translation |', '|---|---|---|',
    ...Object.entries(kept).map(([k, v]) => `| \`${k}\` | ${flatEn[k].replace(/\|/g, '\\|')} | ${v.replace(/\|/g, '\\|')} |`), '',
    `Left in English: ${dropped.length ? dropped.map((k) => `\`${k}\``).join(', ') : 'none'}`, '');
}
writeFileSync('docs/translation-review-kha-lus.md', review.join('\n'));
console.log('\nwrote locale files and docs/translation-review-kha-lus.md');

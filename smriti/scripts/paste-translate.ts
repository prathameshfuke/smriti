/**
 * Drafts a language for the app with no key and no service: you paste text
 * into the Google Translate website and paste the result back.
 *
 *   npx tsx scripts/paste-translate.ts export kha
 *       writes translation-drafts/kha/1-en.txt (and 2-en.txt...). Paste each
 *       into translate.google.com (English -> Khasi) and save the result as
 *       1-out.txt, 2-out.txt...
 *   npx tsx scripts/paste-translate.ts import kha
 *       checks the pasted results and writes docs/translation-review-kha.md
 *       (English beside the draft, with mechanical flags). Locale files are
 *       NOT touched.
 *   npx tsx scripts/paste-translate.ts back-export kha
 *       optional: writes 1-draft.txt... Paste those into Google Translate
 *       (Khasi -> English) and save as 1-back.txt...
 *   npx tsx scripts/paste-translate.ts import kha
 *       run again after the back files exist: adds a round-trip column that
 *       flags lines whose meaning drifted.
 *   npx tsx scripts/paste-translate.ts apply kha --reviewed-by "Name"
 *       after a native speaker has fixed docs/translation-review-kha.md,
 *       writes the approved lines to src/lib/i18n/locales/kha.json.
 *
 * Any language code works for the drafting steps (kha, lus, trp...); `apply`
 * only exists for languages the app has a catalog for (kha, lus).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  buildSheet, check, chunkKeys, flatten, normalizeLine, repairPlaceholders, roundTripSimilarity, selectKeys, splitOutput,
  toPasteLine, unflatten, type Flat, type SheetRow,
} from './paste-translate.lib';

const NAMES: Record<string, string> = { kha: 'Khasi', lus: 'Mizo', trp: 'Kokborok' };
const APPLICABLE = new Set(['kha', 'lus']);

/** Words Google put inside placeholders, mapped back to the real names (seen in a Khasi paste). */
const PLACEHOLDER_ALIASES: Record<string, Record<string, string>> = {
  kha: {
    kyrteng: 'name', baroh: 'total', khein: 'count', jingkhein: 'count', jingiadei: 'relationship',
    'kaba peit bniah': 'detail', tarik: 'date',
  },
  // Seen in a Mizo paste.
  lus: { hming: 'name', chipchiar: 'detail', inzawmna: 'relationship' },
};

const [command, code, ...rest] = process.argv.slice(2);
if (!command || !code) {
  console.error('usage: npx tsx scripts/paste-translate.ts <export|import|back-export|apply> <kha|lus|trp> [--reviewed-by "Name"]');
  process.exit(1);
}
const name = NAMES[code] ?? code;
const dir = `translation-drafts/${code}`;
const sheetPath = `docs/translation-review-${code}.md`;
const en: Flat = flatten(JSON.parse(readFileSync('src/lib/i18n/locales/en.json', 'utf8')));
const allKeys = Object.keys(en);
const keys = selectKeys(en);
const chunks = chunkKeys(keys, en);

function read(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/** key -> text for every chunk pasted back with `suffix` (`out` or `back`); reports chunks that do not line up. */
function readChunks(suffix: 'out' | 'back', source: (key: string) => string | undefined): { texts: Flat; problems: string[] } {
  const texts: Flat = {};
  const problems: string[] = [];
  chunks.forEach((chunk, i) => {
    const raw = read(`${dir}/${i + 1}-${suffix}.txt`);
    if (raw === null) return;
    const lines = splitOutput(raw);
    if (lines.length !== chunk.length) {
      problems.push(`${i + 1}-${suffix}.txt has ${lines.length} lines, expected ${chunk.length}: skipped (a line was merged or split; paste that chunk again)`);
      return;
    }
    chunk.forEach((k, j) => {
      if (source(k) !== undefined) texts[k] = repairPlaceholders(en[k], lines[j], PLACEHOLDER_ALIASES[code] ?? {});
    });
  });
  return { texts, problems };
}

if (command === 'export') {
  mkdirSync(dir, { recursive: true });
  chunks.forEach((chunk, i) => writeFileSync(`${dir}/${i + 1}-en.txt`, chunk.map((k) => toPasteLine(en[k])).join('\n') + '\n'));
  console.log(`${keys.length} strings (${allKeys.length - keys.length} safety strings left out) in ${chunks.length} file(s) in ${dir}/`);
  console.log(`Paste each N-en.txt into translate.google.com (English -> ${name}), save the result as ${dir}/N-out.txt, then run: import ${code}`);
} else if (command === 'import') {
  const { texts, problems } = readChunks('out', (k) => en[k]);
  if (Object.keys(texts).length === 0) {
    console.error(`No usable ${dir}/N-out.txt files.\n${problems.join('\n')}`);
    process.exit(1);
  }
  const back = readChunks('back', (k) => texts[k]);
  const rows: SheetRow[] = Object.keys(texts).map((key) => ({
    key,
    english: en[key],
    draft: texts[key],
    verdict: check(en[key], texts[key]),
    similarity: back.texts[key] === undefined ? null : roundTripSimilarity(en[key], back.texts[key]),
    back: back.texts[key] ?? null,
  }));
  mkdirSync('docs', { recursive: true });
  writeFileSync(sheetPath, buildSheet(name, code, rows, allKeys.filter((k) => !keys.includes(k))));
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/draft.json`, JSON.stringify(Object.fromEntries(rows.filter((r) => r.verdict === 'ok').map((r) => [r.key, r.draft])), null, 2));
  const flagged = rows.filter((r) => r.verdict !== 'ok').length;
  console.log(`${rows.length} drafted, ${rows.length - flagged} passed the mechanical checks, ${flagged} flagged. Sheet: ${sheetPath}`);
  for (const p of [...problems, ...back.problems]) console.warn(`warning: ${p}`);
} else if (command === 'back-export') {
  const draft = JSON.parse(read(`${dir}/draft.json`) ?? 'null') as Flat | null;
  if (!draft) {
    console.error(`Run import ${code} first.`);
    process.exit(1);
  }
  chunks.forEach((chunk, i) => {
    // Failed lines get a dash, not a blank: a blank line could be dropped by the pasting and shift every line after it.
    writeFileSync(`${dir}/${i + 1}-draft.txt`, chunk.map((k) => toPasteLine(draft[k] ?? '') || '-').join('\n') + '\n');
  });
  console.log(`Paste each ${dir}/N-draft.txt into translate.google.com (${name} -> English), save as ${dir}/N-back.txt, then run: import ${code}`);
} else if (command === 'apply') {
  const who = rest[rest.indexOf('--reviewed-by') + 1];
  if (!APPLICABLE.has(code) || rest.indexOf('--reviewed-by') === -1 || !who || who.startsWith('--')) {
    console.error('apply needs a language the app has a catalog for (kha, lus) and --reviewed-by "Name" of the native speaker.');
    process.exit(1);
  }
  const sheet = read(sheetPath);
  if (!sheet) {
    console.error(`No ${sheetPath}. Run import first.`);
    process.exit(1);
  }
  // Parsed from the sheet the reviewer edited: `approve` keeps the draft, other text replaces it, blank drops the line.
  const approved: Flat = {};
  for (const line of sheet.split('\n')) {
    const m = line.match(/^\| `([^`]+)` \| (.*) \| (.*) \| (.*) \| ([a-z-]+)(?: \(drifted\))? \| ([0-9.]*) \| (.*) \|$/);
    if (!m) continue;
    const [, key, , draft, , , , reviewer] = m;
    const decision = reviewer.trim();
    if (!decision || !(key in en)) continue;
    const text = normalizeLine((decision.toLowerCase() === 'approve' ? draft : decision).replace(/\\\|/g, '|'));
    if (check(en[key], text) !== 'ok') {
      console.warn(`skipped ${key}: fails the mechanical checks`);
      continue;
    }
    approved[key] = text;
  }
  writeFileSync(`src/lib/i18n/locales/${code}.json`, JSON.stringify(unflatten(approved), null, 2) + '\n');
  console.log(`${Object.keys(approved).length} approved lines written to src/lib/i18n/locales/${code}.json (reviewed by ${who}).`);
  console.log('Record the reviewer in docs/translation-review.md, then run the tests.');
} else {
  console.error(`unknown command: ${command}`);
  process.exit(1);
}

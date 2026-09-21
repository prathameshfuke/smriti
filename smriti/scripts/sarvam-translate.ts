/**
 * Second opinion on the Bodo and Manipuri text, from Sarvam-Translate.
 *
 *   SARVAM_API_KEY=... npx tsx scripts/sarvam-translate.ts brx mni
 *   SARVAM_API_KEY=... npx tsx scripts/sarvam-translate.ts brx --limit 3   (try a few first)
 *
 * Translates every English UI string once and saves the raw result as a cache
 * in docs/translation-sources/sarvam-<code>.json (rerunning skips strings
 * already cached), then writes docs/translation-sarvam-<code>.md: English,
 * the text currently in the app, and Sarvam's, side by side, with the lines
 * where the two disagree marked for a native speaker. It never edits the
 * locale files. The key is read from the environment only, never stored.
 *
 * Sarvam-Translate (`sarvam-translate:v1`) covers all 22 scheduled languages,
 * including Bodo and Manipuri, in formal mode; requests are limited to 2000
 * characters and one string is sent per request so lines never merge.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const CODES: Record<string, { sarvam: string; name: string }> = {
  brx: { sarvam: 'brx-IN', name: 'Bodo' },
  mni: { sarvam: 'mni-IN', name: 'Manipuri' },
  as: { sarvam: 'as-IN', name: 'Assamese' },
  ne: { sarvam: 'ne-IN', name: 'Nepali' },
  bn: { sarvam: 'bn-IN', name: 'Bengali' },
  hi: { sarvam: 'hi-IN', name: 'Hindi' },
};
const URL = 'https://api.sarvam.ai/translate';
const CONCURRENCY = 3;

const USAGE = 'usage: SARVAM_API_KEY=... npx tsx scripts/sarvam-translate.ts <brx|mni|as|ne|bn|hi>... [--limit N]';

/** Strict on purpose: a typo must stop the run, not quietly translate less than was asked for. */
function parseArgs(argv: string[]): { codes: string[]; limit: number } {
  const codes: string[] = [];
  let limit = Infinity;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') {
      const value = argv[i + 1];
      if (value === undefined || !/^\d+$/.test(value)) throw new Error(`--limit needs a whole number, got ${value ?? 'nothing'}`);
      limit = Number(value);
      i += 1;
    } else if (arg in CODES) {
      if (!codes.includes(arg)) codes.push(arg);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (codes.length === 0) throw new Error('name at least one language');
  return { codes, limit };
}

const key = process.env.SARVAM_API_KEY;
let parsed: { codes: string[]; limit: number };
try {
  parsed = parseArgs(process.argv.slice(2));
  if (!key) throw new Error('SARVAM_API_KEY is not set');
} catch (err) {
  console.error(`${(err as Error).message}\n${USAGE}`);
  process.exit(1);
}
const { codes, limit } = parsed;

type Flat = Record<string, string>;
function flatten(node: unknown, prefix = '', out: Flat = {}): Flat {
  if (typeof node === 'string') out[prefix] = node;
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

const ATTEMPTS = 5;

/** Network failures and timeouts are transient too, so they retry like a 429 does. */
async function translate(text: string, target: string): Promise<string> {
  let lastError = 'unknown error';
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    // Wait before a retry, never after the last attempt.
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    let res: Response;
    try {
      res = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-subscription-key': key as string },
        body: JSON.stringify({
          input: text,
          source_language_code: 'en-IN',
          target_language_code: target,
          model: 'sarvam-translate:v1',
          mode: 'formal',
          // The app writes numbers in each language's own digits itself.
          numerals_format: 'international',
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      lastError = (err as Error).message;
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      lastError = `Sarvam returned ${res.status}`;
      continue;
    }
    if (!res.ok) throw new Error(`Sarvam returned ${res.status}`);
    const body = (await res.json()) as { translated_text?: string };
    if (typeof body.translated_text !== 'string') throw new Error('Sarvam returned no text');
    return body.translated_text.trim();
  }
  throw new Error(`gave up after ${ATTEMPTS} attempts: ${lastError}`);
}

async function main() {
  const en = flatten(JSON.parse(readFileSync('src/lib/i18n/locales/en.json', 'utf8')));
  const keys = Object.keys(en).slice(0, limit);
  mkdirSync('docs/translation-sources', { recursive: true });

  for (const code of codes) {
    const { sarvam, name } = CODES[code];
    const cachePath = `docs/translation-sources/sarvam-${code}.json`;
    const cache: Flat = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
    const todo = keys.filter((k) => !(k in cache));
    console.log(`${name} (${code}): ${keys.length - todo.length} cached, ${todo.length} to translate`);

    let next = 0;
    const failed: string[] = [];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (next < todo.length) {
          const k = todo[next++];
          try {
            cache[k] = await translate(en[k], sarvam);
            process.stdout.write('.');
          } catch (err) {
            process.stdout.write('x');
            failed.push(k);
            console.error(`\n${k}: ${(err as Error).message}`);
          }
        }
      }),
    );
    writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n');
    if (failed.length > 0) {
      // The cache keeps what succeeded, so a rerun only redoes these. No report is
      // written: a sheet with holes in it would look complete.
      console.error(`\n${name}: ${failed.length} string(s) failed, no report written. Rerun to retry them.`);
      process.exitCode = 1;
      continue;
    }

    if (limit !== Infinity) {
      // A trial run must not replace the full sheet with a partial one.
      console.log(`\n${name}: trial run (--limit ${limit}), cache updated, report not written`);
      continue;
    }

    const current = existsSync(`src/lib/i18n/locales/${code}.json`) ? flatten(JSON.parse(readFileSync(`src/lib/i18n/locales/${code}.json`, 'utf8'))) : {};
    const cell = (s: string) => (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const rows = keys.filter((k) => k in cache).map((k) => {
      const same = (current[k] ?? '').trim() === cache[k].trim();
      const ph = placeholders(cache[k]) === placeholders(en[k]) ? '' : ' placeholders changed';
      return `| \`${k}\` | ${cell(en[k])} | ${cell(current[k] ?? '')} | ${cell(cache[k])} | ${same ? 'same' : 'differs'}${ph} |  |`;
    });
    const differs = rows.filter((r) => r.includes('| differs')).length;
    writeFileSync(
      `docs/translation-sarvam-${code}.md`,
      [
        `# ${name} (${code}): text in the app vs Sarvam-Translate`,
        '',
        '**Status: neither column has been checked by a native speaker.** The "In the app" column was written by an AI model; the "Sarvam" column is `sarvam-translate:v1` (formal mode). Where they agree, that is mild evidence both are reasonable; where they differ, a native speaker needs to pick or write the right text. Nothing here changes the app.',
        '',
        `${rows.length} strings compared, ${rows.length - differs} identical, ${differs} differ.`,
        '',
        '| Key | English | In the app | Sarvam | Compare | Reviewer |',
        '|---|---|---|---|---|---|',
        ...rows,
        '',
      ].join('\n'),
    );
    console.log(`\nwrote docs/translation-sarvam-${code}.md (${differs} of ${rows.length} differ)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

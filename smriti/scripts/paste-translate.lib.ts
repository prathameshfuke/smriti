/**
 * Pure helpers for scripts/paste-translate.ts: a free, key-less way to draft
 * a language by pasting text into the Google Translate website and pasting
 * the result back. Split out so it can be unit-tested with no network or
 * filesystem. Nothing here decides that a translation is right — it only
 * catches mechanical damage and builds the sheet a native speaker approves.
 */

export type Flat = Record<string, string>;

/** Wording where a mistake can hurt someone. Never drafted: it stays English until a native speaker supplies it. */
export const SAFETY_PREFIXES = [
  'reminder.', 'reminders.', 'reminderType.', 'pin.', 'home.pin', 'home.forgotPin', 'home.caregiverAccess',
  'home.caregiverLogin', 'companion.', 'disclaimer', 'login.', 'alertPush.', 'alertOptIn.', 'push.', 'lang.', 'caregiver.',
];

/** The Google Translate box takes 5000 characters; stay under it. */
export const MAX_CHUNK_CHARS = 4500;

export function flatten(node: unknown, prefix = '', out: Flat = {}): Flat {
  if (typeof node === 'string') out[prefix] = node;
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

export function unflatten(flat: Flat): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let node = root;
    for (const p of parts.slice(0, -1)) node = (node[p] ??= {}) as Record<string, unknown>;
    node[parts[parts.length - 1]] = value;
  }
  return root;
}

/** English keys worth drafting: everything except the safety wording. */
export function selectKeys(en: Flat): string[] {
  return Object.keys(en).filter((k) => !SAFETY_PREFIXES.some((p) => k.startsWith(p)));
}

/** Splits keys into pasteable chunks, one string per line, each under the character limit. */
export function chunkKeys(keys: string[], en: Flat, max = MAX_CHUNK_CHARS): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const k of keys) {
    const cost = en[k].length + 1;
    if (current.length > 0 && size + cost > max) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(k);
    size += cost;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** One string per line: a line break inside a string would shift every line after it. */
export const toPasteLine = (s: string): string => s.replace(/\s*\n\s*/g, ' ').trim();

/** Google sometimes re-spaces braces or curly-quotes; put both back so {name} still matches. */
export function normalizeLine(s: string): string {
  return s
    .replace(/\{\s*(\w+)\s*\}/g, '{$1}')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

/**
 * Google Translate sometimes translates the word inside a placeholder
 * ({name} -> {kyrteng}). `aliases` maps each translated word back to the
 * original name. Only names in the map are touched, and the result is kept
 * only if it ends up with exactly the source's placeholders; otherwise the
 * line is returned unchanged and the mechanical check flags it.
 */
export function repairPlaceholders(source: string, output: string, aliases: Record<string, string>): string {
  const wanted = placeholders(source);
  if (placeholders(output) === wanted) return output;
  const fixed = output.replace(/\{([^{}]+)\}/g, (whole, inner: string) => {
    const name = inner.trim();
    return name in aliases ? `{${aliases[name]}}` : whole;
  });
  return placeholders(fixed) === wanted ? fixed : output;
}

export const placeholders = (s: string): string => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

const words = (s: string): string[] => (s.toLowerCase().match(/[a-zà-ÿ']+/g) ?? []).filter((w) => w.length > 1);

/** Share of the output's words that are English words from the source: high means it was passed through. */
export function englishOverlap(output: string, source: string): number {
  const out = words(output.replace(/\{\w+\}/g, ''));
  if (out.length === 0) return 0;
  const src = new Set(words(source));
  return out.filter((w) => src.has(w)).length / out.length;
}

/** How much of the original English survives a round trip back to English (word Jaccard, 0-1). */
export function roundTripSimilarity(original: string, back: string): number {
  const a = new Set(words(original));
  const b = new Set(words(back));
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export const DRIFT_THRESHOLD = 0.25;

export type Verdict =
  | 'ok' | 'empty' | 'unchanged' | 'placeholders' | 'wrong-script' | 'mostly-english' | 'repeats' | 'blocked-word';

/**
 * Words that look like a harmless English loanword but mean something else in
 * the target language. Found from a round trip, never guessed.
 *  - Mizo `tap` means "to cry": Google leaves the English verb "tap" in the
 *    Mizo text, and it came back as "Cry as soon as you see the picture" and
 *    "Don't cry for any other picture". A reviewer must replace it with the
 *    Mizo verb for touching the screen.
 */
export const BLOCKED_WORDS: Record<string, RegExp[]> = {
  lus: [/\btap\b/i, /\btaps\b/i],
};

const NON_LATIN = /[ऀ-ॿঀ-৿ༀ-࿿]/;

/** Mechanical checks only. `ok` means "not visibly broken", never "correct". */
export function check(source: string, output: string, blocked: RegExp[] = []): Verdict {
  const text = output.trim();
  if (!text) return 'empty';
  if (text === source) return 'unchanged';
  if (placeholders(text) !== placeholders(source)) return 'placeholders';
  if (blocked.some((re) => re.test(text))) return 'blocked-word';
  if (NON_LATIN.test(text)) return 'wrong-script';
  const tokens = words(text);
  if (tokens.length >= 6 && new Set(tokens).size / tokens.length < 0.4) return 'repeats';
  if (englishOverlap(text, source) >= 0.4) return 'mostly-english';
  return 'ok';
}

/** Lines pasted back must line up one-to-one with what was pasted out. */
export function splitOutput(text: string): string[] {
  return text.replace(/\r/g, '').split('\n').map(normalizeLine).filter((l) => l.length > 0);
}

export interface SheetRow {
  key: string;
  english: string;
  draft: string;
  verdict: Verdict;
  /** Round-trip similarity when a back-translation was supplied, else null. */
  similarity: number | null;
  /** The English the draft translated back to, when supplied. */
  back?: string | null;
}

const cell = (s: string) => s.replace(/\|/g, '\\|');

export function buildSheet(name: string, code: string, rows: SheetRow[], left: string[]): string {
  const kept = rows.filter((r) => r.verdict === 'ok');
  const drifted = kept.filter((r) => r.similarity !== null && r.similarity < DRIFT_THRESHOLD);
  return [
    `# ${name} (${code}): draft translation, needs a native speaker`,
    '',
    '**Status: drafted with the Google Translate website and pasted in by hand. No native speaker has checked any line.** Nothing here reaches patients until a reviewer approves it and `apply` is run.',
    '',
    `Drafted ${rows.length}, passed the mechanical checks ${kept.length}, flagged ${rows.length - kept.length}` +
      (kept.some((r) => r.similarity !== null) ? `, meaning may have drifted on ${drifted.length} (round trip below ${DRIFT_THRESHOLD}).` : '.'),
    '',
    'Reviewer: for each row, write `approve`, or replace the draft with the right text, in the last column. "Back to English" is what Google Translate says the draft means: read it against the English column. The round-trip score is a rough word-overlap screen and misses meaning errors, so read every row, not only the marked ones.',
    '',
    '| Key | English | Draft | Back to English | Check | Round trip | Reviewer |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| \`${r.key}\` | ${cell(r.english)} | ${cell(r.draft)} | ${cell(r.back ?? '')} | ${r.verdict}${
          r.verdict === 'ok' && r.similarity !== null && r.similarity < DRIFT_THRESHOLD ? ' (drifted)' : ''
        } | ${r.similarity === null ? '' : r.similarity.toFixed(2)} |  |`,
    ),
    '',
    `Never drafted, stays English until a reviewer supplies it (medicine, appointment, PIN, distress, sign-in, disclaimer): ${left.length} strings.`,
    '',
  ].join('\n');
}

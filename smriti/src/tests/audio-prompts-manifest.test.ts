import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  PROMPTS,
  TTS_LANGUAGES,
  NO_TTS_LANGUAGES,
  resolvePromptText,
  promptHash,
  normalizePromptText,
  buildExpectedEntries,
} from '@/lib/audio/prompts';
import { LANGUAGES } from '@/lib/i18n/languages';

const SRC = path.resolve(__dirname, '..');
const PUBLIC_AUDIO = path.resolve(SRC, '..', 'public/audio');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const localeKeys = () => new Set(PROMPTS.flatMap((p) => (p.source.type === 'locale' ? [p.source.key] : [])));

describe('prompt manifest definition', () => {
  it('has unique, file-safe ids', () => {
    const ids = PROMPTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9._-]*$/);
  });

  it('every language is either synthesizable or explicitly listed as having no Bhashini TTS', () => {
    const all = [...TTS_LANGUAGES, ...NO_TTS_LANGUAGES].sort();
    expect(all).toEqual([...LANGUAGES].sort());
    expect(NO_TTS_LANGUAGES).toContain('ne');
  });

  it('every prompt resolves to English text (English is the source of truth)', () => {
    for (const p of PROMPTS) {
      expect(resolvePromptText(p, 'en'), `${p.id} has no English text`).toBeTruthy();
    }
  });

  it('every t() key passed straight to narrate()/speak() in the app has a prompt entry', () => {
    const keys = localeKeys();
    const re = /(?:narrate|speak)\(\s*t\(\s*['"]([^'"]+)['"]\s*\)/g;
    const found = new Set<string>();
    for (const file of walk(path.join(SRC, 'app')).concat(walk(path.join(SRC, 'components')))) {
      const src = readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) found.add(m[1]);
    }
    // Sanity: the scan really finds the known game instructions.
    expect(found.has('game.quickTap.instruction')).toBe(true);
    for (const key of found) {
      // Short keys ('observing') live in per-game next-intl catalogs, covered by `game` sources.
      if (!key.includes('.')) continue;
      expect(keys.has(key), `spoken key ${key} is missing from PROMPTS`).toBe(true);
    }
  });

  it('every GameTutorial step key and session-end line is in the manifest', () => {
    const src = readFileSync(path.join(SRC, 'components/games/GameTutorial.tsx'), 'utf8');
    const stepKeys = [...src.matchAll(/textKey: '([^']+)'/g)].map((m) => m[1]);
    expect(stepKeys.length).toBeGreaterThan(5);
    const keys = localeKeys();
    for (const k of stepKeys) expect(keys.has(k), k).toBe(true);
    const done = readFileSync(path.join(SRC, 'components/games/SessionComplete.tsx'), 'utf8');
    for (const m of done.matchAll(/'(game\.sessionEnd\.star\d)'/g)) expect(keys.has(m[1]), m[1]).toBe(true);
  });

  it('per-game next-intl narrated lines are in the manifest', () => {
    const games = PROMPTS.filter((p) => p.source.type === 'game').map((p) => p.source.type === 'game' && p.source.catalog);
    for (const c of [
      'MEMORY_SPAN_MESSAGES',
      'DOUBLE_DECISION_MESSAGES',
      'COUNTING_BOXES_MESSAGES',
      'MEMORY_BLOCKS_MESSAGES',
      'REMINISCENCE_QUIZ_MESSAGES',
      'FISH_TRACE_MESSAGES',
    ]) {
      expect(games, c).toContain(c);
    }
  });

  it('does not include open-ended or templated content', () => {
    for (const p of PROMPTS) {
      expect(resolvePromptText(p, 'en') ?? '', `${p.id} contains a {variable}`).not.toMatch(/\{\w+\}/);
    }
    expect(PROMPTS.map((p) => p.id).join(' ')).not.toMatch(/companion|familyNote|patientName/i);
  });
});

describe('per-language resolution never substitutes another language', () => {
  it('a non-English language never gets English text as its prompt', () => {
    for (const lang of TTS_LANGUAGES) {
      if (lang === 'en') continue;
      for (const p of PROMPTS) {
        const text = resolvePromptText(p, lang);
        if (text === undefined) continue;
        expect(text, `${lang}/${p.id} is English text`).not.toBe(resolvePromptText(p, 'en'));
      }
    }
  });

  it('returns undefined rather than falling back when a language lacks the string', () => {
    const def = { id: 'x', group: 't', source: { type: 'locale' as const, key: 'no.such.key.anywhere' } };
    expect(resolvePromptText(def, 'hi')).toBeUndefined();
    expect(resolvePromptText(def, 'brx')).toBeUndefined();
  });

  it('nothing is planned for languages without TTS', () => {
    const plan = buildExpectedEntries();
    for (const lang of NO_TTS_LANGUAGES) {
      expect(plan.entries.filter((e) => e.lang === lang)).toHaveLength(0);
    }
  });

  it('every (language, prompt) is either planned or reported missing, none silently dropped', () => {
    const plan = buildExpectedEntries();
    for (const lang of TTS_LANGUAGES) {
      for (const p of PROMPTS) {
        const planned = plan.entries.some((e) => e.lang === lang && e.id === p.id);
        const missing = plan.missing.some((m) => m.lang === lang && m.id === p.id);
        expect(planned !== missing, `${lang}/${p.id}`).toBe(true);
      }
    }
  });

  it('English is fully covered', () => {
    expect(buildExpectedEntries().missing.filter((m) => m.lang === 'en')).toEqual([]);
  });
});

describe('text hashing', () => {
  it('is stable and whitespace/unicode-normalization insensitive', () => {
    expect(promptHash('Good!')).toBe(promptHash('  Good!  '));
    expect(promptHash('a  b')).toBe(promptHash('a b'));
    expect(promptHash('é')).toBe(promptHash('é'));
    expect(promptHash('Good!')).not.toBe(promptHash('Good'));
    expect(promptHash('Good!')).toMatch(/^[0-9a-f]{10,}$/);
    expect(normalizePromptText(' a \n b ')).toBe('a b');
  });
});

describe('committed public/audio/manifest.json', () => {
  const manifest = JSON.parse(readFileSync(path.join(PUBLIC_AUDIO, 'manifest.json'), 'utf8')) as {
    version: number;
    languages: Record<string, Record<string, { h: string; ext: string }>>;
  };

  it('is valid and only lists TTS languages', () => {
    expect(manifest.version).toBe(1);
    for (const lang of Object.keys(manifest.languages)) {
      expect(TTS_LANGUAGES as readonly string[]).toContain(lang);
    }
  });

  it('every listed clip exists, is non-empty, and its hash matches the current text', () => {
    for (const [lang, entries] of Object.entries(manifest.languages)) {
      for (const [id, entry] of Object.entries(entries)) {
        const def = PROMPTS.find((p) => p.id === id);
        expect(def, `${lang}/${id} is not a known prompt`).toBeTruthy();
        const file = path.join(PUBLIC_AUDIO, lang, `${id}.${entry.ext}`);
        expect(statSync(file).size, file).toBeGreaterThan(200);
        const text = resolvePromptText(def!, lang as (typeof TTS_LANGUAGES)[number]);
        expect(text, `${lang}/${id}: source text gone`).toBeTruthy();
        expect(entry.h, `${lang}/${id}: text changed since synthesis, rerun npm run audio:synthesize`).toBe(
          promptHash(text!),
        );
      }
    }
  });
});

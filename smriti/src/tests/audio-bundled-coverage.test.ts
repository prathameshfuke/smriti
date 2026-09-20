import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { TTS_LANGUAGES, buildExpectedEntries } from '@/lib/audio/prompts';
import type { UILanguage } from '@/lib/i18n/languages';

const AUDIO_DIR = path.resolve(__dirname, '..', '..', 'public/audio');
const manifest = JSON.parse(readFileSync(path.join(AUDIO_DIR, 'manifest.json'), 'utf8')) as {
  languages: Record<string, Record<string, { h: string; ext: string }>>;
};

/** The priority languages for the target patients. Every prompt must ship as
 * bundled audio, so an offline first launch is never silent for them. */
const REQUIRED: readonly UILanguage[] = ['hi', 'as'];

/** TTS-capable languages whose clips have not been generated yet. Each one
 * still speaks through the cache -> live Bhashini -> browser tiers. Remove a
 * language from this list the moment it is synthesized (the last test fails
 * if it is left here once it has audio). Never add hi or as. */
const NOT_YET_SYNTHESIZED: readonly UILanguage[] = ['en', 'bn', 'brx', 'mni'];

const clipOk = (lang: string, id: string, ext: string) => {
  const file = path.join(AUDIO_DIR, lang, `${id}.${ext}`);
  return existsSync(file) && statSync(file).size > 200;
};

describe('bundled offline audio coverage', () => {
  it('every TTS language is either fully required or explicitly listed as pending', () => {
    for (const lang of TTS_LANGUAGES) {
      expect(
        REQUIRED.includes(lang) || NOT_YET_SYNTHESIZED.includes(lang),
        `${lang} is in TTS_LANGUAGES but neither required nor pending`,
      ).toBe(true);
    }
    for (const lang of REQUIRED) expect(NOT_YET_SYNTHESIZED).not.toContain(lang);
  });

  for (const lang of REQUIRED) {
    it(`${lang}: every prompt has a bundled clip that matches its current text`, () => {
      const { entries } = buildExpectedEntries([lang]);
      expect(entries.length).toBeGreaterThan(0);
      const bucket = manifest.languages[lang] ?? {};
      const problems: string[] = [];
      for (const e of entries) {
        const m = bucket[e.id];
        if (!m) problems.push(`${e.id}: not in manifest`);
        else if (m.h !== e.hash) problems.push(`${e.id}: stale (text changed since synthesis)`);
        else if (!clipOk(lang, e.id, m.ext)) problems.push(`${e.id}: file missing or empty`);
      }
      expect(problems, `${lang} bundled audio incomplete`).toEqual([]);
    });

    it(`${lang}: manifest has no clip for an id that is not a current prompt`, () => {
      const ids = new Set(buildExpectedEntries([lang]).entries.map((e) => e.id));
      expect(Object.keys(manifest.languages[lang] ?? {}).filter((id) => !ids.has(id))).toEqual([]);
    });
  }

  it('a pending language really has no audio yet (remove it from the pending list once generated)', () => {
    for (const lang of NOT_YET_SYNTHESIZED) {
      expect(Object.keys(manifest.languages[lang] ?? {}), `${lang} now has audio; drop it from NOT_YET_SYNTHESIZED`).toEqual(
        [],
      );
    }
  });
});

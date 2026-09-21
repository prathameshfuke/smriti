import { describe, it, expect } from 'vitest';
import en from '@/lib/i18n/locales/en.json';
import as from '@/lib/i18n/locales/as.json';
import hi from '@/lib/i18n/locales/hi.json';
import bn from '@/lib/i18n/locales/bn.json';
import ne from '@/lib/i18n/locales/ne.json';
import brx from '@/lib/i18n/locales/brx.json';
import mni from '@/lib/i18n/locales/mni.json';
import kha from '@/lib/i18n/locales/kha.json';
import lus from '@/lib/i18n/locales/lus.json';
import { OBJECTS } from '@/lib/engine/objects';
import { LANGUAGES, type UILanguage } from '@/lib/i18n/languages';
import { N_BACK_MESSAGES } from '@/components/games/n-back/messages';
import { MEMORY_SPAN_MESSAGES } from '@/components/games/memory-span/messages';
import { LARGER_NUMBER_MESSAGES } from '@/components/games/larger-number/messages';
import { DOUBLE_DECISION_MESSAGES } from '@/components/games/double-decision/messages';
import { FROG_LEAP_MESSAGES } from '@/components/games/frog-leap/messages';
import { FISH_TRACE_MESSAGES } from '@/components/games/fish-trace/messages';
import { COUNTING_BOXES_MESSAGES } from '@/components/games/counting-boxes/messages';
import { MEMORY_BLOCKS_MESSAGES } from '@/components/games/memory-blocks/messages';
import { REMINISCENCE_QUIZ_MESSAGES } from '@/components/games/reminiscence-quiz/messages';

/**
 * Every UI language must carry every English key (nested keys included), keep
 * the same {placeholders}, and hold real text rather than a silent copy of
 * English. t() falls back to English, so a gap never crashes — it just shows a
 * Bodo- or Manipuri-reading patient English they cannot read.
 */

type Tree = Record<string, unknown>;

function flatten(node: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === 'string') {
    out[prefix] = node;
  } else if (Array.isArray(node)) {
    node.forEach((item, i) => flatten(item, `${prefix}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Tree)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
/** A value with no real English word in it ('%', '{seconds}s', '#') may legitimately match English. */
const hasEnglishWord = (s: string) => /[A-Za-z]{3,}/.test(s.replace(/\{\w+\}/g, ''));

/** Khasi and Mizo: machine-translated drafts, checked separately below (they may cover only part of the catalog). */
const DRAFT_LOCALES = { kha, lus } as const;
const LOCALES: Record<Exclude<UILanguage, 'en' | keyof typeof DRAFT_LOCALES>, Tree> = { as, hi, bn, ne, brx, mni };
const TARGETS = Object.keys(LOCALES) as (keyof typeof LOCALES)[];

/** Language names are written in their own script by design, in every catalog. */
const isLanguageName = (key: string) => key.startsWith('lang.');

const BENGALI = /[ঀ-৿]/;
// The danda (U+0964/0965) is shared by every Indic script, so it does not count as Devanagari.
const DEVANAGARI = /[ऀ-ऻऽ-ॣ०-ॿ]/;

/** Loanwords and proper nouns that legitimately read the same in a neighbouring language. */
const SHARED_LOANWORDS = new Set([
  'home.thankYou',
  'game.tile',
  'game.card',
  'game.nBack.name',
  'companion.smriti',
  'pin.keypad',
  'sync.offline',
  'caregiver.dashboard',
  'reminderType.medication',
  'reminders.title',
  // Placeholders only ("{name}: {severity}"): no words to translate.
  'alertPush.title',
]);

describe.each(TARGETS)('locale %s vs en.json', (code) => {
  const enFlat = flatten(en);
  const flat = flatten(LOCALES[code]);

  it('has every English key and no stray keys', () => {
    expect(Object.keys(enFlat).filter((k) => !(k in flat))).toEqual([]);
    expect(Object.keys(flat).filter((k) => !(k in enFlat))).toEqual([]);
  });

  it('keeps the same {placeholders} as English', () => {
    const bad = Object.keys(enFlat).filter((k) => k in flat && placeholders(flat[k]) !== placeholders(enFlat[k]));
    expect(bad).toEqual([]);
  });

  it('has no value that is just the English text', () => {
    const same = Object.keys(enFlat).filter(
      (k) => !isLanguageName(k) && flat[k] === enFlat[k] && hasEnglishWord(enFlat[k]),
    );
    expect(same).toEqual([]);
  });

  it('has no empty values', () => {
    expect(Object.keys(flat).filter((k) => flat[k].trim() === '')).toEqual([]);
  });
});

describe.each(['brx', 'mni'] as const)('%s script and provenance', (code) => {
  const flat = flatten(LOCALES[code]);
  const script = code === 'brx' ? DEVANAGARI : BENGALI;
  const wrongScript = code === 'brx' ? BENGALI : DEVANAGARI;
  const keys = Object.keys(flat).filter((k) => !isLanguageName(k));

  it('is written in its own script (Bodo: Devanagari, Manipuri: Bengali script)', () => {
    expect(keys.filter((k) => !SHARED_LOANWORDS.has(k) && !script.test(flat[k]))).toEqual([]);
    expect(keys.filter((k) => wrongScript.test(flat[k]))).toEqual([]);
  });

  it('is not a copy of the Hindi, Assamese, Bengali or Nepali text', () => {
    const copies: string[] = [];
    for (const other of ['hi', 'as', 'bn', 'ne'] as const) {
      const o = flatten(LOCALES[other]);
      for (const k of keys) if (o[k] === flat[k] && !SHARED_LOANWORDS.has(k)) copies.push(`${k} == ${other}`);
    }
    expect(copies).toEqual([]);
  });
});

describe.each(Object.keys(DRAFT_LOCALES) as (keyof typeof DRAFT_LOCALES)[])('draft locale %s vs en.json', (code) => {
  const enFlat = flatten(en);
  const flat = flatten(DRAFT_LOCALES[code]);

  it('has no stray keys (partial coverage is allowed; missing keys fall back to English)', () => {
    expect(Object.keys(flat).filter((k) => !(k in enFlat))).toEqual([]);
  });

  it('keeps the same {placeholders} as English', () => {
    expect(Object.keys(flat).filter((k) => placeholders(flat[k]) !== placeholders(enFlat[k]))).toEqual([]);
  });

  it('has no empty values', () => {
    expect(Object.keys(flat).filter((k) => flat[k].trim() === '')).toEqual([]);
  });

  it('is written in Latin script, not Bengali or Devanagari', () => {
    expect(Object.keys(flat).filter((k) => BENGALI.test(flat[k]) || DEVANAGARI.test(flat[k]))).toEqual([]);
  });

  it('is not a copy of another Northeast language\'s text', () => {
    const copies: string[] = [];
    for (const other of ['as', 'hi', 'bn', 'ne', 'brx', 'mni'] as const) {
      const o = flatten(LOCALES[other]);
      for (const k of Object.keys(flat)) if (o[k] === flat[k] && !SHARED_LOANWORDS.has(k) && !isLanguageName(k)) copies.push(`${k} == ${other}`);
    }
    expect(copies).toEqual([]);
  });
});

/** Per-game catalogs (next-intl). Each game ships its own; all must cover the same languages. */
const GAME_CATALOGS: Record<string, Record<string, Tree>> = {
  'n-back': N_BACK_MESSAGES,
  'memory-span': MEMORY_SPAN_MESSAGES,
  'larger-number': LARGER_NUMBER_MESSAGES,
  'double-decision': DOUBLE_DECISION_MESSAGES,
  'frog-leap': FROG_LEAP_MESSAGES,
  'fish-trace': FISH_TRACE_MESSAGES,
  'counting-boxes': COUNTING_BOXES_MESSAGES,
  'memory-blocks': MEMORY_BLOCKS_MESSAGES,
  'reminiscence-quiz': REMINISCENCE_QUIZ_MESSAGES,
};

describe.each(Object.entries(GAME_CATALOGS))('game catalog %s', (_name, catalog) => {
  const enFlat = flatten(catalog.en);
  it.each(TARGETS)('%s has every English key with the same placeholders', (code) => {
    const flat = flatten(catalog[code]);
    expect(Object.keys(enFlat).filter((k) => !(k in flat))).toEqual([]);
    expect(Object.keys(flat).filter((k) => !(k in enFlat))).toEqual([]);
    expect(Object.keys(enFlat).filter((k) => placeholders(flat[k] ?? '') !== placeholders(enFlat[k]))).toEqual([]);
  });
  it.each(TARGETS)('%s has no value that is just the English text', (code) => {
    const flat = flatten(catalog[code]);
    expect(Object.keys(enFlat).filter((k) => flat[k] === enFlat[k] && hasEnglishWord(enFlat[k]))).toEqual([]);
  });
});

describe('object names', () => {
  // Khasi and Mizo object names fall back to English until a reviewer supplies them.
  it.each(LANGUAGES.filter((code) => !(code in DRAFT_LOCALES)))('every object has a %s name', (code) => {
    expect(OBJECTS.filter((o) => !o.name[code]).map((o) => o.id)).toEqual([]);
  });
  it.each(['brx', 'mni', 'bn', 'ne'] as const)('%s object names are in the right script and not English', (code) => {
    const script = code === 'mni' || code === 'bn' ? BENGALI : DEVANAGARI;
    expect(OBJECTS.filter((o) => !script.test(o.name[code] ?? '')).map((o) => o.id)).toEqual([]);
  });
});

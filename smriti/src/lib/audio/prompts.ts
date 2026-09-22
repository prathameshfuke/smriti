/**
 * Manifest of the FIXED phrases the app speaks aloud, and how to find each
 * one's text in every language. This is the single source of truth for
 * `scripts/synthesize-prompts.ts` and for the manifest tests; it is NOT
 * imported by app runtime code (the runtime only needs `bundled.ts`), so the
 * catalogs pulled in here never reach a page bundle.
 *
 * What is in and out
 * ------------------
 * IN: any line whose full text is fixed at build time and is spoken through
 * `narrate()`/`speak()`: game instructions, tutorial steps, session-end
 * encouragement, in-game feedback, reminder-type fallback lines, and the
 * names of the fixed game objects.
 *
 * OUT, by design (each one stays on live/cached Bhashini TTS, then the device
 * voice, then on-screen text):
 *  - Open-ended content: companion answers, family notes, patient names,
 *    caregiver-written reminder labels and facility names.
 *  - Templated frames whose variable is unbounded or per-user: appointment
 *    "tomorrow/today at {time} at {facility}" (1440 times x free-text
 *    facility), N-Back "{level}" challenge line, Larger Number challenge line,
 *    Frog Leap "{jumpCount} watch", Object Hunt "Where was the {object}?".
 *    Bundling only the static half would not be spoken as one line anyway,
 *    because callers speak the joined sentence.
 *  - Memory Span word bank (`speak(word)`): a large per-language word list,
 *    left for a follow-up.
 *
 * Strict per-language resolution
 * ------------------------------
 * `resolvePromptText` never falls back to English or to another language. A
 * language whose catalog lacks a string, or carries an untranslated copy of
 * the English text, resolves to `undefined` and is reported as missing.
 * Bundling English audio under a Bodo or Manipuri id would be the exact
 * cross-language substitution this app must not do.
 */
import { NO_SPEECH_SERVICE_LANGUAGES, type UILanguage } from '@/lib/i18n/languages';
import { OBJECTS } from '@/lib/engine/objects';
import as from '@/lib/i18n/locales/as.json';
import en from '@/lib/i18n/locales/en.json';
import hi from '@/lib/i18n/locales/hi.json';
import brx from '@/lib/i18n/locales/brx.json';
import mni from '@/lib/i18n/locales/mni.json';
import kha from '@/lib/i18n/locales/kha.json';
import lus from '@/lib/i18n/locales/lus.json';
import bn from '@/lib/i18n/locales/bn.json';
import ne from '@/lib/i18n/locales/ne.json';
import { MEMORY_SPAN_MESSAGES } from '@/components/games/memory-span/messages';
import { DOUBLE_DECISION_MESSAGES } from '@/components/games/double-decision/messages';
import { COUNTING_BOXES_MESSAGES } from '@/components/games/counting-boxes/messages';
import { MEMORY_BLOCKS_MESSAGES } from '@/components/games/memory-blocks/messages';
import { REMINISCENCE_QUIZ_MESSAGES } from '@/components/games/reminiscence-quiz/messages';
import { FISH_TRACE_MESSAGES } from '@/components/games/fish-trace/messages';
import { normalizePromptText, promptHash } from './promptHash';

export { normalizePromptText, promptHash };

/** Languages Bhashini can synthesize (see lib/i18n/languages.ts: as, hi, en,
 * bn have full TTS; Bodo and Manipuri have TTS but no ASR). */
export const TTS_LANGUAGES: readonly UILanguage[] = ['as', 'hi', 'en', 'bn', 'brx', 'mni'];
/** Nepali has translation only on Bhashini: no audio at all. It keeps the
 * device voice / on-screen text path until a human records it. */
export const NO_TTS_LANGUAGES: readonly UILanguage[] = NO_SPEECH_SERVICE_LANGUAGES;

export type PromptSource =
  | { type: 'locale'; key: string }
  | { type: 'game'; catalog: string; path: string; keys: string[]; joiner: string }
  | { type: 'object'; objectId: string };

export interface PromptDef {
  id: string;
  /** Where it is spoken; documentation and report grouping only. */
  group: string;
  source: PromptSource;
}

const locale = (group: string, key: string): PromptDef => ({
  id: key.toLowerCase(),
  group,
  source: { type: 'locale', key },
});

const gameLine = (id: string, catalog: string, path: string, keys: string[], joiner = ' '): PromptDef => ({
  id,
  group: 'game-ui',
  source: { type: 'game', catalog, path, keys, joiner },
});

const LOCALE_KEYS: [string, string[]][] = [
  ['game-instruction', [
    'game.objectHunt.instruction',
    'game.wordStream.rememberLater',
    'game.wordStream.whichItems',
    'game.quickTap.instruction',
    'game.pathMatch.instruction',
    'game.memoryMatch.instruction',
  ]],
  ['game-feedback', [
    'game.correct',
    'game.tryAgain',
    'game.pathMatch.good',
    'game.memoryMatch.goodMatch',
    'game.memoryMatch.tryAnotherOne',
  ]],
  ['session-end', [
    'game.sessionEnd.star1',
    'game.sessionEnd.star2',
    'game.sessionEnd.star3',
    'game.sessionEnd.star4',
    'game.sessionEnd.star5',
  ]],
  ['game-tutorial', [
    'game.tutorial.quickTap.step1',
    'game.tutorial.quickTap.step2',
    'game.tutorial.quickTap.step3',
    'game.tutorial.quickTap.step4',
    'game.tutorial.pathMatch.step1',
    'game.tutorial.pathMatch.step2',
    'game.tutorial.pathMatch.step3',
    'game.tutorial.pathMatch.step4',
    'game.tutorial.countingBoxes.step1',
    'game.tutorial.countingBoxes.step2',
    'game.tutorial.countingBoxes.step3',
  ]],
  ['reminder', [
    'reminder.medication',
    'reminder.hydration',
    'reminder.activity',
    'reminder.appointment',
  ]],
  ['mood', [
    'mood.title',
    'mood.thanksPositive',
    'mood.thanksLow',
  ]],
];

export const PROMPTS: readonly PromptDef[] = [
  ...LOCALE_KEYS.flatMap(([group, keys]) => keys.map((k) => locale(group, k))),
  gameLine('game.memoryspan.intro', 'MEMORY_SPAN_MESSAGES', 'games.freeShortTermMemoryTest', ['memorizeTheseWords', 'studyAtYourPace'], ' '),
  gameLine('game.doubledecision.intro', 'DOUBLE_DECISION_MESSAGES', 'games.doubleDecision.gameUI', ['title', 'intro'], '. '),
  gameLine('game.countingboxes.observing', 'COUNTING_BOXES_MESSAGES', 'games.countingBoxes.gameUI', ['observing']),
  gameLine('game.memoryblocks.watch', 'MEMORY_BLOCKS_MESSAGES', 'games.blockMemoryChallenge.gameUI', ['watchSequence']),
  gameLine('game.reminiscencequiz.correct', 'REMINISCENCE_QUIZ_MESSAGES', 'games.reminiscenceQuiz.gameUI', ['correct']),
  gameLine('game.reminiscencequiz.trytogether', 'REMINISCENCE_QUIZ_MESSAGES', 'games.reminiscenceQuiz.gameUI', ['tryTogether']),
  gameLine('game.fishtrace.start', 'FISH_TRACE_MESSAGES', 'games.fishTrace', ['start']),
  ...OBJECTS.map<PromptDef>((o) => ({
    id: `object.${o.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    group: 'object-name',
    source: { type: 'object', objectId: o.id },
  })),
];

const LOCALE_CATALOGS: Record<UILanguage, Record<string, unknown>> = { as, hi, en, brx, mni, bn, ne, kha, lus };

const GAME_CATALOGS: Record<string, Partial<Record<UILanguage, unknown>>> = {
  MEMORY_SPAN_MESSAGES,
  DOUBLE_DECISION_MESSAGES,
  COUNTING_BOXES_MESSAGES,
  MEMORY_BLOCKS_MESSAGES,
  REMINISCENCE_QUIZ_MESSAGES,
  FISH_TRACE_MESSAGES,
};

function dig(root: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>(
    (node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    root,
  );
}

function rawText(def: PromptDef, lang: UILanguage): string | undefined {
  const src = def.source;
  if (src.type === 'locale') {
    const v = dig(LOCALE_CATALOGS[lang], src.key);
    return typeof v === 'string' && v.trim() ? v : undefined;
  }
  if (src.type === 'game') {
    const root = GAME_CATALOGS[src.catalog]?.[lang];
    const base = root === undefined ? undefined : dig(root, src.path);
    const parts = src.keys.map((k) => dig(base, k));
    if (parts.some((p) => typeof p !== 'string' || !p.trim())) return undefined;
    return (parts as string[]).join(src.joiner);
  }
  const object = OBJECTS.find((o) => o.id === src.objectId);
  const name = object?.name[lang];
  return typeof name === 'string' && name.trim() ? name : undefined;
}

/**
 * The exact text the app speaks for `def` in `lang`, or `undefined` when that
 * language has no genuine string for it (missing, blank, or an untranslated
 * copy of the English text). Never falls back to another language.
 */
export function resolvePromptText(def: PromptDef, lang: UILanguage): string | undefined {
  const text = rawText(def, lang);
  if (text === undefined || lang === 'en') return text;
  const english = rawText(def, 'en');
  if (english !== undefined && normalizePromptText(english) === normalizePromptText(text)) return undefined;
  return text;
}

export interface ExpectedEntry {
  lang: UILanguage;
  id: string;
  group: string;
  text: string;
  hash: string;
}

export interface ExpectedPlan {
  entries: ExpectedEntry[];
  /** Synthesizable (language, prompt) pairs whose text is absent. Each needs
   * a translation (workstream 3) before audio can exist. */
  missing: { lang: UILanguage; id: string; group: string }[];
}

/** Every clip that should exist right now, given the current catalogs. */
export function buildExpectedEntries(languages: readonly UILanguage[] = TTS_LANGUAGES): ExpectedPlan {
  const entries: ExpectedEntry[] = [];
  const missing: ExpectedPlan['missing'] = [];
  for (const lang of languages) {
    for (const def of PROMPTS) {
      const text = resolvePromptText(def, lang);
      if (text === undefined) {
        missing.push({ lang, id: def.id, group: def.group });
      } else {
        entries.push({ lang, id: def.id, group: def.group, text, hash: promptHash(text) });
      }
    }
  }
  return { entries, missing };
}

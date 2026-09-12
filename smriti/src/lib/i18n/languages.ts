/**
 * Language primitives, kept separate from the provider so that stores can
 * depend on them without importing React or creating an import cycle.
 */

/**
 * `brx`/`mni`/`bn`/`ne` added after a live Bhashini capability probe (see
 * .claude/plans/multilingual-expansion.plan.md Part 2) — Bodo and Manipuri
 * have TTS + text translation but no speech recognition; Bengali has full
 * ASR/TTS/translation; Nepali has translation only, no audio at all. Six
 * other candidate languages (Khasi, Garo, Mizo, Kokborok, Bhutia, Lepcha)
 * were live-verified to have zero working Bhashini tier and are
 * deliberately not added here — nothing in this app would work for them.
 */
export const LANGUAGES = ['as', 'hi', 'en', 'brx', 'mni', 'bn', 'ne'] as const;
export type UILanguage = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: UILanguage = 'en';

export function isUILanguage(value: unknown): value is UILanguage {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

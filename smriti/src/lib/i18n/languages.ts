/**
 * Language primitives, kept separate from the provider so that stores can
 * depend on them without importing React or creating an import cycle.
 */

/**
 * `brx`/`mni`/`bn`/`ne` added after a live Bhashini capability probe (see
 * .claude/plans/multilingual-expansion.plan.md Part 2) — Bodo and Manipuri
 * have TTS + text translation but no speech recognition; Bengali has full
 * ASR/TTS/translation; Nepali has translation only, no audio at all.
 *
 * `kha`/`lus` (Khasi, Mizo) are text-only: Bhashini's model list (September
 * 2026) shows a translation service for both and no speech service, and no
 * macOS/iOS device voice exists for either. Their catalogs are machine
 * translations from that service (scripts/translate-locale.mjs), unreviewed,
 * and stay out of the caregiver picker until the catalog has content.
 *
 * Garo, Kokborok, Bhutia and Lepcha are deliberately not added: Bhashini
 * lists no service for any of them (Garo is still being built under the
 * April 2025 Meghalaya MoU), and nothing here can produce a trustworthy
 * translation without one. Kokborok also needs a script decision (Latin or
 * Bengali); Bhutia and Lepcha need fonts.
  */
export const LANGUAGES = ['as', 'hi', 'en', 'brx', 'mni', 'bn', 'ne', 'kha', 'lus'] as const;
export type UILanguage = (typeof LANGUAGES)[number];

/**
 * Languages no Bhashini speech service can voice. Their text is shown, and a
 * spoken line falls to an installed device voice or silence — never another
 * language's audio. Nepali has translation only; Khasi and Mizo have text
 * translation only (Bhashini's model list, checked September 2026).
 */
export const NO_SPEECH_SERVICE_LANGUAGES: readonly UILanguage[] = ['ne', 'kha', 'lus'];

/** Languages whose text has been machine-translated only and not yet reviewed by a native speaker. */
export const DRAFT_TRANSLATION_LANGUAGES: readonly UILanguage[] = ['kha', 'lus'];

export const DEFAULT_LANGUAGE: UILanguage = 'en';

export function isUILanguage(value: unknown): value is UILanguage {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** English names for caregiver-facing labels ("Age 72, Assamese"). Patient
 * screens show a language in its own script instead (see LanguagePicker). */
const LANGUAGE_ENGLISH_NAME: Record<UILanguage, string> = {
  as: 'Assamese',
  hi: 'Hindi',
  en: 'English',
  brx: 'Bodo',
  mni: 'Manipuri',
  bn: 'Bengali',
  ne: 'Nepali',
  kha: 'Khasi',
  lus: 'Mizo',
};

export function languageName(code: string): string {
  return isUILanguage(code) ? LANGUAGE_ENGLISH_NAME[code] : code;
}

/**
 * Language names written in their own script, never translated: a patient
 * looking for Assamese scans for "অসমীয়া", not for the word "Assamese".
 * Manipuri is written in Bengali script here (no Meitei Mayek font loaded).
 */
export const NATIVE_LANGUAGE_NAME: Record<UILanguage, string> = {
  as: 'অসমীয়া',
  hi: 'हिन्दी',
  en: 'English',
  brx: 'बड़ो',
  mni: 'মৈতৈলোন্',
  bn: 'বাংলা',
  ne: 'नेपाली',
  kha: 'Khasi',
  lus: 'Mizo ṭawng',
};


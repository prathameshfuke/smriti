import type { UILanguage } from './languages';

/** Script ranges for the non-Latin UI languages. Used to detect caregiver-typed
 * text (a reminder label, a facility name) that is plainly in English (no
 * matching script present), so a Hindi/Assamese-only patient is not read or
 * shown English text. That text is freeform, never one of the catalog's own
 * English defaults verbatim, so script detection is the only heuristic that
 * actually catches the common case. */
const SCRIPT_RANGE: Partial<Record<UILanguage, RegExp>> = {
  hi: /[ऀ-ॿ]/,
  as: /[ঀ-৿]/,
  // Bodo and Nepali both use Devanagari here, same range as Hindi.
  brx: /[ऀ-ॿ]/,
  ne: /[ऀ-ॿ]/,
  // Bengali, and Manipuri (written in Bengali script in this app — see
  // languages.ts), share the same Unicode block as Assamese.
  bn: /[ঀ-৿]/,
  mni: /[ঀ-৿]/,
};

/** True when `text` can be shown as-is to someone reading `language`. */
export function textFitsLanguage(text: string, language: UILanguage): boolean {
  const script = SCRIPT_RANGE[language];
  return !script || script.test(text);
}

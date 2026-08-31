/**
 * Language primitives, kept separate from the provider so that stores can
 * depend on them without importing React or creating an import cycle.
 */

export const LANGUAGES = ['as', 'hi', 'en'] as const;
export type UILanguage = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: UILanguage = 'en';

export function isUILanguage(value: unknown): value is UILanguage {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

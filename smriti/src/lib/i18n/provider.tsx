'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { DEFAULT_LANGUAGE, type UILanguage } from './languages';
import as from './locales/as.json';
import en from './locales/en.json';
import hi from './locales/hi.json';
import brx from './locales/brx.json';
import mni from './locales/mni.json';
import bn from './locales/bn.json';
import ne from './locales/ne.json';

export { LANGUAGES, DEFAULT_LANGUAGE, isUILanguage, type UILanguage } from './languages';

type Messages = Record<string, unknown>;
/** brx/mni are best-effort machine translations from the Part 2 language
 * expansion, not yet verified by a native speaker — see
 * .claude/plans/multilingual-expansion.plan.md. bn/ne are real, confident
 * translations. `t()`'s own English fallback below means an actually-wrong
 * entry here degrades to English, never to broken/garbled text. */
const CATALOGS: Record<UILanguage, Messages> = { as, hi, en, brx, mni, bn, ne };

/** Resolves a dot-path such as `home.greeting` against a catalog. */
function lookup(catalog: Messages, key: string): string | undefined {
  const found = key.split('.').reduce<unknown>(
    (node, part) =>
      node !== null && typeof node === 'object' ? (node as Messages)[part] : undefined,
    catalog,
  );
  return typeof found === 'string' ? found : undefined;
}

interface I18nContextValue {
  language: UILanguage;
  setLanguage: (language: UILanguage) => void;
  /** Returns the string for `key`, falling back to English, then to the key.
   * `{name}`-style placeholders are filled from `vars`. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Language is owned by `settingsStore` — this provider is a read-through view
 * of it, not a second copy. An earlier version kept its own localStorage key,
 * which meant settingsStore.setLanguage() changed nothing on screen.
 *
 * It is read via useSyncExternalStore so the server snapshot stays
 * deterministic: zustand's persist middleware rehydrates from localStorage
 * synchronously on the client, which would otherwise disagree with the
 * server-rendered markup.
 */
export function I18nProvider({
  children,
  initialLanguage = DEFAULT_LANGUAGE,
}: {
  children: React.ReactNode;
  initialLanguage?: UILanguage;
}) {
  const language = useSyncExternalStore(
    useSettingsStore.subscribe,
    () => useSettingsStore.getState().language,
    () => initialLanguage,
  );

  const setLanguage = useCallback((next: UILanguage) => {
    useSettingsStore.getState().setLanguage(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(language, key, vars),
    [language],
  );

  // Screen readers pick their voice and pronunciation from <html lang>, and
  // browsers use it to choose glyphs; it stayed "en" whatever was chosen.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function translate(language: UILanguage, key: string, vars?: Record<string, string | number>): string {
  const text = lookup(CATALOGS[language], key) ?? lookup(CATALOGS.en, key) ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text;
}

/** True when `language`'s own catalog has `key` (no English fallback). */
export function hasTranslation(language: UILanguage, key: string): boolean {
  return lookup(CATALOGS[language], key) !== undefined;
}

/** English, for a component rendered outside the provider (isolated tests, stories). */
const FALLBACK_CONTEXT: I18nContextValue = {
  language: DEFAULT_LANGUAGE,
  setLanguage: () => undefined,
  t: (key, vars) => translate('en', key, vars),
};

export function useTranslation(): I18nContextValue {
  return useContext(I18nContext) ?? FALLBACK_CONTEXT;
}

/** Spec name for the same provider. */
export { I18nProvider as LanguageProvider };

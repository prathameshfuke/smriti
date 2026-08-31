'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { DEFAULT_LANGUAGE, type UILanguage } from './languages';
import as from './locales/as.json';
import en from './locales/en.json';
import hi from './locales/hi.json';

export { LANGUAGES, DEFAULT_LANGUAGE, isUILanguage, type UILanguage } from './languages';

type Messages = Record<string, unknown>;
const CATALOGS: Record<UILanguage, Messages> = { as, hi, en };

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
  /** Returns the string for `key`, falling back to English, then to the key. */
  t: (key: string) => string;
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
    (key: string) => lookup(CATALOGS[language], key) ?? lookup(CATALOGS.en, key) ?? key,
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used inside <I18nProvider>');
  return ctx;
}

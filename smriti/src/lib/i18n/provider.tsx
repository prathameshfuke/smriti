'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import as from './locales/as.json';
import en from './locales/en.json';
import hi from './locales/hi.json';

export const LANGUAGES = ['as', 'hi', 'en'] as const;
export type UILanguage = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: UILanguage = 'en';
export const LANGUAGE_STORAGE_KEY = 'smriti.language';

type Messages = Record<string, unknown>;
const CATALOGS: Record<UILanguage, Messages> = { as, hi, en };

function isUILanguage(value: unknown): value is UILanguage {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Resolves a dot-path such as `home.greeting` against a catalog. */
function lookup(catalog: Messages, key: string): string | undefined {
  const found = key.split('.').reduce<unknown>(
    (node, part) =>
      node !== null && typeof node === 'object' ? (node as Messages)[part] : undefined,
    catalog,
  );
  return typeof found === 'string' ? found : undefined;
}

/**
 * Language lives in localStorage and is read through useSyncExternalStore
 * rather than an on-mount effect. That keeps the server snapshot deterministic
 * (no hydration mismatch) while letting the client pick up the stored value on
 * its first render, and it satisfies React 19's set-state-in-effect rule.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Keep other tabs on the same device in sync.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function getStoredLanguage(): UILanguage {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isUILanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    // Private mode or blocked storage.
    return DEFAULT_LANGUAGE;
  }
}

function persistLanguage(language: UILanguage): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The choice still applies for this session even if it cannot be saved.
  }
  for (const listener of listeners) listener();
}

interface I18nContextValue {
  language: UILanguage;
  setLanguage: (language: UILanguage) => void;
  /** Returns the string for `key`, falling back to English, then to the key. */
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLanguage = DEFAULT_LANGUAGE,
}: {
  children: React.ReactNode;
  initialLanguage?: UILanguage;
}) {
  const language = useSyncExternalStore(
    subscribe,
    getStoredLanguage,
    () => initialLanguage, // server render: no localStorage
  );

  const setLanguage = useCallback((next: UILanguage) => persistLanguage(next), []);

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

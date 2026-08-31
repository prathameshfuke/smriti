import '@testing-library/jest-dom';

/**
 * Node 26 defines its own experimental `localStorage` global — a getter that
 * returns undefined unless the process was started with --localstorage-file.
 * Because the global already exists, Vitest's jsdom environment does not
 * replace it with jsdom's implementation, so `window.localStorage` is
 * undefined in tests even though jsdom provides one.
 *
 * Install jsdom's Storage explicitly when the global is missing.
 */
function installLocalStorage() {
  if (typeof window === 'undefined') return;

  const usable = (() => {
    try {
      return typeof window.localStorage?.getItem === 'function';
    } catch {
      return false;
    }
  })();
  if (usable) return;

  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(String(k), String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
  };

  for (const target of [window, globalThis]) {
    Object.defineProperty(target, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
  }
}

installLocalStorage();

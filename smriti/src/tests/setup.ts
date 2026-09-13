import { beforeEach } from 'vitest';
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

/**
 * jsdom does not implement ResizeObserver. Several copied game components
 * use it for responsive canvas sizing — a no-op stub is enough for tests
 * that only check initial render, since real layout never happens in jsdom.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
}

/**
 * `useSettingsStore` persists to the localStorage polyfill above, and that
 * polyfill's backing Map lives for the whole worker process, not one test
 * file — so whichever test last called `setLanguage('hi')` (there are
 * several, all covering real multilingual behavior) leaves the language
 * store as Hindi for every test file that runs after it in the same
 * worker. Order-independent under `vitest run`'s default file order, this
 * surfaced as real, reproducible failures under `--sequence.shuffle`:
 * `reminders.test.tsx`'s `ReminderCard` suite hardcodes English fixture
 * text and never sets language itself, so it silently depended on running
 * before any Hindi-setting test happened to execute. Resetting here, once,
 * for every test, removes that ordering dependency at the source rather
 * than patching one call site's `beforeEach`.
 *
 * Dynamic `import()` deliberately, not a static one at the top of this
 * file: a static import is resolved before any of this file's own
 * top-level statements run, so `settingsStore.ts`'s Zustand `persist`
 * middleware would read `localStorage` before `installLocalStorage()`
 * above ever executes — against Node's broken experimental global, not
 * jsdom's. Importing inside `beforeEach` guarantees the polyfill is
 * already installed first.
 */
beforeEach(async () => {
  const [{ useSettingsStore }, { DEFAULT_LANGUAGE }] = await Promise.all([
    import('@/stores/settingsStore'),
    import('@/lib/i18n/languages'),
  ]);
  useSettingsStore.setState({
    language: DEFAULT_LANGUAGE,
    isFirstLaunch: true,
    caregiverPinHash: null,
    caregiverSessionVerifiedAt: null,
    pinAttempts: 0,
    pinCooldownUntil: null,
  });
});

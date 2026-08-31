import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nProvider, useTranslation } from '@/lib/i18n/provider';
import { useSettingsStore } from '@/stores/settingsStore';

/** Language is persisted by settingsStore's zustand persist middleware. */
const SETTINGS_KEY = 'smriti.settings';
const seedLanguage = async (language: string) => {
  window.localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ state: { language, isFirstLaunch: true, caregiverPinHash: null }, version: 0 }),
  );
  await useSettingsStore.persist.rehydrate();
};

function Probe({ k }: { k: string }) {
  const { t, language, setLanguage } = useTranslation();
  return (
    <div>
      <span data-testid="value">{t(k)}</span>
      <span data-testid="lang">{language}</span>
      <button onClick={() => setLanguage('as')}>to-as</button>
    </div>
  );
}

const renderWith = (k = 'home.greeting') =>
  render(
    <I18nProvider>
      <Probe k={k} />
    </I18nProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

describe('i18n provider', () => {
  it('defaults to English and resolves home.greeting', () => {
    renderWith();
    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(screen.getByTestId('value').textContent).toBe('Hello');
  });

  it('resolves home.greeting in Assamese after switching language', async () => {
    renderWith();
    await act(async () => {
      screen.getByText('to-as').click();
    });
    expect(screen.getByTestId('value').textContent).toBe('নমস্কাৰ');
  });

  it('returns the key itself for an unknown key', () => {
    renderWith('nonexistent.key');
    expect(screen.getByTestId('value').textContent).toBe('nonexistent.key');
  });

  it('falls back to the English string when a locale lacks a translation', async () => {
    // as.json intentionally carries English for untranslated keys.
    await seedLanguage('as');
    renderWith('caregiver.dashboard');
    expect(screen.getByTestId('value').textContent).toBe('Dashboard');
  });

  it('persists the chosen language to localStorage', async () => {
    renderWith();
    await act(async () => {
      screen.getByText('to-as').click();
    });
    expect(window.localStorage.getItem(SETTINGS_KEY)).toContain('"language":"as"');
  });

  it('loads a previously saved language on mount', async () => {
    await seedLanguage('hi');
    renderWith();
    expect(screen.getByTestId('lang').textContent).toBe('hi');
    expect(screen.getByTestId('value').textContent).toBe('नमस्ते');
  });

  it('reflects a language set through settingsStore', async () => {
    // Regression guard: the provider previously kept its own localStorage key,
    // so settingsStore.setLanguage() updated state but changed nothing on screen.
    renderWith();
    await act(async () => {
      useSettingsStore.getState().setLanguage('hi');
    });
    expect(screen.getByTestId('lang').textContent).toBe('hi');
    expect(screen.getByTestId('value').textContent).toBe('नमस्ते');
  });

  it('keeps the provider and settingsStore in agreement after a UI change', async () => {
    renderWith();
    await act(async () => {
      screen.getByText('to-as').click();
    });
    expect(useSettingsStore.getState().language).toBe('as');
    expect(screen.getByTestId('lang').textContent).toBe('as');
  });
});

describe('locale files', () => {
  it('keeps identical key sets across en, as and hi', async () => {
    const flatten = (o: Record<string, unknown>, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v !== null && typeof v === 'object'
          ? flatten(v as Record<string, unknown>, `${p}${k}.`)
          : [`${p}${k}`],
      );

    const en = flatten((await import('@/lib/i18n/locales/en.json')).default);
    const as = flatten((await import('@/lib/i18n/locales/as.json')).default);
    const hi = flatten((await import('@/lib/i18n/locales/hi.json')).default);

    expect(as.sort()).toEqual(en.sort());
    expect(hi.sort()).toEqual(en.sort());
  });

  it('carries the specified Assamese and Hindi translations', async () => {
    const as = (await import('@/lib/i18n/locales/as.json')).default;
    const hi = (await import('@/lib/i18n/locales/hi.json')).default;
    expect(as.home.greeting).toBe('নমস্কাৰ');
    expect(as.sync.offline).toBe('অফলাইন');
    expect(hi.home.greeting).toBe('नमस्ते');
    expect(hi.reminder.medication).toBe('दवाई लेने का समय');
  });
});

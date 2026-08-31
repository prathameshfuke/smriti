import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nProvider, useTranslation } from '@/lib/i18n/provider';

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
});

describe('i18n provider', () => {
  it('defaults to English and resolves home.greeting', () => {
    renderWith();
    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(screen.getByTestId('value').textContent).toBe('Namaste');
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

  it('falls back to the English string when a locale lacks a translation', () => {
    // as.json intentionally carries English for untranslated keys.
    window.localStorage.setItem('smriti.language', 'as');
    renderWith('caregiver.dashboard');
    expect(screen.getByTestId('value').textContent).toBe('Dashboard');
  });

  it('persists the chosen language to localStorage', async () => {
    renderWith();
    await act(async () => {
      screen.getByText('to-as').click();
    });
    expect(window.localStorage.getItem('smriti.language')).toBe('as');
  });

  it('loads a previously saved language on mount', () => {
    window.localStorage.setItem('smriti.language', 'hi');
    renderWith();
    expect(screen.getByTestId('lang').textContent).toBe('hi');
    expect(screen.getByTestId('value').textContent).toBe('नमस्ते');
  });

  it('ignores an unsupported stored language and stays on the default', () => {
    window.localStorage.setItem('smriti.language', 'fr');
    renderWith();
    expect(screen.getByTestId('lang').textContent).toBe('en');
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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LANGUAGES, NO_SPEECH_SERVICE_LANGUAGES, NATIVE_LANGUAGE_NAME } from '@/lib/i18n/languages';

/**
 * Khasi and Mizo are text-only languages that appear in the caregiver picker
 * only once their catalog has real content, and never on a patient screen.
 */
let pathname = '/caregiver/settings';
vi.mock('next/navigation', () => ({ usePathname: () => pathname, useRouter: () => ({ push: vi.fn() }) }));

async function loadWithCatalogs(kha: unknown, lus: unknown) {
  vi.resetModules();
  vi.doMock('@/lib/i18n/locales/kha.json', () => ({ default: kha }));
  vi.doMock('@/lib/i18n/locales/lus.json', () => ({ default: lus }));
  const provider = await import('@/lib/i18n/provider');
  const picker = (await import('@/components/layout/LanguagePicker')).default;
  return { provider, Picker: picker };
}

/** Half of en.json's strings, so it clears the "offered" threshold. */
async function halfOfEnglish() {
  const en = (await import('@/lib/i18n/locales/en.json')).default as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  let count = 0;
  const total = JSON.stringify(en).match(/":"/g)?.length ?? 0;
  for (const [k, v] of Object.entries(en)) {
    if (count >= total / 2 + 5) break;
    out[k] = v;
    count += JSON.stringify(v).match(/":"/g)?.length ?? 1;
  }
  return out;
}

afterEach(() => {
  vi.doUnmock('@/lib/i18n/locales/kha.json');
  vi.doUnmock('@/lib/i18n/locales/lus.json');
  pathname = '/caregiver/settings';
});

describe('language offering', () => {
  it('has no speech service for Khasi, Mizo or Nepali, so narration never asks for one', () => {
    expect([...NO_SPEECH_SERVICE_LANGUAGES].sort()).toEqual(['kha', 'lus', 'ne']);
  });

  it('hides a language whose catalog is empty', async () => {
    const { provider, Picker } = await loadWithCatalogs({}, {});
    expect(provider.isLanguageOffered('kha')).toBe(false);
    expect(provider.isLanguageOffered('lus')).toBe(false);
    expect(provider.isLanguageOffered('en')).toBe(true);
    render(<Picker />);
    expect(screen.queryByRole('button', { name: /Khasi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mizo/ })).not.toBeInTheDocument();
  });

  it('offers a language with real text, labelled as a draft, in the caregiver picker', async () => {
    const half = await halfOfEnglish();
    const { provider, Picker } = await loadWithCatalogs(half, {});
    expect(provider.isLanguageOffered('kha')).toBe(true);
    expect(provider.isLanguageOffered('lus')).toBe(false);
    render(<Picker />);
    const khasi = screen.getByRole('button', { name: /Khasi/ });
    expect(khasi).toHaveTextContent('Draft translation');
    expect(screen.getByRole('button', { name: /English/ })).not.toHaveTextContent('Draft translation');
  });

  it('never renders on a patient screen, for any language including Khasi and Mizo', async () => {
    const half = await halfOfEnglish();
    const { Picker } = await loadWithCatalogs(half, half);
    for (const path of ['/app', '/games/object-hunt', '/companion', '/reminders']) {
      pathname = path;
      const view = render(<Picker />);
      expect(view.container).toBeEmptyDOMElement();
      view.unmount();
    }
  });

  it('gives every language a name written in its own words', () => {
    for (const code of LANGUAGES) expect(NATIVE_LANGUAGE_NAME[code].length).toBeGreaterThan(0);
    expect(NATIVE_LANGUAGE_NAME.kha).toBe('Khasi');
    expect(NATIVE_LANGUAGE_NAME.lus).toBe('Mizo ṭawng');
  });
});

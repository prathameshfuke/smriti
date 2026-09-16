import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/provider';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import type { LocalPatient } from '@/lib/db/schema';
import SessionComplete from '@/components/games/SessionComplete';

const { narrateMock } = vi.hoisted(() => ({ narrateMock: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/audio/narrate', () => ({ narrate: narrateMock }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/games/quick-tap',
}));

const patient = (over: Partial<LocalPatient> = {}): LocalPatient => ({
  id: 'p1',
  caregiverId: 'c1',
  displayName: 'Aai',
  ageYears: 72,
  gender: 'female',
  educationYears: 4,
  primaryLanguage: 'en',
  sessionDurationMinutes: 10,
  isActive: true,
  currentDifficulty: {},
  updatedAt: '2026-08-31T00:00:00.000Z',
  syncedAt: null,
  ...over,
});

beforeEach(() => {
  narrateMock.mockClear();
  usePatientStore.setState(usePatientStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  usePatientStore.getState().setCurrentPatient(patient());
});

describe('custom-provider game pages — instruction audio goes through narrate()', () => {
  it('Quick Tap speaks its instruction screen through narrate() with the current language, not raw browser speak()', async () => {
    const { default: QuickTapPage } = await import('@/app/games/quick-tap/page');
    render(
      <I18nProvider>
        <QuickTapPage />
      </I18nProvider>,
    );
    expect(narrateMock).toHaveBeenCalled();
    const [text, language] = narrateMock.mock.calls[0];
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
    expect(language).toBe('en');
  });
});

describe('SessionComplete — spoken encouragement is translated, not hardcoded English', () => {
  it('speaks the Hindi star-tier message through narrate() when the UI language is Hindi', () => {
    useSettingsStore.getState().setLanguage('hi');
    render(
      <I18nProvider>
        <SessionComplete
          gameType="quick_tap"
          stars={5}
          correctCount={5}
          totalCount={5}
          onGoHome={() => {}}
        />
      </I18nProvider>,
    );
    expect(narrateMock).toHaveBeenCalledWith('बहुत बढ़िया! आज शानदार काम किया!', 'hi', expect.anything(), expect.anything());
    expect(screen.getByText('बहुत बढ़िया! आज शानदार काम किया!')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, cleanup } from '@testing-library/react';
import type { LocalPatient } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { LanguageProvider } from '@/lib/i18n/provider';
import { GAME_CONFIG, difficultyForLevel } from '@/components/games/larger-number/config';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/games',
}));
vi.mock('@/lib/audio/narrate', () => ({ narrate: vi.fn().mockResolvedValue(undefined) }));

import NBackPage from '@/app/games/n-back/page';
import LargerNumberPage from '@/app/games/larger-number/page';

const patient = (id: string, cd: Record<string, number>): LocalPatient => ({
  id, caregiverId: 'c1', displayName: 'Aai', ageYears: 72, gender: 'female', educationYears: 4,
  primaryLanguage: 'en', sessionDurationMinutes: 10, isActive: true, currentDifficulty: cd,
  updatedAt: '2026-08-31T00:00:00.000Z', syncedAt: null,
});

beforeEach(() => {
  cleanup();
  usePatientStore.setState(usePatientStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
});

describe('real game components start at the patient level', () => {
  it('difficultyForLevel: level 1 is the original settings, level 3 = two wins up the in-game ladder', () => {
    expect(difficultyForLevel(1)).toEqual(GAME_CONFIG.initialDifficulty);
    const l3 = difficultyForLevel(3);
    expect(l3.attempts).toBe(25 + 3 * 2);
    expect(l3.minDifference).toBe(1);
  });

  it('larger-number shows Level 4 for a level-4 patient and not for a new one', () => {
    usePatientStore.getState().setCurrentPatient(patient('a', { larger_number: 4 }));
    render(<LanguageProvider><LargerNumberPage /></LanguageProvider>);
    expect(document.body.textContent).toMatch(/Level\s*4/);
    cleanup();
    usePatientStore.getState().setCurrentPatient(patient('b', {}));
    render(<LanguageProvider><LargerNumberPage /></LanguageProvider>);
    expect(document.body.textContent).not.toMatch(/Level\s*4/);
  });

  it('n-back starts at 3-back for a level-3 patient, not for a new one', () => {
    usePatientStore.getState().setCurrentPatient(patient('a', { n_back: 3 }));
    render(<LanguageProvider><NBackPage /></LanguageProvider>);
    expect(document.body.textContent).toMatch(/3-?\s?back/i);
    cleanup();
    usePatientStore.getState().setCurrentPatient(patient('b', {}));
    render(<LanguageProvider><NBackPage /></LanguageProvider>);
    expect(document.body.textContent).not.toMatch(/3-?\s?back/i);
  });
});

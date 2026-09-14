import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import type { LocalPatient } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { db } from '@/lib/db/schema';
import { LanguageProvider } from '@/lib/i18n/provider';

function renderPage(ui: ReactElement) {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

const push = vi.fn();
const replace = vi.fn();

// jsdom has no real WebGL context; Counting Boxes' Three.js scene only needs
// to construct without throwing for this smoke test, not actually render.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement('canvas');
      setSize() {}
      setPixelRatio() {}
      render() {}
      dispose() {}
      getPixelRatio() {
        return 1;
      }
    },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/games',
}));

const { narrateMock } = vi.hoisted(() => ({ narrateMock: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/audio/narrate', () => ({ narrate: narrateMock }));

import MemoryBlocksPage from '@/app/games/memory-blocks/page';
import FrogLeapPage from '@/app/games/frog-leap/page';
import CountingBoxesPage from '@/app/games/counting-boxes/page';
import LargerNumberPage from '@/app/games/larger-number/page';
import MemorySpanPage from '@/app/games/memory-span/page';
import FishTracePage from '@/app/games/fish-trace/page';
import DoubleDecisionPage from '@/app/games/double-decision/page';
import NBackPage from '@/app/games/n-back/page';

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

beforeEach(async () => {
  push.mockClear();
  replace.mockClear();
  narrateMock.mockClear();
  usePatientStore.setState(usePatientStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
  await db.patients.clear();
  usePatientStore.getState().setCurrentPatient(patient());
});

describe('New games — smoke render + PatientNav back always present', () => {
  it('Memory Blocks renders its start control', () => {
    renderPage(<MemoryBlocksPage />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  it('Frog Leap renders its start control', () => {
    renderPage(<FrogLeapPage />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /start/i }).length).toBeGreaterThan(0);
  });

  it('Counting Boxes renders its start control', () => {
    renderPage(<CountingBoxesPage />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('Larger Number renders its start control', () => {
    renderPage(<LargerNumberPage />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  it('Memory Span renders its presentation phase', () => {
    renderPage(<MemorySpanPage />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('Fish Trace renders its start control', () => {
    renderPage(<FishTracePage />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('Double Decision renders its practice-start control, not the timed activity directly', () => {
    renderPage(<DoubleDecisionPage />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try one practice round/i })).toBeInTheDocument();
  });

  it('N-Back renders its start control', () => {
    renderPage(<NBackPage />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('N-Back shows real instruction text, not the raw next-intl key', () => {
    // Regression: `t('challenge')` was called with no `{level}` param even
    // though the message requires one ('...matches from {level} step(s)
    // back.'). next-intl has no fallback for a missing required param — it
    // renders the literal key string instead, so the idle screen showed
    // "games.dualNBack.gameUI.challenge" verbatim.
    renderPage(<NBackPage />);
    expect(screen.queryByText(/games\.dualNBack/)).not.toBeInTheDocument();
    expect(screen.getByText(/step\(s\) back/i)).toBeInTheDocument();
  });
});

describe('New games — instruction audio goes through narrate(), not raw browser speak()', () => {
  // These 9 games previously called the browser speechSynthesis API directly
  // with no language argument, so a Hindi/Assamese UI still picked an
  // English voice to read the (correctly translated) instruction text —
  // mispronounced audio, not just missing audio. narrate() is this app's
  // established cache -> Bhashini TTS -> browser-speak pipeline, already
  // proven for the companion and reminders; every game's instruction moment
  // must route through it with the real UI language, matching that pattern.
  it('N-Back speaks its idle-screen challenge instructions through narrate() with the current language', () => {
    renderPage(<NBackPage />);
    expect(narrateMock).toHaveBeenCalled();
    const [text, language] = narrateMock.mock.calls[0];
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
    expect(language).toBe('en');
  });

  it('Memory Span speaks its presentation-phase instruction through narrate()', () => {
    renderPage(<MemorySpanPage />);
    expect(narrateMock).toHaveBeenCalled();
  });

  it('Double Decision speaks its intro instruction through narrate()', () => {
    renderPage(<DoubleDecisionPage />);
    expect(narrateMock).toHaveBeenCalled();
  });
});

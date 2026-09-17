import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { LocalPatient } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { I18nProvider } from '@/lib/i18n/provider';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/games/word-stream',
}));

vi.mock('@/lib/audio/speech', () => ({ speak: vi.fn(), GAME_SPEECH_RATE: 0.9 }));

const patient = (): LocalPatient => ({
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
});

beforeEach(() => {
  usePatientStore.setState(usePatientStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
  usePatientStore.setState({ currentPatient: patient() });
  push.mockClear();
});

/**
 * Regression for the exact bug reported: after telling the patient to
 * remember the items, the game used to navigate back to the home screen
 * mid-round instead of continuing to the recall step — which read as the
 * app randomly quitting. The current implementation stays on this one page
 * for the whole round (show -> a filled delay -> recall -> result); this
 * proves that end to end, not just by reading the code.
 */
describe('Word Stream full round, single continuous visit', () => {
  it('goes from show through delay to recall without ever navigating away, and only leaves on Back to Home', async () => {
    vi.useFakeTimers();
    try {
      const { default: WordStreamPage } = await import('@/app/games/word-stream/page');
      render(
        <I18nProvider>
          <WordStreamPage />
        </I18nProvider>,
      );

      // SHOW phase: 3 items at level 1, 3s each slowed 20% (pacing.SLOWDOWN,
      // src/lib/games/pacing.ts) to 4s. Advanced one item at a time (rather
      // than one big jump) so each setTimeout's state update gets a full
      // render + effect cycle to schedule the next one before fake timers
      // are asked to look further ahead.
      for (let i = 0; i < 4; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(4001);
        });
      }

      // DELAY phase: 12s filled pause, no navigation.
      expect(screen.getByText(/remember these for later/i)).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(12_000 + 100);
      });

      // RECALL phase reached automatically, still the same page, no exit.
      expect(screen.getByText(/which items did we show you/i)).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();

      // Real timers from here on: finishing recall and going home both write
      // to Dexie, and fake-indexeddb's own internal scheduling doesn't
      // survive a switch back to real timers mid-flight — done with the UI
      // countdowns (the actual point of this test), so no reason to keep
      // fake timers active for the data-writing half.
      vi.useRealTimers();

      const optionButtons = screen.getAllByRole('button').filter((b) => b.querySelector('span[aria-hidden]'));
      fireEvent.click(optionButtons[0]);
      fireEvent.click(screen.getByRole('button', { name: /i am done/i }));

      // RESULT phase: stays on-page showing the score, still hasn't left.
      expect(await screen.findByRole('button', { name: /back to home/i })).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();

      // Only now, on an explicit tap, does it navigate home.
      fireEvent.click(screen.getByRole('button', { name: /back to home/i }));
      await waitFor(() => expect(push).toHaveBeenCalledWith('/app'));
    } finally {
      vi.useRealTimers();
    }
  }, 15000);
});

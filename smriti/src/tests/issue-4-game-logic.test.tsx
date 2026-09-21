import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { penalizedAccuracy } from '@/lib/engine/scoring';
import { matchSpokenWords } from '@/lib/audio/voiceInput';
import SessionComplete from '@/components/games/SessionComplete';
import GameTutorial, { TUTORIALS } from '@/components/games/GameTutorial';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { I18nProvider } from '@/lib/i18n/provider';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/games/object-hunt',
}));
vi.mock('@/lib/audio/speech', () => ({ speak: vi.fn(), GAME_SPEECH_RATE: 0.9 }));
vi.mock('@/lib/audio/narrate', () => ({ narrate: vi.fn().mockResolvedValue(undefined) }));

describe('penalizedAccuracy (Market List / Quick Tap / N-Back scoring)', () => {
  it('lets each wrong pick cancel one correct pick', () => {
    expect(penalizedAccuracy(4, 1, 5)).toBeCloseTo(0.6);
  });

  it('no longer gives full marks for tapping everything', () => {
    expect(penalizedAccuracy(5, 10, 5)).toBe(0);
  });

  it('never goes below 0 or above 1, and handles an empty round', () => {
    expect(penalizedAccuracy(0, 3, 5)).toBe(0);
    expect(penalizedAccuracy(5, 0, 5)).toBe(1);
    expect(penalizedAccuracy(0, 0, 0)).toBe(0);
  });
});

describe('matchSpokenWords (Memory Span voice answers)', () => {
  const words = ['Umbrella', 'Lamp', 'Ice cream', 'छाता'];

  it('finds whole words said in any order, case-insensitively', () => {
    expect(matchSpokenWords('lamp and umbrella', words)).toEqual(['Umbrella', 'Lamp']);
  });

  it('accepts a simple plural and multi-word phrases', () => {
    expect(matchSpokenWords('umbrellas, ice cream', words)).toEqual(['Umbrella', 'Ice cream']);
  });

  it('does not match part of a longer word', () => {
    expect(matchSpokenWords('lamppost', words)).toEqual([]);
  });

  it('works for Hindi words', () => {
    expect(matchSpokenWords('मेरा छाता', words)).toEqual(['छाता']);
  });
});

describe('SessionComplete celebration', () => {
  it('shows a greeting and the extra-taps count, still without fail vocabulary', () => {
    const { container } = render(
      <I18nProvider>
        <SessionComplete gameType="quick_tap" stars={3} correctCount={4} totalCount={5} wrongCount={2} onGoHome={() => {}} />
      </I18nProvider>,
    );
    expect(screen.getByText(/2 extra taps/)).toBeInTheDocument();
    expect(screen.getByText(/Hooray|Wonderful|Well played/)).toBeInTheDocument();
    expect(container.querySelector('[data-testid="celebration-confetti"]')).toBeTruthy();
    expect(container.innerHTML.toLowerCase()).not.toContain('wrong');
  });

  it('hides the extra-taps line when there were none', () => {
    render(
      <I18nProvider>
        <SessionComplete gameType="quick_tap" stars={5} correctCount={5} totalCount={5} onGoHome={() => {}} />
      </I18nProvider>,
    );
    expect(screen.queryByText(/extra taps/)).not.toBeInTheDocument();
  });
});

describe('GameTutorial', () => {
  beforeEach(() => window.localStorage.clear());

  it('opens by itself on a patient\'s first 7 visits only', async () => {
    usePatientStore.setState({ currentPatient: { id: 'p-tutorial' } as never });
    const opened: boolean[] = [];
    for (let visit = 0; visit < 9; visit += 1) {
      const view = render(
        <I18nProvider>
          <GameTutorial gameId="quick_tap" steps={TUTORIALS.quick_tap} />
        </I18nProvider>,
      );
      await act(async () => {});
      opened.push(screen.queryByTestId('tutorial-step') !== null);
      view.unmount();
    }
    expect(opened).toEqual([true, true, true, true, true, true, true, false, false]);
  });

  it('starts a different patient\'s count from zero, and the button still works after 7', async () => {
    usePatientStore.setState({ currentPatient: { id: 'p-a' } as never });
    for (let visit = 0; visit < 7; visit += 1) {
      const v = render(
        <I18nProvider>
          <GameTutorial gameId="quick_tap" steps={TUTORIALS.quick_tap} />
        </I18nProvider>,
      );
      await act(async () => {});
      v.unmount();
    }
    const spent = render(
      <I18nProvider>
        <GameTutorial gameId="quick_tap" steps={TUTORIALS.quick_tap} />
      </I18nProvider>,
    );
    await act(async () => {});
    expect(screen.queryByTestId('tutorial-step')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('how-to-play'));
    expect(screen.getByTestId('tutorial-step')).toBeInTheDocument();
    spent.unmount();

    usePatientStore.setState({ currentPatient: { id: 'p-b' } as never });
    render(
      <I18nProvider>
        <GameTutorial gameId="quick_tap" steps={TUTORIALS.quick_tap} />
      </I18nProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId('tutorial-step')).toBeInTheDocument();
  });

  it('steps through to the end and closes, and reopens from How to play', async () => {
    window.localStorage.setItem('smriti.tutorialSeen.path_match', '1');
    render(
      <I18nProvider>
        <GameTutorial gameId="path_match" steps={TUTORIALS.path_match} />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByTestId('how-to-play'));
    for (let i = 1; i < TUTORIALS.path_match.length; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(screen.getByText(/Step 4 of 4/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Got it/ }));
    expect(screen.queryByTestId('tutorial-step')).not.toBeInTheDocument();
  });

  it('closes with the close button and Escape', () => {
    window.localStorage.setItem('smriti.tutorialSeen.counting_boxes', '1');
    render(
      <I18nProvider>
        <GameTutorial gameId="counting_boxes" steps={TUTORIALS.counting_boxes} />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByTestId('how-to-play'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('tutorial-step')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('how-to-play'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('tutorial-step')).not.toBeInTheDocument();
  });
});

describe('Object Hunt recall taps (issue #4)', () => {
  beforeEach(() => {
    usePatientStore.setState(usePatientStore.getInitialState(), true);
    useGameStore.setState(useGameStore.getInitialState(), true);
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('accepts a tile tap with no patient profile loaded, after showing the target picture alone', async () => {
    const { default: ObjectHuntPage } = await import('@/app/games/object-hunt/page');
    render(
      <I18nProvider>
        <ObjectHuntPage />
      </I18nProvider>,
    );

    // The start screen waits for the patient (no timer), then level 1
    // reveals 2 objects × 3s slowed 20% (pacing.SLOWDOWN,
    // src/lib/games/pacing.ts) to 4s, + 500ms, then recall.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(screen.getByRole('button', { name: 'Start!' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start!' }));
    for (const ms of [10, 4000, 4000, 510, 10]) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
    }
    expect(screen.getByTestId('object-hunt-prompt')).toBeInTheDocument();

    // PROMPT_MS is 2000ms slowed 20% to 2400ms.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2410);
    });
    expect(screen.queryByTestId('object-hunt-prompt')).not.toBeInTheDocument();
    expect(screen.getByTestId('object-grid-question')).toBeInTheDocument();

    const tiles = screen.getAllByRole('button', { name: /Tile/ });
    fireEvent.click(tiles[0]);
    // A second quick tap must not answer again.
    fireEvent.click(tiles[1]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const flashed = document.querySelectorAll('.ring-success, .ring-warning');
    expect(flashed).toHaveLength(1);
  });

  it('skips the start screen once this patient has seen it 7 times', async () => {
    usePatientStore.setState({ currentPatient: { id: 'p-oh', currentDifficulty: {} } as never });
    window.localStorage.setItem('smriti.tutorialShown.p-oh.object_hunt', '7');
    const { default: ObjectHuntPage } = await import('@/app/games/object-hunt/page');
    render(
      <I18nProvider>
        <ObjectHuntPage />
      </I18nProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.queryByRole('button', { name: 'Start!' })).not.toBeInTheDocument();
    expect(screen.getByTestId('object-hunt-progress')).toBeInTheDocument();
  });

  it('shows the start screen on a new patient\'s visit and counts it', async () => {
    usePatientStore.setState({ currentPatient: { id: 'p-new', currentDifficulty: {} } as never });
    window.localStorage.clear();
    const { default: ObjectHuntPage } = await import('@/app/games/object-hunt/page');
    render(
      <I18nProvider>
        <ObjectHuntPage />
      </I18nProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByRole('button', { name: 'Start!' })).toBeInTheDocument();
    expect(window.localStorage.getItem('smriti.tutorialShown.p-new.object_hunt')).toBe('1');
  });
});

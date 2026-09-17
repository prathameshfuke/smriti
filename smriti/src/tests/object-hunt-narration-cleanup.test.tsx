import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, act } from '@testing-library/react';
import type { LocalPatient } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { I18nProvider } from '@/lib/i18n/provider';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/games/object-hunt',
}));

const { speakMock } = vi.hoisted(() => ({ speakMock: vi.fn() }));
vi.mock('@/lib/audio/speech', () => ({ speak: speakMock, GAME_SPEECH_RATE: 0.9 }));
vi.mock('@/lib/audio/narrate', () => ({ narrate: vi.fn().mockResolvedValue(undefined) }));

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
  speakMock.mockClear();
});

/**
 * Regression for narration surviving navigation away from the game page.
 * Object Hunt's reveal/recall effects defer their real work into
 * queueMicrotask (to satisfy a lint rule about deriving state outside the
 * effect body); before the fix, a microtask already queued when the effect
 * cleaned up (phase change or unmount) still ran afterward, fully detached
 * from React, starting a setInterval / calling speak() with nothing left to
 * ever cancel it. queueMicrotask is stubbed here to capture rather than
 * auto-run its callback so the race can be reproduced deterministically,
 * instead of depending on real event-loop timing.
 */
describe('Object Hunt — narration does not survive an unmount mid-microtask', () => {
  it('never starts the reveal-phase narration loop if the page unmounts before its queued microtask runs', async () => {
    const pending: Array<() => void> = [];
    const realQueueMicrotask = queueMicrotask;
    vi.stubGlobal('queueMicrotask', (fn: () => void) => pending.push(fn));
    vi.useFakeTimers();

    try {
      const { default: ObjectHuntPage } = await import('@/app/games/object-hunt/page');
      const { unmount } = render(
        <I18nProvider>
          <ObjectHuntPage />
        </I18nProvider>,
      );

      // Advance past the 5s instruction phase: setPhase('reveal') fires, and
      // the reveal effect queues its microtask (captured above, not run).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5001);
      });
      expect(pending.length).toBeGreaterThan(0);

      // Leave the page before that microtask ever executes.
      unmount();

      // The microtask still runs afterward, same as it would in a real
      // browser — nothing cancels a queued microtask on unmount.
      pending.forEach((fn) => fn());

      expect(speakMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.stubGlobal('queueMicrotask', realQueueMicrotask);
    }
  });

  it('never speaks the recall-phase prompt if the page unmounts before its queued microtask runs', async () => {
    const pending: Array<() => void> = [];
    const realQueueMicrotask = queueMicrotask;
    // Let every microtask run immediately (mirrors real behavior) until the
    // test explicitly wants to capture one instead.
    let capture = false;
    vi.stubGlobal('queueMicrotask', (fn: () => void) => {
      if (capture) {
        pending.push(fn);
      } else {
        realQueueMicrotask(fn);
      }
    });
    vi.useFakeTimers();

    try {
      const { default: ObjectHuntPage } = await import('@/app/games/object-hunt/page');
      const { unmount } = render(
        <I18nProvider>
          <ObjectHuntPage />
        </I18nProvider>,
      );

      // Reach 'reveal' and let its own microtask/interval run normally so
      // the round actually advances toward 'recall'. Level 1: objectCount 2,
      // revealSeconds 3s slowed 20% (pacing.SLOWDOWN, src/lib/games/pacing.ts)
      // to 4s — instruction (5s) + two 4s reveal ticks + the 500ms hand-off
      // to recall.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5001);
      });
      speakMock.mockClear();

      capture = true;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000 + 4000 + 500 + 10);
      });
      expect(pending.length).toBeGreaterThan(0);

      // Only the still-pending recall-prompt microtask matters from here —
      // the reveal phase's own (legitimate, while-mounted) narration already
      // happened above.
      speakMock.mockClear();
      unmount();
      pending.forEach((fn) => fn());

      expect(speakMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.stubGlobal('queueMicrotask', realQueueMicrotask);
    }
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuid } from 'uuid';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { LocalPatient } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { I18nProvider } from '@/lib/i18n/provider';
import { db } from '@/lib/db/schema';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/games/path-match',
}));

/**
 * A fresh id per test run, not a fixed 'p1' — this test reads *cumulative*
 * difficulty history across 4 simulated visits from the shared
 * fake-indexeddb singleton (gameSessions/telemetryEvents/dailySummaries),
 * which every other test file also shares with no global reset (see
 * setup.ts). A fixed id let leftover rows from whichever file happened to
 * run first make this test's result depend on suite file order. A unique
 * id per run makes that collision impossible in either direction, without
 * needing to know every table the difficulty engine reads from.
 */
let patientId: string;

const patient = (): LocalPatient => ({
  id: patientId,
  caregiverId: 'c1',
  displayName: 'Aai',
  ageYears: 72,
  gender: 'female',
  educationYears: 4,
  primaryLanguage: 'as',
  sessionDurationMinutes: 10,
  isActive: true,
  currentDifficulty: {},
  updatedAt: '2026-08-31T00:00:00.000Z',
  syncedAt: null,
});

beforeEach(async () => {
  patientId = uuid();
  usePatientStore.setState(usePatientStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
  await db.patients.put(patient());
  usePatientStore.setState({ currentPatient: patient() });
  Element.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0, toJSON() {} } as DOMRect;
  };
});

/** Enter the game fresh, play exactly one perfect round, then Finish Session (simulates going home). */
async function oneVisitPerfectRound(): Promise<number> {
  // Captured *before* this visit's own actions: the level change is written
  // to Dexie and the store after the round ends, and the next visit must not
  // mount until that write has landed. A difficulty change deliberately does
  // NOT bump `updatedAt` any more (it is local-only state — see
  // stores/patientStore.ts), so the level itself is what this waits on.
  // Real patients take minutes between games; this race is a test-timing
  // artifact, not a production concern, so the wait lives here, not in app code.
  const levelBeforeThisVisit = usePatientStore.getState().currentPatient?.currentDifficulty?.path_match ?? 1;
  const { default: PathMatchPage } = await import('@/app/games/path-match/page');
  const { unmount } = render(
    <I18nProvider>
      <PathMatchPage />
    </I18nProvider>,
  );

  fireEvent.click(screen.getByText(/start!/i));
  await waitFor(() => expect(screen.getByTestId('path-canvas')).toBeInTheDocument());
  const svg = screen.getByTestId('path-canvas');
  const points = screen.getAllByTestId(/^path-point-/);
  const numPoints = points.length;
  for (const point of points) {
    const circle = point.querySelector('circle')!;
    fireEvent.pointerDown(svg, {
      clientX: Number(circle.getAttribute('cx')),
      clientY: Number(circle.getAttribute('cy')),
    });
  }
  await waitFor(() => expect(screen.getByText(/finish for now/i)).toBeInTheDocument());
  fireEvent.click(screen.getByText(/finish for now/i));
  await waitFor(() => expect(screen.getByText(/back to home/i)).toBeInTheDocument());
  await waitFor(() =>
    expect(usePatientStore.getState().currentPatient?.currentDifficulty?.path_match ?? 1).not.toBe(
      levelBeforeThisVisit,
    ),
  );

  unmount();
  cleanup();
  return numPoints;
}

describe('Path Match difficulty progression across SEPARATE visits (one round each, like a real patient)', () => {
  it('increases node count after 3 separate perfect one-round visits', async () => {
    const visit1 = await oneVisitPerfectRound();
    await oneVisitPerfectRound();
    await oneVisitPerfectRound();
    const visit4 = await oneVisitPerfectRound();

    expect(visit4).toBeGreaterThan(visit1);
  });
});

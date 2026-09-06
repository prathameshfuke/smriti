import { describe, it, expect, beforeEach, vi } from 'vitest';
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

const patient = (): LocalPatient => ({
  id: 'p1',
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
  await waitFor(() => expect(screen.getByText(/finish session/i)).toBeInTheDocument());
  fireEvent.click(screen.getByText(/finish session/i));
  await waitFor(() => expect(screen.getByText(/back to home/i)).toBeInTheDocument());
  await waitFor(() => expect(usePatientStore.getState().currentPatient?.updatedAt).not.toBe(patient().updatedAt));

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

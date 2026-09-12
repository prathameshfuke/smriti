import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { computeDPrime, starsFromRate, scoreQuickTapRound } from '@/lib/engine/scoring';
import type { PathPoint } from '@/components/games/PathCanvas';
import PathCanvas from '@/components/games/PathCanvas';
import SessionComplete from '@/components/games/SessionComplete';
import type { LocalPatient } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { I18nProvider } from '@/lib/i18n/provider';

const push = vi.fn();
const router = { push, replace: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/games/path-match',
}));

describe('PathCanvas', () => {
  const points: PathPoint[] = [
    { x: 50, y: 50, label: 1 },
    { x: 150, y: 50, label: 2 },
    { x: 250, y: 50, label: 3 },
  ];

  it('renders correct number of circles for given points array', () => {
    const { container } = render(
      <PathCanvas points={points} currentTarget={0} onPointTap={() => {}} completedPath={[]} />,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(3);
  });

  it('current target circle has pulse styling', () => {
    const { container } = render(
      <PathCanvas points={points} currentTarget={1} onPointTap={() => {}} completedPath={[]} />,
    );
    const circles = container.querySelectorAll('circle');
    expect(circles[1].getAttribute('class')).toMatch(/animate-pulse-ring/);
  });

  it('completed path has SVG line elements between completed pairs', () => {
    const { container } = render(
      <PathCanvas
        points={points}
        currentTarget={2}
        onPointTap={() => {}}
        completedPath={[{ from: 0, to: 1 }]}
      />,
    );
    expect(container.querySelectorAll('line')).toHaveLength(1);
  });
});

describe('Quick Tap scoring', () => {
  it('correctly identifies hit vs false alarm vs miss for a known item sequence', () => {
    const items = [
      { isTarget: true, tapped: true }, // hit
      { isTarget: true, tapped: false }, // miss
      { isTarget: false, tapped: true }, // false alarm
      { isTarget: false, tapped: false }, // correct reject
    ];
    const result = scoreQuickTapRound(items);
    expect(result.hits).toBe(1);
    expect(result.misses).toBe(1);
    expect(result.falseAlarms).toBe(1);
    expect(result.correctRejects).toBe(1);
  });

  it('dPrime is positive for perfect hit rate and zero false alarms', () => {
    const d = computeDPrime(10, 10, 0, 10);
    expect(d).toBeGreaterThan(0);
  });
});

describe('starsFromRate', () => {
  it('clamps to a minimum of 1 star', () => {
    expect(starsFromRate(0)).toBe(1);
  });
});

describe('SessionComplete', () => {
  it('always renders at least 1 star regardless of input', () => {
    const { container } = render(
      <I18nProvider>
        <SessionComplete
          gameType="path_match"
          stars={0}
          correctCount={0}
          totalCount={5}
          onGoHome={() => {}}
        />
      </I18nProvider>,
    );
    expect(container.textContent?.match(/⭐/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('output HTML never contains the words "wrong" or "failed"', () => {
    for (let stars = 1; stars <= 5; stars += 1) {
      const { container, unmount } = render(
        <I18nProvider>
          <SessionComplete
            gameType="quick_tap"
            stars={stars}
            correctCount={stars}
            totalCount={5}
            onGoHome={() => {}}
          />
        </I18nProvider>,
      );
      const html = container.innerHTML.toLowerCase();
      expect(html).not.toContain('wrong');
      expect(html).not.toContain('failed');
      unmount();
    }
  });
});

describe('Path Match page tap handling', () => {
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

  beforeEach(() => {
    usePatientStore.setState(usePatientStore.getInitialState(), true);
    useGameStore.setState(useGameStore.getInitialState(), true);
    usePatientStore.setState({ currentPatient: patient() });
    Element.prototype.getBoundingClientRect = function () {
      return { left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0, toJSON() {} } as DOMRect;
    };
  });

  it('correct tap (index matches currentTarget-1) advances currentTarget', async () => {
    const { default: PathMatchPage } = await import('@/app/games/path-match/page');
    render(
      <I18nProvider>
        <PathMatchPage />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByText(/start/i));

    await waitFor(() => expect(screen.getByTestId('path-canvas')).toBeInTheDocument());

    const points = screen.getAllByTestId(/^path-point-/);
    const svg = screen.getByTestId('path-canvas');

    const firstPoint = points[0];
    const cx = Number(firstPoint.querySelector('circle')!.getAttribute('cx'));
    const cy = Number(firstPoint.querySelector('circle')!.getAttribute('cy'));

    fireEvent.pointerDown(svg, { clientX: cx, clientY: cy });

    await waitFor(() => {
      expect(screen.getByTestId('current-target-label').textContent).toContain('2');
    });
  });

  it('wrong tap does NOT advance currentTarget', async () => {
    const { default: PathMatchPage } = await import('@/app/games/path-match/page');
    render(
      <I18nProvider>
        <PathMatchPage />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByText(/start/i));

    await waitFor(() => expect(screen.getByTestId('path-canvas')).toBeInTheDocument());

    const points = screen.getAllByTestId(/^path-point-/);
    const svg = screen.getByTestId('path-canvas');

    const lastPoint = points[points.length - 1];
    const cx = Number(lastPoint.querySelector('circle')!.getAttribute('cx'));
    const cy = Number(lastPoint.querySelector('circle')!.getAttribute('cy'));

    fireEvent.pointerDown(svg, { clientX: cx, clientY: cy });

    expect(screen.getByTestId('current-target-label').textContent).toContain('1');
  });
});

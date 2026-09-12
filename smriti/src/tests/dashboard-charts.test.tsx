import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CognitiveTrendChart from '@/components/caregiver/CognitiveTrendChart';
import GameBreakdownChart from '@/components/caregiver/GameBreakdownChart';
import SessionCalendar from '@/components/caregiver/SessionCalendar';
import type { TrendPoint } from '@/lib/dashboard/trend';

const point = (over: Partial<TrendPoint> = {}): TrendPoint => ({
  date: '2026-09-01',
  accuracy: 80,
  gameType: 'object_hunt',
  maxDifficultyReached: 3,
  sessionCount: 1,
  totalRounds: 10,
  ...over,
});

describe('CognitiveTrendChart', () => {
  const noop = vi.fn();

  it('shows a skeleton while loading, not any render state text', () => {
    const { container } = render(
      <CognitiveTrendChart points={[]} sessionDays={0} range="30d" onRangeChange={noop} isLoading />,
    );
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    expect(screen.queryByText(/no sessions/i)).not.toBeInTheDocument();
  });

  it('0-session state: shows the exact existing empty copy', () => {
    render(<CognitiveTrendChart points={[]} sessionDays={0} range="30d" onRangeChange={noop} />);
    expect(screen.getByText('No sessions recorded yet.')).toBeInTheDocument();
  });

  it('1-2 session low-data state: lists sessions individually, draws no line, and suppresses the drop callout', () => {
    const points = [
      point({ date: '2026-09-01', accuracy: 90, totalRounds: 10 }),
      point({ date: '2026-09-02', accuracy: 60, totalRounds: 10 }), // a >15pt fall, must NOT be flagged here
    ];
    render(<CognitiveTrendChart points={points} sessionDays={2} range="30d" onRangeChange={noop} minSessionsForTrend={5} />);

    expect(
      screen.getByText('2 sessions so far. A trend needs about 5. Showing each session instead.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/2026-09-01 · 90% accuracy/)).toBeInTheDocument();
    expect(screen.getByText(/2026-09-02 · 60% accuracy/)).toBeInTheDocument();
    expect(screen.queryByText(/drop/i)).not.toBeInTheDocument();
    // No chart region drawn in this state.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('singular copy for exactly 1 session', () => {
    render(
      <CognitiveTrendChart
        points={[point({ date: '2026-09-01' })]}
        sessionDays={1}
        range="30d"
        onRangeChange={noop}
      />,
    );
    expect(screen.getByText(/^1 session so far/)).toBeInTheDocument();
  });

  it('full-dataset state: renders the accessible chart region, sr-only table, and a drop callout', () => {
    const points = Array.from({ length: 6 }, (_, i) =>
      point({ date: `2026-09-0${i + 1}`, accuracy: i === 5 ? 40 : 90, totalRounds: 10 }),
    );
    render(<CognitiveTrendChart points={points} sessionDays={6} range="30d" onRangeChange={noop} />);

    const region = screen.getByRole('img');
    expect(region.getAttribute('aria-label')).toMatch(/line chart of blended daily accuracy/i);
    expect(screen.getByText(/point drop on 2026-09-06/)).toBeInTheDocument();

    const table = within(region).getByRole('table', { hidden: true });
    expect(table.className).toContain('sr-only');
    expect(within(table).getByText('2026-09-01')).toBeInTheDocument();
  });

  it('range toggle calls onRangeChange with the clicked value and marks the active one pressed', () => {
    const onRangeChange = vi.fn();
    render(<CognitiveTrendChart points={[]} sessionDays={0} range="30d" onRangeChange={onRangeChange} />);
    expect(screen.getByRole('button', { name: '30d' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '90d' }));
    expect(onRangeChange).toHaveBeenCalledWith('90d');
  });
});

describe('GameBreakdownChart', () => {
  it('0-session state: shows the same empty copy', () => {
    render(<GameBreakdownChart points={[]} />);
    expect(screen.getByText('No sessions recorded yet.')).toBeInTheDocument();
  });

  it('shows a skeleton while loading', () => {
    const { container } = render(<GameBreakdownChart points={[]} isLoading />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('low-data (1-2 sessions): still renders bars — a bar chart makes no trend claim', () => {
    render(<GameBreakdownChart points={[point({ gameType: 'quick_tap', accuracy: 75 })]} />);
    const region = screen.getByRole('img');
    const table = within(region).getByRole('table', { hidden: true });
    expect(within(table).getByText('Quick Tap')).toBeInTheDocument();
    expect(within(table).getByText('75%')).toBeInTheDocument();
  });

  it('full dataset: groups rows-weighted accuracy per game with labels and level caps from the shared sources', () => {
    const points = [
      point({ gameType: 'object_hunt', date: '2026-09-01', accuracy: 50, totalRounds: 10, maxDifficultyReached: 4 }),
      point({ gameType: 'object_hunt', date: '2026-09-02', accuracy: 90, totalRounds: 10, maxDifficultyReached: 6 }),
      point({ gameType: 'memory_match', date: '2026-09-01', accuracy: 100, totalRounds: 5, maxDifficultyReached: 2 }),
    ];
    render(<GameBreakdownChart points={points} />);
    const region = screen.getByRole('img');
    const table = within(region).getByRole('table', { hidden: true });
    expect(within(table).getByText('Object Hunt')).toBeInTheDocument();
    expect(within(table).getByText('Memory Match')).toBeInTheDocument();
    expect(within(table).getByText('70%')).toBeInTheDocument(); // (5+9)/20
    // maxDifficultyReached (max of 4 and 6 across the two object_hunt rows) / MAX_LEVEL.object_hunt.
    // Split across 3 text nodes by JSX interpolation, so match on the cell's full textContent.
    expect(
      within(table).getByText(
        (_content, el) => el?.tagName === 'TD' && el.textContent?.replace(/\s+/g, ' ').trim() === '6 / 10',
      ),
    ).toBeInTheDocument();
  });
});

describe('SessionCalendar', () => {
  it('renders one cell per day in the month regardless of whether there is data', () => {
    render(<SessionCalendar year={2026} month={8} points={[]} />); // September 2026 (0-indexed)
    const cells = screen.getAllByTestId('calendar-day');
    expect(cells).toHaveLength(30);
  });

  it('sizes each day button at the 48px touch-min token, not the old 40px', () => {
    render(<SessionCalendar year={2026} month={8} points={[]} />);
    const cells = screen.getAllByTestId('calendar-day');
    for (const cell of cells) {
      expect(cell.style.height).toBe('48px');
      expect(cell.style.width).toBe('48px');
    }
  });

  it('shows a coloured dot only for days with data, and opens a detail panel on tap', () => {
    const points = [point({ date: '2026-09-05', gameType: 'object_hunt', accuracy: 82 })];
    render(<SessionCalendar year={2026} month={8} points={points} />);

    const day5 = screen.getByText('5').closest('button')!;
    expect(day5.querySelector('.bg-success')).toBeTruthy();

    fireEvent.click(day5);
    expect(screen.getByRole('dialog', { name: /details for 2026-09-05/i })).toBeInTheDocument();
    expect(screen.getByText(/Object Hunt: 82%/)).toBeInTheDocument();
  });

  it('does nothing when tapping a day with no data', () => {
    render(<SessionCalendar year={2026} month={8} points={[]} />);
    const day5 = screen.getByText('5').closest('button')!;
    fireEvent.click(day5);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

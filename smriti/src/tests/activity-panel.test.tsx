import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActivityLevelPanel from '@/components/caregiver/ActivityLevelPanel';
import type { TrendPoint } from '@/lib/dashboard/trend';

const TODAY = '2026-09-20';

const point = (over: Partial<TrendPoint> = {}): TrendPoint => ({
  date: TODAY,
  accuracy: 78,
  gameType: 'object_hunt',
  maxDifficultyReached: 3,
  sessionCount: 1,
  totalRounds: 10,
  ...over,
});

describe('ActivityLevelPanel', () => {
  it('shows a skeleton while loading, with no numbers yet', () => {
    const { container } = render(<ActivityLevelPanel points={[]} today={TODAY} isLoading />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('says plainly when nothing has been played, instead of drawing an empty chart', () => {
    render(<ActivityLevelPanel points={[]} today={TODAY} />);
    expect(screen.getByText(/no games played in this period/i)).toBeInTheDocument();
    expect(screen.queryByTestId('activity-bars')).not.toBeInTheDocument();
  });

  it('counts days played, sessions and rounds a day', () => {
    render(
      <ActivityLevelPanel
        points={[
          point({ date: '2026-09-19', sessionCount: 2, totalRounds: 20 }),
          point({ date: '2026-09-20', sessionCount: 1, totalRounds: 8 }),
        ]}
        today={TODAY}
      />,
    );
    expect(screen.getByText('Days played').nextSibling).toHaveTextContent('2/14');
    expect(screen.getByText('Sessions').nextSibling).toHaveTextContent('3');
    expect(screen.getByText('Rounds a day').nextSibling).toHaveTextContent('2.0');
  });

  it('warns after a quiet stretch, with something the caregiver can do', () => {
    render(<ActivityLevelPanel points={[point({ date: '2026-09-10' })]} today={TODAY} />);
    expect(screen.getByText(/nothing played for 10 days/i)).toBeInTheDocument();
  });

  it('stays quiet about inactivity when they played today', () => {
    render(<ActivityLevelPanel points={[point()]} today={TODAY} />);
    expect(screen.queryByText(/nothing played for/i)).not.toBeInTheDocument();
  });

  it('breaks the games down by the kind of thinking they exercise', () => {
    render(
      <ActivityLevelPanel
        points={[point({ gameType: 'memory_match' }), point({ gameType: 'quick_tap', accuracy: 60 })]}
        today={TODAY}
      />,
    );
    expect(screen.getAllByTestId('domain-row')).toHaveLength(2);
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('Speed')).toBeInTheDocument();
  });

  it('tells the caregiver whether the difficulty is landing right', () => {
    render(<ActivityLevelPanel points={[point({ accuracy: 97 })]} today={TODAY} />);
    expect(screen.getByText(/may be too easy/i)).toBeInTheDocument();

    render(<ActivityLevelPanel points={[point({ accuracy: 35 })]} today={TODAY} />);
    expect(screen.getByText(/may be too hard/i)).toBeInTheDocument();
  });

  it('says the level is about right when accuracy sits in the target band', () => {
    render(<ActivityLevelPanel points={[point({ accuracy: 78 })]} today={TODAY} />);
    expect(screen.getByText(/pitched about right/i)).toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LeaderboardList, type LeaderboardEntry } from '@/components/caregiver/WeeklyLeaderboard';

const entries: LeaderboardEntry[] = [
  { rank: 1, patientId: 'a', displayName: 'Jalaja Utekar', points: 142, gamesPlayed: 12 },
  { rank: 2, patientId: 'b', displayName: 'Maya Devi', points: 1, gamesPlayed: 1 },
  { rank: 3, patientId: 'c', displayName: 'Ramesh', points: 0, gamesPlayed: 0 },
];

describe('LeaderboardList', () => {
  it('lists everyone in rank order with a readable rank and totals', () => {
    render(<LeaderboardList entries={entries} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Rank 1: Jalaja Utekar');
    expect(rows[0]).toHaveTextContent('142 points · 12 games');
    expect(rows[1]).toHaveTextContent('1 point · 1 game');
  });

  it('gives medals only to people who scored', () => {
    render(<LeaderboardList entries={entries} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('🥇');
    expect(rows[1]).toHaveTextContent('🥈');
    expect(rows[2]).not.toHaveTextContent('🥉');
    expect(within(rows[2]).getByText('3')).toBeInTheDocument();
  });

  it('says nobody has played yet instead of ranking a week of zeros', () => {
    render(<LeaderboardList entries={entries.map((e) => ({ ...e, points: 0, gamesPlayed: 0 }))} />);
    expect(screen.getByText('No games played in the last 7 days yet.')).toBeInTheDocument();
    expect(screen.queryByText('🥇')).not.toBeInTheDocument();
  });

  it('shows an empty state with no patients', () => {
    render(<LeaderboardList entries={[]} />);
    expect(screen.getByText('No patients yet.')).toBeInTheDocument();
  });
});

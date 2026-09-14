import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { computeAdherence, dateRange } from '@/lib/engine/adherence';
import { mergeScoreRows, summarizeActivity, type ScoreRow } from '@/lib/dashboard/cognitiveScore';
import { formatDayDate, formatShortDate, formatTimeOfDay } from '@/lib/dashboard/formatDate';

const row = (over: Partial<ScoreRow> = {}): ScoreRow => ({
  date: '2026-09-14',
  gameType: 'quick_tap',
  correctRounds: 3,
  totalRounds: 4,
  maxDifficultyReached: 2,
  ...over,
});

describe('computeAdherence', () => {
  const schedule = {
    id: 'water',
    reminder_type: 'hydration' as const,
    time_of_day: '00:00',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    label: 'Drink water',
  };

  it('does not count days before the reminder was set up as missed', () => {
    const days = dateRange(7);
    const created = `${days[5]}T00:00:00.000Z`;
    const result = computeAdherence([{ ...schedule, created_at: created }], [], days);
    expect(result.byType.hydration.total).toBe(2);
    expect(result.missed.map((m) => m.date)).toEqual([days[5], days[6]]);
  });

  it('counts every day in the window for a reminder with no creation date', () => {
    expect(computeAdherence([schedule], [], dateRange(7)).byType.hydration.total).toBe(7);
  });

  it('skips the first day when the reminder time had already passed when it was added', () => {
    const days = dateRange(7);
    const result = computeAdherence(
      [{ ...schedule, time_of_day: '00:00', created_at: `${days[4]}T09:30:00.000Z` }],
      [],
      days,
    );
    expect(result.missed.map((m) => m.date)).not.toContain(days[4]);
  });
});

describe('mergeScoreRows / summarizeActivity', () => {
  it('keeps the fuller copy of a game-day present on both phone and server', () => {
    const merged = mergeScoreRows([row({ totalRounds: 2, correctRounds: 1 })], [row({ totalRounds: 6, correctRounds: 6 })]);
    expect(merged).toEqual([row({ totalRounds: 6, correctRounds: 6 })]);
  });

  it('gives a score and today accuracy from a handful of games', () => {
    const summary = summarizeActivity(
      [row(), row({ gameType: 'frog_leap', correctRounds: 2, totalRounds: 3 }), row({ gameType: 'path_match', correctRounds: 5, totalRounds: 5 })],
      '2026-09-14',
    );
    expect(summary.score).not.toBeNull();
    expect(summary.score!.enoughData).toBe(false);
    expect(summary.accuracyToday).toBe(83); // 10 of 12
    expect(summary.daysPlayedThisWeek).toBe(1);
  });

  it('reports today as not played (null), not 0%', () => {
    expect(summarizeActivity([row({ date: '2026-09-13' })], '2026-09-14').accuracyToday).toBeNull();
  });
});

describe('date formatting', () => {
  it('formats days and times without ISO strings or seconds', () => {
    expect(formatShortDate('2026-09-12')).toBe('12 Sep');
    expect(formatDayDate('2026-09-14T10:00:00Z')).toBe('Mon 14 Sep');
    expect(formatTimeOfDay('16:00:00')).toBe('4 pm');
    expect(formatTimeOfDay('08:30')).toBe('8:30 am');
    expect(formatTimeOfDay('00:00')).toBe('12 am');
    expect(formatTimeOfDay('12:00')).toBe('12 pm');
  });
});

const adherenceMock = vi.fn();
vi.mock('@/hooks/useReminderAdherence', () => ({ useReminderAdherence: () => adherenceMock() }));

describe('RemindersTab', () => {
  it('groups missed reminders by name with a count and a readable last time', async () => {
    const missed = [
      ...['2026-09-12', '2026-09-13', '2026-09-14'].flatMap((date) =>
        ['08:00', '12:00', '16:00'].map((time) => ({ date, time, label: 'Drink water' })),
      ),
      { date: '2026-09-13', time: '08:00', label: 'Morning medication' },
    ];
    adherenceMock.mockReturnValue({
      isLoading: false,
      overallPct: 10,
      byType: { hydration: { acked: 1, total: 10 }, medication: { acked: 0, total: 1 }, activity: { acked: 0, total: 0 } },
      missed,
    });
    const { default: RemindersTab } = await import('@/components/caregiver/RemindersTab');
    render(<RemindersTab patientId="p1" />);

    expect(screen.getByText('1 of 11 marked done')).toBeInTheDocument();
    expect(screen.queryByText('Activity')).not.toBeInTheDocument();
    const groups = screen.getAllByTestId('missed-group');
    expect(groups).toHaveLength(2);
    expect(within(groups[0]).getByText('Drink water')).toBeInTheDocument();
    expect(within(groups[0]).getByText('9 times')).toBeInTheDocument();
    expect(within(groups[0]).getByText('Last on Mon 14 Sep, 4 pm')).toBeInTheDocument();
    expect(within(groups[1]).getByText('Once')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('shows five groups, then all on request', async () => {
    adherenceMock.mockReturnValue({
      isLoading: false,
      overallPct: 0,
      byType: { medication: { acked: 0, total: 7 } },
      missed: Array.from({ length: 7 }, (_, i) => ({ date: '2026-09-14', time: `0${i}:00`, label: `Pill ${i}` })),
    });
    const { default: RemindersTab } = await import('@/components/caregiver/RemindersTab');
    render(<RemindersTab patientId="p1" />);
    expect(screen.getAllByTestId('missed-group')).toHaveLength(5);
    expect(screen.getByText(/can only appear while SMRITI is open/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all 7' }));
    expect(screen.getAllByTestId('missed-group')).toHaveLength(7);
  });
});

describe('Overview card', () => {
  beforeEach(async () => {
    const { db } = await import('@/lib/db/schema');
    await db.dailySummaries.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('counts games played on this phone that the server does not have yet', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-14T10:00:00Z'));
    const { db } = await import('@/lib/db/schema');
    await db.dailySummaries.bulkPut(
      ['quick_tap', 'frog_leap', 'path_match', 'memory_match'].map((gameType, i) => ({
        id: `s${i}`,
        patientId: 'p1',
        summaryDate: '2026-09-14',
        gameType,
        totalRounds: 4,
        correctRounds: 3,
        avgResponseTimeMs: 900,
        maxDifficultyReached: 2,
        sessionCount: 1,
        eloRating: 0,
        synced: false,
      })),
    );
    vi.doMock('@/lib/api/client', () => ({
      authedFetch: vi.fn().mockResolvedValue({
        patients: [
          {
            id: 'p1',
            displayName: 'Jalaja Utekar',
            ageYears: 56,
            primaryLanguage: 'hi',
            alertStatus: 'yellow',
            accuracyToday: null,
            sessionsThisWeek: 0,
            cognitiveScore: null,
            week: [null, null, null, null, null, null, null],
            scoreRows: [],
          },
        ],
      }),
    }));
    vi.doMock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/caregiver/dashboard' }));
    vi.doMock('@/components/ui/SyncStatus', () => ({ default: () => null }));
    const { default: Dashboard } = await import('@/app/caregiver/dashboard/page');
    render(<Dashboard />);

    expect(await screen.findByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Early estimate')).toBeInTheDocument();
    expect(screen.getByText('1 of 7 days')).toBeInTheDocument();
    expect(screen.queryByText('No games yet')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

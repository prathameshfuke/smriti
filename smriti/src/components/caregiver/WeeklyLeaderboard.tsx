'use client';

import { useEffect, useState } from 'react';
import Panel from '@/components/ui/Panel';
import Skeleton from '@/components/ui/Skeleton';
import { authedFetch } from '@/lib/api/client';

export interface LeaderboardEntry {
  rank: number;
  patientId: string;
  displayName: string;
  points: number;
  gamesPlayed: number;
}

const RANK_MARKER: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The ranked rows on their own, so the list can be rendered and tested
 * without the network fetch.
 *
 * Medals only go to people who actually scored this week: with nobody
 * playing, handing out gold, silver and bronze for 0 points reads as a
 * result that isn't there.
 */
export function LeaderboardList({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return <p className="px-5 pb-5 text-caregiver-body text-ink-muted">No patients yet.</p>;
  }

  const anyoneScored = entries.some((e) => e.points > 0);

  return (
    <>
      {!anyoneScored ? (
        <p className="px-5 pb-3 text-patient-sm text-ink-muted">No games played in the last 7 days yet.</p>
      ) : null}
      <ol className="divide-y divide-line200 border-t border-line200">
        {entries.map((entry) => {
          const medal = entry.points > 0 ? RANK_MARKER[entry.rank] : undefined;
          return (
            <li key={entry.patientId} className="flex items-center gap-3 px-5 py-3">
              <span
                aria-hidden="true"
                className="w-9 shrink-0 text-center text-[1.25rem] font-bold tabular-nums text-ink-muted"
              >
                {medal ?? entry.rank}
              </span>
              {/* Names wrap instead of truncating, and the totals drop under
                  the name on narrow screens, so neither gets squeezed out at
                  larger text sizes. */}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
                <span className="min-w-0 break-words text-caregiver-body font-bold text-ink sm:flex-1">
                  <span className="sr-only">Rank {entry.rank}: </span>
                  {entry.displayName}
                </span>
                <span className="text-patient-sm tabular-nums text-ink-muted sm:shrink-0 sm:text-caregiver-body">
                  {plural(entry.points, 'point', 'points')} · {plural(entry.gamesPlayed, 'game', 'games')}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * Caregiver-only weekly points leaderboard, scoped to this caregiver's own
 * patients — never shown to patients, never spans other caregivers. Built
 * for old-age-home staff tracking their own residents' engagement, not a
 * clinical measure. Points are correct answers across every game this week,
 * not a per-game score — see api/patients/leaderboard.
 */
export default function WeeklyLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      authedFetch<{ leaderboard: LeaderboardEntry[] }>('/api/patients/leaderboard')
        // A body without the list is treated like a failed request, so the
        // panel hides instead of crashing the Patients page.
        .then((body) => (Array.isArray(body?.leaderboard) ? setEntries(body.leaderboard) : setError(true)))
        .catch(() => setError(true));
    });
  }, []);

  if (error) return null; // Quiet failure: the patient list below still loads on its own.

  return (
    <Panel
      title="This week's leaderboard"
      description="Points are correct answers across all games in the last 7 days."
      className="mb-6"
      flush
    >
      {entries === null ? (
        <div className="flex flex-col gap-2 px-5 pb-5" aria-busy="true">
          <Skeleton height={48} />
          <Skeleton height={48} />
        </div>
      ) : (
        <LeaderboardList entries={entries} />
      )}
    </Panel>
  );
}

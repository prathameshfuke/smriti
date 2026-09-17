'use client';

import { useEffect, useState } from 'react';
import Panel from '@/components/ui/Panel';
import Skeleton from '@/components/ui/Skeleton';
import { authedFetch } from '@/lib/api/client';

interface LeaderboardEntry {
  rank: number;
  patientId: string;
  displayName: string;
  points: number;
  gamesPlayed: number;
}

const RANK_MARKER: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

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

  const load = () => {
    setError(false);
    setEntries(null);
    authedFetch<{ leaderboard: LeaderboardEntry[] }>('/api/patients/leaderboard')
      .then((body) => setEntries(body.leaderboard))
      .catch(() => setError(true));
  };

  useEffect(() => {
    queueMicrotask(load);
  }, []);

  if (error) return null; // Quiet failure: the patient list below still loads on its own.

  return (
    <Panel title="This week's leaderboard" description="Points and games played over the last 7 days." className="mb-6">
      <div className="px-5 pb-5">
        {entries === null ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
        ) : null}

        {entries && entries.length === 0 ? (
          <p className="text-caregiver-body text-ink-muted">No patients yet.</p>
        ) : null}

        {entries && entries.length > 0 ? (
          <ul className="divide-y divide-line200">
            {entries.map((entry) => (
              <li key={entry.patientId} className="flex items-center gap-3 py-3">
                <span className="w-8 shrink-0 text-center text-[1.25rem]" aria-hidden="true">
                  {RANK_MARKER[entry.rank] ?? `#${entry.rank}`}
                </span>
                <span className="min-w-0 flex-1 truncate text-caregiver-body font-bold text-ink">
                  {entry.displayName}
                </span>
                <span className="shrink-0 text-caregiver-body text-ink-muted">
                  {entry.points} pts · {entry.gamesPlayed} games
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}

'use client';

import { useMemo } from 'react';
import Skeleton from '@/components/ui/Skeleton';
import { aggregateByGame } from '@/lib/dashboard/gameBreakdown';
import { formatShortDate } from '@/lib/dashboard/formatDate';
import type { TrendPoint } from '@/lib/dashboard/trend';

export interface GameBreakdownChartProps {
  points: TrendPoint[];
  isLoading?: boolean;
  /** Height of the loading placeholder. */
  height?: number;
}

/**
 * Per-game accuracy as a plain list of labelled bars. It replaced a Recharts
 * bar chart that printed raw values such as 66.66666666666667, cut long game
 * names off, and drew nothing at all for a game played at 0%. Here every
 * number is rounded, names wrap, and each row states its value in words, so
 * no separate screen-reader table is needed.
 */
export default function GameBreakdownChart({ points, isLoading = false, height = 240 }: GameBreakdownChartProps) {
  const rows = useMemo(
    () => aggregateByGame(points).sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed) || a.label.localeCompare(b.label)),
    [points],
  );

  if (isLoading) return <Skeleton height={height} />;

  if (rows.length === 0) {
    return <p className="text-caregiver-body text-ink-muted">No sessions recorded yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-4" aria-label="Accuracy by game">
      {rows.map((r) => {
        const pct = Math.round(r.accuracy);
        return (
          <li key={r.gameType} data-testid="game-breakdown-row" className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-caregiver-body font-bold text-ink">{r.label}</span>
              <span className="shrink-0 text-caregiver-body font-bold tabular-nums text-ink">{pct}%</span>
            </div>
            <div aria-hidden="true" className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-patient-sm text-ink-muted">
              {r.maxLevel > 1 ? `Level ${r.maxDifficultyReached} of ${r.maxLevel}. ` : ''}
              Last played {formatShortDate(r.lastPlayed)}.
            </p>
          </li>
        );
      })}
    </ul>
  );
}

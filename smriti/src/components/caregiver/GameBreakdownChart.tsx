'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Skeleton from '@/components/ui/Skeleton';
import { aggregateByGame, type GameBreakdownRow } from '@/lib/dashboard/gameBreakdown';
import type { TrendPoint } from '@/lib/dashboard/trend';

export interface GameBreakdownChartProps {
  points: TrendPoint[];
  isLoading?: boolean;
  height?: number;
}

const BAR_COLOR = '#B3452D';
const GRID_COLOR = '#D8D2CB'; // line200
const AXIS_TICK_COLOR = '#4B4541'; // ink-muted
const TOOLTIP_BORDER_COLOR = '#D8D2CB'; // line200
const ROW_HEIGHT_PX = 32;

/**
 * Per-game accuracy, `layout="vertical"` (horizontal bars) so all 15 game
 * labels stay readable on a phone. Presentational only, same no-fetching
 * rationale as CognitiveTrendChart — `points` is the identical Dexie-backed
 * array `useCognitiveTrend` returns, aggregated per game instead of per day.
 */
export default function GameBreakdownChart({ points, isLoading = false, height = 360 }: GameBreakdownChartProps) {
  const rows = useMemo(() => aggregateByGame(points), [points]);

  if (isLoading) return <Skeleton height={height} />;

  if (rows.length === 0) {
    return <p className="text-caregiver-body text-ink-muted">No sessions recorded yet.</p>;
  }

  const accuracies = rows.map((r) => r.accuracy);
  const ariaLabel =
    `Bar chart of accuracy by game across ${rows.length} game${rows.length === 1 ? '' : 's'} played, ` +
    `ranging from ${Math.round(Math.min(...accuracies))}% to ${Math.round(Math.max(...accuracies))}%`;
  const chartHeight = Math.max(height, rows.length * ROW_HEIGHT_PX + 40);

  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-col gap-2">
      <div aria-hidden="true" style={{ height: chartHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 72, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: AXIS_TICK_COLOR }} tickLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              width={120}
              tick={{ fontSize: 12, fill: AXIS_TICK_COLOR }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#FFFFFF',
                border: `1px solid ${TOOLTIP_BORDER_COLOR}`,
                borderRadius: 12,
              }}
              formatter={(v) => [`${Math.round(Number(v))}%`, 'Accuracy']}
            />
            <Bar dataKey="accuracy" name="accuracy" fill={BAR_COLOR} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList
                dataKey="accuracy"
                position="right"
                style={{ fill: AXIS_TICK_COLOR, fontSize: 11 }}
                valueAccessor={(entry) => {
                  const row = entry.payload as GameBreakdownRow;
                  return `Lvl ${row.maxDifficultyReached}/${row.maxLevel}`;
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Accessible equivalent — see CognitiveTrendChart for why. */}
      <table className="sr-only">
        <caption>Per-game accuracy and difficulty level</caption>
        <thead>
          <tr>
            <th scope="col">Game</th>
            <th scope="col">Accuracy</th>
            <th scope="col">Level</th>
            <th scope="col">Last played</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.gameType}>
              <td>{r.label}</td>
              <td>{Math.round(r.accuracy)}%</td>
              <td>
                {r.maxDifficultyReached} / {r.maxLevel}
              </td>
              <td>{r.lastPlayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

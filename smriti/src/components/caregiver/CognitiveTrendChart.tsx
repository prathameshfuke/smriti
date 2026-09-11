'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Skeleton from '@/components/ui/Skeleton';
import {
  aggregateDailyBlended,
  findAccuracyDrops,
  getTrendState,
  type TrendPoint,
} from '@/lib/dashboard/trend';

export type TrendRangeOption = '30d' | '90d' | '180d';

export interface CognitiveTrendChartProps {
  points: TrendPoint[];
  sessionDays: number;
  range: TrendRangeOption;
  onRangeChange: (r: TrendRangeOption) => void;
  minSessionsForTrend?: number;
  height?: number;
  isLoading?: boolean;
}

const RANGES: TrendRangeOption[] = ['30d', '90d', '180d'];

/** Literal hex, not Tailwind classes — recharts renders raw SVG presentation
 * attributes, which do not resolve Tailwind's utility classes. Values match
 * tailwind.config.ts exactly (see the caregiver-dashboard report for the
 * full token mapping). */
const ACCURACY_LINE_COLOR = '#B3452D';
const GRID_COLOR = '#D8D2CB'; // line200
const AXIS_TICK_COLOR = '#4B4541'; // ink-muted
const TOOLTIP_BORDER_COLOR = '#D8D2CB'; // line200

const DROP_THRESHOLD_PCT = 15;

function dotColorClass(accuracy: number): string {
  if (accuracy > 75) return 'bg-success';
  if (accuracy >= 50) return 'bg-warning';
  return 'bg-danger';
}

/**
 * Blended-accuracy cognitive trend line. Presentational only — no fetching.
 * `useCognitiveTrend` (Dexie-backed, no network call) is the data source
 * wired up today; because everything here arrives as props, a server-backed
 * source could be swapped in later (see that hook's cross-device caveat)
 * without touching this file.
 *
 * Renders one of 4 states: a loading skeleton, an empty-history message, a
 * low-data session list (below `minSessionsForTrend`, no line drawn so a
 * 1-2 point blip is never mistaken for a trend), or the full line chart.
 */
export default function CognitiveTrendChart({
  points,
  sessionDays,
  range,
  onRangeChange,
  minSessionsForTrend = 5,
  height = 240,
  isLoading = false,
}: CognitiveTrendChartProps) {
  const daily = useMemo(() => aggregateDailyBlended(points), [points]);
  const state = getTrendState(sessionDays, minSessionsForTrend);
  const drops = useMemo(() => (state === 'trend' ? findAccuracyDrops(daily) : []), [state, daily]);

  const tabs = (
    <div role="group" aria-label="Timeline range" className="flex gap-2">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onRangeChange(r)}
          aria-pressed={range === r}
          className={
            'rounded-card px-3 py-2 text-caregiver-body font-semibold transition-colors ' +
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ' +
            (range === r
              ? 'bg-primary text-ink-inverse'
              : 'bg-surface-muted text-ink hover:bg-game-active')
          }
        >
          {r}
        </button>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {tabs}
        <Skeleton height={height} />
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="flex flex-col gap-3">
        {tabs}
        <p className="text-caregiver-body text-ink-muted">No sessions recorded yet.</p>
      </div>
    );
  }

  if (state === 'low-data') {
    return (
      <div className="flex flex-col gap-3">
        {tabs}
        <p className="text-patient-sm text-ink-muted">
          {sessionDays} session{sessionDays === 1 ? '' : 's'} so far — a trend needs about{' '}
          {minSessionsForTrend}. Showing each session instead.
        </p>
        <ul className="flex flex-col gap-2">
          {daily.map((d) => (
            <li key={d.date} className="flex items-center gap-3">
              <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${dotColorClass(d.accuracy)}`} />
              <span className="text-patient-sm text-ink">
                {d.date} — {Math.round(d.accuracy)}% accuracy
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const accuracies = daily.map((d) => d.accuracy);
  const ariaLabel =
    `Line chart of blended daily accuracy from ${daily[0].date} to ${daily[daily.length - 1].date}, ` +
    `ranging from ${Math.round(Math.min(...accuracies))}% to ${Math.round(Math.max(...accuracies))}%`;

  return (
    <div className="flex flex-col gap-3">
      {tabs}

      {drops.length > 0 ? (
        <p className="flex items-center gap-2 text-caregiver-body text-danger">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full bg-danger" />
          {drops.length === 1
            ? `${Math.round(drops[0].delta)} point drop on ${drops[0].date}`
            : `${drops.length} accuracy drops over ${DROP_THRESHOLD_PCT} points in this range`}
        </p>
      ) : null}

      <div role="img" aria-label={ariaLabel} className="flex flex-col gap-2">
        <div aria-hidden="true" style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: AXIS_TICK_COLOR }} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: AXIS_TICK_COLOR }}
                tickLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: '#FFFFFF',
                  border: `1px solid ${TOOLTIP_BORDER_COLOR}`,
                  borderRadius: 12,
                }}
                formatter={(v) => [`${Math.round(Number(v))}%`, 'Accuracy']}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                name="accuracy"
                stroke={ACCURACY_LINE_COLOR}
                strokeWidth={2}
                connectNulls
                isAnimationActive={false}
                dot={{ r: 3, fill: ACCURACY_LINE_COLOR }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Accessible equivalent: recharts' <svg> has no role/name and its
            tooltip is pointer-only, so the actual data is also available as
            a plain table for assistive tech, extending ScoreGraph's
            text-first drop-callout above rather than relying on the chart. */}
        <table className="sr-only">
          <caption>{`Daily blended accuracy, last ${range}`}</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{Math.round(d.accuracy)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ScorePoint {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  accuracy: number;
}

export interface ScoreGraphProps {
  data: ScorePoint[];
  height?: number;
}

/**
 * Cognitive velocity over time for the caregiver dashboard. Accuracy is
 * pinned to a 0-100 domain so a run of good days cannot rescale the axis and
 * visually flatten a real decline.
 */
export default function ScoreGraph({ data, height = 240 }: ScoreGraphProps) {
  if (data.length === 0) {
    return (
      <p className="text-caregiver-body text-ink-muted">
        No sessions recorded yet.
      </p>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE6" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B6560' }} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: '#6B6560' }}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid #F0EDE6',
              borderRadius: 12,
            }}
            formatter={(v) => [`${Number(v)}%`, 'Accuracy']}
          />
          <Line
            type="monotone"
            dataKey="accuracy"
            stroke="#8B6914"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

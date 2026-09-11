'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { GAME_LABELS } from '@/lib/dashboard/gameLabels';
import type { GameType } from '@/lib/supabase/types';

/**
 * Re-exported so existing importers (`app/caregiver/patients/[id]/page.tsx`
 * historically imported this as `ScoreGameType`) keep working. This used to
 * be its OWN narrower union (`word_recall`/`path_trace`, no
 * `reminiscence_quiz`) — one of 3 copies of a canonical<->narrower game-type
 * mapping that existed only to feed this component (the others were
 * page.tsx's `SCORE_GAME_FOR` and the timeline API route's `GAME_TYPE_MAP`,
 * both now deleted). Now a plain alias of the canonical union, so there is
 * nothing left to translate.
 */
export type { GameType };

export interface ScorePoint {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  accuracy: number;
  gameType: GameType;
}

export interface ScoreGraphProps {
  data: ScorePoint[];
  height?: number;
}

/**
 * One colour per game, so a caregiver can tell the lines apart. Values are
 * intentionally NOT all design tokens — tailwind.config.ts's palette is a
 * small brand palette, not a 15-hue qualitative data scale — except
 * `frog_leap` and `memory_match`, which used to be leftover hex values from
 * the app's retired cyan palette (`#059669`, `#0E7490`) rather than anything
 * ever defined in the current config; those two now point at real tokens
 * (`terra700`, `navy`).
 */
const GAME_COLOR: Record<GameType, string> = {
  object_hunt: '#8B6914', // muga-dark
  word_stream: '#2E7D32',
  path_match: '#1565C0',
  quick_tap: '#6A1B9A',
  memory_match: '#151312', // navy
  memory_blocks: '#BE3A34', // gamosa
  frog_leap: '#933A27', // terra700 / primary.dark
  counting_boxes: '#C2410C',
  n_back: '#7C3AED',
  larger_number: '#0284C7',
  memory_span: '#BE185D',
  fish_trace: '#0D9488',
  double_decision: '#B45309',
  reminiscence_quiz: '#E7B2A2', // rose100
  routine_recall: '#65A30D',
};

/** Shared with the per-game breakdown chart and the page — see gameLabels.ts. */
const GAME_LABEL = GAME_LABELS;

const RANGES = [
  { id: '7d', days: 7 },
  { id: '30d', days: 30 },
  { id: '90d', days: 90 },
] as const;

/** A fall this steep is the clinical signal the dashboard exists to surface. */
const DROP_THRESHOLD_PCT = 15;

interface Drop {
  date: string;
  gameType: GameType;
  delta: number;
}

function findDrops(points: ScorePoint[]): Drop[] {
  const drops: Drop[] = [];
  const byGame = new Map<GameType, ScorePoint[]>();
  for (const p of points) {
    byGame.set(p.gameType, [...(byGame.get(p.gameType) ?? []), p]);
  }
  for (const [gameType, series] of byGame) {
    const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < sorted.length; i += 1) {
      const delta = sorted[i - 1].accuracy - sorted[i].accuracy;
      if (delta > DROP_THRESHOLD_PCT) {
        drops.push({ date: sorted[i].date, gameType, delta });
      }
    }
  }
  return drops;
}

/**
 * Cognitive velocity over time. Accuracy is pinned to a 0-100 domain so a run
 * of good days cannot rescale the axis and visually flatten a real decline,
 * and any drop steeper than 15 points is called out in words as well as with
 * a red dot — a caregiver scanning on a phone should not have to read slopes.
 */
export default function ScoreGraph({ data, height = 240 }: ScoreGraphProps) {
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('30d');

  const windowed = useMemo(() => {
    if (data.length === 0) return [];
    const latest = data.reduce((max, p) => (p.date > max ? p.date : max), data[0].date);
    const days = RANGES.find((r) => r.id === range)?.days ?? 30;
    const cutoff = new Date(`${latest}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
    const from = cutoff.toISOString().slice(0, 10);
    return data.filter((p) => p.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, range]);

  const games = useMemo(
    () => [...new Set(windowed.map((p) => p.gameType))],
    [windowed],
  );

  const drops = useMemo(() => findDrops(windowed), [windowed]);
  const dropDates = new Set(drops.map((d) => `${d.gameType}:${d.date}`));

  const rows = useMemo(() => {
    const byDate = new Map<string, Record<string, string | number>>();
    for (const p of windowed) {
      const row = byDate.get(p.date) ?? { date: p.date };
      row[p.gameType] = p.accuracy;
      byDate.set(p.date, row);
    }
    return [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [windowed]);

  const tabs = (
    <div role="group" aria-label="Time range" className="flex gap-2">
      {RANGES.map(({ id }) => (
        <button
          key={id}
          type="button"
          onClick={() => setRange(id)}
          aria-pressed={range === id}
          className={
            'rounded-card px-3 py-2 text-caregiver-body transition-colors ' +
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ' +
            (range === id
              ? 'bg-primary text-ink-inverse'
              : 'bg-surface-muted text-ink hover:bg-game-active')
          }
        >
          {id}
        </button>
      ))}
    </div>
  );

  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {tabs}
        <p className="text-caregiver-body text-ink-muted">No sessions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tabs}

      {drops.length > 0 ? (
        <p className="flex items-center gap-2 text-caregiver-body text-danger">
          <span aria-hidden="true" className="h-3 w-3 rounded-full bg-danger" />
          {drops.length === 1
            ? `${Math.round(drops[0].delta)} point drop in ${GAME_LABEL[drops[0].gameType]} on ${drops[0].date}`
            : `${drops.length} accuracy drops over ${DROP_THRESHOLD_PCT} points in this range`}
        </p>
      ) : null}

      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            {/* Literal hex, not Tailwind classes: recharts renders raw SVG
                presentation attributes. line200 (#D8D2CB) and ink-muted
                (#4B4541) — this used to be non-token #F0EDE6 / #6B6560. */}
            <CartesianGrid strokeDasharray="3 3" stroke="#D8D2CB" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#4B4541' }} tickLine={false} />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: '#4B4541' }}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: '#FFFFFF',
                border: '1px solid #D8D2CB',
                borderRadius: 12,
              }}
              formatter={(v, name) => [`${Number(v)}%`, GAME_LABEL[name as GameType] ?? name]}
            />
            {games.map((game) => (
              <Line
                key={game}
                type="monotone"
                dataKey={game}
                name={game}
                stroke={GAME_COLOR[game]}
                strokeWidth={2}
                connectNulls
                isAnimationActive={false}
                dot={(props) => {
                  const { cx, cy, payload, index } = props as {
                    cx: number;
                    cy: number;
                    payload: { date: string };
                    index: number;
                  };
                  const flagged = dropDates.has(`${game}:${payload.date}`);
                  return (
                    <circle
                      key={`${game}-${index}`}
                      cx={cx}
                      cy={cy}
                      r={flagged ? 6 : 3}
                      fill={flagged ? '#B71C1C' : GAME_COLOR[game]}
                    />
                  );
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

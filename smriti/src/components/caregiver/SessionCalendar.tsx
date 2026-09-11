'use client';

import { useMemo, useState } from 'react';
import { aggregateDailyBlended } from '@/lib/dashboard/trend';
import type { TrendPoint } from '@/lib/dashboard/trend';
import { GAME_LABELS } from '@/lib/dashboard/gameLabels';
import type { GameType } from '@/lib/supabase/types';

export interface SessionCalendarProps {
  /** Calendar year to render, e.g. 2026. */
  year: number;
  /** 0-indexed month, matching `Date#getMonth()` (0 = January). */
  month: number;
  points: TrendPoint[];
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Month calendar with a colour-coded accuracy dot per day, extracted from
 * the caregiver patient-detail page's "history" tab (previously inline
 * markup on that page). Not a recharts job — a CSS grid of day buttons is
 * both simpler and more legible here than a chart would be.
 *
 * Each day button is sized to this app's 48px `touch-min` token
 * (tailwind.config.ts) — the original inline markup used a fixed 40x40px,
 * below that minimum.
 */
export default function SessionCalendar({ year, month, points }: SessionCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const accuracyByDate = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const inMonth = points.filter((p) => p.date.startsWith(monthPrefix));
    // Blended per day (rounds-weighted, see lib/dashboard/trend.ts) rather
    // than "whichever game's row happened to be read last" — the original
    // inline version overwrote one game's accuracy with another's when a
    // patient played more than one game on the same day.
    return new Map(aggregateDailyBlended(inMonth).map((d) => [d.date, d.accuracy]));
  }, [points, year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const selectedDaySessions = useMemo(
    () => (selectedDay ? points.filter((p) => p.date === selectedDay) : []),
    [points, selectedDay],
  );

  return (
    <div className="rounded-card border border-line200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((d, i) => (
          <span key={i} className="text-patient-sm text-ink-muted">
            {d}
          </span>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`pad-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const accuracy = accuracyByDate.get(dateStr);
          const hasData = accuracy !== undefined;
          const dotColor =
            accuracy === undefined
              ? undefined
              : accuracy > 75
                ? 'bg-success'
                : accuracy >= 50
                  ? 'bg-warning'
                  : 'bg-danger';
          return (
            <button
              key={dateStr}
              type="button"
              data-testid="calendar-day"
              onClick={() => hasData && setSelectedDay(dateStr)}
              style={{ height: 48, width: 48 }}
              className="mx-auto flex flex-col items-center justify-center"
            >
              <span className={hasData ? 'text-ink' : 'text-ink-muted'}>{day}</span>
              {dotColor ? (
                <span aria-hidden="true" style={{ height: 12, width: 12 }} className={`rounded-full ${dotColor}`} />
              ) : null}
            </button>
          );
        })}
      </div>

      {selectedDay ? (
        <div
          className="fixed inset-x-0 bottom-16 z-40 rounded-t-tile bg-surface-card p-4 shadow-2xl transition-transform duration-300 md:bottom-4 md:mx-auto md:max-w-md md:rounded-tile"
          role="dialog"
          aria-label={`Details for ${selectedDay}`}
        >
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            className="mb-2 text-caregiver-body text-ink-muted"
          >
            Close
          </button>
          <p className="font-bold text-ink">{selectedDay}</p>
          {selectedDaySessions.map((p, i) => (
            <p key={i} className="text-caregiver-body text-ink">
              {GAME_LABELS[p.gameType as GameType] ?? p.gameType}: {Math.round(p.accuracy)}%
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

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
    <div className="rounded-card border border-line200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-serif-display text-[1.375rem] font-medium leading-tight text-ink">
          {new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </h2>
        <ul aria-label="Day colours" className="flex flex-wrap gap-x-4 gap-y-1 text-patient-sm text-ink-muted">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-3 rounded-full bg-success" />
            Above 75%
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-3 rounded-full bg-warning" />
            50 to 75%
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-3 rounded-full bg-danger" />
            Below 50%
          </li>
        </ul>
      </div>
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
              style={{ height: 48 }}
              aria-label={hasData ? `${dateStr}, ${Math.round(accuracy)}% accuracy` : undefined}
              disabled={!hasData}
              className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-control enabled:hover:bg-surface-muted disabled:cursor-default"
            >
              <span className={hasData ? 'font-bold text-ink' : 'text-ink-muted'}>{day}</span>
              {dotColor ? (
                <span aria-hidden="true" style={{ height: 12, width: 12 }} className={`rounded-full ${dotColor}`} />
              ) : null}
            </button>
          );
        })}
      </div>

      {selectedDay ? (
        <div
          className="fixed inset-x-0 bottom-(--caregiver-nav-h) z-40 rounded-t-card border border-line200 bg-surface-card p-5 shadow-2xl md:bottom-4 md:mx-auto md:max-w-md md:rounded-card"
          role="dialog"
          aria-label={`Details for ${selectedDay}`}
        >
          <div className="mb-2 flex items-center justify-between gap-4">
            <p className="text-caregiver-body font-bold text-ink">{selectedDay}</p>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="min-h-touch-min rounded-control px-3 text-caregiver-body font-bold text-primary-dark underline decoration-primary/40 underline-offset-4"
            >
              Close
            </button>
          </div>
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

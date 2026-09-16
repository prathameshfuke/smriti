export interface WeekActivityProps {
  /** Seven days, oldest first: accuracy 0-100, or null for a day not played. */
  days: Array<number | null>;
  /** ISO dates matching `days`; used for weekday labels and the text summary. */
  dates?: string[];
  variant?: 'mini' | 'full';
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekday(iso: string): string {
  return WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

/**
 * Last seven days at a glance: one bar per day, its height the day's
 * accuracy, a short grey stub for a day with no games. `mini` is the inline
 * sparkline in the patient list; `full` adds weekday labels and values.
 * Today (the last bar) is the darker terracotta. A plain-text summary is
 * always present for screen readers.
 */
export default function WeekActivity({ days, dates, variant = 'mini' }: WeekActivityProps) {
  const played = days.filter((d): d is number => d !== null);
  const summary =
    played.length === 0
      ? 'No games played in the last 7 days'
      : `Played on ${played.length} of the last 7 days, average accuracy ${Math.round(
          played.reduce((a, b) => a + b, 0) / played.length,
        )}%`;

  if (variant === 'mini') {
    return (
      <span role="img" aria-label={summary} className="flex h-7 items-end gap-[3px]">
        {days.map((d, i) => (
          <span
            key={i}
            className={
              'w-[7px] rounded-[2px] ' +
              (d === null ? 'h-[3px] bg-line200' : i === days.length - 1 ? 'bg-primary-dark' : 'bg-primary')
            }
            style={d === null ? undefined : { height: `${Math.max(12, d)}%` }}
          />
        ))}
      </span>
    );
  }

  // Full "Mon"/"Today" labels need about 2 characters' width per column. On
  // a narrow panel — a 320px phone, or Medium/Large text — seven of them no
  // longer fit and ran into each other, so below 17rem (rem, so the threshold
  // scales with the text size) the row switches to one-letter labels.
  return (
    <figure className="@container">
      <div role="img" aria-label={summary} className="grid h-36 grid-cols-7 items-end gap-2">
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          return (
            <div key={i} className="flex h-full flex-col items-center justify-end gap-1.5">
              <span aria-hidden="true" className="text-patient-sm font-bold tabular-nums text-ink">
                {d === null ? '' : Math.round(d)}
              </span>
              <span
                aria-hidden="true"
                className={
                  'w-full max-w-10 rounded-t-[6px] rounded-b-[2px] ' +
                  (d === null ? 'h-1 bg-line200' : isToday ? 'bg-primary-dark' : 'bg-primary')
                }
                style={d === null ? undefined : { height: `${Math.max(8, d * 0.8)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="mt-2 grid grid-cols-7 gap-2 border-t border-line200 pt-2 text-center">
        {days.map((_, i) => (
          <span
            key={i}
            className={`text-patient-sm ${i === days.length - 1 ? 'font-bold text-ink' : 'text-ink-muted'}`}
          >
            {dates || i === days.length - 1 ? (
              <>
                <span className="@min-[17rem]:hidden">{dates ? weekday(dates[i]).charAt(0) : 'T'}</span>
                <span className="hidden @min-[17rem]:inline">
                  {i === days.length - 1 ? 'Today' : dates ? weekday(dates[i]) : ''}
                </span>
              </>
            ) : null}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 text-patient-sm text-ink-muted">{summary}.</figcaption>
    </figure>
  );
}

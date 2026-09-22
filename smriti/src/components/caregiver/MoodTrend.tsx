export interface MoodTrendProps {
  /** Seven days, oldest first: the mood logged that day, or null if unanswered. */
  days: Array<'good' | 'okay' | 'low' | null>;
}

const DOT_CLASS: Record<'good' | 'okay' | 'low', string> = {
  good: 'bg-success',
  okay: 'bg-warning',
  low: 'bg-danger',
};

const LABEL: Record<'good' | 'okay' | 'low', string> = {
  good: 'Good',
  okay: 'Okay',
  low: 'Not so good',
};

/**
 * Last seven days of the patient's daily mood check-in, one colour-coded dot
 * per day — same "7 days, oldest first, today last" shape as WeekActivity,
 * simplified to a dot instead of a bar since mood is a 3-value pick, not a
 * percentage. An empty ring means the patient did not check in that day.
 */
export default function MoodTrend({ days }: MoodTrendProps) {
  const answered = days.filter((d): d is 'good' | 'okay' | 'low' => d !== null);
  const summary =
    answered.length === 0
      ? 'No mood check-ins in the last 7 days'
      : `Mood checked in on ${answered.length} of the last 7 days: ${answered.map((d) => LABEL[d]).join(', ')}`;

  return (
    <figure>
      <div role="img" aria-label={summary} className="grid grid-cols-7 gap-2">
        {days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span
              aria-hidden="true"
              className={
                'h-6 w-6 rounded-full ' +
                (d === null ? 'border-2 border-line200 bg-transparent' : DOT_CLASS[d]) +
                (i === days.length - 1 && d !== null ? ' ring-2 ring-offset-2 ring-ink-muted/40' : '')
              }
            />
          </div>
        ))}
      </div>
      <figcaption className="mt-3 text-patient-sm text-ink-muted">{summary}.</figcaption>
    </figure>
  );
}

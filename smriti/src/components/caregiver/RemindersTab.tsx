'use client';

import Skeleton from '@/components/ui/Skeleton';
import ScoreRing from '@/components/ui/ScoreRing';
import Panel from '@/components/ui/Panel';
import { useReminderAdherence } from '@/hooks/useReminderAdherence';
import type { ReminderType } from '@/lib/supabase/types';

const REMINDER_TYPES: ReminderType[] = ['medication', 'hydration', 'activity', 'appointment'];
const REMINDER_TYPE_LABEL: Record<ReminderType, string> = {
  medication: 'Medicine',
  hydration: 'Water',
  activity: 'Activity',
  appointment: 'Appointments',
};

export interface RemindersTabProps {
  patientId: string;
}

/** The week's reminder acknowledgement, by type, plus what was missed. */
export default function RemindersTab({ patientId }: RemindersTabProps) {
  const adherence = useReminderAdherence(patientId);

  if (adherence.isLoading) return <Skeleton height={120} />;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
      <section className="rounded-card border border-line200 bg-surface-card p-5">
        <div className="flex items-center gap-5">
          <ScoreRing value={adherence.overallPct} size="lg" label={`${adherence.overallPct}% of reminders acknowledged this week`}>
            {`${adherence.overallPct}%`}
          </ScoreRing>
          <p className="font-serif-display text-[1.5rem] font-medium leading-tight text-ink">
            {adherence.overallPct}% reminders acknowledged this week
          </p>
        </div>
        <ul className="mt-6 flex flex-col gap-4 border-t border-line200 pt-5">
          {REMINDER_TYPES.map((type) => {
            const stat = adherence.byType[type] ?? { acked: 0, total: 0 };
            const pct = stat.total > 0 ? (stat.acked / stat.total) * 100 : 0;
            return (
              <li key={type} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between text-caregiver-body">
                  <span className="font-bold text-ink">{REMINDER_TYPE_LABEL[type]}</span>
                  <span className="tabular-nums text-ink-muted">
                    {stat.acked} of {stat.total}
                  </span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
                  role="img"
                  aria-label={`${REMINDER_TYPE_LABEL[type]}: ${stat.acked} of ${stat.total} acknowledged`}
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <Panel title="Missed Reminders" flush>
        {adherence.missed.length === 0 ? (
          <p className="px-5 pb-5 text-caregiver-body text-ink-muted">None this week.</p>
        ) : (
          <ul className="divide-y divide-line200 border-t border-line200">
            {adherence.missed.map((m, i) => (
              <li key={i} className="flex flex-col px-5 py-3 text-caregiver-body sm:flex-row sm:justify-between sm:gap-4">
                <span className="font-bold text-ink">{m.label}</span>
                <span className="tabular-nums text-ink-muted">
                  {m.date} {m.time}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

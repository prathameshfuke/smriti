'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Skeleton from '@/components/ui/Skeleton';
import ScoreRing from '@/components/ui/ScoreRing';
import Panel, { buttonClass } from '@/components/ui/Panel';
import { useReminderAdherence } from '@/hooks/useReminderAdherence';
import { formatDayDate, formatTimeOfDay } from '@/lib/dashboard/formatDate';
import type { ReminderType } from '@/lib/supabase/types';
import { db } from '@/lib/db/schema';
import { isDatedAppointment } from '@/lib/engine/appointments';
import { localDateString } from '@/lib/engine/adherence';

const REMINDER_TYPES: ReminderType[] = ['medication', 'hydration', 'activity', 'appointment'];
const REMINDER_TYPE_LABEL: Record<ReminderType, string> = {
  medication: 'Medicine',
  hydration: 'Water',
  activity: 'Activity',
  appointment: 'Appointments',
};

const MISSED_PREVIEW = 5;

export interface RemindersTabProps {
  patientId: string;
}

interface MissedGroup {
  label: string;
  count: number;
  lastDate: string;
  lastTime: string;
}

/**
 * One row per reminder name, most recent first. The raw list had a row for
 * every single occurrence ("Drink water 2026-09-12 12:00:00" forty times),
 * which buried the one thing a caregiver needs: which reminders are being
 * skipped, and how often.
 */
function groupMissed(missed: Array<{ date: string; time: string; label: string }>): MissedGroup[] {
  const byLabel = new Map<string, MissedGroup>();
  for (const m of missed) {
    const g = byLabel.get(m.label);
    const stamp = `${m.date} ${m.time}`;
    if (!g) {
      byLabel.set(m.label, { label: m.label, count: 1, lastDate: m.date, lastTime: m.time });
    } else {
      g.count += 1;
      if (stamp > `${g.lastDate} ${g.lastTime}`) {
        g.lastDate = m.date;
        g.lastTime = m.time;
      }
    }
  }
  return [...byLabel.values()].sort((a, b) => `${b.lastDate} ${b.lastTime}`.localeCompare(`${a.lastDate} ${a.lastTime}`));
}

/**
 * Dated appointments from today on, soonest first, with everything the
 * caregiver typed in shown in full: this is for planning the trip, not a
 * count. Read from this phone's copy, like the adherence numbers beside it.
 */
export function UpcomingAppointments({ patientId }: RemindersTabProps) {
  const appointments = useLiveQuery(async () => {
    const today = localDateString();
    const rows = await db.reminderSchedules
      .where('patientId')
      .equals(patientId)
      .filter((s) => s.isActive && isDatedAppointment(s) && (s.appointmentDate as string) >= today)
      .toArray();
    return rows.sort((a, b) =>
      `${a.appointmentDate} ${a.timeOfDay}`.localeCompare(`${b.appointmentDate} ${b.timeOfDay}`),
    );
  }, [patientId]);

  if (!appointments || appointments.length === 0) return null;

  return (
    <Panel title="Upcoming appointments" flush>
      <ul className="divide-y divide-line200 border-t border-line200">
        {appointments.map((a) => {
          const details = [
            { heading: 'Where', text: a.facilityName },
            { heading: 'How to get there', text: a.locationNotes },
            { heading: 'What to bring', text: a.bringNotes },
          ].filter((d): d is { heading: string; text: string } => Boolean(d.text));
          const prompts = [
            a.remindDayBeforeTime ? `day before at ${formatTimeOfDay(a.remindDayBeforeTime)}` : null,
            a.remindDayOfTime ? `on the day at ${formatTimeOfDay(a.remindDayOfTime)}` : null,
          ].filter(Boolean);
          return (
            <li key={a.id} data-testid="upcoming-appointment" className="flex flex-col gap-2 px-5 py-4">
              <p className="text-caregiver-body font-bold text-ink">
                {formatDayDate(a.appointmentDate as string)}, {formatTimeOfDay(a.timeOfDay)}
              </p>
              <p className="break-words text-caregiver-body text-ink">{a.label}</p>
              {details.length > 0 ? (
                <dl className="flex flex-col gap-1.5">
                  {details.map((d) => (
                    <div key={d.heading}>
                      <dt className="text-patient-sm text-ink-muted">{d.heading}</dt>
                      <dd className="whitespace-pre-line break-words text-caregiver-body text-ink">{d.text}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <p className="text-patient-sm text-ink-muted">
                {prompts.length > 0 ? `Reminds ${prompts.join(' and ')}` : 'No reminder set'}
              </p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** The week's reminders: how many were marked done, by type, and which were not. */
export default function RemindersTab({ patientId }: RemindersTabProps) {
  const adherence = useReminderAdherence(patientId);
  const [showAll, setShowAll] = useState(false);
  const groups = useMemo(() => groupMissed(adherence.missed), [adherence.missed]);

  if (adherence.isLoading) return <Skeleton height={120} />;

  const types = REMINDER_TYPES.map((type) => ({ type, ...(adherence.byType[type] ?? { acked: 0, total: 0 }) })).filter(
    (t) => t.total > 0,
  );
  const acked = types.reduce((sum, t) => sum + t.acked, 0);
  const total = types.reduce((sum, t) => sum + t.total, 0);
  const visibleGroups = showAll ? groups : groups.slice(0, MISSED_PREVIEW);

  if (total === 0) {
    return (
      <div className="flex flex-col gap-5">
        <UpcomingAppointments patientId={patientId} />
        <Panel title="This week">
          <p className="text-caregiver-body text-ink-muted">No reminders were due this week.</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <UpcomingAppointments patientId={patientId} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="reminders-week-heading" className="flex flex-col gap-5 rounded-card border border-line200 bg-surface-card p-5">
          <div className="flex items-center gap-4">
            <ScoreRing value={adherence.overallPct} label={`${adherence.overallPct}% of reminders marked done this week`}>
              <span className="text-base font-bold">{adherence.overallPct}%</span>
            </ScoreRing>
            <div className="min-w-0">
              <h2 id="reminders-week-heading" className="font-serif-display text-[1.375rem] font-medium leading-tight text-ink">
                {acked} of {total} marked done
              </h2>
              <p className="text-patient-sm text-ink-muted">In the last 7 days</p>
            </div>
          </div>

          <ul className="flex flex-col gap-4 border-t border-line200 pt-5">
            {types.map(({ type, acked: typeAcked, total: typeTotal }) => {
              const pct = Math.round((typeAcked / typeTotal) * 100);
              return (
                <li key={type} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-caregiver-body">
                    <span className="font-bold text-ink">{REMINDER_TYPE_LABEL[type]}</span>
                    <span className="shrink-0 tabular-nums text-ink-muted">
                      {typeAcked} of {typeTotal}
                    </span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
                    role="img"
                    aria-label={`${REMINDER_TYPE_LABEL[type]}: ${typeAcked} of ${typeTotal} marked done`}
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>

          {acked === 0 ? (
            <p className="border-t border-line200 pt-4 text-patient-sm text-ink-muted">
              A reminder counts as done when it is tapped Done on the patient&apos;s phone. It can only appear while
              SMRITI is open, so a phone left closed shows reminders as not done.
            </p>
          ) : null}
        </section>

        <Panel title="Not marked done" description="Grouped by reminder, most recent first." flush>
          {groups.length === 0 ? (
            <p className="px-5 pb-5 text-caregiver-body text-ink-muted">Every reminder this week was marked done.</p>
          ) : (
            <>
              <ul className="divide-y divide-line200 border-t border-line200">
                {visibleGroups.map((g) => (
                  <li key={g.label} data-testid="missed-group" className="flex items-start justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="break-words text-caregiver-body font-bold text-ink">{g.label}</p>
                      <p className="text-patient-sm text-ink-muted">
                        Last on {formatDayDate(g.lastDate)}, {formatTimeOfDay(g.lastTime)}
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-caregiver-body tabular-nums text-ink">
                      {g.count === 1 ? 'Once' : `${g.count} times`}
                    </p>
                  </li>
                ))}
              </ul>
              {groups.length > MISSED_PREVIEW ? (
                <div className="border-t border-line200 px-5 py-4">
                  <button type="button" onClick={() => setShowAll((v) => !v)} className={`${buttonClass.secondary} w-full`}>
                    {showAll ? 'Show fewer' : `Show all ${groups.length}`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

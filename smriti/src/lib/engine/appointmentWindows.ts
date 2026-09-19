import type { LocalReminderSchedule } from '@/lib/db/schema';

/**
 * The timing half of appointment reminders: which prompt is due when.
 *
 * Split out of `appointments.ts` so the service worker bundle (built by
 * next-pwa's own webpack step, which has no `@/` alias) can import it. This
 * file therefore has no value imports, only relative ones and erased types.
 * `appointments.ts` re-exports everything here, so callers are unchanged.
 * The rules themselves are documented in `appointments.ts`.
 */

export type AppointmentOccurrenceKind = 'day_before' | 'day_of';

export interface AppointmentOccurrence {
  kind: AppointmentOccurrenceKind;
  /** Local calendar date the prompt belongs to, `YYYY-MM-DD`. */
  date: string;
  /** Local time the prompt first becomes due, `HH:MM`. */
  time: string;
}

/** The fields of a schedule that decide when an appointment prompt is due. */
export type AppointmentTiming = Pick<
  LocalReminderSchedule,
  'id' | 'reminderType' | 'timeOfDay' | 'isActive' | 'appointmentDate' | 'remindDayBeforeTime' | 'remindDayOfTime'
>;

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-10-01`, -1 → `2026-09-30`. Pure calendar arithmetic, no time zone involved. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** True for a dated appointment row. Older builds saved undated ones, which keep the weekday behaviour. */
export function isDatedAppointment(s: Pick<LocalReminderSchedule, 'reminderType' | 'appointmentDate'>): boolean {
  return s.reminderType === 'appointment' && Boolean(s.appointmentDate);
}

export function appointmentOccurrences(s: AppointmentTiming): AppointmentOccurrence[] {
  if (!isDatedAppointment(s)) return [];
  const date = s.appointmentDate as string;
  const occurrences: AppointmentOccurrence[] = [];
  if (s.remindDayBeforeTime) {
    occurrences.push({ kind: 'day_before', date: addDays(date, -1), time: s.remindDayBeforeTime.slice(0, 5) });
  }
  if (s.remindDayOfTime) {
    occurrences.push({ kind: 'day_of', date, time: s.remindDayOfTime.slice(0, 5) });
  }
  return occurrences;
}

/** Local `YYYY-MM-DD HH:MM` of the moment an occurrence stops being worth showing. */
export function occurrenceWindowEnd(s: Pick<AppointmentTiming, 'timeOfDay'>, o: AppointmentOccurrence): string {
  return o.kind === 'day_before' ? `${o.date} 24:00` : `${o.date} ${s.timeOfDay.slice(0, 5)}`;
}

function localStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The appointment prompt due at `now`, if any. `ackedKeys` holds
 * `reminderId:YYYY-MM-DD` for acknowledged occurrences, dated by the
 * occurrence (the ack's `scheduledAt`), not by when it was tapped.
 */
export function appointmentDueNow(
  s: AppointmentTiming,
  now: Date,
  ackedKeys: Set<string>,
): AppointmentOccurrence | null {
  if (!s.isActive || !isDatedAppointment(s)) return null;
  const stamp = localStamp(now);
  const appointmentAt = `${s.appointmentDate} ${s.timeOfDay.slice(0, 5)}`;
  if (stamp >= appointmentAt) return null;

  // Latest first: on the day, only the day-of prompt can be due.
  const due = appointmentOccurrences(s)
    .reverse()
    .find(
      (o) =>
        stamp.slice(0, 10) === o.date &&
        stamp >= `${o.date} ${o.time}` &&
        stamp < occurrenceWindowEnd(s, o) &&
        !ackedKeys.has(`${s.id}:${o.date}`),
    );
  return due ?? null;
}

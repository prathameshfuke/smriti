import type { LocalReminderSchedule } from '@/lib/db/schema';
import { appointmentDueNow, isDatedAppointment, type AppointmentOccurrence } from './appointmentWindows';

/**
 * The single definition of "is this reminder due right now?", shared by the
 * open app (`useReminders`), the service worker (offline / periodic sync) and
 * the server push tick. Pure: no database, no clock, no I/O.
 *
 * Relative imports only (plus erased types) so the service worker bundle,
 * which is built without the `@/` alias, can import it.
 */

/** The fields due-ness needs. Deliberately excludes the encrypted free-text fields. */
export type DueSchedule = Pick<
  LocalReminderSchedule,
  | 'id'
  | 'patientId'
  | 'reminderType'
  | 'timeOfDay'
  | 'daysOfWeek'
  | 'isActive'
  | 'appointmentDate'
  | 'remindDayBeforeTime'
  | 'remindDayOfTime'
>;

export interface DueAck {
  reminderId: string;
  scheduledAt: string;
  acknowledgedAt: string | null;
}

export interface DueReminder<S extends DueSchedule = LocalReminderSchedule> {
  schedule: S;
  /** Set for a dated appointment: which of its two prompts is due. */
  occurrence?: AppointmentOccurrence;
}

export interface DueOptions {
  /** How long after its time a weekday reminder still counts as due. Default 2. */
  lookbackMinutes?: number;
  /** How long before its time it already counts as due. Default 2. */
  lookaheadMinutes?: number;
  /** Local date of an acknowledgement's instant. Defaults to this process's zone;
   * the server passes the phone's zone. */
  ackLocalDate?: (isoInstant: string) => string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local `YYYY-MM-DD`. Same output as `localDateString` in adherence.ts, without its imports. */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function computeDueReminders<S extends DueSchedule>(
  schedules: readonly S[],
  acks: readonly DueAck[],
  now: Date,
  opts: DueOptions = {},
): DueReminder<S>[] {
  const lookback = opts.lookbackMinutes ?? 2;
  const lookahead = opts.lookaheadMinutes ?? 2;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();
  const todayStr = localDate(now);

  const ackDate = opts.ackLocalDate ?? ((iso: string) => localDate(new Date(iso)));
  const acked = acks.filter((a) => a.acknowledgedAt);
  const ackedTodayIds = new Set(
    acked.filter((a) => ackDate(a.acknowledgedAt as string) === todayStr).map((a) => a.reminderId),
  );
  const ackedOccurrenceKeys = new Set(acked.map((a) => `${a.reminderId}:${a.scheduledAt.slice(0, 10)}`));

  const due: DueReminder<S>[] = [];
  for (const s of schedules) {
    if (isDatedAppointment(s)) {
      const occurrence = appointmentDueNow(s, now, ackedOccurrenceKeys);
      if (occurrence) due.push({ schedule: s, occurrence });
      continue;
    }
    if (!s.isActive) continue;
    if (!s.daysOfWeek.includes(today)) continue;
    if (ackedTodayIds.has(s.id)) continue;
    const diff = nowMinutes - toMinutes(s.timeOfDay);
    if (diff <= lookback && diff >= -lookahead) due.push({ schedule: s });
  }
  return due;
}

/**
 * One string per notifiable occurrence, used to make sure the page, the
 * service worker and the server each notify it at most once. Appointment
 * prompts use the same `reminderId:date` key as their acknowledgement.
 */
export function occurrenceKey(d: DueReminder<DueSchedule>, now: Date): string {
  return `${d.schedule.id}:${d.occurrence?.date ?? localDate(now)}`;
}

/**
 * A Date whose *local* getters (`getHours`, `getDay`, ...) read the wall clock
 * of `timeZone` at `now`. Lets the server evaluate a patient's local
 * reminders without the process time zone mattering. Unknown zone: `now` as is.
 */
export function wallClockDate(now: Date, timeZone: string): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).formatToParts(now);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  } catch {
    return now;
  }
}

/**
 * Every patient this app serves is in India (no internal DST, one zone for
 * the whole country including the NER states), so unlike reminder delivery
 * — which already has a per-device `push_subscriptions.timezone` to read
 * (see lib/push/tick.ts, itself defaulting to this same zone) — a
 * day-boundary check that only needs "today" has no real per-patient value
 * to look up: it would just re-derive this same constant from the device's
 * own `Intl.DateTimeFormat().resolvedOptions().timeZone` almost every time,
 * at the cost of an extra query. Threading a stored zone through here too
 * only pays off if this product ever serves patients outside India.
 */
export const DEFAULT_PATIENT_TIMEZONE = 'Asia/Kolkata';

/** The patient's local calendar day, `YYYY-MM-DD`, for server-side code that
 * only has `new Date()` (the server's own clock) to start from — e.g. a
 * day-boundary alert check. See `DEFAULT_PATIENT_TIMEZONE`'s doc comment for
 * why this doesn't look up a per-patient zone. */
export function patientLocalDateToday(now: Date = new Date()): string {
  return localDate(wallClockDate(now, DEFAULT_PATIENT_TIMEZONE));
}

import type { LocalReminderSchedule } from '@/lib/db/schema';
import { formatTimeOfDay } from '@/lib/dashboard/formatDate';
import { textFitsLanguage } from '@/lib/i18n/script';
import type { UILanguage } from '@/lib/i18n/languages';
import type { AppointmentOccurrence } from './appointmentWindows';

// The due-time rules live in appointmentWindows.ts (importable by the service
// worker); re-exported so existing imports from here keep working.
export {
  addDays,
  appointmentDueNow,
  appointmentOccurrences,
  isDatedAppointment,
  occurrenceWindowEnd,
  type AppointmentOccurrence,
  type AppointmentOccurrenceKind,
  type AppointmentTiming,
} from './appointmentWindows';

/**
 * Appointment reminders.
 *
 * A caregiver types in what they were told — a slip from a PHC/CHC visit, a
 * verbal instruction, an eSanjeevani slot. Nothing here syncs with or looks up
 * any booking system.
 *
 * Unlike the other reminder types (a time of day repeating on weekdays), an
 * appointment is one dated event with up to two prompts: the evening before,
 * so travel can be planned, and again on the day. Both prompts share the
 * schedule's id; an acknowledgement is told apart by the date in its
 * `scheduledAt`, the same `reminderId:date` key adherence already uses.
 *
 * Reminders only appear while SMRITI is open (see `useReminders`). An
 * appointment prompt therefore stays due until it is acknowledged or its
 * window closes, so opening the phone late still shows it:
 * - day before: from its time until midnight that night;
 * - on the day: from its time until the appointment itself.
 * After the appointment nothing fires, and a missed "tomorrow" prompt is
 * never replayed on the day itself.
 */

export const APPOINTMENT_TEXT_LIMITS = {
  facilityName: 120,
  locationNotes: 500,
  bringNotes: 500,
} as const;

/** Longest facility name read aloud; the card still shows the whole name. */
export const SPEECH_FACILITY_MAX = 60;

export const DEFAULT_DAY_BEFORE_TIME = '18:00';
const EARLIEST_DAY_OF_DEFAULT = '07:00';
const DAY_OF_LEAD_MINUTES = 120;

const pad = (n: number) => String(n).padStart(2, '0');

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Two hours before the appointment, but not before 07:00 — and never after the appointment itself. */
export function defaultDayOfTime(appointmentTime: string): string {
  const appt = toMinutes(appointmentTime);
  const lead = Math.max(appt - DAY_OF_LEAD_MINUTES, toMinutes(EARLIEST_DAY_OF_DEFAULT));
  return fromMinutes(Math.min(lead, appt));
}

/**
 * Free text from the caregiver form: control characters removed, spaces
 * collapsed, at most one blank line kept, capped at `max`. Empty → undefined,
 * so an unfilled field is stored as absent rather than as `""`.
 */
export function sanitizeAppointmentText(value: string | null | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
    .trim();
  return cleaned || undefined;
}

/** Cuts `text` to at most `max` characters at a word boundary, for speech. */
export function truncateForSpeech(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : text.slice(0, max)).replace(/[\s,;:.-]+$/, '');
}

export interface AppointmentPrompt {
  /** Shown on the reminder card. */
  display: string;
  /** Read aloud: same words, with a long facility name shortened. */
  speech: string;
}

/**
 * "You have an appointment tomorrow at 10:30 am at Tezpur CHC". Naming the
 * place lowers confusion; without a facility name (or with one in a script the
 * patient's language does not use) it falls back to the generic wording.
 */
export function buildAppointmentPrompt(
  s: LocalReminderSchedule,
  occurrence: AppointmentOccurrence,
  language: UILanguage,
  t: (key: string, vars?: Record<string, string | number>) => string,
  /** Whether `language` has its own wording for a key. Where it does not, the
   * older translated "Time for your appointment" line beats English. */
  hasKey: (key: string) => boolean = () => true,
): AppointmentPrompt {
  const time = formatTimeOfDay(s.timeOfDay);
  const base = occurrence.kind === 'day_before' ? 'reminder.appointmentTomorrow' : 'reminder.appointmentToday';
  if (!hasKey(base)) {
    const text = t('reminder.appointment');
    return { display: text, speech: text };
  }
  const facility = s.facilityName?.trim();
  if (!facility || !textFitsLanguage(facility, language)) {
    const text = t(base, { time });
    return { display: text, speech: text };
  }
  return {
    display: t(`${base}At`, { time, facility }),
    speech: t(`${base}At`, { time, facility: truncateForSpeech(facility, SPEECH_FACILITY_MAX) }),
  };
}

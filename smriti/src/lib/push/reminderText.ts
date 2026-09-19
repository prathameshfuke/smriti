import { formatTimeOfDay } from '../dashboard/formatDate';
import type { DueReminder, DueSchedule } from '../engine/dueCore';

/**
 * Wording for a reminder notification. Shared by the service worker and the
 * server tick, so no `@/` imports.
 *
 * Generic on purpose: a notification is readable on a locked screen, so it
 * says "Time for your medicine", never the medicine's name or the clinic.
 * The full detail (facility, how to get there) is on the in-app card.
 */

/** Periodic-sync tag: registered by the page (lib/push/client.ts), handled in sw/index.ts. */
export const PERIODIC_SYNC_TAG = 'smriti-reminders';

/** Notification tag prefix: `<prefix><reminderId>:<date>`. Same tag = one notification. */
export const REMINDER_TAG_PREFIX = 'smriti-reminder:';

export const DEFAULT_NOTIFICATION_STRINGS: Record<string, string> = {
  medication: 'Time for your medicine',
  hydration: 'Time to drink water',
  activity: 'Time for your walk',
  appointment: 'Time for your appointment',
  appointmentTomorrow: 'You have an appointment tomorrow at {time}',
  appointmentToday: 'You have an appointment today at {time}',
};

/** The keys of `strings` a notification can use. */
export const NOTIFICATION_STRING_KEYS = Object.keys(DEFAULT_NOTIFICATION_STRINGS);

export function reminderBody(
  due: DueReminder<DueSchedule>,
  strings: Record<string, string> | null | undefined,
): string {
  const pick = (key: string) => strings?.[key] || DEFAULT_NOTIFICATION_STRINGS[key];
  const { schedule, occurrence } = due;
  if (occurrence) {
    const key = occurrence.kind === 'day_before' ? 'appointmentTomorrow' : 'appointmentToday';
    return pick(key).replace('{time}', formatTimeOfDay(schedule.timeOfDay));
  }
  return pick(schedule.reminderType);
}

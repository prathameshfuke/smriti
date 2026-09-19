/**
 * The server half of "reminders while the app is closed": on each tick,
 * find the reminders that are due for every phone with a push subscription
 * and send a Web Push for each one that has not been sent yet.
 *
 * Driven by an external scheduler hitting /api/push/tick (see that route).
 * That scheduler is coarse (every 5 minutes at best on free tiers), so a
 * reminder is treated as due from its time until `lookbackMinutes` after it,
 * and `push_deliveries` remembers what was sent so the next tick does not
 * repeat it. Due-ness is the same `computeDueReminders` the app and the
 * service worker use, evaluated on the wall clock of the phone's own time zone.
 *
 * Server-only. Takes a service-role Supabase client.
 */

import { computeDueReminders, localDate, occurrenceKey, wallClockDate, type DueAck, type DueSchedule } from '../engine/dueCore';
import asm from '../i18n/locales/as.json';
import bn from '../i18n/locales/bn.json';
import brx from '../i18n/locales/brx.json';
import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';
import mni from '../i18n/locales/mni.json';
import ne from '../i18n/locales/ne.json';
import {
  DEFAULT_NOTIFICATION_STRINGS,
  NOTIFICATION_STRING_KEYS,
  REMINDER_TAG_PREFIX,
  reminderBody,
} from './reminderText';
import { sendPushToSubscription, type PushPayload } from './send';
import {
  deleteSubscriptionById,
  listPatientDeviceSubscriptions,
  type PushDb,
  type StoredSubscription,
} from './subscriptionStore';

const CATALOGS: Record<string, { reminder?: Record<string, string> }> = { as: asm, bn, brx, en, hi, mni, ne };

/** Default look-back. A cron every 5 minutes plus a minute of slack. */
export const DEFAULT_LOOKBACK_MINUTES = 6;
const DELIVERY_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export interface TickResult {
  subscriptions: number;
  due: number;
  sent: number;
  failed: number;
  removed: number;
}

export interface TickOptions {
  lookbackMinutes?: number;
  /** Injected in tests. */
  send?: (sub: StoredSubscription, payload: PushPayload) => Promise<'ok' | 'gone' | 'failed'>;
}

/** Notification wording in `language`; anything missing there falls back to English. */
export function notificationStringsFor(language: string): Record<string, string> {
  const own = CATALOGS[language]?.reminder ?? {};
  const strings: Record<string, string> = { ...DEFAULT_NOTIFICATION_STRINGS };
  for (const key of NOTIFICATION_STRING_KEYS) if (typeof own[key] === 'string') strings[key] = own[key];
  return strings;
}

interface ScheduleRow {
  id: string;
  patient_id: string;
  reminder_type: DueSchedule['reminderType'];
  time_of_day: string;
  days_of_week: number[] | null;
  is_active: boolean;
  appointment_date: string | null;
  remind_day_before_time: string | null;
  remind_day_of_time: string | null;
}

interface AckRow {
  reminder_id: string;
  patient_id?: string;
  scheduled_at: string;
  acknowledged_at: string | null;
}

const toSchedule = (r: ScheduleRow): DueSchedule => ({
  id: r.id,
  patientId: r.patient_id,
  reminderType: r.reminder_type,
  timeOfDay: r.time_of_day.slice(0, 5),
  daysOfWeek: r.days_of_week ?? [],
  isActive: r.is_active,
  appointmentDate: r.appointment_date ?? undefined,
  remindDayBeforeTime: r.remind_day_before_time ?? undefined,
  remindDayOfTime: r.remind_day_of_time ?? undefined,
});

export async function runReminderTick(db: PushDb, now: Date = new Date(), opts: TickOptions = {}): Promise<TickResult> {
  const send = opts.send ?? sendPushToSubscription;
  const lookbackMinutes = opts.lookbackMinutes ?? DEFAULT_LOOKBACK_MINUTES;
  const result: TickResult = { subscriptions: 0, due: 0, sent: 0, failed: 0, removed: 0 };

  const subs = await listPatientDeviceSubscriptions(db);
  result.subscriptions = subs.length;
  if (subs.length === 0) return result;

  const patientIds = [...new Set(subs.flatMap((s) => s.patientIds))];
  if (patientIds.length === 0) return result;

  const { data: scheduleRows } = await db.from('reminder_schedules').select('*').in('patient_id', patientIds);
  // Two days back covers an evening "tomorrow" prompt crossing midnight in any zone.
  const since = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data: ackRows } = await db
    .from('reminder_acks')
    .select('reminder_id, patient_id, scheduled_at, acknowledged_at')
    .in('patient_id', patientIds)
    .gte('scheduled_at', since);

  const schedules = ((scheduleRows ?? []) as ScheduleRow[]).map(toSchedule);
  const acks = ((ackRows ?? []) as AckRow[]).map(
    (a): DueAck => ({ reminderId: a.reminder_id, scheduledAt: a.scheduled_at, acknowledgedAt: a.acknowledged_at }),
  );

  for (const sub of subs) {
    const wall = wallClockDate(now, sub.timezone);
    const mine = schedules.filter((s) => sub.patientIds.includes(s.patientId));
    const due = computeDueReminders(mine, acks, wall, {
      lookbackMinutes,
      lookaheadMinutes: 0,
      ackLocalDate: (iso) => localDate(wallClockDate(new Date(iso), sub.timezone)),
    });
    result.due += due.length;
    const strings = notificationStringsFor(sub.language);

    for (const d of due) {
      const key = occurrenceKey(d, wall);
      const claim = await db.from('push_deliveries').insert({ subscription_id: sub.id, occurrence_key: key });
      // Already sent, or the table is missing (migration not applied): either
      // way do not send, so a misconfiguration can never spam a phone.
      if (claim?.error) continue;

      const outcome = await send(sub, {
        title: 'SMRITI',
        body: reminderBody(d, strings),
        tag: `${REMINDER_TAG_PREFIX}${key}`,
        url: '/app',
      });
      if (outcome === 'ok') result.sent += 1;
      else if (outcome === 'gone') {
        result.removed += 1;
        await deleteSubscriptionById(db, sub.id).catch(() => undefined);
        break;
      } else {
        result.failed += 1;
        // Release the claim so the next tick, still inside the window, retries.
        await db.from('push_deliveries').delete().eq('subscription_id', sub.id).eq('occurrence_key', key);
      }
    }
  }

  await db
    .from('push_deliveries')
    .delete()
    .lt('sent_at', new Date(now.getTime() - DELIVERY_MAX_AGE_MS).toISOString())
    .then(undefined, () => undefined);
  return result;
}

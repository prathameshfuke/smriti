import type { LocalReminderAck, LocalReminderSchedule } from '@/lib/db/schema';
import type { AdherenceAck, AdherenceSchedule } from '@/lib/engine/adherence';

/**
 * `computeAdherence` (lib/engine/adherence.ts) is already pure and already
 * used server-side by `/api/patients/[id]/adherence`, reading snake_case
 * rows straight off Postgres. Dexie's local mirror of the same tables is
 * camelCase (see db/schema.ts's own header comment on why) — these two
 * small mappers are the only thing standing between the local rows and that
 * same shared function, so the Reminders tab can reuse it unchanged instead
 * of re-implementing adherence math a second time for the offline path.
 */
export function toAdherenceSchedule(schedule: LocalReminderSchedule): AdherenceSchedule {
  return {
    id: schedule.id,
    reminder_type: schedule.reminderType,
    time_of_day: schedule.timeOfDay,
    days_of_week: schedule.daysOfWeek,
    label: schedule.label,
    created_at: schedule.createdAt ?? schedule.updatedAt,
    ...(schedule.reminderType === 'appointment'
      ? {
          appointment_date: schedule.appointmentDate ?? null,
          remind_day_before_time: schedule.remindDayBeforeTime ?? null,
          remind_day_of_time: schedule.remindDayOfTime ?? null,
        }
      : {}),
  };
}

export function toAdherenceAck(ack: LocalReminderAck): AdherenceAck {
  return {
    reminder_id: ack.reminderId,
    scheduled_at: ack.scheduledAt,
    acknowledged_at: ack.acknowledgedAt,
  };
}

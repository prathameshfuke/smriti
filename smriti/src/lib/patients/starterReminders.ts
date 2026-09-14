import { v4 as uuid } from 'uuid';
import type { LocalReminderSchedule } from '@/lib/db/schema';

export interface StarterReminderChoice {
  morningMedication: boolean;
  hydration: boolean;
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/**
 * The optional reminders offered while setting a patient up: one morning
 * medication reminder at 08:00, and water every two hours from 08:00 to
 * 20:00. Shared by first-time setup and Add patient so both offer the same.
 */
export function buildStarterReminders(patientId: string, choice: StarterReminderChoice): LocalReminderSchedule[] {
  const now = new Date().toISOString();
  const reminders: LocalReminderSchedule[] = [];

  if (choice.morningMedication) {
    reminders.push({
      id: uuid(),
      patientId,
      reminderType: 'medication',
      label: 'Morning medication',
      timeOfDay: '08:00',
      daysOfWeek: EVERY_DAY,
      isActive: true,
      updatedAt: now,
    });
  }

  if (choice.hydration) {
    for (let hour = 8; hour <= 20; hour += 2) {
      reminders.push({
        id: uuid(),
        patientId,
        reminderType: 'hydration',
        label: 'Drink water',
        timeOfDay: `${String(hour).padStart(2, '0')}:00`,
        daysOfWeek: EVERY_DAY,
        isActive: true,
        updatedAt: now,
      });
    }
  }

  return reminders;
}

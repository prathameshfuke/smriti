import type { MemoryBankCategory, ReminderType } from '@/lib/supabase/types';
import type { CompanionFact } from './companion-retrieval';

/**
 * Turns stored rows into the facts Ask Smriti answers from. Takes a neutral
 * shape so the server (snake_case Supabase rows) and the phone (camelCase
 * Dexie rows) build identical facts.
 */

export interface MemoryEntryLike {
  id: string;
  category: MemoryBankCategory | string;
  title: string;
  detail: string;
  relationship: string | null;
}

export interface ReminderLike {
  id: string;
  reminderType: ReminderType;
  label: string;
  timeOfDay: string;
  daysOfWeek: number[];
  appointmentDate?: string | null;
  facilityName?: string | null;
  locationNotes?: string | null;
  bringNotes?: string | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const KINDS = new Set(['person', 'schedule', 'life_fact', 'medication']);

export function memoryEntryToFact(entry: MemoryEntryLike): CompanionFact {
  return {
    id: `m:${entry.id}`,
    kind: KINDS.has(entry.category) ? (entry.category as CompanionFact['kind']) : 'life_fact',
    title: entry.title,
    detail: entry.detail,
    relationship: entry.relationship,
  };
}

function days(daysOfWeek: number[]): string {
  const valid = [...new Set(daysOfWeek)].filter((d) => d >= 0 && d <= 6).sort();
  if (valid.length === 0 || valid.length === 7) return 'every day';
  return `every ${valid.map((d) => DAY_NAMES[d]).join(', ')}`;
}

export function reminderToFact(reminder: ReminderLike): CompanionFact {
  const time = reminder.timeOfDay.slice(0, 5);
  let detail: string;
  if (reminder.reminderType === 'appointment' && reminder.appointmentDate) {
    detail = [
      `Appointment on ${reminder.appointmentDate} at ${time}${reminder.facilityName ? ` at ${reminder.facilityName}` : ''}.`,
      reminder.locationNotes ? `How to get there: ${reminder.locationNotes}.` : '',
      reminder.bringNotes ? `Bring: ${reminder.bringNotes}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
  } else {
    detail = `${reminder.reminderType} reminder at ${time}, ${days(reminder.daysOfWeek)}`;
  }
  return {
    id: `r:${reminder.id}`,
    kind: reminder.reminderType === 'medication' ? 'medication' : 'reminder',
    title: reminder.label,
    detail,
    relationship: null,
  };
}

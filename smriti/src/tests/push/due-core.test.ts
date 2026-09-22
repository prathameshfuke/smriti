import { describe, it, expect } from 'vitest';
import { computeDueReminders, occurrenceKey, patientLocalDateToday, wallClockDate, type DueSchedule } from '@/lib/engine/dueCore';

const base: DueSchedule = {
  id: 'r1',
  patientId: 'p1',
  reminderType: 'medication',
  timeOfDay: '09:00',
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  isActive: true,
};
// 2026-09-19 (a Saturday), local time
const at = (h: number, m: number) => new Date(2026, 8, 19, h, m);

describe('computeDueReminders (pure, shared by page, service worker and server)', () => {
  it('matches the old +/-2 minute window by default', () => {
    expect(computeDueReminders([base], [], at(9, 1))).toHaveLength(1);
    expect(computeDueReminders([base], [], at(9, 2))).toHaveLength(1);
    expect(computeDueReminders([base], [], at(9, 3))).toHaveLength(0);
    expect(computeDueReminders([base], [], at(8, 58))).toHaveLength(1);
    expect(computeDueReminders([base], [], at(8, 57))).toHaveLength(0);
  });

  it('a wider look-back catches a reminder a slow background tick reaches late, but never one in the future', () => {
    const opts = { lookbackMinutes: 10, lookaheadMinutes: 0 };
    expect(computeDueReminders([base], [], at(9, 9), opts)).toHaveLength(1);
    expect(computeDueReminders([base], [], at(9, 11), opts)).toHaveLength(0);
    expect(computeDueReminders([base], [], at(8, 59), opts)).toHaveLength(0);
  });

  it('skips inactive, wrong weekday and already-acknowledged-today reminders', () => {
    expect(computeDueReminders([{ ...base, isActive: false }], [], at(9, 0))).toHaveLength(0);
    expect(computeDueReminders([{ ...base, daysOfWeek: [1] }], [], at(9, 0))).toHaveLength(0);
    const ack = {
      reminderId: 'r1',
      scheduledAt: '2026-09-19T09:00:00.000Z',
      acknowledgedAt: new Date(2026, 8, 19, 9, 0).toISOString(),
    };
    expect(computeDueReminders([base], [ack], at(9, 1))).toHaveLength(0);
  });

  it('gives a dated appointment its own occurrence and honours the ack for that occurrence date', () => {
    const appt: DueSchedule = {
      ...base,
      id: 'a1',
      reminderType: 'appointment',
      timeOfDay: '10:30',
      daysOfWeek: [],
      appointmentDate: '2026-09-20',
      remindDayBeforeTime: '18:00',
      remindDayOfTime: '08:30',
    };
    const due = computeDueReminders([appt], [], at(19, 0));
    expect(due[0].occurrence).toMatchObject({ kind: 'day_before', date: '2026-09-19' });
    const ack = { reminderId: 'a1', scheduledAt: '2026-09-19T18:00:00.000Z', acknowledgedAt: '2026-09-19T13:00:00.000Z' };
    expect(computeDueReminders([appt], [ack], at(19, 0))).toHaveLength(0);
  });
});

describe('occurrenceKey', () => {
  it('is the same string for the same occurrence and differs across days', () => {
    const [d] = computeDueReminders([base], [], at(9, 0));
    expect(occurrenceKey(d, at(9, 0))).toBe(occurrenceKey(d, at(9, 1)));
    expect(occurrenceKey(d, at(9, 0))).not.toBe(occurrenceKey(d, new Date(2026, 8, 20, 9, 0)));
  });

  it('uses the appointment occurrence date, matching the ack key', () => {
    const appt: DueSchedule = {
      ...base,
      id: 'a1',
      reminderType: 'appointment',
      timeOfDay: '10:30',
      daysOfWeek: [],
      appointmentDate: '2026-09-20',
      remindDayBeforeTime: '18:00',
    };
    const [d] = computeDueReminders([appt], [], at(19, 0));
    expect(occurrenceKey(d, at(19, 0))).toBe('a1:2026-09-19');
  });
});

describe('wallClockDate', () => {
  it('reads the clock of another time zone through ordinary local getters', () => {
    // 2026-09-19 03:30 UTC is 09:00 in India.
    const w = wallClockDate(new Date('2026-09-19T03:30:00Z'), 'Asia/Kolkata');
    expect([w.getFullYear(), w.getMonth(), w.getDate(), w.getHours(), w.getMinutes()]).toEqual([2026, 8, 19, 9, 0]);
    expect(w.getDay()).toBe(6);
  });

  it('rolls the date over across midnight', () => {
    const w = wallClockDate(new Date('2026-09-19T20:00:00Z'), 'Asia/Kolkata');
    expect([w.getDate(), w.getHours(), w.getMinutes()]).toEqual([20, 1, 30]);
  });

  it('falls back to the given moment for an unknown zone', () => {
    const now = new Date(2026, 8, 19, 9, 0);
    expect(wallClockDate(now, 'Not/AZone').getTime()).toBe(now.getTime());
  });
});

describe('patientLocalDateToday', () => {
  it('returns the IST calendar day, not the UTC one it has already rolled past', () => {
    // 2026-09-19 20:00 UTC is 2026-09-20 01:30 IST — this is exactly the
    // window (past local midnight, before UTC has caught up) where naively
    // using `new Date().toISOString().slice(0, 10)` server-side reports
    // "2026-09-19", a day behind what mood_logs.log_date (the phone's own
    // local date) already wrote for "today".
    expect(patientLocalDateToday(new Date('2026-09-19T20:00:00Z'))).toBe('2026-09-20');
  });

  it('matches the UTC date for most of the day, since IST is only 5.5 hours ahead', () => {
    expect(patientLocalDateToday(new Date('2026-09-19T03:30:00Z'))).toBe('2026-09-19');
  });
});

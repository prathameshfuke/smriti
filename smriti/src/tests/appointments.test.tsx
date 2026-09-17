import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { db, type LocalReminderSchedule } from '@/lib/db/schema';
import {
  appointmentOccurrences,
  appointmentDueNow,
  buildAppointmentPrompt,
  defaultDayOfTime,
  sanitizeAppointmentText,
  truncateForSpeech,
  APPOINTMENT_TEXT_LIMITS,
} from '@/lib/engine/appointments';
import { acknowledgeReminder, getDueReminders, getRemindersDueNow, saveReminderSchedules } from '@/lib/engine/reminders';
import { computeAdherence } from '@/lib/engine/adherence';
import { toAdherenceSchedule } from '@/lib/dashboard/adherenceAdapter';
import { toWireReminderSchedule } from '@/lib/db/wire';
import ReminderCard from '@/components/ui/ReminderCard';
import { I18nProvider } from '@/lib/i18n/provider';
import { useSettingsStore } from '@/stores/settingsStore';
import { localDateString } from '@/lib/engine/adherence';

function withI18n(node: ReactNode) {
  return <I18nProvider>{node}</I18nProvider>;
}

const en = (key: string, vars?: Record<string, string | number>) => {
  const table: Record<string, string> = {
    'reminder.appointment': 'Time for your appointment',
    'reminder.appointmentTomorrowAt': 'You have an appointment tomorrow at {time} at {facility}',
    'reminder.appointmentTomorrow': 'You have an appointment tomorrow at {time}',
    'reminder.appointmentTodayAt': 'You have an appointment today at {time} at {facility}',
    'reminder.appointmentToday': 'You have an appointment today at {time}',
  };
  const text = table[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, n: string) => String(vars?.[n] ?? ''));
};

function appointment(over: Partial<LocalReminderSchedule> = {}): LocalReminderSchedule {
  return {
    id: 'appt1',
    patientId: 'p1',
    reminderType: 'appointment',
    label: 'Eye check-up',
    timeOfDay: '10:30',
    daysOfWeek: [],
    isActive: true,
    updatedAt: '2026-09-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    appointmentDate: '2026-09-20',
    facilityName: 'Tezpur CHC',
    locationNotes: 'Bus from market, get off at hospital gate',
    bringNotes: 'Ayushman Bharat card, previous prescription',
    remindDayBeforeTime: '18:00',
    remindDayOfTime: '08:30',
    ...over,
  };
}

/** Local wall-clock Date for a `YYYY-MM-DD` + `HH:MM`. */
function at(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

describe('appointment text sanitizing', () => {
  it('trims, strips control characters and caps length', () => {
    expect(sanitizeAppointmentText('  Tezpur\u0000 CHC \u0007 ', 120)).toBe('Tezpur CHC');
    expect(sanitizeAppointmentText('x'.repeat(900), APPOINTMENT_TEXT_LIMITS.bringNotes)).toHaveLength(
      APPOINTMENT_TEXT_LIMITS.bringNotes,
    );
    expect(sanitizeAppointmentText('   ', 120)).toBeUndefined();
    expect(sanitizeAppointmentText(undefined, 120)).toBeUndefined();
  });

  it('keeps line breaks in multi-line notes but collapses runs of blank lines', () => {
    expect(sanitizeAppointmentText('card\n\n\n\nprescription', 500)).toBe('card\n\nprescription');
  });

  it('cuts long text for speech at a word boundary', () => {
    const long = 'Regional Institute of Medical Sciences outpatient department block number four';
    const spoken = truncateForSpeech(long, 40);
    expect(spoken.length).toBeLessThanOrEqual(40);
    expect(long.startsWith(spoken)).toBe(true);
    expect(spoken.endsWith(' ')).toBe(false);
    expect(truncateForSpeech('Tezpur CHC', 40)).toBe('Tezpur CHC');
  });
});

describe('defaultDayOfTime', () => {
  it('is two hours before the appointment, never before 07:00, never after the appointment', () => {
    expect(defaultDayOfTime('10:30')).toBe('08:30');
    expect(defaultDayOfTime('08:00')).toBe('07:00');
    expect(defaultDayOfTime('06:30')).toBe('06:30');
  });
});

describe('appointmentOccurrences', () => {
  it('yields a day-before and a day-of occurrence', () => {
    expect(appointmentOccurrences(appointment())).toEqual([
      { kind: 'day_before', date: '2026-09-19', time: '18:00' },
      { kind: 'day_of', date: '2026-09-20', time: '08:30' },
    ]);
  });

  it('crosses a month boundary for the day before', () => {
    expect(appointmentOccurrences(appointment({ appointmentDate: '2026-10-01' }))[0].date).toBe('2026-09-30');
  });

  it('leaves out a reminder the caregiver turned off', () => {
    expect(appointmentOccurrences(appointment({ remindDayBeforeTime: undefined })).map((o) => o.kind)).toEqual(['day_of']);
    expect(appointmentOccurrences(appointment({ remindDayOfTime: undefined })).map((o) => o.kind)).toEqual(['day_before']);
  });

  it('is empty for a non-appointment or an undated legacy appointment row', () => {
    expect(appointmentOccurrences(appointment({ reminderType: 'medication' }))).toEqual([]);
    expect(appointmentOccurrences(appointment({ appointmentDate: undefined }))).toEqual([]);
  });
});

describe('appointmentDueNow — each reminder fires on its own', () => {
  const none = new Set<string>();

  it('day-before fires at its time on the day before', () => {
    expect(appointmentDueNow(appointment(), at('2026-09-19', '18:00'), none)?.kind).toBe('day_before');
  });

  it('nothing fires before the day-before time', () => {
    expect(appointmentDueNow(appointment(), at('2026-09-19', '17:59'), none)).toBeNull();
  });

  it('day-of fires at its time on the day, even after day-before was acknowledged', () => {
    const acked = new Set(['appt1:2026-09-19']);
    expect(appointmentDueNow(appointment(), at('2026-09-20', '08:30'), acked)?.kind).toBe('day_of');
  });

  it('day-of still fires when day-before was never acknowledged', () => {
    expect(appointmentDueNow(appointment(), at('2026-09-20', '08:31'), none)?.kind).toBe('day_of');
  });

  it('an acknowledged day-before does not come back the same evening', () => {
    const acked = new Set(['appt1:2026-09-19']);
    expect(appointmentDueNow(appointment(), at('2026-09-19', '21:00'), acked)).toBeNull();
  });

  it('day-of fires alone when day-before is turned off', () => {
    const s = appointment({ remindDayBeforeTime: undefined });
    expect(appointmentDueNow(s, at('2026-09-19', '18:00'), none)).toBeNull();
    expect(appointmentDueNow(s, at('2026-09-20', '08:30'), none)?.kind).toBe('day_of');
  });

  it('an inactive appointment never fires', () => {
    expect(appointmentDueNow(appointment({ isActive: false }), at('2026-09-20', '09:00'), none)).toBeNull();
  });
});

describe('appointmentDueNow — phone off overnight (offline catch-up)', () => {
  const none = new Set<string>();

  it('opening the app late on the day before still gives the day-before prompt', () => {
    expect(appointmentDueNow(appointment(), at('2026-09-19', '23:10'), none)?.kind).toBe('day_before');
  });

  it('opening on the day, after the day-of time but before the appointment, fires day-of immediately — never a stale "tomorrow"', () => {
    const due = appointmentDueNow(appointment(), at('2026-09-20', '09:45'), none);
    expect(due?.kind).toBe('day_of');
  });

  it('opening on the day with day-of turned off does not replay a stale day-before prompt', () => {
    const s = appointment({ remindDayOfTime: undefined });
    expect(appointmentDueNow(s, at('2026-09-20', '09:00'), none)).toBeNull();
  });

  it('opening after the appointment time skips silently', () => {
    expect(appointmentDueNow(appointment(), at('2026-09-20', '10:30'), none)).toBeNull();
    expect(appointmentDueNow(appointment(), at('2026-09-21', '07:00'), none)).toBeNull();
  });
});

describe('getDueReminders + acknowledgeReminder with Dexie', () => {
  beforeEach(async () => {
    await db.reminderSchedules.clear();
    await db.reminderAcks.clear();
    await db.syncQueue.clear();
  });

  const onTheDay = at('2026-09-20', '09:45');

  it('persists every appointment field through save and reload', async () => {
    await saveReminderSchedules([appointment()]);
    const stored = await db.reminderSchedules.get('appt1');
    expect(stored).toMatchObject({
      appointmentDate: '2026-09-20',
      facilityName: 'Tezpur CHC',
      locationNotes: 'Bus from market, get off at hospital gate',
      bringNotes: 'Ayushman Bharat card, previous prescription',
      remindDayBeforeTime: '18:00',
      remindDayOfTime: '08:30',
    });
    const queued = (await db.syncQueue.toArray()).find((q) => q.recordId === 'appt1');
    expect(queued?.payload).toMatchObject({ facilityName: 'Tezpur CHC', appointmentDate: '2026-09-20' });
  });

  it('an edit overwrites the stored fields', async () => {
    await saveReminderSchedules([appointment()]);
    await saveReminderSchedules([appointment({ facilityName: 'Dr. Borah', bringNotes: undefined })]);
    const stored = await db.reminderSchedules.get('appt1');
    expect(stored?.facilityName).toBe('Dr. Borah');
    expect(stored?.bringNotes).toBeUndefined();
  });

  it('returns a caught-up day-of appointment with its occurrence, and not via the ±2 minute path', async () => {
    await db.reminderSchedules.put(appointment());
    const due = await getDueReminders('p1', onTheDay);
    expect(due).toHaveLength(1);
    expect(due[0].occurrence?.kind).toBe('day_of');
    expect((await getRemindersDueNow('p1', onTheDay)).map((s) => s.id)).toEqual(['appt1']);
  });

  it('acknowledging records the occurrence date and time, and stops it firing again', async () => {
    await db.reminderSchedules.put(appointment());
    const [due] = await getDueReminders('p1', onTheDay);
    await acknowledgeReminder('appt1', 'p1', 'touch', due.occurrence);

    const [ack] = await db.reminderAcks.where('reminderId').equals('appt1').toArray();
    expect(ack.scheduledAt).toBe('2026-09-20T08:30:00.000Z');
    expect(await getDueReminders('p1', onTheDay)).toHaveLength(0);
  });

  it('a day-before prompt tapped just after midnight does not count as the day-of acknowledgement', async () => {
    await db.reminderSchedules.put(appointment());
    const [due] = await getDueReminders('p1', at('2026-09-19', '23:58'));
    expect(due.occurrence?.kind).toBe('day_before');
    await db.reminderAcks.add({
      id: 'late-tap',
      reminderId: 'appt1',
      patientId: 'p1',
      scheduledAt: '2026-09-19T18:00:00.000Z',
      acknowledgedAt: at('2026-09-20', '00:02').toISOString(),
      ackMethod: 'touch',
      synced: false,
    });
    const [next] = await getDueReminders('p1', onTheDay);
    expect(next?.occurrence?.kind).toBe('day_of');
  });

  it('medication reminders keep their exact-time window', async () => {
    const past = new Date(Date.now() - 10 * 60_000);
    await db.reminderSchedules.put({
      id: 'med',
      patientId: 'p1',
      reminderType: 'medication',
      label: 'Pill',
      timeOfDay: `${String(past.getHours()).padStart(2, '0')}:${String(past.getMinutes()).padStart(2, '0')}`,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      isActive: true,
      updatedAt: new Date().toISOString(),
    });
    expect(await getDueReminders('p1')).toHaveLength(0);
  });
});

describe('buildAppointmentPrompt', () => {
  it('names the facility for the day-before prompt', () => {
    const p = buildAppointmentPrompt(appointment(), { kind: 'day_before', date: '2026-09-19', time: '18:00' }, 'en', en);
    expect(p.display).toBe('You have an appointment tomorrow at 10:30 am at Tezpur CHC');
    expect(p.speech).toBe(p.display);
  });

  it('names the facility for the day-of prompt', () => {
    const p = buildAppointmentPrompt(appointment(), { kind: 'day_of', date: '2026-09-20', time: '08:30' }, 'en', en);
    expect(p.display).toBe('You have an appointment today at 10:30 am at Tezpur CHC');
  });

  it('falls back to the generic copy without a facility', () => {
    const p = buildAppointmentPrompt(
      appointment({ facilityName: undefined }),
      { kind: 'day_of', date: '2026-09-20', time: '08:30' },
      'en',
      en,
    );
    expect(p.display).toBe('You have an appointment today at 10:30 am');
  });

  it('shows the whole facility name but speaks a shortened one', () => {
    const facility = 'Regional Institute of Medical Sciences outpatient department block number four, second floor';
    const p = buildAppointmentPrompt(
      appointment({ facilityName: facility }),
      { kind: 'day_of', date: '2026-09-20', time: '08:30' },
      'en',
      en,
    );
    expect(p.display).toContain(facility);
    expect(p.speech).not.toContain(facility);
    expect(p.speech.length).toBeLessThan(p.display.length);
  });

  it('leaves an English facility name out of a Hindi prompt instead of mixing scripts', () => {
    const p = buildAppointmentPrompt(appointment(), { kind: 'day_of', date: '2026-09-20', time: '08:30' }, 'hi', en);
    expect(p.display).toBe('You have an appointment today at 10:30 am');
  });

  it('uses the older translated appointment line where a language has no new wording yet, rather than English', () => {
    const p = buildAppointmentPrompt(
      appointment(),
      { kind: 'day_of', date: '2026-09-20', time: '08:30' },
      'brx',
      en,
      () => false,
    );
    expect(p.display).toBe('Time for your appointment');
  });

  it('keeps a facility name already written in Devanagari for Hindi', () => {
    const p = buildAppointmentPrompt(
      appointment({ facilityName: 'तेजपुर अस्पताल' }),
      { kind: 'day_of', date: '2026-09-20', time: '08:30' },
      'hi',
      en,
    );
    expect(p.display).toContain('तेजपुर अस्पताल');
  });
});

describe('adherence counts an appointment by its own occurrences', () => {
  it('never counts an appointment on every weekday, and counts both fires', () => {
    const days = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'];
    vi.useFakeTimers();
    vi.setSystemTime(at('2026-09-20', '23:00'));
    try {
      const result = computeAdherence(
        [toAdherenceSchedule(appointment())],
        [{ reminder_id: 'appt1', scheduled_at: '2026-09-19T18:00:00.000Z', acknowledged_at: '2026-09-19T18:01:00.000Z' }],
        days,
      );
      expect(result.byType.appointment).toEqual({ acked: 1, total: 2 });
      expect(result.missed).toEqual([{ date: '2026-09-20', time: '08:30', label: 'Eye check-up' }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not count an occurrence that has not come round yet', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at('2026-09-19', '12:00'));
    try {
      const result = computeAdherence([toAdherenceSchedule(appointment())], [], ['2026-09-18', '2026-09-19']);
      expect(result.byType.appointment).toEqual({ acked: 0, total: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not count a reminder whose window closed before the appointment was entered', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at('2026-09-20', '23:00'));
    try {
      const entered = at('2026-09-20', '09:00').toISOString();
      const result = computeAdherence(
        [toAdherenceSchedule(appointment({ createdAt: entered }))],
        [],
        ['2026-09-19', '2026-09-20'],
      );
      // Day-before (window ended midnight on the 19th) could never fire; day-of could (09:00 < 10:30).
      expect(result.byType.appointment).toEqual({ acked: 0, total: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('sync wire mapping', () => {
  it('sends appointment columns in snake_case', () => {
    expect(toWireReminderSchedule({ ...appointment() })).toMatchObject({
      appointment_date: '2026-09-20',
      facility_name: 'Tezpur CHC',
      location_notes: 'Bus from market, get off at hospital gate',
      bring_notes: 'Ayushman Bharat card, previous prescription',
      remind_day_before_time: '18:00',
      remind_day_of_time: '08:30',
    });
  });

  it('clears the appointment columns on other reminder types, so an appointment changed to another type still syncs', () => {
    const wire = toWireReminderSchedule({
      id: 'm',
      patientId: 'p1',
      reminderType: 'medication',
      label: 'Pill',
      timeOfDay: '08:00',
      daysOfWeek: [1],
      isActive: true,
      // Left over from when the row was an appointment.
      appointmentDate: '2026-09-20',
      facilityName: 'Tezpur CHC',
    });
    expect(wire).toMatchObject({
      appointment_date: null,
      facility_name: null,
      location_notes: null,
      bring_notes: null,
      remind_day_before_time: null,
      remind_day_of_time: null,
    });
  });
});

describe('ReminderCard for an appointment', () => {
  beforeEach(() => {
    useSettingsStore.setState({ language: 'en' });
  });

  it('shows the facility, where to go and what to bring, and keeps Done/Later', () => {
    const onAcknowledge = vi.fn();
    render(
      withI18n(
        <ReminderCard
          reminder={appointment()}
          occurrence={{ kind: 'day_before', date: '2026-09-19', time: '18:00' }}
          onAcknowledge={onAcknowledge}
          onSnooze={() => {}}
        />,
      ),
    );
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('You have an appointment tomorrow at 10:30 am at Tezpur CHC')).toBeInTheDocument();
    expect(within(dialog).getByText('Bus from market, get off at hospital gate')).toBeInTheDocument();
    expect(within(dialog).getByText('Ayushman Bharat card, previous prescription')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Done/ }));
    expect(onAcknowledge).toHaveBeenCalledOnce();
  });

  it('uses the generic appointment wording when no facility was entered', () => {
    render(
      withI18n(
        <ReminderCard
          reminder={appointment({ facilityName: undefined, locationNotes: undefined, bringNotes: undefined })}
          occurrence={{ kind: 'day_of', date: '2026-09-20', time: '08:30' }}
          onAcknowledge={() => {}}
          onSnooze={() => {}}
        />,
      ),
    );
    expect(screen.getByText('You have an appointment today at 10:30 am')).toBeInTheDocument();
  });
});

describe('Upcoming appointments on the caregiver Reminders tab', () => {
  beforeEach(async () => {
    await db.reminderSchedules.clear();
  });

  it('lists facility, location and what to bring in full', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const longBring = 'Ayushman Bharat card, previous prescription, ' + 'blood report '.repeat(20);
    await db.reminderSchedules.put(appointment({ appointmentDate: localDateString(future), bringNotes: longBring.trim() }));
    await db.reminderSchedules.put(appointment({ id: 'old', appointmentDate: '2020-01-01', facilityName: 'Old clinic' }));

    const { UpcomingAppointments } = await import('@/components/caregiver/RemindersTab');
    render(<UpcomingAppointments patientId="p1" />);

    const item = await screen.findByTestId('upcoming-appointment');
    expect(within(item).getByText('Tezpur CHC')).toBeInTheDocument();
    expect(within(item).getByText('Bus from market, get off at hospital gate')).toBeInTheDocument();
    expect(within(item).getByText(longBring.trim())).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Old clinic')).not.toBeInTheDocument());
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent } from '@testing-library/react';
import { db, type LocalReminderSchedule } from '@/lib/db/schema';
import {
  generateDefaultHydrationSchedule,
  getRemindersDueNow,
  acknowledgeReminder,
} from '@/lib/engine/reminders';
import { playAudio } from '@/lib/audio/player';
import ReminderCard from '@/components/ui/ReminderCard';

describe('generateDefaultHydrationSchedule', () => {
  it('returns exactly 8 reminders', () => {
    const schedules = generateDefaultHydrationSchedule('p1');
    expect(schedules).toHaveLength(8);
  });

  it('times are 07:00, 09:00, ..., 21:00', () => {
    const schedules = generateDefaultHydrationSchedule('p1');
    const times = schedules.map((s) => s.timeOfDay);
    expect(times).toEqual(['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00']);
  });
});

function schedule(over: Partial<LocalReminderSchedule> = {}): LocalReminderSchedule {
  return {
    id: 'r1',
    patientId: 'p1',
    reminderType: 'medication',
    label: 'Morning pill',
    timeOfDay: '09:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    isActive: true,
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

describe('getRemindersDueNow', () => {
  beforeEach(async () => {
    await db.reminderSchedules.clear();
    await db.reminderAcks.clear();
    // Wednesday 2026-09-02 09:00 local time — matches every test schedule's default.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 2, 9, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns matching reminder when time is within 2-minute window', async () => {
    await db.reminderSchedules.put(schedule({ id: 'due', timeOfDay: '09:01' }));
    const due = await getRemindersDueNow('p1');
    expect(due.map((r) => r.id)).toContain('due');
  });

  it('excludes reminder already acknowledged today', async () => {
    await db.reminderSchedules.put(schedule({ id: 'acked', timeOfDay: '09:00' }));
    await db.reminderAcks.add({
      id: 'ack1',
      reminderId: 'acked',
      patientId: 'p1',
      scheduledAt: new Date(2026, 8, 2, 9, 0, 0).toISOString(),
      acknowledgedAt: new Date(2026, 8, 2, 9, 0, 30).toISOString(),
      ackMethod: 'touch',
      synced: false,
    });
    const due = await getRemindersDueNow('p1');
    expect(due.map((r) => r.id)).not.toContain('acked');
  });
});

describe('acknowledgeReminder', () => {
  beforeEach(async () => {
    await db.reminderSchedules.clear();
    await db.reminderAcks.clear();
    await db.syncQueue.clear();
  });

  it('creates record in db.reminderAcks with synced=false and correct ackMethod', async () => {
    await db.reminderSchedules.put(schedule({ id: 'r2' }));
    await acknowledgeReminder('r2', 'p1', 'touch');

    const acks = await db.reminderAcks.where('reminderId').equals('r2').toArray();
    expect(acks).toHaveLength(1);
    expect(acks[0].synced).toBe(false);
    expect(acks[0].ackMethod).toBe('touch');
    expect(acks[0].patientId).toBe('p1');
  });
});

describe('ReminderCard', () => {
  const reminder = schedule({ reminderType: 'hydration', label: 'Drink water' });

  it('renders reminder.label text', () => {
    render(<ReminderCard reminder={reminder} onAcknowledge={() => {}} onSnooze={() => {}} />);
    expect(screen.getByText('Drink water')).toBeInTheDocument();
  });

  it('calls onAcknowledge when Done button is clicked', () => {
    const onAcknowledge = vi.fn();
    render(<ReminderCard reminder={reminder} onAcknowledge={onAcknowledge} onSnooze={() => {}} />);
    fireEvent.click(screen.getByText(/done/i));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it('calls onSnooze when snooze link is clicked', () => {
    const onSnooze = vi.fn();
    render(<ReminderCard reminder={reminder} onAcknowledge={() => {}} onSnooze={onSnooze} />);
    fireEvent.click(screen.getByText(/remind me in 15 minutes/i));
    expect(onSnooze).toHaveBeenCalledTimes(1);
  });
});

describe('playAudio', () => {
  it('does not throw when SpeechSynthesis is undefined', () => {
    const original = window.speechSynthesis;
    // @ts-expect-error deliberately simulating a browser without SpeechSynthesis
    delete window.speechSynthesis;

    expect(() => playAudio('', 'Time for your medicine', 'en')).not.toThrow();

    Object.defineProperty(window, 'speechSynthesis', { value: original, configurable: true });
  });
});

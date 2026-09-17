import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent } from '@testing-library/react';
import { db, type LocalReminderSchedule } from '@/lib/db/schema';
import { toHHMM } from '@/lib/supabase/types';
import {
  generateDefaultHydrationSchedule,
  getRemindersDueNow,
  acknowledgeReminder,
} from '@/lib/engine/reminders';
import { playAudio } from '@/lib/audio/player';
import ReminderCard from '@/components/ui/ReminderCard';
import { I18nProvider } from '@/lib/i18n/provider';
import { useSettingsStore } from '@/stores/settingsStore';

function withI18n(node: ReactNode) {
  return <I18nProvider>{node}</I18nProvider>;
}

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

// Real Date.now() throughout — fake timers block the real IndexedDB async
// chain fake-indexeddb relies on and time out (see PBKDF2 lesson elsewhere
// in this suite). Times are derived from the actual current moment instead.
function nowHHMM(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

describe('getRemindersDueNow', () => {
  beforeEach(async () => {
    await db.reminderSchedules.clear();
    await db.reminderAcks.clear();
  });

  it('returns matching reminder when time is within 2-minute window', async () => {
    await db.reminderSchedules.put(schedule({ id: 'due', timeOfDay: nowHHMM(1) }));
    const due = await getRemindersDueNow('p1');
    expect(due.map((r) => r.id)).toContain('due');
  });

  it('excludes reminder already acknowledged today', async () => {
    await db.reminderSchedules.put(schedule({ id: 'acked', timeOfDay: nowHHMM() }));
    await db.reminderAcks.add({
      id: 'ack1',
      reminderId: 'acked',
      patientId: 'p1',
      scheduledAt: new Date().toISOString(),
      acknowledgedAt: new Date().toISOString(),
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
    render(withI18n(<ReminderCard reminder={reminder} onAcknowledge={() => {}} onSnooze={() => {}} />));
    expect(screen.getByText('Drink water')).toBeInTheDocument();
  });

  it('calls onAcknowledge when Done button is clicked', () => {
    const onAcknowledge = vi.fn();
    render(
      withI18n(
        <ReminderCard reminder={reminder} onAcknowledge={onAcknowledge} onSnooze={() => {}} />,
      ),
    );
    fireEvent.click(screen.getByText(/done/i));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it('calls onSnooze when snooze link is clicked', () => {
    const onSnooze = vi.fn();
    render(
      withI18n(<ReminderCard reminder={reminder} onAcknowledge={() => {}} onSnooze={onSnooze} />),
    );
    fireEvent.click(screen.getByText(/remind me in 15 minutes/i));
    expect(onSnooze).toHaveBeenCalledTimes(1);
  });

  describe('language wiring', () => {
    beforeEach(() => {
      useSettingsStore.setState(useSettingsStore.getInitialState(), true);
    });

    it('shows the Hindi "time for" prompt and Done/snooze labels, not the hardcoded English text', () => {
      useSettingsStore.getState().setLanguage('hi');
      render(
        withI18n(
          <ReminderCard
            reminder={schedule({ reminderType: 'hydration', label: 'पानी पीने का समय' })}
            onAcknowledge={() => {}}
            onSnooze={() => {}}
          />,
        ),
      );
      expect(screen.getByText('समय हो गया है:')).toBeInTheDocument();
      expect(screen.getByText('पानी पीने का समय')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'हो गया ✓' })).toBeInTheDocument();
      expect(screen.getByText('मुझे 15 मिनट में याद दिलाएं')).toBeInTheDocument();
    });

    it('falls back to the translated per-type label when the stored label is plain English under a non-English UI language', () => {
      // A caregiver typed the label in English ("Morning pill") while the
      // patient's device is set to Hindi — reading/showing that raw English
      // text to a Hindi-only patient defeats the point of the language
      // setting, so this falls back to the translated reminder-type phrase.
      useSettingsStore.getState().setLanguage('hi');
      render(
        withI18n(
          <ReminderCard
            reminder={schedule({ reminderType: 'medication', label: 'Morning pill' })}
            onAcknowledge={() => {}}
            onSnooze={() => {}}
          />,
        ),
      );
      expect(screen.queryByText('Morning pill')).not.toBeInTheDocument();
      expect(screen.getByText('दवाई लेने का समय')).toBeInTheDocument();
    });

    it('trusts a label already written in the matching script, even under a non-English UI language', () => {
      useSettingsStore.getState().setLanguage('hi');
      render(
        withI18n(
          <ReminderCard
            reminder={schedule({ reminderType: 'medication', label: 'शाम की दवाई' })}
            onAcknowledge={() => {}}
            onSnooze={() => {}}
          />,
        ),
      );
      expect(screen.getByText('शाम की दवाई')).toBeInTheDocument();
    });
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

describe('toHHMM', () => {
  it('trims seconds from Postgres TIME values', () => {
    expect(toHHMM('08:00:00')).toBe('08:00');
    expect(toHHMM('14:30')).toBe('14:30');
  });
});

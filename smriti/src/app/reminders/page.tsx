'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import BigButton from '@/components/ui/BigButton';
import PatientNav from '@/components/layout/PatientNav';
import { db, type LocalReminderAck, type LocalReminderSchedule } from '@/lib/db/schema';
import {
  generateDefaultHydrationSchedule,
  saveReminderSchedules,
} from '@/lib/engine/reminders';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { usePatientStore } from '@/stores/patientStore';
import type { ReminderType } from '@/lib/supabase/types';

const TYPE_ICON: Record<ReminderType, string> = {
  medication: '💊',
  hydration: '💧',
  activity: '🚶',
  appointment: '📅',
};

const TYPE_LABEL: Record<ReminderType, string> = {
  medication: 'Medication',
  hydration: 'Hydration',
  activity: 'Activity',
  appointment: 'Appointment',
};

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RemindersPage() {
  const router = useRouter();
  const currentPatient = usePatientStore((s) => s.currentPatient);

  const [schedules, setSchedules] = useState<LocalReminderSchedule[]>([]);
  const [todayAcks, setTodayAcks] = useState<LocalReminderAck[]>([]);
  const [hasSession, setHasSession] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<ReminderType>('medication');
  const [label, setLabel] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('08:00');
  const [days, setDays] = useState<boolean[]>(ALL_DAYS.map(() => true));

  const reload = async () => {
    if (!currentPatient) return;
    const rows = await db.reminderSchedules.where('patientId').equals(currentPatient.id).toArray();
    setSchedules([...rows].sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay)));

    const acks = await db.reminderAcks.where('patientId').equals(currentPatient.id).toArray();
    const todayStr = todayDateString();
    setTodayAcks(acks.filter((a) => a.acknowledgedAt?.slice(0, 10) === todayStr));
  };

  useEffect(() => {
    queueMicrotask(() => void reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPatient?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      queueMicrotask(() => setHasSession(false));
      return;
    }
    createBrowserClient()
      .auth.getSession()
      .then(({ data }) => setHasSession(!!data.session));
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setType('medication');
    setLabel('');
    setTimeOfDay('08:00');
    setDays(ALL_DAYS.map(() => true));
  };

  const toggleDay = (index: number) => {
    setDays((prev) => prev.map((d, i) => (i === index ? !d : d)));
  };

  const saveReminder = async () => {
    if (!currentPatient || !label.trim()) return;
    const daysOfWeek = ALL_DAYS.filter((_, i) => days[i]);

    const row: LocalReminderSchedule = {
      id: editingId ?? uuid(),
      patientId: currentPatient.id,
      reminderType: type,
      label: label.trim(),
      timeOfDay,
      daysOfWeek,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };

    await saveReminderSchedules([row]);
    resetForm();
    await reload();
  };

  const quickAddMedication = async () => {
    if (!currentPatient) return;
    await saveReminderSchedules([
      {
        id: uuid(),
        patientId: currentPatient.id,
        reminderType: 'medication',
        label: 'Morning medication',
        timeOfDay: '08:00',
        daysOfWeek: ALL_DAYS,
        isActive: true,
        updatedAt: new Date().toISOString(),
      },
    ]);
    await reload();
  };

  const quickAddHydration = async () => {
    if (!currentPatient) return;
    await saveReminderSchedules(generateDefaultHydrationSchedule(currentPatient.id));
    await reload();
  };

  const editReminder = (schedule: LocalReminderSchedule) => {
    setEditingId(schedule.id);
    setType(schedule.reminderType);
    setLabel(schedule.label);
    setTimeOfDay(schedule.timeOfDay);
    setDays(ALL_DAYS.map((d) => schedule.daysOfWeek.includes(d)));
  };

  const deleteReminder = async (schedule: LocalReminderSchedule) => {
    await saveReminderSchedules([{ ...schedule, isActive: false, updatedAt: new Date().toISOString() }]);
    await reload();
  };

  const today = new Date().getDay();
  const todaysSchedules = schedules.filter((s) => s.isActive && s.daysOfWeek.includes(today));
  const activeSchedules = schedules.filter((s) => s.isActive);
  const ackByReminderId = new Map(todayAcks.map((a) => [a.reminderId, a]));

  return (
    <div className="mx-auto flex min-h-dvh max-w-patient flex-col">
      <PatientNav title="Reminders" onBack={() => router.push('/')} />

      <main className="flex flex-1 flex-col gap-8 px-4 py-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-caregiver-heading font-semibold text-ink">Today</h2>
          {todaysSchedules.length === 0 ? (
            <p className="text-caregiver-body text-ink-muted">No reminders scheduled today.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {todaysSchedules.map((s) => {
                const ack = ackByReminderId.get(s.id);
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-card bg-surface-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">
                        {TYPE_ICON[s.reminderType]}
                      </span>
                      <div>
                        <p className="text-caregiver-body text-ink">
                          {s.timeOfDay} — {s.label}
                        </p>
                        {ack?.acknowledgedAt ? (
                          <p className="text-patient-sm text-success">
                            Done at{' '}
                            {new Date(ack.acknowledgedAt).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span aria-hidden="true" className={ack ? 'text-success' : 'text-ink-muted'}>
                      {ack ? '✓' : '○'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {hasSession ? (
          <>
            <section className="flex flex-col gap-3">
              <h2 className="text-caregiver-heading font-semibold text-ink">
                {editingId ? 'Edit Reminder' : 'Add Reminder'}
              </h2>

              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TYPE_LABEL) as ReminderType[]).map((t) => (
                  <BigButton
                    key={t}
                    label={`${TYPE_ICON[t]} ${TYPE_LABEL[t]}`}
                    variant={type === t ? 'primary' : 'secondary'}
                    onClick={() => setType(t)}
                  />
                ))}
              </div>

              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Morning red pill"
                className="h-14 w-full rounded-card border border-surface-muted px-4 text-caregiver-body"
              />

              <input
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                className="h-14 w-full rounded-card border border-surface-muted px-4 text-caregiver-body"
              />

              <div className="flex gap-2">
                {DAY_LETTERS.map((letter, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    aria-pressed={days[i]}
                    style={{ height: 40, width: 40 }}
                    className={
                      'rounded-full text-caregiver-body font-semibold ' +
                      (days[i] ? 'bg-primary text-ink-inverse' : 'bg-surface-muted text-ink-muted')
                    }
                  >
                    {letter}
                  </button>
                ))}
              </div>

              <BigButton label="Save Reminder" variant="primary" onClick={() => void saveReminder()} />
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-caregiver-heading font-semibold text-ink">Quick setup</h2>
              <BigButton
                label="Add morning medication reminder at 8:00 AM"
                variant="secondary"
                onClick={() => void quickAddMedication()}
              />
              <BigButton
                label="Add hourly hydration reminders"
                variant="secondary"
                onClick={() => void quickAddHydration()}
              />
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-caregiver-heading font-semibold text-ink">All reminders</h2>
              <ul className="flex flex-col gap-2">
                {activeSchedules.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-card bg-surface-card p-3"
                  >
                    <p className="text-caregiver-body text-ink">
                      {TYPE_ICON[s.reminderType]} {s.timeOfDay} — {s.label}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        aria-label={`Edit ${s.label}`}
                        onClick={() => editReminder(s)}
                        style={{ minHeight: 40, minWidth: 40 }}
                      >
                        <Pencil size={20} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${s.label}`}
                        onClick={() => void deleteReminder(s)}
                        style={{ minHeight: 40, minWidth: 40 }}
                      >
                        <Trash2 size={20} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

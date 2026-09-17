'use client';

import { useTranslation } from '@/lib/i18n/provider';
import { localDateString } from '@/lib/engine/adherence';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import BigButton from '@/components/ui/BigButton';
import PatientNav from '@/components/layout/PatientNav';
import { buttonClass, fieldClass, labelClass, textActionClass } from '@/components/ui/Panel';
import { db, type LocalReminderAck, type LocalReminderSchedule } from '@/lib/db/schema';
import {
  generateDefaultHydrationSchedule,
  saveReminderSchedules,
} from '@/lib/engine/reminders';
import {
  APPOINTMENT_TEXT_LIMITS,
  DEFAULT_DAY_BEFORE_TIME,
  defaultDayOfTime,
  isDatedAppointment,
  sanitizeAppointmentText,
} from '@/lib/engine/appointments';
import { formatDayDate, formatTimeOfDay } from '@/lib/dashboard/formatDate';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { toHHMM, type ReminderType } from '@/lib/supabase/types';

const TYPE_LABEL: Record<ReminderType, string> = {
  medication: 'Medication',
  hydration: 'Hydration',
  activity: 'Activity',
  appointment: 'Appointment',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function todayDateString(): string {
  return localDateString();
}

export default function RemindersPage() {
  const router = useRouter();
  // Named `tr` here: this page already uses `t` for reminder types in the caregiver form.
  const { t: tr } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);

  const [schedules, setSchedules] = useState<LocalReminderSchedule[]>([]);
  const [todayAcks, setTodayAcks] = useState<LocalReminderAck[]>([]);
  // Gates the add/edit/delete form below, same as elsewhere in the app: a
  // *live Supabase session* used to be the check here, but that stays true
  // in the background (auto-refreshing tokens) long after a caregiver has
  // handed the device back to the patient — it answers "has anyone ever
  // logged in on this browser," not "is a caregiver holding it right now."
  // `isCaregiverSessionFresh` is the same PIN-freshness signal `/app`'s PIN
  // dialog and every other caregiver-only surface already gates on.
  const [caregiverPresent, setCaregiverPresent] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<ReminderType>('medication');
  const [label, setLabel] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('08:00');
  const [days, setDays] = useState<boolean[]>(ALL_DAYS.map(() => true));
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  // Appointment-only fields. The caregiver types what the slip or the
  // health worker said; nothing is looked up or synced from elsewhere.
  const [appointmentDate, setAppointmentDate] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [bringNotes, setBringNotes] = useState('');
  const [dayBeforeOn, setDayBeforeOn] = useState(true);
  const [dayBeforeTime, setDayBeforeTime] = useState(DEFAULT_DAY_BEFORE_TIME);
  const [dayOfOn, setDayOfOn] = useState(true);
  const [dayOfTime, setDayOfTime] = useState(defaultDayOfTime('08:00'));
  // Until the caregiver sets it by hand, the on-the-day time follows the appointment time.
  const [dayOfTouched, setDayOfTouched] = useState(false);

  const reload = async () => {
    if (!currentPatient) return;
    const rows = await db.reminderSchedules.where('patientId').equals(currentPatient.id).toArray();
    setSchedules([...rows].sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay)));

    const acks = await db.reminderAcks.where('patientId').equals(currentPatient.id).toArray();
    const todayStr = todayDateString();
    setTodayAcks(acks.filter((a) => a.acknowledgedAt && localDateString(new Date(a.acknowledgedAt)) === todayStr));
  };

  useEffect(() => {
    queueMicrotask(() => void reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPatient?.id]);

  useEffect(() => {
    setCaregiverPresent(useSettingsStore.getState().isCaregiverSessionFresh());
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setType('medication');
    setLabel('');
    setTimeOfDay('08:00');
    setDays(ALL_DAYS.map(() => true));
    setAppointmentDate('');
    setFacilityName('');
    setLocationNotes('');
    setBringNotes('');
    setDayBeforeOn(true);
    setDayBeforeTime(DEFAULT_DAY_BEFORE_TIME);
    setDayOfOn(true);
    setDayOfTime(defaultDayOfTime('08:00'));
    setDayOfTouched(false);
  };

  const changeType = (next: ReminderType) => {
    setType(next);
    // A saved appointment has no weekdays; turning it into a daily reminder
    // with none selected would never fire.
    if (next !== 'appointment' && !days.some(Boolean)) setDays(ALL_DAYS.map(() => true));
  };

  const changeTime = (value: string) => {
    setTimeOfDay(value);
    if (!dayOfTouched && value) setDayOfTime(defaultDayOfTime(value));
  };

  const isAppointment = type === 'appointment';
  const appointmentError = !isAppointment
    ? null
    : !dayBeforeOn && !dayOfOn
      ? 'Turn on at least one reminder.'
      : dayOfOn && dayOfTime > timeOfDay
        ? 'The reminder on the day must be before the appointment.'
        : null;
  const canSave = isAppointment ? Boolean(appointmentDate && timeOfDay) && !appointmentError : Boolean(label.trim());

  const toggleDay = (index: number) => {
    setDays((prev) => prev.map((d, i) => (i === index ? !d : d)));
  };

  const saveReminder = async () => {
    if (!currentPatient || !canSave) return;
    const daysOfWeek = ALL_DAYS.filter((_, i) => days[i]);

    let row: LocalReminderSchedule = {
      id: editingId ?? uuid(),
      patientId: currentPatient.id,
      reminderType: type,
      label: label.trim(),
      timeOfDay,
      daysOfWeek,
      isActive: true,
      updatedAt: new Date().toISOString(),
      createdAt: schedules.find((s) => s.id === editingId)?.createdAt ?? new Date().toISOString(),
    };

    if (isAppointment) {
      const facility = sanitizeAppointmentText(facilityName, APPOINTMENT_TEXT_LIMITS.facilityName);
      row = {
        ...row,
        label: row.label || (facility ? `Appointment at ${facility}` : 'Appointment'),
        daysOfWeek: [],
        appointmentDate,
        facilityName: facility,
        locationNotes: sanitizeAppointmentText(locationNotes, APPOINTMENT_TEXT_LIMITS.locationNotes),
        bringNotes: sanitizeAppointmentText(bringNotes, APPOINTMENT_TEXT_LIMITS.bringNotes),
        remindDayBeforeTime: dayBeforeOn ? dayBeforeTime : undefined,
        remindDayOfTime: dayOfOn ? dayOfTime : undefined,
      };
    }

    await saveReminderSchedules([row]);
    setSavedLabel(
      isAppointment
        ? `${editingId ? 'Updated' : 'Added'}: ${row.label} on ${formatDayDate(appointmentDate)} at ${row.timeOfDay}.`
        : `${editingId ? 'Updated' : 'Added'}: ${row.label} at ${row.timeOfDay}.`,
    );
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
        createdAt: new Date().toISOString(),
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
    setTimeOfDay(toHHMM(schedule.timeOfDay));
    setDays(ALL_DAYS.map((d) => schedule.daysOfWeek.includes(d)));
    setAppointmentDate(schedule.appointmentDate ?? '');
    setFacilityName(schedule.facilityName ?? '');
    setLocationNotes(schedule.locationNotes ?? '');
    setBringNotes(schedule.bringNotes ?? '');
    setDayBeforeOn(Boolean(schedule.remindDayBeforeTime) || !schedule.appointmentDate);
    setDayBeforeTime(schedule.remindDayBeforeTime ?? DEFAULT_DAY_BEFORE_TIME);
    setDayOfOn(Boolean(schedule.remindDayOfTime) || !schedule.appointmentDate);
    setDayOfTime(schedule.remindDayOfTime ?? defaultDayOfTime(schedule.timeOfDay));
    setDayOfTouched(Boolean(schedule.remindDayOfTime));
  };

  const deleteReminder = async (schedule: LocalReminderSchedule) => {
    await saveReminderSchedules([{ ...schedule, isActive: false, updatedAt: new Date().toISOString() }]);
    await reload();
  };

  const today = new Date().getDay();
  const todayStr = todayDateString();
  const todaysSchedules = schedules.filter(
    (s) => s.isActive && (isDatedAppointment(s) ? s.appointmentDate === todayStr : s.daysOfWeek.includes(today)),
  );
  const isPastAppointment = (s: LocalReminderSchedule) => isDatedAppointment(s) && (s.appointmentDate as string) < todayStr;
  const activeSchedules = schedules.filter((s) => s.isActive && !isPastAppointment(s));
  const pastAppointments = schedules
    .filter((s) => s.isActive && isPastAppointment(s))
    .sort((a, b) => (b.appointmentDate as string).localeCompare(a.appointmentDate as string));
  const ackByReminderId = new Map(todayAcks.map((a) => [a.reminderId, a]));

  const renderSchedule = (s: LocalReminderSchedule) => (
    <li key={s.id} className="flex flex-col gap-1 px-5 py-4">
      <p className="text-caregiver-body text-ink">
        {isDatedAppointment(s) ? (
          <span className="font-bold">
            {formatDayDate(s.appointmentDate as string)}, {formatTimeOfDay(s.timeOfDay)}
          </span>
        ) : (
          <span className="font-bold tabular-nums">{toHHMM(s.timeOfDay)}</span>
        )}
        <span className="text-ink-muted"> {TYPE_LABEL[s.reminderType]}</span>
      </p>
      <p className="break-words text-caregiver-body font-bold text-ink">{s.label}</p>
      {isDatedAppointment(s)
        ? [s.facilityName, s.locationNotes, s.bringNotes]
            .filter((text): text is string => Boolean(text))
            .map((text, i) => (
              <p key={i} className="whitespace-pre-line break-words text-caregiver-body text-ink">
                {text}
              </p>
            ))
        : null}
      <div className="flex gap-2">
        <button
          type="button"
          aria-label={`Edit ${s.label}`}
          onClick={() => editReminder(s)}
          className={`${textActionClass} pr-3`}
        >
          Edit
        </button>
        <button
          type="button"
          aria-label={`Delete ${s.label}`}
          onClick={() => void deleteReminder(s)}
          className={`${textActionClass} px-3 text-ink-muted decoration-ink-muted/40 hover:text-danger`}
        >
          Delete
        </button>
      </div>
    </li>
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-patient flex-col bg-surface">
      <PatientNav title={tr('reminders.title')} onBack={() => router.push('/app')} />

      <main className="flex flex-1 flex-col gap-10 px-5 py-8">
        <section aria-labelledby="today-heading" className="flex flex-col gap-4">
          <h2 id="today-heading" className="font-serif-display text-[2rem] font-medium leading-tight text-ink">
            {tr('reminders.today')}
          </h2>
          {todaysSchedules.length === 0 ? (
            <p className="text-patient-body text-ink-muted">{tr('reminders.noneToday')}</p>
          ) : (
            <ul className="divide-y divide-line200 overflow-hidden rounded-card border border-line200 bg-surface-card">
              {todaysSchedules.map((s) => {
                const ack = ackByReminderId.get(s.id);
                return (
                  <li key={s.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-4 px-5 py-4">
                    <span className="font-serif-display text-[1.5rem] font-medium tabular-nums text-ink">{toHHMM(s.timeOfDay)}</span>
                    <div className="min-w-0">
                      <p className="text-patient-body font-bold text-ink">{s.label}</p>
                      {ack?.acknowledgedAt ? (
                        <p className="mt-1 flex items-center gap-2 text-patient-sm text-ink">
                          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-success" />
                          {tr('reminders.doneAt', {
                            time: new Date(ack.acknowledgedAt).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            }),
                          })}
                        </p>
                      ) : (
                        <p className="mt-1 text-patient-sm text-ink-muted">{tr('reminders.notDoneYet')}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {caregiverPresent ? (
          <>
            <section aria-labelledby="edit-reminder-heading" className="flex flex-col gap-5 rounded-card border border-line200 bg-surface-card p-5">
              <div>
                <h2 id="edit-reminder-heading" className="font-serif-display text-[1.5rem] font-medium leading-tight text-ink">
                  {editingId ? 'Edit Reminder' : 'Add Reminder'}
                </h2>
                <p className="mt-1 text-patient-sm text-ink-muted">Only shown while a caregiver is signed in.</p>
              </div>

              <fieldset>
                <legend className={labelClass}>Type</legend>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
                  {(Object.keys(TYPE_LABEL) as ReminderType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={type === t}
                      onClick={() => changeType(t)}
                      className={
                        'min-h-14 rounded-control px-3 text-caregiver-body font-bold transition-colors ' +
                        (type === t
                          ? 'bg-primary text-ink-inverse'
                          : 'border-2 border-ink-muted/60 bg-surface-card text-ink hover:bg-surface-muted')
                      }
                    >
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="reminder-label" className={labelClass}>
                  {isAppointment ? 'What it is for (optional)' : 'What to remind'}
                </label>
                <input
                  id="reminder-label"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={isAppointment ? 'Eye check-up' : 'Morning red pill'}
                  className={fieldClass}
                />
              </div>

              {isAppointment ? (
                <div>
                  <label htmlFor="appointment-date" className={labelClass}>
                    Appointment date
                  </label>
                  <input
                    id="appointment-date"
                    type="date"
                    value={appointmentDate}
                    min={editingId ? undefined : todayStr}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              ) : null}

              <div>
                <label htmlFor="reminder-time" className={labelClass}>
                  {isAppointment ? 'Appointment time' : 'Time'}
                </label>
                <input
                  id="reminder-time"
                  type="time"
                  value={timeOfDay}
                  onChange={(e) => changeTime(e.target.value)}
                  className={fieldClass}
                />
              </div>

              {isAppointment ? (
                <>
                  <div>
                    <label htmlFor="appointment-facility" className={labelClass}>
                      Facility or doctor
                    </label>
                    <input
                      id="appointment-facility"
                      type="text"
                      value={facilityName}
                      maxLength={APPOINTMENT_TEXT_LIMITS.facilityName}
                      onChange={(e) => setFacilityName(e.target.value)}
                      placeholder="Tezpur CHC, or Dr. Borah"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="appointment-location" className={labelClass}>
                      How to get there
                    </label>
                    <textarea
                      id="appointment-location"
                      rows={2}
                      value={locationNotes}
                      maxLength={APPOINTMENT_TEXT_LIMITS.locationNotes}
                      onChange={(e) => setLocationNotes(e.target.value)}
                      placeholder="Shared auto from the market, get off at the hospital gate"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="appointment-bring" className={labelClass}>
                      What to bring
                    </label>
                    <textarea
                      id="appointment-bring"
                      rows={2}
                      value={bringNotes}
                      maxLength={APPOINTMENT_TEXT_LIMITS.bringNotes}
                      onChange={(e) => setBringNotes(e.target.value)}
                      placeholder="For example: Ayushman Bharat card, previous prescription, phone for a video call"
                      className={fieldClass}
                    />
                  </div>

                  <fieldset className="flex flex-col gap-4">
                    <legend className={labelClass}>Reminders</legend>
                    <div className="flex flex-col gap-2">
                      <label className="flex min-h-12 items-center gap-3 text-caregiver-body text-ink">
                        <input
                          type="checkbox"
                          checked={dayBeforeOn}
                          onChange={(e) => setDayBeforeOn(e.target.checked)}
                          className="h-6 w-6 accent-primary"
                        />
                        Remind the day before
                      </label>
                      {dayBeforeOn ? (
                        <>
                          <label htmlFor="appointment-day-before-time" className="sr-only">
                            Time the day before
                          </label>
                          <input
                            id="appointment-day-before-time"
                            type="time"
                            value={dayBeforeTime}
                            onChange={(e) => setDayBeforeTime(e.target.value)}
                            className={fieldClass}
                          />
                        </>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="flex min-h-12 items-center gap-3 text-caregiver-body text-ink">
                        <input
                          type="checkbox"
                          checked={dayOfOn}
                          onChange={(e) => setDayOfOn(e.target.checked)}
                          className="h-6 w-6 accent-primary"
                        />
                        Remind on the day
                      </label>
                      {dayOfOn ? (
                        <>
                          <label htmlFor="appointment-day-of-time" className="sr-only">
                            Time on the day
                          </label>
                          <input
                            id="appointment-day-of-time"
                            type="time"
                            value={dayOfTime}
                            onChange={(e) => {
                              setDayOfTime(e.target.value);
                              setDayOfTouched(true);
                            }}
                            className={fieldClass}
                          />
                        </>
                      ) : null}
                    </div>
                    <p className="text-patient-sm text-ink-muted">
                      Reminders show while SMRITI is open on the patient&apos;s phone. If it was closed, they show the
                      next time it is opened, until the appointment starts.
                    </p>
                    {appointmentError ? (
                      <p role="alert" className="text-caregiver-body font-bold text-danger">
                        {appointmentError}
                      </p>
                    ) : null}
                  </fieldset>
                </>
              ) : null}

              {isAppointment ? null : (
              <fieldset>
                <legend className={labelClass}>Days</legend>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {DAY_NAMES.map((day, i) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(i)}
                      aria-pressed={days[i]}
                      aria-label={DAY_FULL[i]}
                      className={
                        'min-h-12 rounded-control text-patient-sm font-bold transition-colors duration-150 ' +
                        (days[i]
                          ? 'bg-primary text-ink-inverse'
                          : 'border-2 border-ink-muted/60 bg-surface-card text-ink hover:bg-surface-muted')
                      }
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </fieldset>
              )}

              <BigButton
                label={editingId ? 'Save changes' : 'Save reminder'}
                variant="primary"
                disabled={!canSave}
                onClick={() => void saveReminder()}
              />
              <p role="status" className="empty:hidden text-caregiver-body font-bold text-ink">
                {savedLabel}
              </p>
              {editingId ? (
                <button type="button" onClick={resetForm} className={`${textActionClass} self-center`}>
                  Cancel editing
                </button>
              ) : null}
            </section>

            <section aria-labelledby="quick-setup-heading" className="flex flex-col gap-3">
              <h2 id="quick-setup-heading" className="font-serif-display text-[1.5rem] font-medium leading-tight text-ink">
                Quick setup
              </h2>
              <button type="button" onClick={() => void quickAddMedication()} className={`${buttonClass.secondary} min-h-14 text-left`}>
                Add morning medication reminder at 8:00 AM
              </button>
              <button type="button" onClick={() => void quickAddHydration()} className={`${buttonClass.secondary} min-h-14 text-left`}>
                Add hourly hydration reminders
              </button>
            </section>

            <section aria-labelledby="all-reminders-heading" className="flex flex-col gap-3">
              <h2 id="all-reminders-heading" className="font-serif-display text-[1.5rem] font-medium leading-tight text-ink">
                All reminders
              </h2>
              {activeSchedules.length === 0 ? (
                <p className="text-caregiver-body text-ink-muted">No reminders yet.</p>
              ) : (
                <ul className="divide-y divide-line200 overflow-hidden rounded-card border border-line200 bg-surface-card">
                  {activeSchedules.map(renderSchedule)}
                </ul>
              )}
            </section>

            {pastAppointments.length > 0 ? (
              <section aria-labelledby="past-appointments-heading" className="flex flex-col gap-3">
                <h2 id="past-appointments-heading" className="font-serif-display text-[1.5rem] font-medium leading-tight text-ink">
                  Past appointments
                </h2>
                <ul className="divide-y divide-line200 overflow-hidden rounded-card border border-line200 bg-surface-card">
                  {pastAppointments.map(renderSchedule)}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

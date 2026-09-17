import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { db } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/reminders',
}));

import RemindersPage from '@/app/reminders/page';

function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function openAppointmentForm() {
  render(<RemindersPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Appointment' }));
}

describe('Caregiver reminder form — appointment', () => {
  beforeEach(async () => {
    await db.reminderSchedules.clear();
    await db.syncQueue.clear();
    usePatientStore.setState({
      currentPatient: {
        id: 'p1',
        caregiverId: 'c1',
        displayName: 'Hari',
        ageYears: 70,
        gender: 'male',
        educationYears: 5,
        primaryLanguage: 'en',
        sessionDurationMinutes: 10,
        isActive: true,
        currentDifficulty: {},
      } as never,
    });
    useSettingsStore.setState({ caregiverSessionVerifiedAt: Date.now(), language: 'en' });
  });

  it('shows appointment fields only for the appointment type, and no weekday picker', async () => {
    render(<RemindersPage />);
    await screen.findByRole('button', { name: 'Appointment' });
    expect(screen.queryByLabelText('Facility or doctor')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Days' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Appointment' }));
    expect(screen.getByLabelText('Appointment date')).toBeInTheDocument();
    expect(screen.getByLabelText('Facility or doctor')).toBeInTheDocument();
    expect(screen.getByLabelText('How to get there')).toBeInTheDocument();
    expect(screen.getByLabelText('What to bring')).toHaveAttribute('placeholder', expect.stringContaining('Ayushman Bharat card'));
    expect(screen.queryByRole('group', { name: 'Days' })).not.toBeInTheDocument();
  });

  it('needs a date before it can be saved', async () => {
    await openAppointmentForm();
    expect(screen.getByRole('button', { name: 'Save reminder' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Appointment date'), { target: { value: futureDate(4) } });
    expect(screen.getByRole('button', { name: 'Save reminder' })).toBeEnabled();
  });

  it('saves every field, sanitized, with both reminder times', async () => {
    await openAppointmentForm();
    const date = futureDate(4);
    fireEvent.change(screen.getByLabelText('Appointment date'), { target: { value: date } });
    fireEvent.change(screen.getByLabelText('Appointment time'), { target: { value: '10:30' } });
    fireEvent.change(screen.getByLabelText('Facility or doctor'), { target: { value: '  Tezpur   CHC ' } });
    fireEvent.change(screen.getByLabelText('How to get there'), { target: { value: 'Bus from market' } });
    fireEvent.change(screen.getByLabelText('What to bring'), { target: { value: 'x'.repeat(800) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save reminder' }));

    await waitFor(async () => expect(await db.reminderSchedules.count()).toBe(1));
    const [row] = await db.reminderSchedules.toArray();
    expect(row).toMatchObject({
      reminderType: 'appointment',
      appointmentDate: date,
      timeOfDay: '10:30',
      daysOfWeek: [],
      facilityName: 'Tezpur CHC',
      locationNotes: 'Bus from market',
      remindDayBeforeTime: '18:00',
      remindDayOfTime: '08:30',
      label: 'Appointment at Tezpur CHC',
    });
    expect(row.bringNotes).toHaveLength(500);

    const list = screen.getByRole('region', { name: 'All reminders' });
    expect(within(list).getByText('Tezpur CHC')).toBeInTheDocument();
    expect(within(list).getByText('Bus from market')).toBeInTheDocument();
  });

  it('can turn the day-before reminder off', async () => {
    await openAppointmentForm();
    fireEvent.change(screen.getByLabelText('Appointment date'), { target: { value: futureDate(4) } });
    fireEvent.click(screen.getByLabelText('Remind the day before'));
    fireEvent.click(screen.getByRole('button', { name: 'Save reminder' }));
    await waitFor(async () => expect(await db.reminderSchedules.count()).toBe(1));
    const [row] = await db.reminderSchedules.toArray();
    expect(row.remindDayBeforeTime).toBeUndefined();
    expect(row.remindDayOfTime).toBeDefined();
  });

  it('refuses a day-of reminder later than the appointment', async () => {
    await openAppointmentForm();
    fireEvent.change(screen.getByLabelText('Appointment date'), { target: { value: futureDate(4) } });
    fireEvent.change(screen.getByLabelText('Appointment time'), { target: { value: '10:30' } });
    fireEvent.change(screen.getByLabelText('Time on the day'), { target: { value: '11:00' } });
    expect(screen.getByText('The reminder on the day must be before the appointment.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save reminder' })).toBeDisabled();
  });

  it('loads an existing appointment into the form for editing and saves changes', async () => {
    const date = futureDate(6);
    await db.reminderSchedules.put({
      id: 'appt1',
      patientId: 'p1',
      reminderType: 'appointment',
      label: 'Eye check-up',
      timeOfDay: '09:00',
      daysOfWeek: [],
      isActive: true,
      updatedAt: new Date().toISOString(),
      createdAt: '2026-09-01T00:00:00.000Z',
      appointmentDate: date,
      facilityName: 'CHC',
      bringNotes: 'Old prescription',
      remindDayOfTime: '07:00',
    });
    render(<RemindersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Eye check-up' }));

    expect(screen.getByLabelText('Appointment date')).toHaveValue(date);
    expect(screen.getByLabelText('Facility or doctor')).toHaveValue('CHC');
    expect(screen.getByLabelText('Remind the day before')).not.toBeChecked();

    fireEvent.change(screen.getByLabelText('Facility or doctor'), { target: { value: 'Dr. Borah, Tezpur CHC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(async () => expect((await db.reminderSchedules.get('appt1'))?.facilityName).toBe('Dr. Borah, Tezpur CHC'));
    const row = await db.reminderSchedules.get('appt1');
    expect(row).toMatchObject({ label: 'Eye check-up', bringNotes: 'Old prescription', createdAt: '2026-09-01T00:00:00.000Z' });
    expect(await db.reminderSchedules.count()).toBe(1);
  });

  it('drops the appointment details when an appointment is changed to another type', async () => {
    await db.reminderSchedules.put({
      id: 'appt1',
      patientId: 'p1',
      reminderType: 'appointment',
      label: 'Eye check-up',
      timeOfDay: '09:00',
      daysOfWeek: [],
      isActive: true,
      updatedAt: new Date().toISOString(),
      appointmentDate: futureDate(6),
      facilityName: 'CHC',
      remindDayOfTime: '07:00',
    });
    render(<RemindersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Eye check-up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Medication' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(async () => expect((await db.reminderSchedules.get('appt1'))?.reminderType).toBe('medication'));
    const row = await db.reminderSchedules.get('appt1');
    expect(row?.appointmentDate).toBeUndefined();
    expect(row?.facilityName).toBeUndefined();
    expect(row?.daysOfWeek.length).toBeGreaterThan(0);
  });

  it('lists past appointments apart from the active reminders', async () => {
    await db.reminderSchedules.bulkPut([
      {
        id: 'past',
        patientId: 'p1',
        reminderType: 'appointment',
        label: 'Old check-up',
        timeOfDay: '09:00',
        daysOfWeek: [],
        isActive: true,
        updatedAt: new Date().toISOString(),
        appointmentDate: futureDate(-3),
      },
      {
        id: 'next',
        patientId: 'p1',
        reminderType: 'appointment',
        label: 'Next check-up',
        timeOfDay: '09:00',
        daysOfWeek: [],
        isActive: true,
        updatedAt: new Date().toISOString(),
        appointmentDate: futureDate(3),
      },
    ]);
    render(<RemindersPage />);

    const past = await screen.findByRole('region', { name: 'Past appointments' });
    expect(within(past).getByText('Old check-up')).toBeInTheDocument();
    expect(within(past).getByRole('button', { name: 'Delete Old check-up' })).toBeInTheDocument();
    const all = screen.getByRole('region', { name: 'All reminders' });
    expect(within(all).queryByText('Old check-up')).not.toBeInTheDocument();
    expect(within(all).getByText('Next check-up')).toBeInTheDocument();
  });
});

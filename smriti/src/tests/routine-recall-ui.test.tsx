import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { v4 as uuid } from 'uuid';
import { db } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import RoutineRecall from '@/components/games/RoutineRecall';
import { I18nProvider } from '@/lib/i18n/provider';

// The dynamically-imported HomePage below calls useTranslation() (My Progress button).
function render(ui: Parameters<typeof rtlRender>[0], options?: Parameters<typeof rtlRender>[1]) {
  return rtlRender(ui, { wrapper: I18nProvider, ...options });
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/app',
}));

const PATIENT_ID = 'patient-1';

async function seedReminder(reminderType: 'medication' | 'hydration' | 'activity' | 'appointment') {
  const id = uuid();
  await db.reminderSchedules.put({
    id,
    patientId: PATIENT_ID,
    reminderType,
    label: reminderType,
    timeOfDay: '08:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    isActive: true,
    updatedAt: new Date().toISOString(),
  });
  return id;
}

async function seedAck(reminderId: string, acknowledgedAt: string) {
  await db.reminderAcks.put({
    id: uuid(),
    reminderId,
    patientId: PATIENT_ID,
    scheduledAt: acknowledgedAt,
    acknowledgedAt,
    ackMethod: 'touch',
    synced: false,
  });
}

function todayAt(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

beforeEach(async () => {
  await db.reminderSchedules.clear();
  await db.reminderAcks.clear();
});

describe('RoutineRecall', () => {
  it('shows the caregiver-facing explanation when there is not enough activity', async () => {
    render(<RoutineRecall patientId={PATIENT_ID} sequenceLength={3} onComplete={() => {}} />);

    expect(
      await screen.findByText(/not enough reminder activity yet today/i),
    ).toBeInTheDocument();
  });

  it('renders a tappable card per real reminder ack and reports correctness on completion', async () => {
    const med = await seedReminder('medication');
    const hyd = await seedReminder('hydration');
    const act = await seedReminder('activity');
    await seedAck(med, todayAt(8));
    await seedAck(hyd, todayAt(11));
    await seedAck(act, todayAt(14));

    let reported: { correct: boolean; submittedOrder: string[] } | null = null;
    render(
      <RoutineRecall
        patientId={PATIENT_ID}
        sequenceLength={3}
        onComplete={(correct, submittedOrder) => {
          reported = { correct, submittedOrder };
        }}
      />,
    );

    // Wait for the 3 cards (one per acknowledged reminder) to render.
    const cards = await screen.findAllByRole('button', { name: /medication|hydration|activity/i });
    expect(cards).toHaveLength(3);

    // Tap them back in the real chronological order regardless of shuffled
    // display order — find by accessible name each time.
    fireEvent.click(await screen.findByRole('button', { name: /medication/i }));
    fireEvent.click(await screen.findByRole('button', { name: /hydration/i }));
    fireEvent.click(await screen.findByRole('button', { name: /activity/i }));

    await waitFor(() => expect(reported).not.toBeNull());
    expect(reported!.correct).toBe(true);
  });

  it('never shows negative language and still surfaces a result on a miss', async () => {
    const med = await seedReminder('medication');
    const hyd = await seedReminder('hydration');
    const act = await seedReminder('activity');
    await seedAck(med, todayAt(8));
    await seedAck(hyd, todayAt(11));
    await seedAck(act, todayAt(14));

    let reported: { correct: boolean } | null = null;
    render(
      <RoutineRecall
        patientId={PATIENT_ID}
        sequenceLength={3}
        onComplete={(correct) => {
          reported = { correct };
        }}
      />,
    );

    await screen.findAllByRole('button', { name: /medication|hydration|activity/i });

    // Tap in a deliberately wrong order.
    fireEvent.click(await screen.findByRole('button', { name: /activity/i }));
    fireEvent.click(await screen.findByRole('button', { name: /medication/i }));
    fireEvent.click(await screen.findByRole('button', { name: /hydration/i }));

    await waitFor(() => expect(reported).not.toBeNull());
    expect(reported!.correct).toBe(false);

    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/wrong|fail|incorrect|mistake/i);
    expect(await screen.findByText(/let's remember together/i)).toBeInTheDocument();
  });
});

describe('routine-recall home tile', () => {
  it('appears in the patient home game list', async () => {
    const HomePage = (await import('@/app/app/page')).default;
    usePatientStore.getState().setCurrentPatient({
      id: PATIENT_ID,
      caregiverId: 'c1',
      displayName: 'Test Patient',
      ageYears: 72,
      gender: 'female',
      educationYears: 4,
      primaryLanguage: 'as',
      sessionDurationMinutes: 10,
      isActive: true,
      currentDifficulty: {},
      updatedAt: new Date().toISOString(),
      syncedAt: null,
    });

    render(<HomePage />);
    expect(screen.getByRole('link', { name: /routine recall/i })).toBeInTheDocument();
  });
});

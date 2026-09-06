import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { db } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import type { LocalPatient } from '@/lib/db/schema';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/caregiver/memory-bank',
}));

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) } }),
}));

const patient: LocalPatient = {
  id: 'p1',
  caregiverId: 'c1',
  displayName: 'Aai',
  ageYears: 72,
  gender: 'female',
  educationYears: 4,
  primaryLanguage: 'as',
  sessionDurationMinutes: 10,
  isActive: true,
  currentDifficulty: {},
  updatedAt: new Date().toISOString(),
  syncedAt: null,
};

beforeEach(async () => {
  push.mockClear();
  await db.memoryBankEntries.clear();
  usePatientStore.setState({ ...usePatientStore.getInitialState(), currentPatient: patient });
});

describe('Memory Bank editor', () => {
  it('shows the empty state when no entries exist', async () => {
    const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
    render(<MemoryBankPage />);

    expect(
      await screen.findByText('Add the people and facts your loved one might ask about.'),
    ).toBeInTheDocument();
  });

  it('caregiver can add a person entry and it appears in the People section', async () => {
    const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
    render(<MemoryBankPage />);

    fireEvent.click(await screen.findByRole('button', { name: /add person/i }));

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Arun' } });
    fireEvent.change(screen.getByLabelText(/relationship/i), { target: { value: 'Son' } });
    fireEvent.change(screen.getByLabelText(/detail/i), {
      target: { value: 'Your son, visits every Sunday afternoon' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    const peopleSection = await screen.findByTestId('memory-bank-section-person');
    expect(within(peopleSection).getByText('Arun')).toBeInTheDocument();
    expect(within(peopleSection).getByText(/visits every sunday/i)).toBeInTheDocument();

    expect(await db.memoryBankEntries.count()).toBe(1);
  });

  it('caregiver can edit an existing entry', async () => {
    await db.memoryBankEntries.put({
      id: 'e1',
      patientId: 'p1',
      category: 'life_fact',
      title: 'Favourite tea',
      detail: 'Drinks red tea every morning',
      photoUrl: null,
      relationship: null,
      active: true,
      createdBy: 'c1',
      updatedAt: new Date().toISOString(),
    });

    const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
    render(<MemoryBankPage />);

    fireEvent.click(await screen.findByRole('button', { name: /edit favourite tea/i }));
    fireEvent.change(screen.getByLabelText(/detail/i), {
      target: { value: 'Drinks green tea every morning' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(async () => {
      const updated = await db.memoryBankEntries.get('e1');
      expect(updated?.detail).toBe('Drinks green tea every morning');
    });
  });

  it('caregiver can delete an entry (soft delete)', async () => {
    await db.memoryBankEntries.put({
      id: 'e2',
      patientId: 'p1',
      category: 'schedule',
      title: 'Sunday visit',
      detail: 'Family visits every Sunday',
      photoUrl: null,
      relationship: null,
      active: true,
      createdBy: 'c1',
      updatedAt: new Date().toISOString(),
    });

    const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
    render(<MemoryBankPage />);

    await screen.findByText('Sunday visit');
    fireEvent.click(screen.getByRole('button', { name: /delete sunday visit/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(async () => {
      const entry = await db.memoryBankEntries.get('e2');
      expect(entry?.active).toBe(false);
    });
    expect(screen.queryByText('Sunday visit')).not.toBeInTheDocument();
  });

  it('groups entries under visible category headings', async () => {
    await db.memoryBankEntries.bulkPut([
      { id: 'e3', patientId: 'p1', category: 'person', title: 'Arun', detail: 'Son', photoUrl: null, relationship: 'Son', active: true, createdBy: 'c1', updatedAt: new Date().toISOString() },
      { id: 'e4', patientId: 'p1', category: 'medication', title: 'Red pill', detail: 'After breakfast', photoUrl: null, relationship: null, active: true, createdBy: 'c1', updatedAt: new Date().toISOString() },
    ]);

    const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
    render(<MemoryBankPage />);

    expect(await screen.findByRole('heading', { name: /people/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /medication/i })).toBeInTheDocument();
  });
});

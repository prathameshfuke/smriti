import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { db } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useMemoryBankStore } from '@/stores/memoryBankStore';
import type { LocalPatient, LocalMemoryBankEntry } from '@/lib/db/schema';

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
  // The store is a module-level singleton, so leftover `entries` from a
  // previous test would otherwise still be sitting there for the brief
  // window before this test's own `loadEntries` effect resolves.
  useMemoryBankStore.setState({ entries: [] });
});

const baseEntry = (overrides: Partial<LocalMemoryBankEntry>): LocalMemoryBankEntry => ({
  id: 'base',
  patientId: 'p1',
  category: 'life_fact',
  title: 'Untitled',
  detail: '',
  photoUrl: null,
  relationship: null,
  active: true,
  createdBy: 'c1',
  updatedAt: new Date().toISOString(),
  synced: true,
  ...overrides,
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
      synced: true,
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
      synced: true,
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
      { id: 'e3', patientId: 'p1', category: 'person', title: 'Arun', detail: 'Son', photoUrl: null, relationship: 'Son', active: true, createdBy: 'c1', updatedAt: new Date().toISOString(), synced: true },
      { id: 'e4', patientId: 'p1', category: 'medication', title: 'Red pill', detail: 'After breakfast', photoUrl: null, relationship: null, active: true, createdBy: 'c1', updatedAt: new Date().toISOString(), synced: true },
    ]);

    const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
    render(<MemoryBankPage />);

    expect(await screen.findByRole('heading', { name: /people/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /medication/i })).toBeInTheDocument();
  });

  describe('the empty state offers all four categories, not just "Add Person"', () => {
    it('opens the correctly-categorised form from an empty bank without requiring a person first', async () => {
      const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
      render(<MemoryBankPage />);

      fireEvent.click(await screen.findByRole('button', { name: /^add schedule$/i }));

      expect(screen.getByRole('heading', { name: /add schedule/i })).toBeInTheDocument();
      // Schedule entries use "Title", not "Name" (the person-only label), and never show a
      // relationship/photo field — mixing those up is exactly the ambiguity a visual,
      // per-category picker is meant to prevent.
      expect(screen.getByLabelText(/^title$/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/relationship/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/photo/i)).not.toBeInTheDocument();
    });
  });

  describe('round-trip persistence (survives an actual reload, not just in-memory state)', () => {
    /** Unmounts, wipes the Zustand store back to empty (so nothing could be
     * carried over in memory), and remounts a fresh page instance. Anything
     * still visible afterwards can only have come from `loadEntries` reading
     * Dexie again from scratch. */
    async function reload() {
      useMemoryBankStore.setState({ entries: [] });
      const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
      render(<MemoryBankPage />);
    }

    it('an added entry is still there after a full reload', async () => {
      const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
      const { unmount } = render(<MemoryBankPage />);

      fireEvent.click(await screen.findByRole('button', { name: /add person/i }));
      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Arun' } });
      fireEvent.change(screen.getByLabelText(/relationship/i), { target: { value: 'Son' } });
      fireEvent.change(screen.getByLabelText(/detail/i), { target: { value: 'Visits on Sundays' } });
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      await screen.findByText('Arun');
      unmount();

      await reload();

      const peopleSection = await screen.findByTestId('memory-bank-section-person');
      expect(within(peopleSection).getByText('Arun')).toBeInTheDocument();
      expect(within(peopleSection).getByText(/visits on sundays/i)).toBeInTheDocument();
    });

    it("an edited entry's changes are still there after a full reload", async () => {
      await db.memoryBankEntries.put(
        baseEntry({ id: 'e1', category: 'life_fact', title: 'Favourite tea', detail: 'Drinks red tea every morning' }),
      );

      const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
      const { unmount } = render(<MemoryBankPage />);

      fireEvent.click(await screen.findByRole('button', { name: /edit favourite tea/i }));
      fireEvent.change(screen.getByLabelText(/detail/i), { target: { value: 'Drinks green tea every morning' } });
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      await screen.findByText(/drinks green tea/i);
      unmount();

      await reload();

      expect(await screen.findByText(/drinks green tea every morning/i)).toBeInTheDocument();
      expect(screen.queryByText(/drinks red tea/i)).not.toBeInTheDocument();
    });

    it('a deleted entry is durably excluded after reload — the removal is persisted, not just hidden in the UI', async () => {
      await db.memoryBankEntries.put(
        baseEntry({ id: 'e2', category: 'schedule', title: 'Sunday visit', detail: 'Family visits every Sunday' }),
      );

      const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
      const { unmount } = render(<MemoryBankPage />);

      await screen.findByText('Sunday visit');
      fireEvent.click(screen.getByRole('button', { name: /delete sunday visit/i }));
      fireEvent.click(screen.getByRole('button', { name: /remove/i }));

      await waitFor(async () => {
        const stored = await db.memoryBankEntries.get('e2');
        // This app's deletes are an intentional soft-delete (matching
        // `patientStore.deactivatePatient` / docs/07_AGENT_PROMPTS.md's
        // "soft delete (is_active = false)" convention) so an offline delete
        // still has something to push through `/api/sync` — a hard
        // `.delete()` would silently never propagate to other devices. The
        // row must still exist, flipped inactive and flagged unsynced.
        expect(stored).toBeDefined();
        expect(stored?.active).toBe(false);
        expect(stored?.synced).toBe(false);
      });

      unmount();

      // Force the store back to a stale snapshot that still *includes* the
      // now-deleted entry, as if a previous screen had cached it. If the
      // deletion only ever removed it from a local array — rather than
      // durably persisting to Dexie — this stale state would leak straight
      // back onto the screen on the very next render.
      useMemoryBankStore.setState({
        entries: [baseEntry({ id: 'e2', category: 'schedule', title: 'Sunday visit', active: true })],
      });
      const { default: MemoryBankPage2 } = await import('@/app/caregiver/memory-bank/page');
      render(<MemoryBankPage2 />);

      await waitFor(() => {
        expect(screen.queryByText('Sunday visit')).not.toBeInTheDocument();
      });
      const stillInDb = await db.memoryBankEntries.get('e2');
      expect(stillInDb?.active).toBe(false);
    });
  });

  describe('photo upload for person entries', () => {
    it('shows a live preview after choosing a photo and persists it on save', async () => {
      const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
      render(<MemoryBankPage />);

      fireEvent.click(await screen.findByRole('button', { name: /add person/i }));
      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Meena' } });
      fireEvent.change(screen.getByLabelText(/relationship/i), { target: { value: 'Daughter' } });
      fireEvent.change(screen.getByLabelText(/detail/i), { target: { value: 'Calls every evening' } });

      const file = new File(['fake-image-bytes'], 'meena.png', { type: 'image/png' });
      fireEvent.change(screen.getByLabelText(/^photo$/i), { target: { files: [file] } });

      const preview = await screen.findByAltText(/photo of meena/i);
      expect(preview).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /remove photo/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      await screen.findByText('Meena');

      const all = await db.memoryBankEntries.toArray();
      const saved = all.find((e) => e.title === 'Meena');
      expect(saved?.photoUrl).toMatch(/^data:/);
    });

    it('rejects an oversized photo with a clear message and keeps the form usable', async () => {
      const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
      render(<MemoryBankPage />);

      fireEvent.click(await screen.findByRole('button', { name: /add person/i }));

      const tooBig = new File(['x'], 'huge.png', { type: 'image/png' });
      Object.defineProperty(tooBig, 'size', { value: 6 * 1024 * 1024 });
      fireEvent.change(screen.getByLabelText(/^photo$/i), { target: { files: [tooBig] } });

      expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i);
      expect(screen.queryByAltText(/selected photo preview/i)).not.toBeInTheDocument();
    });
  });

  describe('guidance against confusing duplicate entries', () => {
    it('warns, without blocking Save, when a second person shares a relationship with an existing one', async () => {
      await db.memoryBankEntries.put(baseEntry({ id: 'e5', category: 'person', title: 'Arun', relationship: 'Son', detail: 'Elder son' }));

      const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
      render(<MemoryBankPage />);

      // Wait for `loadEntries` to settle and the seeded entry to appear before
      // opening the form — this test pre-seeds a person, so (unlike the
      // empty-bank tests) there's a real empty→loaded transition to get past
      // first, and clicking during that window would open the wrong control.
      const peopleSection = await screen.findByTestId('memory-bank-section-person');
      await within(peopleSection).findByText('Arun');
      fireEvent.click(within(peopleSection).getByRole('button', { name: /^add$/i }));
      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'David' } });
      fireEvent.change(screen.getByLabelText(/relationship/i), { target: { value: 'Son' } });
      fireEvent.change(screen.getByLabelText(/detail/i), { target: { value: 'Younger son, lives abroad' } });

      expect(await screen.findByText(/already have "arun" listed as "son"/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled();
    });
  });

  describe('explicit save confirmation', () => {
    it('shows a dismissible confirmation banner after adding, and another after deleting', async () => {
      const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
      render(<MemoryBankPage />);

      fireEvent.click(await screen.findByRole('button', { name: /add person/i }));
      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Arun' } });
      fireEvent.change(screen.getByLabelText(/detail/i), { target: { value: 'Visits on Sundays' } });
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      const savedBanner = await screen.findByRole('status');
      expect(savedBanner).toHaveTextContent(/saved.*arun.*added/i);

      fireEvent.click(screen.getByRole('button', { name: /dismiss confirmation/i }));
      expect(screen.queryByText(/saved.*arun.*added/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /delete arun/i }));
      fireEvent.click(screen.getByRole('button', { name: /remove/i }));

      expect(await screen.findByText(/removed.*arun.*deleted/i)).toBeInTheDocument();
    });
  });
});

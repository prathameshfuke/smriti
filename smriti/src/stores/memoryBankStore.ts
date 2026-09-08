import { create } from 'zustand';
import { db, type LocalMemoryBankEntry } from '@/lib/db/schema';

interface MemoryBankState {
  entries: LocalMemoryBankEntry[];
  loadEntries: (patientId: string) => Promise<void>;
  addEntry: (entry: Omit<LocalMemoryBankEntry, 'synced'>) => Promise<void>;
  updateEntry: (id: string, changes: Partial<LocalMemoryBankEntry>) => Promise<void>;
  /** Soft-delete, matching `patientStore.deactivatePatient` — keeps the
   * record for sync/audit rather than losing it if a delete races offline. */
  deleteEntry: (id: string) => Promise<void>;
}

async function activeEntriesFor(patientId: string): Promise<LocalMemoryBankEntry[]> {
  return db.memoryBankEntries
    .where('patientId')
    .equals(patientId)
    .filter((e) => e.active)
    .toArray();
}

export const useMemoryBankStore = create<MemoryBankState>()((set, get) => ({
  entries: [],

  loadEntries: async (patientId) => {
    const entries = await activeEntriesFor(patientId);
    set({ entries });
  },

  addEntry: async (entry) => {
    const withSync: LocalMemoryBankEntry = { ...entry, synced: false };
    await db.memoryBankEntries.put(withSync);
    set({ entries: [...get().entries, withSync] });
  },

  updateEntry: async (id, changes) => {
    const existing = await db.memoryBankEntries.get(id);
    if (!existing) return;

    const updated: LocalMemoryBankEntry = {
      ...existing,
      ...changes,
      updatedAt: new Date().toISOString(),
      synced: false,
    };

    await db.memoryBankEntries.put(updated);
    set({ entries: get().entries.map((e) => (e.id === id ? updated : e)) });
  },

  deleteEntry: async (id) => {
    const existing = await db.memoryBankEntries.get(id);
    if (!existing) return;

    const updated: LocalMemoryBankEntry = {
      ...existing,
      active: false,
      updatedAt: new Date().toISOString(),
      synced: false,
    };

    await db.memoryBankEntries.put(updated);
    set({ entries: get().entries.filter((e) => e.id !== id) });
  },
}));

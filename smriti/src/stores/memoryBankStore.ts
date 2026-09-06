import { create } from 'zustand';
import { db, type LocalMemoryBankEntry } from '@/lib/db/schema';
import { buildQueueItem } from '@/lib/db/syncQueue';

interface MemoryBankState {
  entries: LocalMemoryBankEntry[];
  loadEntries: (patientId: string) => Promise<void>;
  addEntry: (entry: LocalMemoryBankEntry) => Promise<void>;
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
    await db.transaction('rw', db.memoryBankEntries, db.syncQueue, async () => {
      await db.memoryBankEntries.put(entry);
      await db.syncQueue.put(buildQueueItem('memory_bank_entries', entry.id, 'insert', { ...entry }));
    });
    set({ entries: [...get().entries, entry] });
  },

  updateEntry: async (id, changes) => {
    const existing = await db.memoryBankEntries.get(id);
    if (!existing) return;

    const updated: LocalMemoryBankEntry = {
      ...existing,
      ...changes,
      updatedAt: new Date().toISOString(),
    };

    await db.transaction('rw', db.memoryBankEntries, db.syncQueue, async () => {
      await db.memoryBankEntries.put(updated);
      await db.syncQueue.put(buildQueueItem('memory_bank_entries', updated.id, 'update', { ...updated }));
    });
    set({ entries: get().entries.map((e) => (e.id === id ? updated : e)) });
  },

  deleteEntry: async (id) => {
    const existing = await db.memoryBankEntries.get(id);
    if (!existing) return;

    const updated: LocalMemoryBankEntry = {
      ...existing,
      active: false,
      updatedAt: new Date().toISOString(),
    };

    await db.transaction('rw', db.memoryBankEntries, db.syncQueue, async () => {
      await db.memoryBankEntries.put(updated);
      await db.syncQueue.put(buildQueueItem('memory_bank_entries', updated.id, 'update', { ...updated }));
    });
    set({ entries: get().entries.filter((e) => e.id !== id) });
  },
}));

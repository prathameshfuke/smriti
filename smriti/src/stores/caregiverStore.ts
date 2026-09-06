import { create } from 'zustand';
import { db, type LocalCaregiver } from '@/lib/db/schema';
import { buildQueueItem } from '@/lib/db/syncQueue';

interface CaregiverState {
  currentCaregiver: LocalCaregiver | null;
  setCurrentCaregiver: (caregiver: LocalCaregiver | null) => void;
  /** Onboarding's only write path — creates the caregiver and queues it for sync. */
  createCaregiver: (caregiver: LocalCaregiver) => Promise<void>;
}

export const useCaregiverStore = create<CaregiverState>()((set) => ({
  currentCaregiver: null,

  setCurrentCaregiver: (currentCaregiver) => set({ currentCaregiver }),

  createCaregiver: async (caregiver) => {
    await db.transaction('rw', db.caregivers, db.syncQueue, async () => {
      await db.caregivers.put(caregiver);
      await db.syncQueue.put(
        buildQueueItem('caregivers', caregiver.id, 'insert', { ...caregiver }),
      );
    });
    set({ currentCaregiver: caregiver });
  },
}));

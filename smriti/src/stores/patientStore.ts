import { create } from 'zustand';
import { db, type LocalPatient } from '@/lib/db/schema';
import { buildQueueItem } from '@/lib/db/syncQueue';

interface PatientState {
  currentPatient: LocalPatient | null;
  allPatients: LocalPatient[];
  setCurrentPatient: (patient: LocalPatient | null) => void;
  /** Loads one caregiver's active patients from IndexedDB. */
  loadPatients: (caregiverId: string) => Promise<void>;
  addPatient: (patient: LocalPatient) => Promise<void>;
  /** Persists a new difficulty level for one game, keeping currentPatient in sync. */
  updateDifficulty: (patientId: string, gameType: string, level: number) => Promise<void>;
  /** Soft-deletes a patient (isActive: false) and syncs the change, per the reminders page's precedent. */
  deactivatePatient: (patientId: string) => Promise<void>;
}

/**
 * Reads are always scoped to a caregiver. An ASHA device is shared between
 * workers, and an unscoped read would put another caregiver's patients — and
 * their health data — on screen.
 */
async function activePatientsFor(caregiverId: string): Promise<LocalPatient[]> {
  // caregiverId is indexed; isActive is not, because Dexie cannot key booleans.
  return db.patients.where('caregiverId').equals(caregiverId).filter((p) => p.isActive).toArray();
}

export const usePatientStore = create<PatientState>()((set, get) => ({
  currentPatient: null,
  allPatients: [],

  setCurrentPatient: (currentPatient) => set({ currentPatient }),

  loadPatients: async (caregiverId) => {
    set({ allPatients: await activePatientsFor(caregiverId) });
  },

  addPatient: async (patient) => {
    await db.transaction('rw', db.patients, db.syncQueue, async () => {
      await db.patients.put(patient);
      await db.syncQueue.put(
        buildQueueItem('patients', patient.id, 'update', { ...patient }),
      );
    });
    set({ allPatients: await activePatientsFor(patient.caregiverId) });
  },

  updateDifficulty: async (patientId, gameType, level) => {
    const patient = await db.patients.get(patientId);
    if (!patient) return;

    const updated: LocalPatient = {
      ...patient,
      currentDifficulty: { ...patient.currentDifficulty, [gameType]: level },
      // `updatedAt` deliberately left alone, and nothing queued for sync.
      // The server `patients` table has no difficulty column (see
      // docs/03_DATABASE.md, and `toLocalPatient` in lib/db/sync.ts) — this
      // progression is local by design. Queuing it anyway sent a profile
      // update after every single session whose only real effect was a
      // newer `updated_at`, which is what last-write-wins compares: a
      // caregiver's edit on their own phone could be thrown away by a
      // patient simply finishing a game.
    };

    await db.patients.put(updated);

    if (get().currentPatient?.id === patientId) {
      set({ currentPatient: updated });
    }
  },

  deactivatePatient: async (patientId) => {
    const patient = await db.patients.get(patientId);
    if (!patient) return;

    const updated: LocalPatient = {
      ...patient,
      isActive: false,
      updatedAt: new Date().toISOString(),
    };

    await db.transaction('rw', db.patients, db.syncQueue, async () => {
      await db.patients.put(updated);
      await db.syncQueue.put(buildQueueItem('patients', updated.id, 'update', { ...updated }));
    });

    set({ allPatients: await activePatientsFor(patient.caregiverId) });
    if (get().currentPatient?.id === patientId) {
      set({ currentPatient: null });
    }
  },
}));

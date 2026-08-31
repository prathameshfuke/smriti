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

export const usePatientStore = create<PatientState>()((set) => ({
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
}));

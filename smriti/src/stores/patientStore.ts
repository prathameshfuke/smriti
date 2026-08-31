import { create } from 'zustand';
import { db, type LocalPatient } from '@/lib/db/schema';

interface PatientState {
  currentPatient: LocalPatient | null;
  allPatients: LocalPatient[];
  setCurrentPatient: (patient: LocalPatient | null) => void;
  /** Loads active patients from IndexedDB. */
  loadPatients: () => Promise<void>;
  addPatient: (patient: LocalPatient) => Promise<void>;
}

export const usePatientStore = create<PatientState>()((set) => ({
  currentPatient: null,
  allPatients: [],

  setCurrentPatient: (currentPatient) => set({ currentPatient }),

  loadPatients: async () => {
    // isActive is indexed, but Dexie cannot key on booleans, so it is filtered here.
    const allPatients = await db.patients.filter((p) => p.isActive).toArray();
    set({ allPatients });
  },

  addPatient: async (patient) => {
    await db.patients.put(patient);
    const allPatients = await db.patients.filter((p) => p.isActive).toArray();
    set({ allPatients });
  },
}));

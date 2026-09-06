import { db } from '@/lib/db/schema';
import { useCaregiverStore } from '@/stores/caregiverStore';
import { usePatientStore } from '@/stores/patientStore';

/**
 * Single-caregiver-per-device (kiosk) model: whatever caregiver profile is
 * sitting in local Dexie storage IS this device's caregiver, no Supabase
 * session or authUserId lookup needed. Restores it (and the first active
 * patient) into the in-memory Zustand stores.
 *
 * `usePatientStore`/`useCaregiverStore` are plain (non-persisted) stores —
 * they reset to empty on every fresh page load — while the local Dexie data
 * they mirror survives it. Without this, every reload of `/app` (closing and
 * reopening the tablet, a PWA relaunch, anything short of the tab staying
 * open forever) forgot who the patient was and sent the caregiver back
 * through login and onboarding for no reason. Both `/app` and
 * `/caregiver/layout.tsx` call this on mount so neither entry point can
 * regress into that.
 */
export async function restoreLocalSession(): Promise<boolean> {
  const localCaregiver = await db.caregivers.toCollection().first();
  if (!localCaregiver) return false;

  useCaregiverStore.getState().setCurrentCaregiver(localCaregiver);
  await usePatientStore.getState().loadPatients(localCaregiver.id);

  if (!usePatientStore.getState().currentPatient) {
    const active = usePatientStore.getState().allPatients[0] ?? null;
    usePatientStore.getState().setCurrentPatient(active);
  }

  return true;
}

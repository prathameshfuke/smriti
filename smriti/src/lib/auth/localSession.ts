import { db, type LocalPatient } from '@/lib/db/schema';
import { getDeviceTrustToken } from '@/lib/auth/deviceTrust';
import { useCaregiverStore } from '@/stores/caregiverStore';
import { usePatientStore } from '@/stores/patientStore';

/**
 * Single-caregiver-per-device (kiosk) model: whatever caregiver profile is
 * sitting in local Dexie storage IS this device's caregiver, no Supabase
 * session or authUserId lookup needed. Restores it (and the device's active
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
 *
 * Which patient to restore: a kiosk device is trusted for exactly one
 * patient, and that identity is authoritative in the device-trust token
 * (set alongside the patient at the end of onboarding — see
 * `caregiver/onboarding/page.tsx`), not in "whichever active patient happens
 * to be first" — an ASHA worker's device can carry more than one patient
 * locally. So the token's `patientId` is tried first; the "first active
 * patient" heuristic only covers the case where no token exists yet (e.g. a
 * caregiver-only device that was never trust-registered) or the token points
 * at a patient no longer present/active for this caregiver.
 */
export async function restoreLocalSession(): Promise<boolean> {
  const localCaregiver = await db.caregivers.toCollection().first();
  if (!localCaregiver) return false;

  useCaregiverStore.getState().setCurrentCaregiver(localCaregiver);
  await usePatientStore.getState().loadPatients(localCaregiver.id);

  if (!usePatientStore.getState().currentPatient) {
    const token = await getDeviceTrustToken();
    let active: LocalPatient | null = null;
    if (token) {
      const trusted = await db.patients.get(token.patientId);
      if (trusted && trusted.caregiverId === localCaregiver.id && trusted.isActive) {
        active = trusted;
      }
    }
    if (!active) {
      active = usePatientStore.getState().allPatients[0] ?? null;
    }
    usePatientStore.getState().setCurrentPatient(active);
  }

  return true;
}

import { db, type LocalPatient } from '@/lib/db/schema';
import { getDeviceTrustToken } from '@/lib/auth/deviceTrust';
import { pullCaregiverProfile, type ProfilePullResult } from '@/lib/db/serverProfile';
import { createBrowserClient } from '@/lib/supabase/client';
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
  // More than one local caregiver row is never a valid state under this
  // model — it means onboarding ran twice on the same device (e.g. the
  // caregiver went through setup again with the same email instead of using
  // Log Out or Delete All Data first), leaving an old caregiver+patient pair
  // behind next to the new one. Picking "first" arbitrarily is exactly how
  // one screen ends up showing the old patient's name while another
  // (server-backed) screen correctly shows the new one — the two disagree
  // about which local row is current. Self-heal by wiping the stale local
  // copy and falling through to "no local profile," which forces a real
  // pull from the server (the one place a single row per caregiver is
  // actually enforced) on next login.
  const caregiverCount = await db.caregivers.count();
  if (caregiverCount > 1) {
    await db.transaction('rw', db.caregivers, db.patients, db.reminderSchedules, async () => {
      await db.caregivers.clear();
      await db.patients.clear();
      await db.reminderSchedules.clear();
    });
    return false;
  }

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

/**
 * Pulls a caregiver's profile from the server by their Supabase auth id and
 * writes it into local Dexie + the Zustand stores — the one real login path,
 * shared by both `/caregiver/login` (so verifying the code works no matter
 * which screen it's asked to return to afterward — the patient's `/app` home
 * included, not just the caregiver dashboard) and `caregiver/layout.tsx`'s
 * own "no local profile yet" fallback. Duplicating this in both places is
 * exactly how they used to drift: the login page used to just redirect on a
 * successful code, relying on the *next* page happening to be wrapped in
 * `CaregiverLayout` to actually populate anything — which left `/app` still
 * showing "No patient selected" after a genuinely successful login, because
 * `/app` was never wrapped in that layout and nothing else did the pull.
 */
export async function pullAndStoreServerProfile(
  authUserId: string,
): Promise<ProfilePullResult['status']> {
  const pulled = await pullCaregiverProfile(authUserId);
  if (pulled.status !== 'found') return pulled.status;

  await db.transaction('rw', db.caregivers, db.patients, db.reminderSchedules, async () => {
    await db.caregivers.put(pulled.caregiver);
    await db.patients.bulkPut(pulled.patients);
    if (pulled.reminders.length) await db.reminderSchedules.bulkPut(pulled.reminders);
  });
  useCaregiverStore.getState().setCurrentCaregiver(pulled.caregiver);
  await usePatientStore.getState().loadPatients(pulled.caregiver.id);
  const active = pulled.patients.find((p) => p.isActive) ?? null;
  usePatientStore.getState().setCurrentPatient(active);

  return 'found';
}

export type LiveCaregiverSessionStatus = 'valid' | 'invalid' | 'offline';

/**
 * The caregiver PIN (`settingsStore`) is a fast unlock layered on a real
 * login, not a replacement for one — it must defer to whether that login is
 * actually still live once it's old enough to plausibly have expired. Uses
 * `getSession()`, not `getUser()`, matching `caregiver/layout.tsx`'s own
 * guard: it reads the already-established local session rather than forcing
 * a network round trip, so a briefly-offline device isn't punished for it.
 * `navigator.onLine` is checked first so "no network" and "no session" are
 * never confused — the PIN should still work offline, just unverified until
 * the device is back online.
 */
export async function checkLiveCaregiverSession(): Promise<LiveCaregiverSessionStatus> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  const { data } = await createBrowserClient().auth.getSession();
  return data.session ? 'valid' : 'invalid';
}

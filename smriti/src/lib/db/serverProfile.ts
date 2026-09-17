import { createBrowserClient } from '@/lib/supabase/client';
import type { LocalCaregiver, LocalPatient, LocalReminderSchedule } from './schema';
import { toHHMM, type Language, type PatientLanguage } from '@/lib/supabase/types';
import { toLocalAppointmentFields, toWireAppointmentFields } from './wire';

const NETWORK_TIMEOUT_MS = 8_000;

/** Accepts a Supabase query builder (thenable, not a real Promise) as well as a Promise. */
function withTimeout<T>(thenable: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(thenable),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms)),
  ]);
}

/**
 * Mirrors a freshly-onboarded caregiver + patient into Supabase so the
 * caregiver dashboard (`/api/patients`) can find them, and so any other
 * device — or this one after storage is cleared — can pull the same profile
 * instead of re-running onboarding. Best-effort: offline onboarding must
 * still finish locally, so a failure here is swallowed and the local Dexie
 * record stays the source of truth until the next successful push.
 */
export async function pushCaregiverProfile(
  caregiver: LocalCaregiver,
  patient: LocalPatient,
  language: Language,
  reminders: LocalReminderSchedule[] = [],
): Promise<boolean> {
  try {
    const supabase = createBrowserClient();

    const { error: caregiverError } = await withTimeout(
      supabase.from('caregivers').upsert(
        {
          id: caregiver.id,
          auth_id: caregiver.authUserId,
          display_name: caregiver.displayName,
          phone: null,
          email: null,
          role: caregiver.role,
          preferred_language: language,
        },
        { onConflict: 'auth_id' },
      ),
      NETWORK_TIMEOUT_MS,
    );
    if (caregiverError) return false;

    const { error: patientError } = await withTimeout(
      supabase.from('patients').upsert({
        id: patient.id,
        caregiver_id: caregiver.id,
        display_name: patient.displayName,
        age_years: patient.ageYears,
        gender: patient.gender,
        education_years: patient.educationYears,
        primary_language: patient.primaryLanguage as PatientLanguage,
        session_duration_minutes: patient.sessionDurationMinutes,
        is_active: patient.isActive,
      }),
      NETWORK_TIMEOUT_MS,
    );
    if (patientError) return false;

    if (reminders.length) {
      const { error: reminderError } = await withTimeout(
        supabase.from('reminder_schedules').upsert(
          reminders.map((r) => ({
            id: r.id,
            patient_id: r.patientId,
            reminder_type: r.reminderType,
            label: r.label,
            time_of_day: r.timeOfDay,
            days_of_week: r.daysOfWeek,
            is_active: r.isActive,
            ...toWireAppointmentFields({ ...r }),
          })),
        ),
        NETWORK_TIMEOUT_MS,
      );
      if (reminderError) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export type ProfilePullResult =
  | { status: 'found'; caregiver: LocalCaregiver; patients: LocalPatient[]; reminders: LocalReminderSchedule[] }
  | { status: 'not_found' }
  | { status: 'error' };

/**
 * Looks up a caregiver's full profile by their Supabase auth id. Used when a
 * device has a valid session but no local IndexedDB profile — a new device,
 * or storage was cleared. Lets the caregiver layout hydrate Dexie from the
 * server instead of forcing the onboarding wizard on someone who already
 * onboarded elsewhere.
 */
export async function pullCaregiverProfile(authUserId: string): Promise<ProfilePullResult> {
  try {
    const supabase = createBrowserClient();

    const { data: caregiverRow, error: caregiverError } = await withTimeout(
      supabase.from('caregivers').select('*').eq('auth_id', authUserId).maybeSingle(),
      NETWORK_TIMEOUT_MS,
    );
    if (caregiverError) return { status: 'error' };
    if (!caregiverRow) return { status: 'not_found' };

    const caregiver: LocalCaregiver = {
      id: caregiverRow.id,
      authUserId: caregiverRow.auth_id,
      displayName: caregiverRow.display_name,
      role: caregiverRow.role,
      createdAt: caregiverRow.created_at,
    };

    const { data: patientRows, error: patientError } = await withTimeout(
      supabase.from('patients').select('*').eq('caregiver_id', caregiver.id),
      NETWORK_TIMEOUT_MS,
    );
    if (patientError) return { status: 'error' };

    const nowIso = new Date().toISOString();
    const patients: LocalPatient[] = (patientRows ?? []).map((p: NonNullable<typeof patientRows>[number]) => ({
      id: p.id,
      caregiverId: p.caregiver_id,
      displayName: p.display_name,
      ageYears: p.age_years ?? 0,
      gender: p.gender ?? 'other',
      educationYears: p.education_years,
      primaryLanguage: p.primary_language,
      sessionDurationMinutes: p.session_duration_minutes,
      isActive: p.is_active,
      currentDifficulty: {},
      updatedAt: p.updated_at,
      syncedAt: nowIso,
    }));

    const patientIds = patients.map((p) => p.id);
    let reminders: LocalReminderSchedule[] = [];
    if (patientIds.length) {
      const { data: reminderRows, error: reminderError } = await withTimeout(
        supabase.from('reminder_schedules').select('*').in('patient_id', patientIds),
        NETWORK_TIMEOUT_MS,
      );
      if (!reminderError) {
        reminders = (reminderRows ?? []).map((r: NonNullable<typeof reminderRows>[number]) => ({
          id: r.id,
          patientId: r.patient_id,
          reminderType: r.reminder_type,
          label: r.label,
          timeOfDay: toHHMM(r.time_of_day),
          daysOfWeek: r.days_of_week,
          isActive: r.is_active,
          updatedAt: r.updated_at,
          createdAt: r.created_at,
          ...toLocalAppointmentFields(r),
        }));
      }
    }

    return { status: 'found', caregiver, patients, reminders };
  } catch {
    return { status: 'error' };
  }
}

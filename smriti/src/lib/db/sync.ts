import {
  db,
  type LocalPatient,
  type LocalReminderSchedule,
  type LocalGameSession,
  type LocalTelemetryEvent,
  type LocalDailySummary,
  type LocalReminderAck,
} from './schema';
import { createBrowserClient } from '@/lib/supabase/client';

const SYNC_TIMEOUT_MS = 15_000;

export interface SyncResult {
  success: boolean;
  error?: string;
}

/** Raw wire shape from /api/sync — PostgREST returns snake_case columns, never camelCase. */
interface ServerPatientRow {
  id: string;
  caregiver_id: string;
  display_name: string;
  age_years: number | null;
  gender: 'male' | 'female' | 'other' | null;
  education_years: number;
  primary_language: string;
  session_duration_minutes: number;
  is_active: boolean;
  updated_at: string;
}

interface ServerReminderRow {
  id: string;
  patient_id: string;
  reminder_type: LocalReminderSchedule['reminderType'];
  label: string;
  time_of_day: string;
  days_of_week: number[];
  is_active: boolean;
  updated_at: string;
}

/** Which of one patient's row categories the server rejected this sync — see api/sync/route.ts. */
interface PatientSyncErrors {
  sessions?: string;
  events?: string;
  dailySummaries?: string;
  reminderAcks?: string;
}

interface SyncResponseBody {
  serverTimestamp: string;
  syncedEventCount: number;
  syncErrors: Record<string, PatientSyncErrors>;
  updates: {
    patients: ServerPatientRow[];
    reminders: ServerReminderRow[];
    alerts: unknown[];
  };
}

interface PatientSyncPayload {
  patientId: string;
  sessions: LocalGameSession[];
  events: LocalTelemetryEvent[];
  dailySummaries: LocalDailySummary[];
  reminderAcks: LocalReminderAck[];
}

/**
 * Maps a server patient row into the local camelCase shape. Field names
 * differ between the two (`db/schema.ts`'s own header comment says as
 * much) — merging a raw snake_case row straight into Dexie silently leaves
 * `patient.isActive`/`patient.caregiverId`/etc. `undefined` on every read,
 * and comparing `incoming.updatedAt` (undefined on a raw row) against
 * `local.updatedAt` always came out false, silently dropping every
 * cross-device patient edit.
 *
 * `current_difficulty` has no column in the server `patients` table (see
 * docs/03_DATABASE.md) — difficulty progression is local-only by design.
 * Overwriting it from a server row would silently reset a patient's level
 * on every sync, so the caller passes in the existing local value instead
 * of this function inventing one.
 */
function toLocalPatient(row: ServerPatientRow, existingDifficulty: Record<string, number>): LocalPatient {
  return {
    id: row.id,
    caregiverId: row.caregiver_id,
    displayName: row.display_name,
    ageYears: row.age_years ?? 0,
    gender: row.gender ?? 'other',
    educationYears: row.education_years,
    primaryLanguage: row.primary_language,
    sessionDurationMinutes: row.session_duration_minutes,
    isActive: row.is_active,
    currentDifficulty: existingDifficulty,
    updatedAt: row.updated_at,
    syncedAt: new Date().toISOString(),
  };
}

function toLocalReminderSchedule(row: ServerReminderRow): LocalReminderSchedule {
  return {
    id: row.id,
    patientId: row.patient_id,
    reminderType: row.reminder_type,
    label: row.label,
    timeOfDay: row.time_of_day,
    daysOfWeek: row.days_of_week,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

/** Every unsynced Dexie row for one patient, shaped for the /api/sync request body. */
async function gatherUnsyncedRows(patientId: string): Promise<PatientSyncPayload> {
  const [sessions, events, dailySummaries, reminderAcks] = await Promise.all([
    db.gameSessions.where('patientId').equals(patientId).filter((r) => !r.synced).toArray(),
    db.telemetryEvents.where('patientId').equals(patientId).filter((r) => !r.synced).toArray(),
    // dailySummaries has no plain `patientId` index (only the compound
    // [patientId+summaryDate+gameType]), so `.where('patientId')` isn't valid here.
    db.dailySummaries.toCollection().filter((r) => r.patientId === patientId && !r.synced).toArray(),
    db.reminderAcks.where('patientId').equals(patientId).filter((r) => !r.synced).toArray(),
  ]);
  return { patientId, sessions, events, dailySummaries, reminderAcks };
}

/**
 * Marks every row across every patient as synced, and applies whatever the
 * server sent back — one transaction for the whole batch.
 *
 * A row category is only marked `synced` when the server actually reports no
 * `syncErrors` entry for it — previously this ran unconditionally off a bare
 * HTTP 200, so a batch Supabase rejected (e.g. a game_type CHECK-constraint
 * violation) still got flagged `synced: true` locally. That made the local
 * "pending" count go to zero and the caregiver dashboard's Supabase-backed
 * queries keep coming up empty, with no visible sign anything was wrong.
 */
async function applySyncResponse(payloads: PatientSyncPayload[], body: SyncResponseBody): Promise<void> {
  await db.transaction(
    'rw',
    [db.gameSessions, db.telemetryEvents, db.dailySummaries, db.reminderAcks, db.patients, db.reminderSchedules],
    async () => {
      for (const payload of payloads) {
        const errors = body.syncErrors?.[payload.patientId] ?? {};
        if (!errors.sessions) {
          await db.gameSessions.bulkPut(payload.sessions.map((s) => ({ ...s, synced: true })) as never[]);
        }
        if (!errors.events) {
          await db.telemetryEvents.bulkPut(payload.events.map((e) => ({ ...e, synced: true })) as never[]);
        }
        if (!errors.dailySummaries) {
          await db.dailySummaries.bulkPut(payload.dailySummaries.map((d) => ({ ...d, synced: true })) as never[]);
        }
        if (!errors.reminderAcks) {
          await db.reminderAcks.bulkPut(payload.reminderAcks.map((a) => ({ ...a, synced: true })) as never[]);
        }
      }

      for (const incoming of body.updates.patients ?? []) {
        const local = await db.patients.get(incoming.id);
        if (!local || new Date(incoming.updated_at) > new Date(local.updatedAt)) {
          await db.patients.put(toLocalPatient(incoming, local?.currentDifficulty ?? {}));
        }
      }

      for (const incoming of body.updates.reminders ?? []) {
        const local = await db.reminderSchedules.get(incoming.id);
        if (!local || new Date(incoming.updated_at) > new Date(local.updatedAt)) {
          await db.reminderSchedules.put(toLocalReminderSchedule(incoming));
        }
      }
    },
  );
}

async function postSync(payloads: PatientSyncPayload[], accessToken: string): Promise<SyncResult> {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        lastSyncTimestamp: null,
        patients: payloads,
      }),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });

    if (!res.ok) {
      return { success: false, error: `sync failed with status ${res.status}` };
    }

    const body = (await res.json()) as SyncResponseBody;
    await applySyncResponse(payloads, body);

    const failedPatientIds = Object.keys(body.syncErrors ?? {});
    if (failedPatientIds.length > 0) {
      return { success: false, error: `sync rejected for patient(s): ${failedPatientIds.join(', ')}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'unknown sync error' };
  }
}

async function getAccessToken(): Promise<string | undefined> {
  try {
    const { data } = await createBrowserClient().auth.getSession();
    return data.session?.access_token;
  } catch {
    return undefined;
  }
}

/**
 * Pushes one patient's unsynced Dexie rows to `/api/sync`, then applies
 * whatever the server sends back for profile/reminder rows — last-write-wins
 * by `updatedAt`, so a stale response never regresses fresher local edits.
 */
export async function syncToServer(patientId: string): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, error: 'offline' };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return { success: false, error: 'no_session' };

  const payload = await gatherUnsyncedRows(patientId);
  const isEmpty =
    payload.sessions.length + payload.events.length + payload.dailySummaries.length + payload.reminderAcks.length ===
    0;
  if (isEmpty) return { success: true };

  return postSync([payload], accessToken);
}

function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const KEY = 'smriti-device-id';
  let id = window.localStorage?.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage?.setItem(KEY, id);
  }
  return id;
}

/**
 * Syncs every locally-known patient in a SINGLE `/api/sync` request. Must
 * stay batched, not looped per-patient: the endpoint rate-limits one
 * request per caregiver per 30s (server/route.ts), so a caregiver with 2+
 * active patients issuing one POST per patient meant every patient after
 * the first got a 429 on every sync attempt, forever.
 */
export async function syncAllPatients(): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, error: 'offline' };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return { success: false, error: 'no_session' };

  const patients = await db.patients.toArray();
  const payloads = await Promise.all(patients.map((p) => gatherUnsyncedRows(p.id)));
  const nonEmpty = payloads.filter(
    (p) => p.sessions.length + p.events.length + p.dailySummaries.length + p.reminderAcks.length > 0,
  );
  if (nonEmpty.length === 0) return { success: true };

  return postSync(nonEmpty, accessToken);
}

import type { Table } from 'dexie';
import {
  db,
  type LocalPatient,
  type LocalReminderSchedule,
  type LocalGameSession,
  type LocalTelemetryEvent,
  type LocalDailySummary,
  type LocalReminderAck,
  type LocalMemoryBankEntry,
  type LocalAiConversationLog,
  type LocalConsent,
  type SyncStateRecord,
} from './schema';
import { createBrowserClient } from '@/lib/supabase/client';
import { toHHMM } from '@/lib/supabase/types';
import { toLocalAppointmentFields } from './wire';
import {
  decryptIncomingMemoryBank,
  encryptEntriesForCloud,
  type CloudMemoryBankRow,
  type DecryptedMemoryBank,
} from '@/lib/memoryBank/cloudSync';
import { applyServerConsent } from '@/lib/consent/consentClient';
import { clearCachedAnswers } from '@/lib/ai/companion-cache';
import { fromWireConsent, toWireConsent } from '@/lib/consent/wire';
import type { PatientConsent } from '@/lib/supabase/types';

const SYNC_TIMEOUT_MS = 15_000;

export interface SyncResult {
  success: boolean;
  error?: string;
  /** Row categories the server rejected this run, e.g. `['events']`. */
  failedCategories?: string[];
}

export interface SyncRunOptions {
  /** Skip the run entirely while the post-failure backoff window is open.
   * Automatic triggers pass true; a caregiver tapping "Sync now" does not. */
  respectBackoff?: boolean;
}

const SYNC_STATE_KEY = 'global';

const EMPTY_SYNC_STATE: SyncStateRecord = {
  lastSyncedAt: null,
  consecutiveFailures: 0,
  lastError: null,
  failedCategories: [],
  lastAttemptAt: null,
};

/** Backoff after consecutive failures: 30s, 1m, 2m, 4m, capped at 15m. */
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 15 * 60_000;

export function backoffMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return 0;
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (consecutiveFailures - 1));
}

export async function getSyncState(): Promise<SyncStateRecord> {
  const row = await db.syncState.get(SYNC_STATE_KEY);
  return { ...EMPTY_SYNC_STATE, ...(row ?? {}) };
}

async function putSyncState(patch: Partial<SyncStateRecord>): Promise<void> {
  const current = await getSyncState();
  await db.syncState.put({ ...current, ...patch }, SYNC_STATE_KEY);
}

/**
 * Records the outcome of one run, so a reload still knows when sync last
 * worked and a repeated failure can be backed off instead of retried at the
 * same interval forever.
 */
async function recordOutcome(result: SyncResult): Promise<void> {
  const now = new Date().toISOString();
  if (result.success) {
    await putSyncState({
      lastSyncedAt: now,
      consecutiveFailures: 0,
      lastError: null,
      failedCategories: [],
      lastAttemptAt: now,
    });
    return;
  }
  const state = await getSyncState();
  await putSyncState({
    consecutiveFailures: state.consecutiveFailures + 1,
    lastError: result.error ?? 'unknown sync error',
    failedCategories: result.failedCategories ?? [],
    lastAttemptAt: now,
  });
}

/** True while the backoff window after the last failure is still open. */
async function inBackoffWindow(): Promise<boolean> {
  const state = await getSyncState();
  if (state.consecutiveFailures === 0 || !state.lastAttemptAt) return false;
  return Date.now() - new Date(state.lastAttemptAt).getTime() < backoffMs(state.consecutiveFailures);
}

/** Waits this long at most for the server's rate-limit window before one retry. */
const MAX_RATE_LIMIT_WAIT_MS = 15_000;

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
  created_at?: string;
  appointment_date?: string | null;
  facility_name?: string | null;
  location_notes?: string | null;
  bring_notes?: string | null;
  remind_day_before_time?: string | null;
  remind_day_of_time?: string | null;
}

/** Which of one patient's row categories the server rejected this sync — see api/sync/route.ts. */
interface PatientSyncErrors {
  /** The whole patient was refused (not on this account); nothing was saved. */
  patient?: string;
  profile?: string;
  reminderSchedules?: string;
  sessions?: string;
  events?: string;
  dailySummaries?: string;
  reminderAcks?: string;
  memoryBankEntries?: string;
  consent?: string;
  aiConversationLogs?: string;
}

/** Wire shape for `memory_bank_entries` (snake_case). Personal fields are
 * ciphertext in both directions — see lib/memoryBank/cloudSync.ts. */
type WireMemoryBankEntry = CloudMemoryBankRow;

function toWireAiLog(row: LocalAiConversationLog) {
  return {
    id: row.id,
    patient_id: row.patientId,
    question: row.question,
    answer: row.answer,
    grounded: row.grounded,
    model_used: row.modelUsed,
    created_at: row.createdAt,
  };
}

interface SyncResponseBody {
  serverTimestamp: string;
  syncedEventCount: number;
  syncErrors: Record<string, PatientSyncErrors>;
  updates: {
    patients: ServerPatientRow[];
    reminders: ServerReminderRow[];
    alerts: unknown[];
    /** Memory Bank rows changed since the cursor, including soft-deleted ones —
     * so an entry added or removed on another device reaches this phone's
     * offline Ask Smriti too. Absent from older servers. */
    memoryBankEntries?: WireMemoryBankEntry[];
    consents?: PatientConsent[];
  };
}

interface PatientSyncPayload {
  patientId: string;
  sessions: LocalGameSession[];
  events: LocalTelemetryEvent[];
  dailySummaries: LocalDailySummary[];
  reminderAcks: LocalReminderAck[];
  /** Local entries being uploaded, and their encrypted wire copies. Both
   * empty when no Memory Bank key is unlocked on this phone: entries then
   * stay local and are never sent in plain text. */
  memoryBankEntries: LocalMemoryBankEntry[];
  memoryBankWire: WireMemoryBankEntry[];
  reminderSchedules: LocalReminderSchedule[];
  /** syncQueue rows behind `reminderSchedules`, removed once the server saves them. */
  scheduleQueueIds: string[];
  /** The patient's own details (name, language…) when edited on this phone. */
  profile: LocalPatient | null;
  profileQueueIds: string[];
  /** This patient's consent when it changed on this phone and has not reached the server. */
  consent: LocalConsent | null;
  /** Ask Smriti answers given on this phone while offline, not yet logged on the server. */
  aiConversationLogs: LocalAiConversationLog[];
  /** Server time of this patient's last successful sync; null pulls everything. */
  since: string | null;
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
    timeOfDay: toHHMM(row.time_of_day),
    daysOfWeek: row.days_of_week,
    isActive: row.is_active,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    ...toLocalAppointmentFields(row),
  };
}

async function encryptForUpload(
  entries: LocalMemoryBankEntry[],
): Promise<{ memoryBankEntries: LocalMemoryBankEntry[]; memoryBankWire: WireMemoryBankEntry[] }> {
  const wire = await encryptEntriesForCloud(entries);
  const sent = new Set(wire.map((w) => w.id));
  return { memoryBankEntries: entries.filter((e) => sent.has(e.id)), memoryBankWire: wire };
}

/** Every unsynced Dexie row for one patient, shaped for the /api/sync request body. */
async function gatherUnsyncedRows(patientId: string): Promise<PatientSyncPayload> {
  const [
    sessions,
    events,
    dailySummaries,
    reminderAcks,
    memoryBankEntries,
    scheduleQueue,
    profileQueue,
    profile,
    consent,
    aiConversationLogs,
    cursor,
  ] = await Promise.all([
    db.gameSessions.where('patientId').equals(patientId).filter((r) => !r.synced).toArray(),
    db.telemetryEvents.where('patientId').equals(patientId).filter((r) => !r.synced).toArray(),
    // dailySummaries has no plain `patientId` index (only the compound
    // [patientId+summaryDate+gameType]), so `.where('patientId')` isn't valid here.
    db.dailySummaries.toCollection().filter((r) => r.patientId === patientId && !r.synced).toArray(),
    db.reminderAcks.where('patientId').equals(patientId).filter((r) => !r.synced).toArray(),
    db.memoryBankEntries.where('patientId').equals(patientId).filter((r) => !r.synced).toArray(),
    // Schedules have no `synced` flag; edits made on the Reminders page are
    // recorded in syncQueue instead, which nothing used to send.
    db.syncQueue.where('tableName').equals('reminder_schedules').toArray(),
    // Patient edits (language, name, age) are queued the same way.
    db.syncQueue
      .where('tableName')
      .equals('patients')
      .filter((q) => q.recordId === patientId)
      .toArray(),
    db.patients.get(patientId),
    db.consents.get(patientId),
    db.aiConversationLog.where('patientId').equals(patientId).filter((r) => r.pendingSync === true).toArray(),
    db.syncCursors.get(patientId),
  ]);
  const queuedIds = [...new Set(scheduleQueue.map((q) => q.recordId))];
  const found = await db.reminderSchedules.bulkGet(queuedIds);
  // A queued schedule that no longer exists locally can never be sent.
  const orphans = new Set(queuedIds.filter((_, i) => found[i] === undefined));
  if (orphans.size) await db.syncQueue.bulkDelete(scheduleQueue.filter((q) => orphans.has(q.recordId)).map((q) => q.id));
  const schedules = found.filter(
    (s): s is LocalReminderSchedule => s !== undefined && s.patientId === patientId,
  );
  const scheduleIds = new Set(schedules.map((s) => s.id));
  return {
    patientId,
    sessions,
    events,
    dailySummaries,
    reminderAcks,
    ...(await encryptForUpload(memoryBankEntries)),
    reminderSchedules: schedules,
    scheduleQueueIds: scheduleQueue.filter((q) => scheduleIds.has(q.recordId)).map((q) => q.id),
    profile: profileQueue.length && profile ? profile : null,
    profileQueueIds: profileQueue.map((q) => q.id),
    consent: consent && !consent.synced ? consent : null,
    aiConversationLogs,
    since: cursor?.serverTimestamp ?? null,
  };
}

/** Two rows are the same row when every field but the local `synced` flag matches. */
function sameRow(a: object, b: object): boolean {
  const strip = (r: object) => JSON.stringify(Object.entries(r).filter(([k]) => k !== 'synced').sort(([x], [y]) => (x < y ? -1 : 1)));
  return strip(a) === strip(b);
}

/**
 * Flags rows as synced only if they are still exactly what was sent. The
 * request takes seconds; a game round logged meanwhile updates the day's
 * summary, and writing the sent snapshot back (with `synced: true`) used to
 * roll that update back and mark the newer numbers as already uploaded. A row
 * that changed in flight keeps `synced: false` and goes up on the next sync.
 * Only the flag is written, never the snapshot.
 */
async function markSyncedIfUnchanged<T extends { id: string; synced: boolean }>(
  table: Table<T, string>,
  sent: T[],
): Promise<void> {
  if (sent.length === 0) return;
  const current = await table.bulkGet(sent.map((r) => r.id));
  for (let i = 0; i < sent.length; i++) {
    const now = current[i];
    if (now && sameRow(now, sent[i])) await table.update(sent[i].id, { synced: true } as never);
  }
}

/**
 * Sessions, events and acks are sent from their `synced` flags, never from
 * syncQueue, yet every one of them was also queued and nothing removed the
 * copy — a second, ever-growing copy of every game round on the phone.
 * Drops the queue rows of records the server now has (or that are gone).
 */
async function pruneDeliveredQueue(tableNames: string[]): Promise<void> {
  const tables: Record<string, Table<{ id: string; synced: boolean }, string>> = {
    game_sessions: db.gameSessions as never,
    telemetry_events: db.telemetryEvents as never,
    reminder_acks: db.reminderAcks as never,
  };
  for (const name of tableNames) {
    const queued = await db.syncQueue.where('tableName').equals(name).toArray();
    if (queued.length === 0) continue;
    const rows = await tables[name].bulkGet(queued.map((q) => q.recordId));
    const done = queued.filter((_, i) => !rows[i] || rows[i]!.synced).map((q) => q.id);
    if (done.length) await db.syncQueue.bulkDelete(done);
  }
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
async function applySyncResponse(
  payloads: PatientSyncPayload[],
  body: SyncResponseBody,
  incomingMemoryBank: DecryptedMemoryBank,
): Promise<void> {
  const memoryBankChanged = new Set<string>();
  await db.transaction(
    'rw',
    [
      db.gameSessions,
      db.telemetryEvents,
      db.dailySummaries,
      db.reminderAcks,
      db.memoryBankEntries,
      db.patients,
      db.reminderSchedules,
      db.syncQueue,
      db.consents,
      db.aiConversationLog,
      db.syncCursors,
    ],
    async () => {
      for (const payload of payloads) {
        const errors = body.syncErrors?.[payload.patientId] ?? {};
        if (errors.patient) continue;
        if (!errors.profile && payload.profileQueueIds.length) {
          await db.syncQueue.bulkDelete(payload.profileQueueIds);
        }
        if (!errors.reminderSchedules && payload.scheduleQueueIds.length) {
          await db.syncQueue.bulkDelete(payload.scheduleQueueIds);
        }
        if (!errors.sessions) await markSyncedIfUnchanged(db.gameSessions, payload.sessions);
        if (!errors.events) await markSyncedIfUnchanged(db.telemetryEvents, payload.events);
        if (!errors.dailySummaries) await markSyncedIfUnchanged(db.dailySummaries, payload.dailySummaries);
        if (!errors.reminderAcks) await markSyncedIfUnchanged(db.reminderAcks, payload.reminderAcks);
        const delivered: string[] = [];
        if (!errors.sessions) delivered.push('game_sessions');
        if (!errors.events) delivered.push('telemetry_events');
        if (!errors.reminderAcks) delivered.push('reminder_acks');
        await pruneDeliveredQueue(delivered);
        if (!errors.memoryBankEntries) {
          // Only the `synced` flag changes: the wire copy is ciphertext, never stored here.
          for (const e of payload.memoryBankEntries) {
            // Only rows not edited again while the upload was in flight.
            await db.memoryBankEntries
              .where('id')
              .equals(e.id)
              .filter((row) => row.updatedAt === e.updatedAt)
              .modify({ synced: true });
          }
        }
        if (!errors.consent && payload.consent) {
          const sent = payload.consent;
          await db.consents
            .where('patientId')
            .equals(sent.patientId)
            .filter((row) => row.updatedAt === sent.updatedAt)
            .modify({ synced: true });
        }
        if (!errors.aiConversationLogs) {
          for (const log of payload.aiConversationLogs) {
            await db.aiConversationLog.update(log.id, { pendingSync: false });
          }
        }
        // A patient with every category accepted advances its pull cursor; a
        // partial failure keeps the old one so nothing changed meanwhile is skipped.
        // So does a Memory Bank row this phone couldn't decrypt yet (no key):
        // it is pulled again once the key is unlocked.
        if (
          Object.keys(errors).length === 0 &&
          body.serverTimestamp &&
          !incomingMemoryBank.unreadablePatients.has(payload.patientId)
        ) {
          await db.syncCursors.put({ patientId: payload.patientId, serverTimestamp: body.serverTimestamp });
        }
      }

      for (const incoming of body.updates.memoryBankEntries ?? []) {
        const local = await db.memoryBankEntries.get(incoming.id);
        // An unsent edit on this phone wins until it is uploaded; otherwise newest wins.
        if (local && (local.synced === false || Date.parse(local.updatedAt) >= Date.parse(incoming.updated_at))) continue;
        const decrypted = incomingMemoryBank.entries.get(incoming.id);
        if (!decrypted) continue;
        await db.memoryBankEntries.put(decrypted);
        memoryBankChanged.add(incoming.patient_id);
      }

      for (const incoming of body.updates.consents ?? []) {
        await applyServerConsent(fromWireConsent(incoming));
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
  // Outside the transaction: cached answers built from entries that just changed.
  for (const patientId of memoryBankChanged) await clearCachedAnswers(patientId);
  if (memoryBankChanged.size) {
    // The caregiver's Memory Bank list is held in memory, so an entry edited
    // on another phone only appeared there after a reload. Imported lazily:
    // the store pulls in React, which server-side callers of this file don't need.
    const [{ useMemoryBankStore }, { usePatientStore }] = await Promise.all([
      import('@/stores/memoryBankStore'),
      import('@/stores/patientStore'),
    ]);
    // Keyed on the patient being viewed, not on what the list already holds:
    // restoring a backup on a new phone starts from an empty list, which is
    // exactly the case that most needs the entries to appear.
    const shown = usePatientStore.getState().currentPatient?.id;
    if (shown && memoryBankChanged.has(shown)) await useMemoryBankStore.getState().loadEntries(shown);
  }
}

async function postSync(payloads: PatientSyncPayload[], accessToken: string, retried = false): Promise<SyncResult> {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        lastSyncTimestamp: null,
        // Game, reminder and schedule rows go up in their local camelCase
        // shape; api/sync converts them to column names (lib/db/wire.ts).
        patients: payloads.map((p) => ({
          patientId: p.patientId,
          sessions: p.sessions,
          events: p.events,
          dailySummaries: p.dailySummaries,
          reminderAcks: p.reminderAcks,
          reminderSchedules: p.reminderSchedules,
          profile: p.profile,
          memoryBankEntries: p.memoryBankWire,
          consent: p.consent ? toWireConsent(p.consent) : null,
          aiConversationLogs: p.aiConversationLogs.map(toWireAiLog),
          lastSyncTimestamp: p.since,
        })),
      }),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });

    if (res.status === 429 && !retried) {
      // A tap on Sync now right after an automatic sync lands inside the
      // server's short rate-limit window. Wait it out once instead of
      // reporting that the account could not be reached.
      const hint = await res.json().catch(() => ({}));
      const wait = Math.min(MAX_RATE_LIMIT_WAIT_MS, Math.max(500, Number(hint?.retryAfterMs) || 10_000));
      await new Promise((resolve) => setTimeout(resolve, wait));
      return postSync(payloads, accessToken, true);
    }
    if (res.status === 401) return { success: false, error: 'no_session' };
    if (res.status === 429) return { success: false, error: 'rate_limited' };
    if (!res.ok) {
      return { success: false, error: `sync failed with status ${res.status}` };
    }

    const body = (await res.json()) as SyncResponseBody;
    // Decrypted before the Dexie transaction: it may download photos, and a
    // transaction can't stay open across network calls.
    const incomingMemoryBank = await decryptIncomingMemoryBank(body.updates.memoryBankEntries ?? []);
    await applySyncResponse(payloads, body, incomingMemoryBank);

    const failedPatientIds = Object.keys(body.syncErrors ?? {});
    if (failedPatientIds.length > 0) {
      // Name the categories, not just the patient id: "sync rejected for
      // patient(s): p1" told a caregiver nothing they could act on, and hid
      // which of their records are still stuck on this phone.
      const failedCategories = [
        ...new Set(Object.values(body.syncErrors ?? {}).flatMap((e) => Object.keys(e))),
      ];
      return { success: false, error: `sync rejected: ${failedCategories.join(', ')}`, failedCategories };
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

  // Sent even with nothing to upload: the response is also how changes made
  // on other devices (Memory Bank, consent, reminders) reach this one.
  const payload = await gatherUnsyncedRows(patientId);
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
export async function syncAllPatients(options: SyncRunOptions = {}): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, error: 'offline' };
  }
  if (options.respectBackoff && (await inBackoffWindow())) {
    return { success: false, error: 'backoff' };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return { success: false, error: 'no_session' };

  // Removed patients are refused by the server; their leftover rows would
  // otherwise make every sync report a failure.
  const patients = (await db.patients.toArray()).filter((p) => p.isActive !== false);
  if (patients.length === 0) return { success: true };
  // Every patient goes, including those with nothing to upload — see syncToServer.
  const payloads = await Promise.all(patients.map((p) => gatherUnsyncedRows(p.id)));
  const result = await postSync(payloads, accessToken);
  await recordOutcome(result);
  return result;
}

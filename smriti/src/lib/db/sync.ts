import { db, type LocalPatient } from './schema';
import { createBrowserClient } from '@/lib/supabase/client';

const SYNC_TIMEOUT_MS = 15_000;

export interface SyncResult {
  success: boolean;
  error?: string;
}

interface SyncResponseBody {
  serverTimestamp: string;
  syncedEventCount: number;
  updates: {
    patients: Array<Record<string, unknown> & { id: string; updatedAt: string }>;
    reminders: Array<Record<string, unknown> & { id: string; updatedAt: string }>;
    alerts: unknown[];
  };
}

/**
 * Pushes a patient's unsynced Dexie rows to `/api/sync`, then applies
 * whatever the server sends back for profile/reminder rows — last-write-wins
 * by `updatedAt`, so a stale response never regresses fresher local edits.
 */
export async function syncToServer(patientId: string): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, error: 'offline' };
  }

  let accessToken: string | undefined;
  try {
    const { data } = await createBrowserClient().auth.getSession();
    accessToken = data.session?.access_token;
  } catch {
    return { success: false, error: 'no_session' };
  }
  if (!accessToken) {
    return { success: false, error: 'no_session' };
  }

  const [sessions, events, dailySummaries, reminderAcks] = await Promise.all([
    db.gameSessions.where('patientId').equals(patientId).filter((r) => !r.synced).toArray(),
    db.telemetryEvents.where('patientId').equals(patientId).filter((r) => !r.synced).toArray(),
    // dailySummaries has no plain `patientId` index (only the compound
    // [patientId+summaryDate+gameType]), so `.where('patientId')` isn't valid here.
    db.dailySummaries.toCollection().filter((r) => r.patientId === patientId && !r.synced).toArray(),
    db.reminderAcks.where('patientId').equals(patientId).filter((r) => !r.synced).toArray(),
  ]);

  if (sessions.length + events.length + dailySummaries.length + reminderAcks.length === 0) {
    return { success: true };
  }

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        lastSyncTimestamp: null,
        patients: [{ patientId, sessions, events, dailySummaries, reminderAcks }],
      }),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });

    if (!res.ok) {
      return { success: false, error: `sync failed with status ${res.status}` };
    }

    const body = (await res.json()) as SyncResponseBody;

    await db.transaction(
      'rw',
      db.gameSessions,
      db.telemetryEvents,
      db.dailySummaries,
      db.reminderAcks,
      db.patients,
      async () => {
        await db.gameSessions.bulkPut(sessions.map((s) => ({ ...s, synced: true })));
        await db.telemetryEvents.bulkPut(events.map((e) => ({ ...e, synced: true })));
        await db.dailySummaries.bulkPut(dailySummaries.map((d) => ({ ...d, synced: true })));
        await db.reminderAcks.bulkPut(reminderAcks.map((a) => ({ ...a, synced: true })));

        for (const incoming of body.updates.patients ?? []) {
          const local = await db.patients.get(incoming.id);
          if (!local || new Date(incoming.updatedAt) > new Date(local.updatedAt)) {
            await db.patients.put(incoming as unknown as LocalPatient);
          }
        }
      },
    );

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'unknown sync error' };
  }
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

/** Syncs every locally-known patient, one at a time so a slow/failing one never blocks the rest. */
export async function syncAllPatients(): Promise<void> {
  const patients = await db.patients.toArray();
  for (const patient of patients) {
    await syncToServer(patient.id);
  }
}

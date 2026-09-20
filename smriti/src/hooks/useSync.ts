'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOfflineStatus } from './useOfflineStatus';
import { db } from '@/lib/db/schema';
import { syncAllPatients, getSyncState } from '@/lib/db/sync';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

export type SyncStatus = 'synced' | 'offline' | 'syncing' | 'pending';

const AFTER_ONLINE_DELAY_MS = 3000;

let inFlightSync: ReturnType<typeof syncAllPatients> | null = null;
const PERIODIC_INTERVAL_MS = 5 * 60_000;

async function countUnsynced(patientId: string): Promise<number> {
  const [sessions, events, summaries, acks, memories, consents, companionLogs] = await Promise.all([
    db.gameSessions.where('patientId').equals(patientId).filter((r) => !r.synced).count(),
    db.telemetryEvents.where('patientId').equals(patientId).filter((r) => !r.synced).count(),
    // dailySummaries has no plain `patientId` index — see sync.ts's same fix.
    db.dailySummaries.toCollection().filter((r) => r.patientId === patientId && !r.synced).count(),
    db.reminderAcks.where('patientId').equals(patientId).filter((r) => !r.synced).count(),
    db.memoryBankEntries.where('patientId').equals(patientId).filter((r) => !r.synced).count(),
    db.consents.where('patientId').equals(patientId).filter((r) => !r.synced).count(),
    db.aiConversationLog.where('patientId').equals(patientId).filter((r) => r.pendingSync === true).count(),
  ]);
  return sessions + events + summaries + acks + memories + consents + companionLogs;
}

/** Drives `SyncIndicator`: pending-record count, current status, and sync scheduling. */
export function useSync(): {
  syncStatus: SyncStatus;
  lastSynced: string | null;
  pendingCount: number;
  /** Why the last sync failed (`SyncResult.error`), or null after a success. */
  lastError: string | null;
  /** Resolves true only when the sync actually reached the server. */
  /** Row categories the server rejected last run, e.g. `['events']`. */
  failedCategories: string[];
  syncNow: () => Promise<boolean>;
} {
  const { isOnline } = useOfflineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [failedCategories, setFailedCategories] = useState<string[]>([]);
  // Starts false, not `isOnline`: the goal is "attempt a sync shortly after
  // this hook first sees the device online," and the device being online
  // from the very first render (by far the common case — most sessions
  // never see an offline->online transition at all) is exactly that case,
  // not a no-op. Starting this at `isOnline` made the effect below treat an
  // already-online mount as "no transition happened," so nothing ever
  // synced until either a real offline->online transition or the 5-minute
  // periodic interval — which read as "the app just doesn't sync."
  const wasOnlineRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const patient = usePatientStore.getState().currentPatient;
    const count = patient ? await countUnsynced(patient.id) : 0;
    setPendingCount(count);
  }, []);

  const syncNow = useCallback(async (options: { automatic?: boolean } = {}) => {
    if (useGameStore.getState().isSessionActive) return false;
    setIsSyncing(true);
    // Several components mount this hook at once (desktop rail and the
    // dashboard's phone card are both in the DOM). They share one in-flight
    // sync instead of racing two uploads of the same unsynced rows.
    // Automatic triggers respect the post-failure backoff window; a
    // caregiver tapping "Sync now" always gets a real attempt.
    inFlightSync ??= syncAllPatients({ respectBackoff: options.automatic }).finally(() => {
      inFlightSync = null;
    });
    const result = await inFlightSync;
    // Only a genuine success (including "nothing to sync") updates the
    // timestamp — otherwise the caregiver sees a fresh "last synced" time
    // while their pending records never actually reached the server.
    // The time comes from the persisted sync state, so it survives a reload
    // instead of resetting to "never".
    const state = await getSyncState();
    if (result.success) setLastSynced(state.lastSyncedAt ?? new Date().toISOString());
    setLastError(result.success ? null : (result.error ?? 'unknown'));
    setFailedCategories(result.failedCategories ?? []);
    await refreshPendingCount();
    setIsSyncing(false);
    return result.success;
  }, [refreshPendingCount]);

  useEffect(() => {
    queueMicrotask(() => void refreshPendingCount());
  }, [refreshPendingCount]);

  // The last sync outcome lives in Dexie, so a reload shows the real "last
  // synced" time and any standing failure instead of a blank slate.
  useEffect(() => {
    void getSyncState().then((state) => {
      setLastSynced(state.lastSyncedAt);
      setLastError(state.lastError);
      setFailedCategories(state.failedCategories ?? []);
    });
  }, []);

  useEffect(() => {
    const cameOnline = isOnline && !wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (!cameOnline) return;

    const timer = setTimeout(() => void syncNow({ automatic: true }), AFTER_ONLINE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isOnline, syncNow]);

  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => void syncNow({ automatic: true }), PERIODIC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isOnline, syncNow]);

  const syncStatus: SyncStatus = !isOnline
    ? 'offline'
    : isSyncing
      ? 'syncing'
      : pendingCount > 0
        ? 'pending'
        : 'synced';

  return { syncStatus, lastSynced, pendingCount, lastError, failedCategories, syncNow };
}

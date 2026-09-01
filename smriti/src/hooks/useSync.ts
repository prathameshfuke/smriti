'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOfflineStatus } from './useOfflineStatus';
import { db } from '@/lib/db/schema';
import { syncAllPatients } from '@/lib/db/sync';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

export type SyncStatus = 'synced' | 'offline' | 'syncing' | 'pending';

const AFTER_ONLINE_DELAY_MS = 3000;
const PERIODIC_INTERVAL_MS = 5 * 60_000;

async function countUnsynced(patientId: string): Promise<number> {
  const [sessions, events, summaries, acks] = await Promise.all([
    db.gameSessions.where('patientId').equals(patientId).filter((r) => !r.synced).count(),
    db.telemetryEvents.where('patientId').equals(patientId).filter((r) => !r.synced).count(),
    // dailySummaries has no plain `patientId` index — see sync.ts's same fix.
    db.dailySummaries.toCollection().filter((r) => r.patientId === patientId && !r.synced).count(),
    db.reminderAcks.where('patientId').equals(patientId).filter((r) => !r.synced).count(),
  ]);
  return sessions + events + summaries + acks;
}

/** Drives `SyncIndicator`: pending-record count, current status, and sync scheduling. */
export function useSync(): {
  syncStatus: SyncStatus;
  lastSynced: string | null;
  pendingCount: number;
  syncNow: () => Promise<void>;
} {
  const { isOnline } = useOfflineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const wasOnlineRef = useRef(isOnline);

  const refreshPendingCount = useCallback(async () => {
    const patient = usePatientStore.getState().currentPatient;
    const count = patient ? await countUnsynced(patient.id) : 0;
    setPendingCount(count);
  }, []);

  const syncNow = useCallback(async () => {
    if (useGameStore.getState().isSessionActive) return;
    setIsSyncing(true);
    await syncAllPatients();
    setLastSynced(new Date().toISOString());
    await refreshPendingCount();
    setIsSyncing(false);
  }, [refreshPendingCount]);

  useEffect(() => {
    queueMicrotask(() => void refreshPendingCount());
  }, [refreshPendingCount]);

  useEffect(() => {
    const cameOnline = isOnline && !wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (!cameOnline) return;

    const timer = setTimeout(() => void syncNow(), AFTER_ONLINE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isOnline, syncNow]);

  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => void syncNow(), PERIODIC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isOnline, syncNow]);

  const syncStatus: SyncStatus = !isOnline
    ? 'offline'
    : isSyncing
      ? 'syncing'
      : pendingCount > 0
        ? 'pending'
        : 'synced';

  return { syncStatus, lastSynced, pendingCount, syncNow };
}

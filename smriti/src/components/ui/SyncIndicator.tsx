'use client';

import { Check, CloudOff, RefreshCw, Clock } from 'lucide-react';

export type SyncStatus = 'synced' | 'offline' | 'syncing' | 'pending';

export interface SyncIndicatorProps {
  status: SyncStatus;
  /** ISO timestamp of the last successful sync. */
  lastSyncedAt?: string | null;
}

/**
 * Sync state must always be visible to the caregiver: on intermittent rural
 * connectivity, "is this data current?" changes how the numbers are read.
 */
const PRESENTATION = {
  synced: { text: 'Synced', className: 'text-success', Icon: Check },
  offline: { text: 'Offline', className: 'text-ink-muted', Icon: CloudOff },
  syncing: { text: 'Syncing', className: 'text-primary', Icon: RefreshCw },
  pending: { text: 'Waiting to sync', className: 'text-warning', Icon: Clock },
} as const;

export default function SyncIndicator({ status, lastSyncedAt }: SyncIndicatorProps) {
  const { text, className, Icon } = PRESENTATION[status];

  return (
    <span
      className={`inline-flex items-center gap-2 text-caregiver-body ${className}`}
      role="status"
      aria-live="polite"
    >
      <Icon
        size={18}
        aria-hidden="true"
        className={status === 'syncing' ? 'animate-spin motion-reduce:animate-none' : undefined}
      />
      <span>{text}</span>
      {status === 'offline' && lastSyncedAt ? (
        <span className="text-ink-muted">
          · last {new Date(lastSyncedAt).toLocaleDateString()}
        </span>
      ) : null}
    </span>
  );
}

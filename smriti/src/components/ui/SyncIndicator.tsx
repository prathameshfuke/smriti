'use client';

import { Check, CloudOff, RefreshCw, Clock } from 'lucide-react';

export type SyncStatus = 'synced' | 'offline' | 'syncing' | 'pending';

export interface SyncIndicatorProps {
  status: SyncStatus;
  /** ISO timestamp of the last successful sync. */
  lastSyncedAt?: string | null;
}

const PRESENTATION = {
  synced: { text: 'Synced', className: 'bg-success text-ink-inverse', Icon: Check },
  offline: { text: 'Offline', className: 'bg-ink text-ink-inverse', Icon: CloudOff },
  syncing: { text: 'Syncing', className: 'bg-primary text-ink-inverse', Icon: RefreshCw },
  pending: { text: 'Waiting to sync', className: 'bg-warning text-ink-inverse', Icon: Clock },
} as const;

/**
 * Floating pill, always in the same corner. On intermittent rural
 * connectivity "is this data current?" changes how every number on the screen
 * should be read, so the answer is never more than a glance away.
 */
export default function SyncIndicator({ status, lastSyncedAt }: SyncIndicatorProps) {
  const { text, className, Icon } = PRESENTATION[status];

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        'fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full ' +
        `px-4 py-2 text-caregiver-body shadow-lg ${className}`
      }
    >
      <Icon
        size={18}
        aria-hidden="true"
        className={status === 'syncing' ? 'animate-spin motion-reduce:animate-none' : undefined}
      />
      <span>{text}</span>
      {status === 'offline' && lastSyncedAt ? (
        <span className="opacity-80">
          · last {new Date(lastSyncedAt).toLocaleDateString()}
        </span>
      ) : null}
    </div>
  );
}

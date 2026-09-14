'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import Icon from '@/components/Icon';
import { useSync } from '@/hooks/useSync';
import { useTranslation } from '@/lib/i18n/provider';
import { useGameStore } from '@/stores/gameStore';

export interface SyncStatusProps {
  /** `card`: a bordered panel (dashboard on phones). `rail`: flat, for the desktop sidebar. */
  variant?: 'card' | 'rail';
}

const CONFIRM_MS = 2500;

/**
 * Says what actually went wrong. Every failure used to read "Could not reach
 * your account… sign in again", so a caregiver signed in again for problems
 * signing in could never fix.
 */
function failureDetail(error: string | null): string {
  if (error === 'no_session') return 'You are signed out on this device. Sign in again from Settings, then sync.';
  if (error === 'offline') return 'This device is offline. Changes will sync when it is back online.';
  if (error === 'rate_limited') return 'A sync just ran. Wait a few seconds, then try again.';
  if (error?.startsWith('sync rejected')) {
    return 'Your account did not accept some changes. They are still saved on this device and will be sent again.';
  }
  return 'Could not reach your account. Check the connection, then try again.';
}

/**
 * Whether this device's data has reached the account, plus a real Sync now
 * button. The button spins its arrows while syncing and swaps to a check and
 * "Synced" for a moment after a successful sync, so a tap always shows a
 * result. Offline, the button is disabled and the line says why.
 */
export default function SyncStatus({ variant = 'card' }: SyncStatusProps) {
  const { t } = useTranslation();
  const { syncStatus, lastSynced, pendingCount, lastError, syncNow } = useSync();
  const [confirmed, setConfirmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const offline = syncStatus === 'offline';
  const syncing = syncStatus === 'syncing';

  const [failed, setFailed] = useState(false);
  // syncNow silently declines while a game session is active (it must not
  // upload a session's rows mid-play); distinguished from a real network/auth
  // failure so the message tells the caregiver something they can act on.
  const [gameActive, setGameActive] = useState(false);

  const onSync = async () => {
    setFailed(false);
    setGameActive(false);
    if (useGameStore.getState().isSessionActive) {
      setGameActive(true);
      return;
    }
    const ok = await syncNow();
    if (timer.current) clearTimeout(timer.current);
    if (!ok) {
      setFailed(true);
      return;
    }
    setConfirmed(true);
    timer.current = setTimeout(() => setConfirmed(false), CONFIRM_MS);
  };

  const time = lastSynced
    ? new Date(lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  const title = offline
    ? t('sync.offline')
    : syncing
      ? t('sync.syncing')
      : pendingCount > 0
        ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting`
        : time
          ? `${t('sync.synced')} at ${time}`
          : t('sync.notSyncedYet');
  const detail = gameActive
    ? 'A game is in progress. Finish it, then sync.'
    : failed && !syncing
    ? failureDetail(lastError)
    : offline
    ? 'Everything is saved on this device and will sync when you are back online.'
    : syncing
      ? 'Sending the latest games and reminders to your account.'
      : pendingCount > 0 || !time
        ? 'Saved on this device. Tap Sync now to back them up to your account.'
        : 'Games and reminders from this device are backed up to your account.';
  const marker = offline ? 'bg-ink-muted' : syncing || pendingCount > 0 || !time ? 'bg-warning' : 'bg-success';

  const button = (
    <button
      type="button"
      onClick={() => void onSync()}
      disabled={offline || syncing}
      aria-live="polite"
      className={
        'inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-control border-2 px-4 text-caregiver-body font-bold ' +
        'transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 ' +
        'disabled:cursor-not-allowed ' +
        (confirmed && !syncing
          ? 'border-success bg-success/10 text-ink'
          : 'border-ink-muted bg-surface-card text-ink hover:bg-surface-muted disabled:opacity-60')
      }
    >
      <Icon
        icon={confirmed && !syncing ? Check : RefreshCw}
        size={18}
        className={syncing ? 'animate-spin motion-reduce:animate-none' : undefined}
      />
      {syncing ? t('sync.syncing') : confirmed ? t('sync.synced') : t('caregiver.syncNow')}
    </button>
  );

  const text = (
    <div role="status" className="min-w-0">
      <p className="flex items-center gap-2 text-caregiver-body font-bold text-ink">
        <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${marker} ${syncing ? 'motion-safe:animate-pulse-ring' : ''}`} />
        {title}
      </p>
      <p className="mt-0.5 text-patient-sm text-ink-muted">{detail}</p>
    </div>
  );

  if (variant === 'rail') {
    return (
      <div className="flex flex-col gap-3">
        {text}
        {button}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-card border border-line200 bg-surface-card p-5 sm:flex-row sm:items-center sm:justify-between">
      {text}
      {button}
    </section>
  );
}

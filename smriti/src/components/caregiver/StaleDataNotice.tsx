'use client';

import { useOfflineDataStore } from '@/stores/offlineDataStore';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Shown while any caregiver screen is displaying cached data because the
 * account could not be reached. Informational, not an error: everything on
 * the phone keeps working, and it clears itself on the next live response.
 */
export default function StaleDataNotice() {
  const staleSince = useOfflineDataStore((s) => s.staleSince);
  if (!staleSince) return null;
  return (
    <p
      role="status"
      className="mx-5 mt-4 rounded-card border border-line200 bg-surface-card px-4 py-3 text-caregiver-body text-ink-muted md:mx-10"
    >
      Offline — showing data last synced {formatWhen(staleSince)}.
    </p>
  );
}

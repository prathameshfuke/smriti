import { create } from 'zustand';

/**
 * Set when a caregiver screen is showing cached data because the server
 * could not be reached (see lib/api/client.ts). Read by the caregiver layout
 * to show a calm "showing last synced data" note instead of an error.
 */
interface OfflineDataState {
  /** Oldest `cachedAt` among responses served from cache since the last live one. */
  staleSince: string | null;
  markStale: (cachedAt: string) => void;
  markFresh: () => void;
}

export const useOfflineDataStore = create<OfflineDataState>((set) => ({
  staleSince: null,
  markStale: (cachedAt) =>
    set((s) => ({ staleSince: s.staleSince && s.staleSince < cachedAt ? s.staleSince : cachedAt })),
  markFresh: () => set({ staleSince: null }),
}));

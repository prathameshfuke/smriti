import { createBrowserClient } from '@/lib/supabase/client';
import { db } from '@/lib/db/schema';
import { useOfflineDataStore } from '@/stores/offlineDataStore';

export class ApiFetchError extends Error {}

/** A server that answered with an error status, as opposed to no answer at all. */
class ApiStatusError extends ApiFetchError {
  constructor(
    path: string,
    readonly status: number,
  ) {
    super(`Request to ${path} failed with status ${status}`);
  }
}

/**
 * Attaches the caregiver's Supabase session token to a fetch. Throws on no
 * session or a non-2xx response — callers show the shared "could not load
 * data" state on any thrown error, they never need to branch on the reason.
 *
 * Plain GETs are also stored locally (encrypted, `db.apiCache`). When the
 * server can't be reached — no signal, no session that can be refreshed
 * offline, or a 5xx — the last good response is returned instead and
 * `useOfflineDataStore` is marked stale, so the dashboard shows last-synced
 * data with a note rather than an error. A 4xx from a reachable server is
 * still thrown: that is a real answer, not missing connectivity.
 */
export async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cacheable = !init?.method || init.method.toUpperCase() === 'GET';
  try {
    const body = await liveFetch<T>(path, init);
    if (cacheable) {
      useOfflineDataStore.getState().markFresh();
      await db.apiCache.put({ body, cachedAt: new Date().toISOString() }, path).catch(() => undefined);
    }
    return body;
  } catch (err) {
    if (!cacheable || (err instanceof ApiStatusError && err.status < 500)) throw err;
    const cached = await db.apiCache.get(path).catch(() => undefined);
    if (!cached) throw err;
    useOfflineDataStore.getState().markStale(cached.cachedAt);
    return cached.body as T;
  }
}

async function liveFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await createBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiFetchError('No active session');

  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new ApiStatusError(path, res.status);
  return res.json() as Promise<T>;
}

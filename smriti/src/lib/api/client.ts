import { createBrowserClient } from '@/lib/supabase/client';

export class ApiFetchError extends Error {}

/**
 * Attaches the caregiver's Supabase session token to a fetch. Throws on no
 * session or a non-2xx response — callers show the shared "could not load
 * data" state on any thrown error, they never need to branch on the reason.
 */
export async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

  if (!res.ok) throw new ApiFetchError(`Request to ${path} failed with status ${res.status}`);
  return res.json() as Promise<T>;
}

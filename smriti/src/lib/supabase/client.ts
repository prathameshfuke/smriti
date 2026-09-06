import { createBrowserClient as createSSRBrowserClient, createServerClient as createSSRServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { CookieOptions } from '@supabase/ssr';
import type { Database } from './types';

/**
 * Supabase client factories.
 *
 * Environment variables are read inside the factories rather than at module
 * scope. SMRITI prerenders 18 routes at build time, and a module-scope read
 * would throw during the build on any machine without a .env.local.
 */

function readEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.local.example). SMRITI games ' +
        'and reminders work offline without these; only sync and the caregiver ' +
        'dashboard require them.',
    );
  }
  return { url, anonKey };
}

/** True when Supabase credentials are present. Lets callers degrade to offline-only. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Service-role client — bypasses RLS entirely. Server-only, and only for
 * routes that have already authorized the caller themselves (e.g. validating
 * a kiosk device-trust token, which has no Supabase session for RLS to key
 * off). Never import this from client code; the key must never reach the
 * browser bundle.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase service role is not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Browser client for Client Components. */
export function createBrowserClient() {
  const { url, anonKey } = readEnv();
  return createSSRBrowserClient<Database>(url, anonKey);
}

/**
 * Server client for Route Handlers and Server Components.
 *
 * `cookies()` from `next/headers` is async in Next 16, so the caller passes the
 * resolved cookie store in:
 *
 *   import { cookies } from 'next/headers';
 *   const supabase = createServerClient(await cookies());
 *
 * Server Components cannot write cookies; the setAll failure is swallowed
 * there, which is safe when middleware refreshes the session.
 */
export function createServerClient(
  cookieStore: {
    getAll(): { name: string; value: string }[];
    set(name: string, value: string, options?: CookieOptions): void;
  },
  options?: { authorization?: string },
) {
  const { url, anonKey } = readEnv();

  return createSSRServerClient<Database>(url, anonKey, {
    // API routes authenticate via Bearer token, not the cookie session — this
    // makes RLS see the caller's identity on every `.from()` query too.
    global: options?.authorization
      ? { headers: { Authorization: options.authorization } }
      : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options: cookieOptions } of cookiesToSet) {
            cookieStore.set(name, value, cookieOptions);
          }
        } catch {
          // Called from a Server Component, which cannot set cookies.
          // Middleware is responsible for refreshing the session instead.
        }
      },
    },
  });
}

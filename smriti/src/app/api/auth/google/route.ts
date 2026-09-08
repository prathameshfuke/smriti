import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/client';

/**
 * Starts Google sign-in server-side instead of from the browser.
 *
 * `createBrowserClient().auth.signInWithOAuth(...)` (the client-side call)
 * writes the PKCE code verifier to a cookie, then redirects the browser to
 * Google — two separate steps, and the redirect can fire before the cookie
 * write has actually landed, especially on a repeat sign-in attempt within
 * the same session (a documented `@supabase/ssr` issue, not specific to
 * this app: https://github.com/supabase/ssr/issues/55). The caregiver never
 * saw the cookie get written; they just saw "PKCE code verifier not found
 * in storage" on the way back from Google.
 *
 * Doing it here instead makes it atomic: this route calls `signInWithOAuth`
 * with `skipBrowserRedirect: true` (so it returns the Google URL instead of
 * calling `window.location` itself, which doesn't exist server-side
 * anyway), and the verifier cookie `createServerClient` sets ends up as a
 * `Set-Cookie` header on the very same redirect response sent back to the
 * browser — the cookie is guaranteed to exist before the browser ever
 * leaves this domain, because they're the same HTTP response.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get('next') || '/caregiver/dashboard';

  const supabase = createServerClient(await cookies());
  const redirectTo = `${origin}/caregiver/login/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    const message = encodeURIComponent(error?.message ?? 'Could not start Google sign-in.');
    return Response.redirect(`${origin}/caregiver/login?googleError=${message}`);
  }

  return Response.redirect(data.url);
}

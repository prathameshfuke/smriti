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
/** First value of a (possibly comma-separated, multi-proxy-hop) forwarded header, trimmed. */
function firstForwardedValue(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const first = headerValue.split(',')[0]?.trim();
  return first || null;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin: requestUrlOrigin } = requestUrl;
  const next = searchParams.get('next') || '/caregiver/dashboard';
  const resetPin = searchParams.get('resetPin') === '1';

  // Vercel proxies requests to this function through an internal layer:
  // `request.url` can carry that internal origin instead of the public
  // domain the browser is actually on (most visible on a project with more
  // than one bound domain, e.g. a "backup" deployment). Supabase does an
  // exact match against Authentication -> URL Configuration -> Redirect
  // URLs, so an origin that's even slightly off makes it silently fall back
  // to the Site URL instead of `redirectTo` — the caregiver lands on that
  // fallback's landing page instead of finishing sign-in. `x-forwarded-host`
  // (falling back to `host`) reflects what the browser actually requested;
  // prefer it, and only fall back to the parsed request URL when neither
  // header is present (e.g. local dev without a proxy in front) or the
  // header turns out not to form a valid origin — these headers are
  // client-suppliable, and Supabase's own redirect-URL allow-list is what
  // actually stops a forged one from being used, not this code, so a
  // malformed value must degrade to the safe default rather than crash the
  // route.
  const forwardedHost = firstForwardedValue(request.headers.get('x-forwarded-host')) ?? firstForwardedValue(request.headers.get('host'));
  const forwardedProto = firstForwardedValue(request.headers.get('x-forwarded-proto')) ?? requestUrl.protocol.replace(':', '');
  let origin = requestUrlOrigin;
  if (forwardedHost) {
    try {
      origin = new URL(`${forwardedProto}://${forwardedHost}`).origin;
    } catch {
      // Malformed header — fall back to the request URL's own origin below.
    }
  }

  const supabase = createServerClient(await cookies());
  const callbackUrl = new URL('/caregiver/login/callback', origin);
  callbackUrl.searchParams.set('next', next);
  if (resetPin) callbackUrl.searchParams.set('resetPin', '1');
  const redirectTo = callbackUrl.toString();

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

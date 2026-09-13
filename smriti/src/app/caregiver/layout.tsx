'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import CaregiverNav from '@/components/layout/CaregiverNav';
import CaregiverTopNav from '@/components/layout/CaregiverTopNav';
import Skeleton from '@/components/ui/Skeleton';
import BigButton from '@/components/ui/BigButton';
import { createBrowserClient } from '@/lib/supabase/client';
import { restoreLocalSession, pullAndStoreServerProfile } from '@/lib/auth/localSession';

type GateState = 'checking' | 'ready' | 'offline';

/**
 * Gates every /caregiver/* route. The login page itself is exempt — a login
 * page that redirects to itself on no-session is a bug, not a guard.
 *
 * A caregiver who has already been through onboarding (or a prior server
 * pull) on this device already has a local Dexie profile — and reaching this
 * layout at all from `/app` already required the caregiver PIN. Requiring a
 * *live Supabase session* on top of that, every time, defeats the PIN: an
 * access-token refresh that failed to fire in the background, a closed tab,
 * or simple offline time is enough to expire it, which used to bounce a
 * PIN-verified caregiver straight to email login again — the "have to log in
 * over and over" bug. The local profile is the trust anchor now; Supabase is
 * only consulted when no local profile exists at all, i.e. a genuinely new
 * or wiped device, where it is the only way to tell "no account yet" from
 * "account exists on the server, pull it down." A network failure in that
 * path is shown as a retry screen, never silently funneled into onboarding —
 * that would throw away an existing account and force the caregiver to
 * re-enter everything.
 */
export default function CaregiverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Exempts the login page's callback route too — it establishes the
  // session itself (exchanging the magic link's code) and would otherwise
  // race this gate's own getSession() check, which runs before that
  // exchange finishes and bounces straight back to /caregiver/login.
  const isLoginRoute = pathname === '/caregiver/login' || pathname.startsWith('/caregiver/login/');
  const isOnboardingRoute = pathname === '/caregiver/onboarding';

  const [state, setState] = useState<GateState>(isLoginRoute ? 'ready' : 'checking');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (isLoginRoute) return;

    let cancelled = false;
    setState('checking');

    (async () => {
      const foundLocal = await restoreLocalSession();
      if (cancelled) return;

      if (foundLocal) {
        // Onboarding while a local profile already exists is exactly how a
        // device ends up with two caregiver/patient pairs — going through
        // setup again created a second local row instead of replacing the
        // first, and whichever screen queried the local tables "first" (not
        // necessarily the same row each time) showed a different patient
        // than the one the server-backed dashboard resolved by auth id.
        // Nothing to onboard when a profile is already here; redirect to
        // the dashboard instead of rendering the form. Deliberately
        // fresh means Delete All Data first, which is the only path that
        // actually clears the local profile.
        if (isOnboardingRoute) {
          router.replace('/caregiver/dashboard');
          return;
        }
        setState('ready');
        return;
      }

      const { data } = await createBrowserClient().auth.getSession();
      if (cancelled) return;

      if (!data.session) {
        router.replace('/caregiver/login');
        return;
      }

      if (isOnboardingRoute) {
        setState('ready');
        return;
      }

      const authUserId = data.session.user.id;
      const status = await pullAndStoreServerProfile(authUserId);
      if (cancelled) return;

      if (status === 'found') {
        setState('ready');
        return;
      }

      if (status === 'error') {
        setState('offline');
        return;
      }

      router.replace('/caregiver/onboarding');
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoginRoute, isOnboardingRoute, router, retryToken]);

  if (isLoginRoute) {
    return <section className="min-h-dvh">{children}</section>;
  }

  if (state === 'offline') {
    return (
      <section className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-serif-display text-caregiver-heading font-semibold text-ink">
          Could not reach your account
        </p>
        <p className="max-w-sm text-caregiver-body text-ink-muted">
          This device is not connected right now, so your saved details could not be checked. Your
          information is safe. Try again once you have a connection.
        </p>
        <BigButton label="Try again" variant="primary" onClick={() => setRetryToken((t) => t + 1)} />
      </section>
    );
  }

  if (state === 'checking') {
    return (
      <section className="flex min-h-dvh flex-col gap-4 p-6" aria-busy="true">
        <Skeleton height={32} width="60%" />
        <Skeleton height={200} />
        <Skeleton height={200} />
      </section>
    );
  }

  return (
    <section data-caregiver-shell className="min-h-dvh bg-canvas pb-(--caregiver-nav-h) md:pb-0">
      <CaregiverTopNav />
      {children}
      <CaregiverNav />
    </section>
  );
}

'use client';

import StaleDataNotice from '@/components/caregiver/StaleDataNotice';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import CaregiverNav from '@/components/layout/CaregiverNav';
import CaregiverRail from '@/components/layout/CaregiverRail';
import Skeleton from '@/components/ui/Skeleton';
import BigButton from '@/components/ui/BigButton';
import { createBrowserClient } from '@/lib/supabase/client';
import { restoreLocalSession, pullAndStoreServerProfile, needsDevicePatientChoice } from '@/lib/auth/localSession';
import { patientsNeedingConsent } from '@/lib/consent/gate';

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
  const isConsentRoute = pathname === '/caregiver/consent';

  const [state, setState] = useState<GateState>(isLoginRoute ? 'ready' : 'checking');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (isLoginRoute) return;

    let cancelled = false;
    setState('checking');

    /** Consent guardrail: a patient without valid consent (set up before
     * consent existed, or before the notice changed) sends the caregiver to
     * the consent form before any other caregiver screen. */
    const redirectedForConsent = async (): Promise<boolean> => {
      if (isConsentRoute || pathname === '/caregiver/device') return false;
      if ((await patientsNeedingConsent()).length === 0) return false;
      if (!cancelled) router.replace(`/caregiver/consent?next=${encodeURIComponent(pathname)}`);
      return true;
    };

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
        // An account with several patients, signed in on a phone that isn't
        // linked to any of them yet (e.g. a patient's own new phone): choose
        // who uses it before anything else, so nobody plays under the wrong name.
        if (pathname !== '/caregiver/device' && (await needsDevicePatientChoice())) {
          if (cancelled) return;
          router.replace('/caregiver/device?setup=1');
          return;
        }
        if (await redirectedForConsent()) return;
        if (cancelled) return;
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
        if (pathname !== '/caregiver/device' && (await needsDevicePatientChoice())) {
          if (cancelled) return;
          router.replace('/caregiver/device?setup=1');
          return;
        }
        if (await redirectedForConsent()) return;
        if (cancelled) return;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname is read once at the gate, not re-gated on every navigation
  }, [isLoginRoute, isOnboardingRoute, isConsentRoute, router, retryToken]);

  if (isLoginRoute) {
    return <section className="min-h-dvh">{children}</section>;
  }

  if (state === 'offline') {
    return (
      <section className="flex min-h-dvh flex-col justify-center bg-surface px-6 py-10">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/error.png" alt="" className="h-16 w-16" />
          <h1 className="font-serif-display text-[2rem] font-medium leading-tight text-ink">
            Could not reach your account
          </h1>
          <p className="text-caregiver-body text-ink-muted">
            This device is not connected right now, so your saved details could not be checked. Your
            information is safe. Try again once you have a connection.
          </p>
          <BigButton label="Try again" variant="primary" onClick={() => setRetryToken((t) => t + 1)} />
        </div>
      </section>
    );
  }

  if (state === 'checking') {
    return (
      <section className="mx-auto flex min-h-dvh w-full max-w-dashboard flex-col gap-4 px-5 py-8 md:px-10" aria-busy="true">
        <Skeleton height={40} width="40%" />
        <Skeleton height={24} width="60%" />
        <Skeleton height={160} className="mt-6" />
        <Skeleton height={160} />
      </section>
    );
  }

  return (
    <section data-caregiver-shell className="min-h-dvh bg-canvas pb-(--caregiver-nav-h) md:flex md:pb-0">
      <a
        href="#caregiver-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface-card focus:px-4 focus:py-3 focus:font-bold focus:text-ink"
      >
        Skip to content
      </a>
      <CaregiverRail />
      <div id="caregiver-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
        <StaleDataNotice />
        {children}
      </div>
      <CaregiverNav />
    </section>
  );
}

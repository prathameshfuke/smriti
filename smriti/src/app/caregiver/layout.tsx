'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import CaregiverNav from '@/components/layout/CaregiverNav';
import Skeleton from '@/components/ui/Skeleton';
import { createBrowserClient } from '@/lib/supabase/client';

/**
 * Gates every /caregiver/* route behind a Supabase session. The login page
 * itself is exempt — a login page that redirects to itself on no-session is
 * a bug, not a guard.
 */
export default function CaregiverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === '/caregiver/login';

  const [checking, setChecking] = useState(!isLoginRoute);

  useEffect(() => {
    if (isLoginRoute) return;

    let cancelled = false;
    createBrowserClient()
      .auth.getSession()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data.session) {
          router.replace('/caregiver/login');
          return;
        }
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoginRoute, router]);

  if (isLoginRoute) {
    return <section className="min-h-dvh">{children}</section>;
  }

  if (checking) {
    return (
      <section className="flex min-h-dvh flex-col gap-4 p-6" aria-busy="true">
        <Skeleton height={32} width="60%" />
        <Skeleton height={200} />
        <Skeleton height={200} />
      </section>
    );
  }

  return (
    <section className="min-h-dvh pb-16">
      {children}
      <CaregiverNav />
    </section>
  );
}

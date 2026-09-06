'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useSync } from '@/hooks/useSync';
import appIcon from '@/appicon.png';

const ITEMS = [
  { href: '/caregiver/dashboard', label: 'Overview' },
  { href: '/caregiver/patients', label: 'Patients' },
  { href: '/reminders', label: 'Reminders' },
  { href: '/caregiver/settings', label: 'Settings' },
] as const;

/**
 * Calm desktop top bar for caregiver mode (spec section 4.1). Hidden below
 * `md` — small screens keep the thumb-reachable bottom tab bar (CaregiverNav)
 * instead, per section 4.3's "do not reproduce a desktop sidebar on mobile."
 */
export default function CaregiverTopNav() {
  const pathname = usePathname();
  const { syncStatus } = useSync();

  return (
    <header className="hidden h-16 items-center justify-between border-b border-gray-300 bg-white px-6 md:flex">
      <Link
        href="/caregiver/dashboard"
        className="flex items-center gap-2 font-serif-display text-xl font-semibold text-navy"
      >
        <Image src={appIcon} alt="" width={24} height={24} className="h-6 w-6" priority />
        SMRITI
      </Link>

      <nav aria-label="Caregiver" className="flex items-center gap-8">
        {ITEMS.map(({ href, label }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={
                'border-b-2 py-5 text-caregiver-body font-semibold transition-colors ' +
                (active ? 'border-muga text-navy' : 'border-transparent text-gray-600 hover:text-navy')
              }
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 text-patient-sm text-gray-600" role="status">
        {syncStatus === 'offline' ? (
          <WifiOff size={16} aria-hidden="true" />
        ) : syncStatus === 'syncing' ? (
          <RefreshCw size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        ) : (
          <Wifi size={16} aria-hidden="true" />
        )}
        <span>
          {syncStatus === 'offline' ? 'Offline' : syncStatus === 'syncing' ? 'Syncing' : 'Online'}
        </span>
      </div>
    </header>
  );
}

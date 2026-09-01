'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Settings } from 'lucide-react';

/**
 * Fixed bottom tab bar for the caregiver side. Caregivers use SMRITI
 * one-handed on a shared device between other apps, so the 3 destinations
 * stay reachable with a thumb at all times rather than scrolling to a header.
 */
const ITEMS = [
  { href: '/caregiver/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/caregiver/patients', label: 'Patients', Icon: Users },
  { href: '/caregiver/settings', label: 'Settings', Icon: Settings },
] as const;

export default function CaregiverNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Caregiver"
      style={{ height: 64, paddingBottom: 'env(safe-area-inset-bottom)' }}
      className="fixed inset-x-0 bottom-0 z-40 flex bg-surface-card border-t border-surface-muted"
    >
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              'flex flex-1 flex-col items-center justify-center gap-1 ' +
              (active ? 'text-primary' : 'text-ink-muted')
            }
          >
            <Icon size={22} aria-hidden="true" />
            <span className="text-xs">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Settings, Images, Home } from 'lucide-react';

/**
 * Fixed bottom tab bar for the caregiver side. Caregivers use SMRITI
 * one-handed on a shared device between other apps, so the destinations
 * stay reachable with a thumb at all times rather than scrolling to a header.
 * "Patient View" lives here too — on mobile, CaregiverTopNav (which carries
 * the desktop equivalent) is hidden entirely, so without it there was no way
 * back to `/app` short of typing the URL once a caregiver session started.
 *
 * Sized for a 320px phone as the binding constraint: five edge-to-edge tabs
 * (64px each at 320px), 12px labels that wrap between words rather than
 * truncate. Measured in Atkinson Hyperlegible, the widest single word
 * ("Overview", 47.8px) keeps 8px clear on each side at 320px — "Dashboard"
 * (56.8px) cannot, which is why the label matches CaregiverTopNav's
 * "Overview". The bar's 64px excludes the safe-area inset, which is added
 * on top so the home indicator never eats into the tap area.
 */
const ITEMS = [
  { href: '/caregiver/dashboard', label: 'Overview', Icon: LayoutDashboard },
  { href: '/caregiver/patients', label: 'Patients', Icon: Users },
  { href: '/caregiver/memory-bank', label: 'Memory Bank', Icon: Images },
  { href: '/caregiver/settings', label: 'Settings', Icon: Settings },
  { href: '/app', label: 'Patient View', Icon: Home },
] as const;

export default function CaregiverNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Caregiver"
      data-caregiver-nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-surface-card border-t border-surface-muted md:hidden"
    >
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              'flex flex-1 basis-0 min-w-0 flex-col items-center justify-start gap-0.5 pt-2 ' +
              'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ' +
              (active ? 'text-primary' : 'text-ink-muted')
            }
          >
            <Icon size={20} aria-hidden="true" className="shrink-0" />
            <span className="px-2 text-center text-xs leading-tight">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

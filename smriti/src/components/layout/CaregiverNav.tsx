'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Settings, Images, Home } from 'lucide-react';
import Icon from '@/components/Icon';

/**
 * Fixed bottom tab bar for the caregiver side. Caregivers use SMRITI
 * one-handed on a shared device between other apps, so the destinations
 * stay reachable with a thumb at all times rather than scrolling to a header.
 * "Patient View" lives here too — on mobile, CaregiverRail (which carries
 * the desktop equivalent) is hidden entirely, so without it there was no way
 * back to `/app` short of typing the URL once a caregiver session started.
 *
 * Sized for a 320px phone as the binding constraint: five edge-to-edge tabs
 * (64px each at 320px), 12px labels that wrap between words rather than
 * truncate. Measured in Atkinson Hyperlegible, the widest single word
 * ("Overview", 47.8px) keeps 8px clear on each side at 320px — "Dashboard"
 * (56.8px) cannot, which is why the label matches CaregiverRail's
 * "Overview". The active tab carries a 3px terracotta bar on top as well as
 * the colour change, so the current place never depends on colour alone.
 * Not bold: bold "Overview" loses the 8px side clearance at 320px. Height and bottom padding come from `--caregiver-nav-h` /
 * `--caregiver-nav-pad` in globals.css, which overlap the home-indicator
 * zone instead of stacking the full inset as a blank strip under the labels.
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
      className="fixed inset-x-0 bottom-0 z-40 flex h-(--caregiver-nav-h) pb-(--caregiver-nav-pad) bg-surface-card border-t border-line200 md:hidden"
    >
      {ITEMS.map(({ href, label, Icon: ItemIcon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              'flex flex-1 basis-0 min-w-0 flex-col items-center justify-start gap-0.5 border-t-[3px] pt-[3px] ' +
              'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-dark ' +
              (active ? 'border-primary text-primary-dark' : 'border-transparent text-ink-muted')
            }
          >
            <Icon icon={ItemIcon} size={20} className="shrink-0" />
            {/* Clamped to two lines, which --caregiver-nav-h is sized for. At Large
                text on a 320px phone a single long word may break mid-word
                (overflow-wrap: anywhere) rather than spill into the next tab. */}
            <span className="line-clamp-2 min-w-0 max-w-full px-1 text-center text-xs leading-[1.1] [overflow-wrap:anywhere]">
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SyncStatus from '@/components/ui/SyncStatus';
import { usePatientViewConfirm } from '@/components/layout/PatientViewConfirm';
import appIcon from '@/appicon.png';

const ITEMS = [
  { href: '/caregiver/dashboard', label: 'Overview' },
  { href: '/caregiver/patients', label: 'Patients' },
  { href: '/caregiver/memory-bank', label: 'Memory Bank' },
  { href: '/reminders', label: 'Reminders' },
  { href: '/caregiver/settings', label: 'Settings' },
] as const;

/**
 * Persistent left navigation for caregiver mode on tablets and desktops
 * (md and up). Every destination is a visible word, always in the same
 * place; nothing is hidden behind a menu button. Phones keep the
 * thumb-reachable bottom tab bar (CaregiverNav) instead.
 *
 * The foot of the rail answers two standing questions without competing
 * with page content: is this data current, and how do I get back to the
 * patient's screen.
 */
export default function CaregiverRail() {
  const pathname = usePathname();
  const patientView = usePatientViewConfirm();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line200 bg-surface-card md:flex lg:w-64">
      <Link
        href="/caregiver/dashboard"
        className="flex h-20 items-center gap-2.5 px-6 font-serif-display text-[1.375rem] font-medium text-ink"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 28px static brand mark, nothing to optimise */}
        <img src={appIcon.src} alt="" width={28} height={28} className="h-7 w-7" />
        SMRITI
      </Link>

      <nav aria-label="Caregiver" className="flex flex-1 flex-col gap-1 px-3 pt-2">
        {ITEMS.map(({ href, label }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={
                'flex min-h-12 items-center rounded-control px-3.5 text-caregiver-body transition-colors duration-150 ' +
                (active ? 'bg-primary/10 font-bold text-primary-dark' : 'text-ink hover:bg-surface-muted')
              }
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-4 border-t border-line200 px-5 py-5">
        <SyncStatus variant="rail" />
        <button
          type="button"
          onClick={patientView.ask}
          className="flex min-h-12 items-center justify-center rounded-control bg-primary px-4 text-caregiver-body font-bold text-ink-inverse transition-colors hover:bg-primary-dark"
        >
          Patient View
        </button>
      </div>
      {patientView.dialog}
    </aside>
  );
}

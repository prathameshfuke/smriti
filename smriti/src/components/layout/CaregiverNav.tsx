import Link from 'next/link';
import { LayoutDashboard, Users, Settings } from 'lucide-react';

/**
 * Caregiver chrome. Denser than the patient side — an ASHA worker managing 10+
 * patients scans this repeatedly. Sync state is not repeated here: the
 * SyncIndicator pill floats over every screen already.
 */
const ITEMS = [
  { href: '/caregiver/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/caregiver/patients', label: 'Patients', Icon: Users },
  { href: '/caregiver/settings', label: 'Settings', Icon: Settings },
] as const;

export default function CaregiverNav() {
  return (
    <header className="border-b border-surface-muted bg-surface-card">
      <div className="mx-auto flex max-w-dashboard flex-wrap items-center gap-4 px-4 py-3">
        <span className="text-caregiver-heading font-semibold text-primary">SMRITI</span>
        <nav aria-label="Caregiver" className="flex flex-1 flex-wrap gap-1">
          {ITEMS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={
                'flex items-center gap-2 rounded-card px-3 py-2 text-caregiver-body ' +
                'text-ink transition-colors hover:bg-surface-muted ' +
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
              }
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

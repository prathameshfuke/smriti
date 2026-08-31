import Link from 'next/link';
import { Home, Bell, BarChart3 } from 'lucide-react';
import { TOUCH_TARGET_MIN_PX } from '@/components/ui/touchTarget';

/**
 * Fixed bottom bar with three destinations. No hamburger, no swipe, no nested
 * menus: every destination is always visible and always in the same place.
 */
const ITEMS = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/reminders', label: 'Reminders', Icon: Bell },
  { href: '/caregiver/dashboard', label: 'Progress', Icon: BarChart3 },
] as const;

export default function PatientNav() {
  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 border-t border-surface-muted bg-surface-card"
    >
      <ul className="mx-auto flex max-w-patient">
        {ITEMS.map(({ href, label, Icon }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-label={label}
              style={{ minHeight: TOUCH_TARGET_MIN_PX }}
              className={
                'flex flex-col items-center justify-center gap-1 py-2 ' +
                'text-patient-sm font-medium text-ink transition-colors ' +
                'hover:bg-surface-muted focus-visible:outline focus-visible:outline-4 ' +
                'focus-visible:outline-offset-[-4px] focus-visible:outline-primary'
              }
            >
              <Icon size={26} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

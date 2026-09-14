'use client';

import Link from 'next/link';
import { buttonClass } from '@/components/ui/Panel';

export interface AddPatientButtonProps {
  label?: string;
  /** `compact` for page headers, `big` for empty states. */
  size?: 'compact' | 'big';
}

/**
 * Opens the Add patient flow (/caregiver/add-patient), which first asks
 * whether the person plays on their own phone or shares this one. It used
 * to link to first-time setup, which sends a phone that already has a
 * profile straight back to the dashboard.
 */
export default function AddPatientButton({ label = 'Add patient', size = 'compact' }: AddPatientButtonProps) {
  return (
    <Link
      href="/caregiver/add-patient"
      className={`${buttonClass.primary} w-full ${size === 'big' ? 'min-h-[72px] text-patient-body' : 'min-h-14'}`}
    >
      {label}
    </Link>
  );
}

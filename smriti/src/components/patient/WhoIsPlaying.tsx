'use client';

import PatientAvatar from '@/components/patient/PatientAvatar';
import type { LocalPatient } from '@/lib/db/schema';
import { useTranslation } from '@/lib/i18n/provider';

export interface WhoIsPlayingProps {
  patients: LocalPatient[];
  onSelect: (patient: LocalPatient) => void;
}

/**
 * First screen on a phone shared by several patients. One large row per
 * person, face and name, the whole row a single button. No PIN: a patient
 * has to be able to choose themselves, and the choice is only ever between
 * the people a caregiver put on this phone.
 */
export default function WhoIsPlaying({ patients, onSelect }: WhoIsPlayingProps) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="who-heading" className="mt-8">
      <h1 id="who-heading" className="font-serif-display text-[2.5rem] font-medium leading-[1.1] text-ink">
        {t('home.whoIsPlaying')}
      </h1>
      <p className="mt-3 text-patient-body text-ink-muted">{t('home.tapYourName')}</p>
      <ul className="mt-8 flex flex-col gap-4">
        {patients.map((patient) => (
          <li key={patient.id}>
            <button
              type="button"
              onClick={() => onSelect(patient)}
              className="flex min-h-24 w-full items-center gap-5 rounded-card border-2 border-ink-muted/60 bg-surface-card p-4 text-left transition-[transform,background-color] duration-150 hover:bg-surface-muted active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-dark"
            >
              <PatientAvatar patientId={patient.id} name={patient.displayName} size={80} />
              <span className="font-serif-display text-[2rem] font-medium leading-tight text-ink">
                {patient.displayName}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

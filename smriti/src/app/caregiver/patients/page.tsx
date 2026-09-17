'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import Skeleton from '@/components/ui/Skeleton';
import TrafficLight, { type TriageStatus } from '@/components/ui/TrafficLight';
import StatusBadge, { type StatusTone } from '@/components/ui/StatusBadge';
import PageHeader from '@/components/ui/PageHeader';
import AddPatientButton from '@/components/caregiver/AddPatientButton';
import WeeklyLeaderboard from '@/components/caregiver/WeeklyLeaderboard';
import { languageName } from '@/lib/i18n/languages';
import { authedFetch } from '@/lib/api/client';
import { usePatientStore } from '@/stores/patientStore';

interface ListPatient {
  id: string;
  displayName: string;
  ageYears: number;
  primaryLanguage: string;
  alertStatus: TriageStatus;
}

const STATUS: Record<TriageStatus, { tone: StatusTone; label: string }> = {
  red: { tone: 'danger', label: 'Review soon' },
  yellow: { tone: 'warning', label: 'Needs attention' },
  green: { tone: 'success', label: 'On track' },
};

export default function CaregiverPatientsPage() {
  const router = useRouter();
  const deactivatePatient = usePatientStore((s) => s.deactivatePatient);

  const [patients, setPatients] = useState<ListPatient[] | null>(null);
  const [error, setError] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(false);

  const load = () => {
    setError(false);
    setPatients(null);
    authedFetch<{ patients: ListPatient[] }>('/api/patients')
      .then((body) => setPatients(body.patients))
      .catch(() => setError(true));
  };

  useEffect(() => {
    queueMicrotask(load);
  }, []);

  const confirmDelete = async () => {
    if (!confirmingId) return;
    setRemoving(true);
    setRemoveError(false);
    try {
      // The account first: the list comes from the server, so removing only
      // the local copy made the patient reappear on the next load.
      await authedFetch(`/api/patients/${confirmingId}`, { method: 'DELETE' });
      await deactivatePatient(confirmingId);
      setPatients((prev) => prev?.filter((p) => p.id !== confirmingId) ?? null);
      setConfirmingId(null);
    } catch {
      setRemoveError(true);
    } finally {
      setRemoving(false);
    }
  };

  const closeConfirm = useCallback(() => {
    setConfirmingId(null);
    setRemoveError(false);
  }, []);
  useEscapeKey(confirmingId !== null && !removing, closeConfirm);

  const confirming = patients?.find((p) => p.id === confirmingId) ?? null;

  return (
    <main className="mx-auto w-full max-w-dashboard px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title="Patients"
        description="Everyone you care for on this device. Open a name to see their progress, reminders and family sharing."
        action={
          <AddPatientButton />
        }
      />

      <WeeklyLeaderboard />

      {patients === null && !error ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton height={72} />
          <Skeleton height={72} />
        </div>
      ) : null}

      {error ? (
        <div className="flex max-w-md flex-col gap-4 py-8">
          <p className="text-caregiver-body text-ink">
            Could not load your patients. Check the connection, then try again.
          </p>
          <BigButton label="Try again" variant="secondary" onClick={load} />
        </div>
      ) : null}

      {patients && patients.length === 0 ? (
        <section className="flex max-w-lg flex-col gap-2 rounded-card border border-line200 bg-surface-card p-6">
          <h2 className="font-serif-display text-[1.375rem] font-medium text-ink">No patients yet</h2>
          <p className="text-caregiver-body text-ink-muted">
            Use Add patient to set up the person you care for.
          </p>
        </section>
      ) : null}

      {patients && patients.length > 0 ? (
        <ul className="divide-y divide-line200 overflow-hidden rounded-card border border-line200 bg-surface-card">
          {patients.map((patient) => (
            <li key={patient.id} className="flex items-center gap-2 pr-3">
              <button
                type="button"
                onClick={() => router.push(`/caregiver/patients/${patient.id}`)}
                className="flex min-w-0 flex-1 flex-col gap-2 px-5 py-4 text-left transition-colors hover:bg-surface-muted/60 focus-visible:-outline-offset-4 sm:flex-row sm:items-center sm:gap-6"
              >
                <span className="flex min-w-0 items-center gap-3 sm:flex-1">
                  <TrafficLight status={patient.alertStatus} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-caregiver-body font-bold text-ink">{patient.displayName}</span>
                    <span className="block text-patient-sm text-ink-muted">
                      Age {patient.ageYears}, {languageName(patient.primaryLanguage)}
                    </span>
                  </span>
                </span>
                <span className="pl-8 sm:w-44 sm:pl-0">
                  <StatusBadge tone={STATUS[patient.alertStatus].tone} label={STATUS[patient.alertStatus].label} />
                </span>
              </button>
              <button
                type="button"
                aria-label={`Remove ${patient.displayName}`}
                onClick={() => setConfirmingId(patient.id)}
                className="inline-flex min-h-touch-min shrink-0 items-center rounded-control px-3 text-patient-sm font-bold text-ink-muted underline decoration-ink-muted/40 underline-offset-4 hover:bg-danger/5 hover:text-danger"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {confirmingId ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="remove-patient-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center"
        >
          <div className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto overscroll-contain rounded-card bg-surface-card p-6 shadow-xl">
            <h2 id="remove-patient-title" className="font-serif-display text-[1.5rem] font-medium leading-tight text-ink">
              Remove {confirming?.displayName ?? 'this patient'}?
            </h2>
            <p className="text-caregiver-body text-ink-muted">
              They will no longer appear in your patient list on any device. Their game history is kept.
            </p>
            {removeError ? (
              <p role="alert" className="text-caregiver-body font-bold text-danger">
                Could not remove them. Check the connection and try again.
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <BigButton
                label={removing ? 'Removing…' : 'Remove'}
                variant="primary"
                disabled={removing}
                onClick={() => void confirmDelete()}
              />
              <BigButton label="Cancel" variant="secondary" disabled={removing} onClick={closeConfirm} />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

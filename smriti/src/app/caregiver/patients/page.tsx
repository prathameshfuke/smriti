'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import BigButton from '@/components/ui/BigButton';
import Skeleton from '@/components/ui/Skeleton';
import TrafficLight, { type TriageStatus } from '@/components/ui/TrafficLight';
import { authedFetch } from '@/lib/api/client';
import { usePatientStore } from '@/stores/patientStore';

interface ListPatient {
  id: string;
  displayName: string;
  ageYears: number;
  primaryLanguage: string;
  alertStatus: TriageStatus;
}

export default function CaregiverPatientsPage() {
  const router = useRouter();
  const deactivatePatient = usePatientStore((s) => s.deactivatePatient);

  const [patients, setPatients] = useState<ListPatient[] | null>(null);
  const [error, setError] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
    await deactivatePatient(confirmingId);
    setPatients((prev) => prev?.filter((p) => p.id !== confirmingId) ?? null);
    setConfirmingId(null);
  };

  return (
    <main className="mx-auto max-w-dashboard px-4 py-6 md:px-8 md:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-muga/30 pb-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muga-dark">Caregiver</p>
          <h1 className="font-serif-display text-caregiver-heading font-semibold text-navy">
            Patients
          </h1>
        </div>
        <BigButton
          label="Add Patient"
          variant="primary"
          onClick={() => router.push('/caregiver/onboarding')}
        />
      </header>

      {patients === null && !error ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          <Skeleton height={72} />
          <Skeleton height={72} />
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-caregiver-body text-ink-muted">Could not load data. Pull to refresh.</p>
          <BigButton label="Try Again" variant="primary" onClick={load} />
        </div>
      ) : null}

      {patients && patients.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-gray-300 bg-white py-12 text-center shadow-sm">
          <p className="text-caregiver-body text-ink-muted">Add a patient to begin a supervised activity.</p>
        </div>
      ) : null}

      {patients && patients.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {patients.map((patient) => {
            const stripColor =
              patient.alertStatus === 'red'
                ? 'bg-gamosa'
                : patient.alertStatus === 'yellow'
                  ? 'bg-warning'
                  : 'bg-success';
            return (
              <li
                key={patient.id}
                className="flex items-center justify-between gap-2 overflow-hidden rounded-card border border-gray-300 bg-white shadow-sm"
              >
                <div className={`h-full w-1.5 self-stretch shrink-0 ${stripColor}`} aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => router.push(`/caregiver/patients/${patient.id}`)}
                  className="flex flex-1 items-center gap-2 p-4 text-left"
                >
                  <TrafficLight status={patient.alertStatus} size="sm" />
                  <span className="font-bold text-navy">{patient.displayName}</span>
                  <span className="text-patient-sm text-gray-600">
                    {patient.ageYears} · {patient.primaryLanguage}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${patient.displayName}`}
                  onClick={() => setConfirmingId(patient.id)}
                  style={{ minHeight: 48, minWidth: 48 }}
                  className="mr-2 flex shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-danger"
                >
                  <Trash2 size={20} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {confirmingId ? (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="mx-4 flex flex-col gap-4 rounded-card bg-surface-card p-6">
            <p className="text-caregiver-body text-ink">Remove this patient from your list?</p>
            <div className="flex gap-3">
              <BigButton label="Cancel" variant="secondary" onClick={() => setConfirmingId(null)} />
              <BigButton label="Remove" variant="primary" onClick={() => void confirmDelete()} />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

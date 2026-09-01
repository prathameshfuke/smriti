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
    <main className="mx-auto max-w-dashboard px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-caregiver-heading text-ink">Patients</h1>
        <BigButton
          label="Add Patient"
          variant="primary"
          onClick={() => router.push('/caregiver/onboarding')}
        />
      </header>

      {patients === null && !error ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton height={64} />
          <Skeleton height={64} />
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-caregiver-body text-ink-muted">Could not load data. Pull to refresh.</p>
          <BigButton label="Try Again" variant="primary" onClick={load} />
        </div>
      ) : null}

      {patients ? (
        <ul className="flex flex-col gap-2">
          {patients.map((patient) => (
            <li
              key={patient.id}
              className="flex items-center justify-between rounded-card border border-surface-muted bg-surface-card p-3"
            >
              <button
                type="button"
                onClick={() => router.push(`/caregiver/patients/${patient.id}`)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <TrafficLight status={patient.alertStatus} size="sm" />
                <span className="font-bold text-ink">{patient.displayName}</span>
                <span className="text-caregiver-body text-ink-muted">
                  {patient.ageYears} · {patient.primaryLanguage}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Delete ${patient.displayName}`}
                onClick={() => setConfirmingId(patient.id)}
                style={{ minHeight: 48, minWidth: 48 }}
                className="flex items-center justify-center"
              >
                <Trash2 size={20} aria-hidden="true" />
              </button>
            </li>
          ))}
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

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import Skeleton from '@/components/ui/Skeleton';
import TrafficLight, { type TriageStatus } from '@/components/ui/TrafficLight';
import { authedFetch } from '@/lib/api/client';
import { useSync } from '@/hooks/useSync';

interface DashboardPatient {
  id: string;
  displayName: string;
  ageYears: number;
  primaryLanguage: string;
  alertStatus: TriageStatus;
  accuracyToday: number;
  sessionsThisWeek: number;
}

const STATUS_ORDER: Record<TriageStatus, number> = { red: 0, yellow: 1, green: 2 };

export default function CaregiverDashboardPage() {
  const router = useRouter();
  const { syncStatus, lastSynced, syncNow } = useSync();

  const [patients, setPatients] = useState<DashboardPatient[] | null>(null);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    setPatients(null);
    authedFetch<{ patients: DashboardPatient[] }>('/api/patients')
      .then((body) => setPatients(body.patients))
      .catch(() => setError(true));
  };

  useEffect(() => {
    queueMicrotask(load);
  }, []);

  const sorted = patients
    ? [...patients].sort((a, b) => STATUS_ORDER[a.alertStatus] - STATUS_ORDER[b.alertStatus])
    : [];
  const redCount = sorted.filter((p) => p.alertStatus === 'red').length;

  return (
    <main className="mx-auto max-w-dashboard px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-primary font-bold">SMRITI</p>
          <h1 className="text-caregiver-heading text-ink">Dashboard</h1>
        </div>
      </header>

      <div className="mb-4 flex items-center justify-between rounded-card bg-surface-card p-3">
        <div>
          <span className="text-caregiver-body text-ink">
            {syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'offline' ? 'Offline' : 'Synced'}
          </span>
          <p className="text-patient-sm text-ink-muted">
            Last synced: {lastSynced ? new Date(lastSynced).toLocaleTimeString() : 'never'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void syncNow()}
          className="rounded-card border-2 border-primary px-3 py-2 text-caregiver-body text-primary"
        >
          Sync Now
        </button>
      </div>

      {redCount > 0 ? (
        <div className="mb-4 rounded-card border border-danger bg-danger/10 px-4 py-3">
          <p className="text-caregiver-body font-bold text-danger">
            ⚠ {redCount} patient{redCount === 1 ? '' : 's'} need immediate attention
          </p>
        </div>
      ) : null}

      {patients === null && !error ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton height={100} />
          <Skeleton height={100} />
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-caregiver-body text-ink-muted">Could not load data. Pull to refresh.</p>
          <BigButton label="Try Again" variant="primary" onClick={load} />
        </div>
      ) : null}

      {patients && patients.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-caregiver-body text-ink-muted">No patients yet.</p>
          <BigButton
            label="Add First Patient"
            variant="primary"
            onClick={() => router.push('/caregiver/onboarding')}
          />
        </div>
      ) : null}

      {patients && patients.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {sorted.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                onClick={() => router.push(`/caregiver/patients/${patient.id}`)}
                className="w-full rounded-card border border-surface-muted bg-surface-card p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <TrafficLight status={patient.alertStatus} size="sm" />
                  <span data-testid="patient-card-name" className="font-bold text-ink">
                    {patient.displayName}
                  </span>
                  <span className="text-caregiver-body text-ink-muted">
                    {patient.ageYears} · {patient.primaryLanguage}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-4">
                  <div>
                    <span className="text-caregiver-heading font-bold text-primary">
                      {patient.accuracyToday}%
                    </span>
                    <span className="ml-1 text-patient-sm text-ink-muted">accuracy today</span>
                  </div>
                  <span className="text-patient-sm text-ink-muted">
                    {patient.sessionsThisWeek}/7 sessions
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

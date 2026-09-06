'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
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

const STATUS_LABEL: Record<TriageStatus, string> = {
  red: 'Review soon',
  yellow: 'Needs attention',
  green: 'On track',
};

const STATUS_TEXT_CLASS: Record<TriageStatus, string> = {
  red: 'text-danger',
  yellow: 'text-warning',
  green: 'text-success',
};

export default function CaregiverDashboardPage() {
  return (
    <ErrorBoundary>
      <CaregiverDashboardPageInner />
    </ErrorBoundary>
  );
}

function CaregiverDashboardPageInner() {
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
  const attentionCount = sorted.filter((p) => p.alertStatus !== 'green').length;

  return (
    <main className="mx-auto max-w-dashboard px-4 py-6 md:px-8 md:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-muga/30 pb-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muga">Caregiver</p>
          <h1 className="font-serif-display text-caregiver-heading font-semibold text-navy">
            Overview
          </h1>
        </div>
        <BigButton
          label="Add Patient"
          variant="primary"
          icon={<Plus size={20} aria-hidden="true" />}
          onClick={() => router.push('/caregiver/onboarding')}
        />
      </header>

      {patients && patients.length > 0 ? (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="overflow-hidden rounded-card border border-gray-300 bg-white shadow-sm">
            <div className="h-1.5 bg-muga" />
            <div className="p-4">
              <p className="font-serif-display text-3xl font-bold text-navy">{patients.length}</p>
              <p className="text-patient-sm text-gray-600">Total patients</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-card border border-gray-300 bg-white shadow-sm">
            <div className={`h-1.5 ${attentionCount > 0 ? 'bg-gamosa' : 'bg-success'}`} />
            <div className="p-4">
              <p className="font-serif-display text-3xl font-bold text-navy">{attentionCount}</p>
              <p className="text-patient-sm text-gray-600">Needs review</p>
            </div>
          </div>
          <div className="col-span-2 overflow-hidden rounded-card border border-gray-300 bg-white shadow-sm sm:col-span-1">
            <div className="h-1.5 bg-teal" />
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-caregiver-body font-semibold text-navy">
                  {syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'offline' ? 'Offline' : 'Synced'}
                </p>
                <p className="text-patient-sm text-gray-600">
                  {lastSynced ? new Date(lastSynced).toLocaleTimeString() : 'Not synced yet'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void syncNow()}
                aria-label="Sync now"
                className="flex h-10 w-10 items-center justify-center rounded-full text-teal hover:bg-teal/10"
              >
                <RefreshCw size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {redCount > 0 ? (
        <div className="mb-6 flex items-center gap-3 rounded-card border border-danger bg-danger/10 px-4 py-3">
          <AlertTriangle size={20} className="shrink-0 text-danger" aria-hidden="true" />
          <p className="text-caregiver-body font-bold text-danger">
            {redCount} patient{redCount === 1 ? '' : 's'} need immediate attention
          </p>
        </div>
      ) : null}

      {patients === null && !error ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          <Skeleton height={140} />
          <Skeleton height={140} />
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
          <BigButton
            label="Add First Patient"
            variant="primary"
            onClick={() => router.push('/caregiver/onboarding')}
          />
        </div>
      ) : null}

      {patients && patients.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((patient) => {
            const stripColor =
              patient.alertStatus === 'red'
                ? 'bg-gamosa'
                : patient.alertStatus === 'yellow'
                  ? 'bg-warning'
                  : 'bg-success';
            return (
              <li key={patient.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/caregiver/patients/${patient.id}`)}
                  className="flex w-full overflow-hidden rounded-card border border-gray-300 bg-white text-left shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className={`w-1.5 shrink-0 ${stripColor}`} aria-hidden="true" />
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-center gap-2">
                      <TrafficLight status={patient.alertStatus} size="sm" />
                      <span data-testid="patient-card-name" className="font-bold text-navy">
                        {patient.displayName}
                      </span>
                      <span className="text-patient-sm text-gray-600">
                        {patient.ageYears} · {patient.primaryLanguage}
                      </span>
                    </div>
                    <p className={`text-patient-sm font-semibold ${STATUS_TEXT_CLASS[patient.alertStatus]}`}>
                      {STATUS_LABEL[patient.alertStatus]}
                    </p>
                    <div className="flex items-baseline justify-between border-t border-gray-100 pt-3">
                      <div>
                        <span className="font-serif-display text-2xl font-bold text-muga">
                          {patient.accuracyToday}%
                        </span>
                        <span className="ml-1 text-patient-sm text-gray-600">accuracy today</span>
                      </div>
                      <span className="text-patient-sm text-gray-600">
                        {patient.sessionsThisWeek}/7 sessions
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}

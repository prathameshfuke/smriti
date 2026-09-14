'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import BigButton from '@/components/ui/BigButton';
import Skeleton from '@/components/ui/Skeleton';
import type { TriageStatus } from '@/components/ui/TrafficLight';
import StatusBadge, { type StatusTone } from '@/components/ui/StatusBadge';
import PageHeader from '@/components/ui/PageHeader';
import AddPatientButton from '@/components/caregiver/AddPatientButton';
import { authedFetch } from '@/lib/api/client';
import SyncStatus from '@/components/ui/SyncStatus';
import ScoreRing from '@/components/ui/ScoreRing';
import WeekActivity from '@/components/caregiver/WeekActivity';
import { BAND_LABEL, type ScoreBand } from '@/lib/dashboard/cognitiveScore';
import { languageName } from '@/lib/i18n/languages';

interface DashboardPatient {
  id: string;
  displayName: string;
  ageYears: number;
  primaryLanguage: string;
  alertStatus: TriageStatus;
  accuracyToday: number;
  sessionsThisWeek: number;
  cognitiveScore?: { score: number; band: ScoreBand; delta: number | null; enoughData: boolean } | null;
  week?: Array<number | null>;
}

const STATUS_ORDER: Record<TriageStatus, number> = { red: 0, yellow: 1, green: 2 };

const STATUS_LABEL: Record<TriageStatus, string> = {
  red: 'Review soon',
  yellow: 'Needs attention',
  green: 'On track',
};

const STATUS_TONE: Record<TriageStatus, StatusTone> = {
  red: 'danger',
  yellow: 'warning',
  green: 'success',
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function CaregiverDashboardPage() {
  return (
    <ErrorBoundary>
      <CaregiverDashboardPageInner />
    </ErrorBoundary>
  );
}

function CaregiverDashboardPageInner() {
  const router = useRouter();

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
    <main className="mx-auto w-full max-w-dashboard px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title="Overview"
        description="How each person in your care is doing today. Anyone who needs you is listed first."
        action={
          <AddPatientButton />
        }
      />

      {patients && patients.length > 0 ? (
        <SummaryStrip redCount={redCount} attentionCount={attentionCount} total={patients.length} />
      ) : null}

      {patients === null && !error ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton height={88} />
          <Skeleton height={220} />
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
        <section className="flex max-w-lg flex-col gap-4 rounded-card border border-line200 bg-surface-card p-6">
          <h2 className="font-serif-display text-[1.375rem] font-medium text-ink">No patients yet</h2>
          <p className="text-caregiver-body text-ink-muted">
            Add the person you care for to set up their games, reminders and progress.
          </p>
          <AddPatientButton label="Add first patient" size="big" />
        </section>
      ) : null}

      {patients && patients.length > 0 ? (
        <section aria-labelledby="patient-list-heading" className="mt-10">
          <h2 id="patient-list-heading" className="mb-3 font-serif-display text-[1.375rem] font-medium text-ink">
            {plural(patients.length, 'patient', 'patients')}
          </h2>

          <ul className="flex flex-col gap-3">
            {sorted.map((patient) => {
              const score = patient.cognitiveScore ?? null;
              const week = patient.week ?? Array.from({ length: 7 }, () => null);
              return (
                <li key={patient.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/caregiver/patients/${patient.id}`)}
                    className="flex w-full flex-col gap-4 rounded-card border border-line200 bg-surface-card p-4 text-left transition-[border-color,transform] duration-150 hover:border-ink-muted/60 active:scale-[0.99] motion-reduce:active:scale-100 sm:p-5 md:flex-row md:items-center md:gap-6"
                  >
                    <span className="flex min-w-0 items-center gap-4 md:flex-1">
                      <ScoreRing
                        value={score ? score.score : null}
                        label={score ? `Cognitive score ${score.score} out of 100` : 'No cognitive score yet'}
                      />
                      <span className="min-w-0">
                        <span data-testid="patient-card-name" className="block break-words text-caregiver-body font-bold text-ink">
                          {patient.displayName}
                        </span>
                        <span className="block text-patient-sm text-ink-muted">
                          Age {patient.ageYears}, {languageName(patient.primaryLanguage)}
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <StatusBadge tone={STATUS_TONE[patient.alertStatus]} label={STATUS_LABEL[patient.alertStatus]} />
                        </span>
                      </span>
                    </span>

                    <span className="grid grid-cols-3 gap-3 border-t border-line200 pt-4 md:w-[26rem] md:border-t-0 md:pt-0">
                      <span className="flex flex-col gap-1">
                        <span className="text-patient-sm text-ink-muted">Score</span>
                        <span className="text-caregiver-body font-bold text-ink">
                          {score ? BAND_LABEL[score.band] : 'Not yet'}
                        </span>
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className="text-patient-sm text-ink-muted">Today</span>
                        <span className="text-caregiver-body font-bold tabular-nums text-ink">{patient.accuracyToday}%</span>
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className="text-patient-sm text-ink-muted">{patient.sessionsThisWeek} of 7 days</span>
                        <WeekActivity days={week} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="mt-10 md:hidden">
        <SyncStatus />
      </div>
    </main>
  );
}

/**
 * The one sentence a caregiver needs first: does anyone need me right now.
 * Replaces a row of equal-weight stat cards (total, needs review, sync) that
 * made the reader add the numbers up themselves.
 */
function SummaryStrip({ redCount, attentionCount, total }: { redCount: number; attentionCount: number; total: number }) {
  const tone: StatusTone = redCount > 0 ? 'danger' : attentionCount > 0 ? 'warning' : 'success';
  const surface = {
    danger: 'border-danger/40 bg-danger/5',
    warning: 'border-warning/50 bg-warning/5',
    success: 'border-success/50 bg-success/5',
  }[tone];
  const marker = { danger: 'bg-danger', warning: 'bg-warning', success: 'bg-success' }[tone];

  const title =
    redCount > 0
      ? `${plural(redCount, 'patient needs', 'patients need')} immediate attention`
      : attentionCount > 0
        ? `${plural(attentionCount, 'patient needs', 'patients need')} a check-in`
        : 'Everyone is on track today';
  const detail =
    redCount > 0
      ? 'Open their page to see what changed and mark alerts resolved.'
      : attentionCount > 0
        ? 'Nothing urgent. Look in when you have a moment.'
        : `All ${plural(total, 'patient is', 'patients are')} playing and taking reminders as usual.`;

  return (
    <div role="status" className={`flex items-start gap-4 rounded-card border px-5 py-4 ${surface}`}>
      <span className={`mt-2 h-3 w-3 shrink-0 rounded-full ${marker}`} aria-hidden="true" />
      <div>
        <p className="text-caregiver-body font-bold text-ink">{title}</p>
        <p className="text-patient-sm text-ink-muted">{detail}</p>
      </div>
    </div>
  );
}

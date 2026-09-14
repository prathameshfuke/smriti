'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge, { type StatusTone } from '@/components/ui/StatusBadge';
import ScoreRing from '@/components/ui/ScoreRing';
import { textActionClass, buttonClass } from '@/components/ui/Panel';
import { languageName } from '@/lib/i18n/languages';
import CognitiveTab, { type AlertRow } from '@/components/caregiver/CognitiveTab';
import RemindersTab from '@/components/caregiver/RemindersTab';
import CompanionTab from '@/components/caregiver/CompanionTab';
import FamilyTab from '@/components/caregiver/FamilyTab';
import { authedFetch } from '@/lib/api/client';
import { useCognitiveTrend } from '@/hooks/useCognitiveTrend';
import { computeCognitiveScore, mergeScoreRows, type ScoreRow } from '@/lib/dashboard/cognitiveScore';
import type { TriageStatus } from '@/components/ui/TrafficLight';

type Tab = 'cognitive' | 'reminders' | 'companion' | 'family';

interface DetailPatient {
  id: string;
  displayName: string;
  ageYears: number;
  primaryLanguage: string;
  alertStatus: TriageStatus;
  /** Synced game-days from the server, merged with this phone's own. */
  scoreRows?: ScoreRow[];
}

const TABS: Tab[] = ['cognitive', 'reminders', 'companion', 'family'];

const TAB_LABEL: Record<Tab, string> = {
  cognitive: 'Cognitive',
  reminders: 'Reminders',
  companion: 'Companion',
  family: 'Family',
};

const PATIENT_STATUS: Record<TriageStatus, { tone: StatusTone; label: string }> = {
  red: { tone: 'danger', label: 'Review soon' },
  yellow: { tone: 'warning', label: 'Needs attention' },
  green: { tone: 'success', label: 'On track' },
};

/**
 * The shell for one patient's caregiver view: header (name, status, cognitive
 * score), section navigation, and the shared "some details could not load"
 * banner. Each section's own data and actions live in its own component
 * (CognitiveTab/RemindersTab/CompanionTab/FamilyTab) — this file used to hold
 * all four inline and had grown past 900 lines with no natural seams; the
 * patient fetch and alert list/resolve stay here because the header ("N
 * patients need attention") and the Cognitive tab both depend on them.
 */
export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patient, setPatient] = useState<DetailPatient | null>(null);
  const [tab, setTab] = useState<Tab>('cognitive');
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [resolveFailed, setResolveFailed] = useState(false);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  // The header's score ring reads the same 30-day window CognitiveTab scores
  // from — kept here (not passed down) so it renders even while that tab
  // isn't the active one.
  const scoreTrend = useCognitiveTrend(patientId, '30d');
  const localRows: ScoreRow[] = scoreTrend.points.map((p) => ({
    date: p.date,
    gameType: p.gameType,
    correctRounds: (p.accuracy / 100) * p.totalRounds,
    totalRounds: p.totalRounds,
    maxDifficultyReached: p.maxDifficultyReached,
  }));
  const scoreRows = mergeScoreRows(patient?.scoreRows ?? [], localRows);
  const cognitiveScore = computeCognitiveScore(scoreRows, today);

  useEffect(() => {
    let cancelled = false;
    params.then(({ id }) => {
      if (!cancelled) setPatientId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!patientId) return;
    authedFetch<{ patients: DetailPatient[] }>('/api/patients')
      .then((body) => setPatient(body.patients.find((p) => p.id === patientId) ?? null))
      .catch(() => setError(true));
  }, [patientId, reloadToken]);

  useEffect(() => {
    if (!patientId) return;
    authedFetch<{
      alerts: Array<{
        id: string;
        patient_id: string;
        title: string;
        description: string | null;
        severity: TriageStatus;
        is_resolved: boolean;
      }>;
    }>('/api/alerts')
      .then((body) => {
        setAlerts(
          (body.alerts ?? [])
            .filter((a) => a.patient_id === patientId && !a.is_resolved)
            .map((a) => ({ id: a.id, title: a.title, description: a.description, severity: a.severity })),
        );
      })
      .catch(() => setError(true));
  }, [patientId, reloadToken]);

  const resolveAlert = async (alertId: string) => {
    setResolveFailed(false);
    try {
      await authedFetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_resolved: true }),
      });
      // Only drop the alert once the server has it resolved; hiding it on a
      // failed request made it silently come back on the next visit.
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      setResolveFailed(true);
    }
  };

  // Section switches bring the reader back to the top of the page, where the
  // section buttons are, instead of leaving them mid-way down the old one.
  const selectTab = (next: Tab) => {
    setTab(next);
    document.scrollingElement?.scrollTo?.({ top: 0 });
  };

  return (
    <main className="mx-auto w-full max-w-dashboard px-5 pt-5 pb-10 md:px-10 md:pt-10">
      <Link href="/caregiver/patients" className={textActionClass}>
        All patients
      </Link>

      <header className="mt-2 flex items-center gap-4">
        <ScoreRing
          value={cognitiveScore ? cognitiveScore.score : null}
          label={cognitiveScore ? `Cognitive score ${cognitiveScore.score} out of 100` : 'No cognitive score yet'}
        />
        <div className="min-w-0 flex-1">
          <h1 className="break-words font-serif-display text-[1.875rem] font-medium leading-[1.1] text-ink md:text-[2.5rem]">
            {patient ? patient.displayName : 'Patient'}
          </h1>
          {patient ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-caregiver-body text-ink-muted">
              <span>
                Age {patient.ageYears}, {languageName(patient.primaryLanguage)}
              </span>
              <StatusBadge tone={PATIENT_STATUS[patient.alertStatus].tone} label={PATIENT_STATUS[patient.alertStatus].label} />
            </p>
          ) : null}
        </div>
      </header>

      {error ? (
        <div role="alert" className="mt-5 flex flex-col gap-3 rounded-card border border-warning/50 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-caregiver-body text-ink">
            <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-warning" />
            <span>Some details could not load from your account. Progress saved on this device is still shown.</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setError(false);
              setReloadToken((n) => n + 1);
            }}
            className={`${buttonClass.secondary} shrink-0`}
          >
            Try again
          </button>
        </div>
      ) : null}

      <nav aria-label="Patient sections" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 md:max-w-2xl">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => selectTab(t)}
            aria-pressed={tab === t}
            className={
              'min-h-14 rounded-control px-2 text-caregiver-body font-bold transition-[background-color,border-color,color] duration-150 ' +
              (tab === t
                ? 'bg-primary text-ink-inverse'
                : 'border-2 border-ink-muted/60 bg-surface-card text-ink hover:border-ink-muted hover:bg-surface-muted')
            }
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {patientId && tab === 'cognitive' ? (
          <CognitiveTab
            patientId={patientId}
            alerts={alerts}
            onResolveAlert={(id) => void resolveAlert(id)}
            resolveFailed={resolveFailed}
            onError={() => setError(true)}
            serverScoreRows={patient?.scoreRows}
          />
        ) : null}
        {patientId && tab === 'reminders' ? <RemindersTab patientId={patientId} /> : null}
        {patientId && tab === 'companion' ? <CompanionTab patientId={patientId} onError={() => setError(true)} /> : null}
        {patientId && tab === 'family' ? <FamilyTab patientId={patientId} onError={() => setError(true)} /> : null}
      </div>
    </main>
  );
}

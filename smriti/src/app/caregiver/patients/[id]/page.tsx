'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PatientNav from '@/components/layout/PatientNav';
import BigButton from '@/components/ui/BigButton';
import Skeleton from '@/components/ui/Skeleton';
import TrafficLight, { type TriageStatus } from '@/components/ui/TrafficLight';
import StatusBadge from '@/components/ui/StatusBadge';
import CognitiveTrendChart from '@/components/caregiver/CognitiveTrendChart';
import GameBreakdownChart from '@/components/caregiver/GameBreakdownChart';
import SessionCalendar from '@/components/caregiver/SessionCalendar';
import { authedFetch } from '@/lib/api/client';
import { createBrowserClient } from '@/lib/supabase/client';
import { useCognitiveTrend, type TrendRange } from '@/hooks/useCognitiveTrend';
import { useGameStreak } from '@/hooks/useGameStreak';
import { useReminderAdherence } from '@/hooks/useReminderAdherence';
import { aggregateDailyBlended, classifyVelocity } from '@/lib/dashboard/trend';
import type { ReminderType } from '@/lib/supabase/types';

type Tab = 'cognitive' | 'reminders' | 'history' | 'companion' | 'family';

interface FamilyShareRow {
  id: string;
  label: string;
  review_required: boolean;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

interface FamilyNoteRow {
  id: string;
  text: string;
  status: string;
  created_at: string;
}

interface DetailPatient {
  id: string;
  displayName: string;
  ageYears: number;
  primaryLanguage: string;
  alertStatus: TriageStatus;
}

interface AlertRow {
  id: string;
  title: string;
  description: string | null;
  severity: TriageStatus;
}

interface CompanionQuestion {
  id: string;
  question: string;
  answer: string;
  grounded: boolean;
  flaggedForFollowup: boolean;
  createdAt: string;
}

interface DigestEntry {
  id: string;
  weekOf: string;
  summaryText: string;
  generatedAt: string;
}

const REMINDER_TYPES: ReminderType[] = ['medication', 'hydration', 'activity', 'appointment'];
const REMINDER_ICON: Record<ReminderType, string> = {
  medication: '💊',
  hydration: '💧',
  activity: '🚶',
  appointment: '📅',
};

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patient, setPatient] = useState<DetailPatient | null>(null);
  const [tab, setTab] = useState<Tab>('cognitive');
  const [range, setRange] = useState<TrendRange>('30d');
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [companionQuestions, setCompanionQuestions] = useState<CompanionQuestion[] | null>(null);
  const [familyShares, setFamilyShares] = useState<FamilyShareRow[] | null>(null);
  const [familyNotes, setFamilyNotes] = useState<FamilyNoteRow[] | null>(null);
  const [newShareLabel, setNewShareLabel] = useState('');
  const [creatingShare, setCreatingShare] = useState(false);
  const [newMessageSender, setNewMessageSender] = useState('');
  const [newMessageRelation, setNewMessageRelation] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [newMessagePhotoUrl, setNewMessagePhotoUrl] = useState('');
  const [postingMessage, setPostingMessage] = useState(false);
  const [digests, setDigests] = useState<DigestEntry[] | null>(null);
  const [digestGenerating, setDigestGenerating] = useState(false);
  const [quizStatus, setQuizStatus] = useState<
    { kind: 'idle' } | { kind: 'loading' } | { kind: 'done' } | { kind: 'needs_facts'; have: number; needed: number } | { kind: 'error' }
  >({ kind: 'idle' });
  const [error, setError] = useState(false);

  // Both Dexie-backed (dexie-react-hooks' useLiveQuery under the hood) — no
  // network call, so the cognitive tab and the reminders tab keep working
  // offline. See each hook's own doc comment for the cross-device caveat
  // (a summary/ack only ever exists locally on the device that wrote it;
  // `/api/sync` never sends `daily_summaries` back down — lib/db/sync.ts).
  const trend = useCognitiveTrend(patientId, range);
  const adherence = useReminderAdherence(patientId);
  const streak = useGameStreak(patientId);

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
  }, [patientId]);

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
  }, [patientId]);

  useEffect(() => {
    if (!patientId || tab !== 'companion' || companionQuestions) return;
    authedFetch<{ questions: CompanionQuestion[] }>(`/api/patients/${patientId}/companion-activity`)
      .then((body) => setCompanionQuestions(body.questions))
      .catch(() => setError(true));
  }, [patientId, tab, companionQuestions]);

  const loadFamilyTabData = () => {
    if (!patientId) return;
    authedFetch<{ shares: FamilyShareRow[] }>(`/api/family-share?patientId=${patientId}`)
      .then((body) => setFamilyShares(body.shares))
      .catch(() => setFamilyShares((prev) => prev ?? []));
    authedFetch<{ notes: FamilyNoteRow[] }>(`/api/patients/${patientId}/family-notes`)
      .then((body) => setFamilyNotes(body.notes))
      .catch(() => setFamilyNotes((prev) => prev ?? []));
  };

  useEffect(() => {
    if (!patientId || tab !== 'family' || familyShares) return;
    loadFamilyTabData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, tab, familyShares]);

  const createFamilyShare = () => {
    if (!patientId || !newShareLabel.trim()) return;
    setCreatingShare(true);
    authedFetch<{ id: string; expiresAt: string }>('/api/family-share', {
      method: 'POST',
      body: JSON.stringify({ patientId, label: newShareLabel.trim() }),
    })
      .then(() => {
        setNewShareLabel('');
        setFamilyShares(null);
        loadFamilyTabData();
      })
      .catch(() => setError(true))
      .finally(() => setCreatingShare(false));
  };

  const revokeFamilyShare = (shareId: string) => {
    authedFetch(`/api/family-share/${shareId}`, { method: 'DELETE' })
      .then(() => {
        setFamilyShares(null);
        loadFamilyTabData();
      })
      .catch(() => setError(true));
  };

  const postFamilyMessage = () => {
    if (!patientId || !newMessageText.trim()) return;
    setPostingMessage(true);
    authedFetch<{ id: string; status: string }>(`/api/patients/${patientId}/family-notes`, {
      method: 'POST',
      body: JSON.stringify({
        text: newMessageText.trim(),
        senderName: newMessageSender.trim() || undefined,
        senderRelation: newMessageRelation.trim() || undefined,
        photoUrl: newMessagePhotoUrl.trim() || undefined,
      }),
    })
      .then(() => {
        setNewMessageSender('');
        setNewMessageRelation('');
        setNewMessageText('');
        setNewMessagePhotoUrl('');
      })
      .catch(() => setError(true))
      .finally(() => setPostingMessage(false));
  };

  const moderateFamilyNote = (noteId: string, action: 'approve' | 'reject') => {
    if (!patientId) return;
    authedFetch(`/api/patients/${patientId}/family-notes`, {
      method: 'PATCH',
      body: JSON.stringify({ noteId, action }),
    })
      .then(() => {
        setFamilyNotes((prev) => (prev ? prev.filter((n) => n.id !== noteId) : prev));
      })
      .catch(() => setError(true));
  };

  const generateDigest = () => {
    if (!patientId) return;
    setDigestGenerating(true);
    authedFetch<{ summary: string; generatedAt: string }>('/api/ai/generate-digest', {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    })
      .then(() =>
        authedFetch<{ digests: DigestEntry[] }>(`/api/patients/${patientId}/digests`).then((body) =>
          setDigests(body.digests),
        ),
      )
      // A digest failure is never page-breaking — the rest of the tab still
      // works, it just shows "No digest yet" instead of a summary.
      .catch(() => setDigests((prev) => prev ?? []))
      .finally(() => setDigestGenerating(false));
  };

  useEffect(() => {
    if (!patientId || tab !== 'cognitive' || digests) return;
    authedFetch<{ digests: DigestEntry[] }>(`/api/patients/${patientId}/digests`)
      .then((body) => {
        setDigests(body.digests);
        const latest = body.digests[0];
        if (!latest || Date.now() - new Date(latest.generatedAt).getTime() >= 7 * 24 * 60 * 60 * 1000) {
          generateDigest();
        }
      })
      .catch(() => setDigests([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, tab, digests]);

  const refreshQuiz = async () => {
    if (!patientId) return;
    setQuizStatus({ kind: 'loading' });
    // Not authedFetch here — it discards the response body on a non-2xx,
    // and the not-enough-facts case needs that body (`needed`/`have`) to
    // show the right prompt instead of a generic failure.
    const { data } = await createBrowserClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setQuizStatus({ kind: 'error' });
      return;
    }
    try {
      const res = await fetch('/api/ai/generate-reminiscence-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientId }),
      });
      const body = await res.json();
      if (res.ok) {
        setQuizStatus({ kind: 'done' });
      } else if (body.error === 'not_enough_facts') {
        setQuizStatus({ kind: 'needs_facts', have: body.have, needed: body.needed });
      } else {
        setQuizStatus({ kind: 'error' });
      }
    } catch {
      setQuizStatus({ kind: 'error' });
    }
  };

  const resolveAlert = async (alertId: string) => {
    await authedFetch(`/api/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_resolved: true }),
    }).catch(() => setError(true));
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  // Rounds-weighted (see lib/dashboard/trend.ts) so a 3-round game never
  // moves this as much as a 30-round one — the bug in the old per-row
  // unweighted mean this replaces.
  const dailyBlended = useMemo(() => aggregateDailyBlended(trend.points), [trend.points]);
  const velocity = useMemo(() => classifyVelocity(dailyBlended), [dailyBlended]);
  const velocityClassName =
    velocity?.direction === 'up' ? 'text-success' : velocity?.direction === 'down' ? 'text-danger' : 'text-ink-muted';

  const { year, month } = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, []);

  if (error) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-dashboard flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-caregiver-body text-ink-muted">Could not load data. Pull to refresh.</p>
        <BigButton label="Try again" variant="primary" onClick={() => setError(false)} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-dashboard flex-col bg-canvas">
      <PatientNav
        title={patient ? patient.displayName : 'Patient'}
        onBack={() => router.push('/caregiver/patients')}
      />
      {patient ? (
        <div className="flex items-center justify-between gap-2 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <TrafficLight status={patient.alertStatus} size="sm" />
            <span className="text-caregiver-body text-ink-muted">
              {patient.ageYears} · {patient.primaryLanguage}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshQuiz()}
              disabled={quizStatus.kind === 'loading'}
              className="text-sm font-semibold text-primary hover:text-primary-dark disabled:opacity-50"
            >
              {quizStatus.kind === 'loading' ? 'Refreshing…' : 'Refresh Quiz'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/caregiver/memory-bank')}
              className="text-sm font-semibold text-primary hover:text-primary-dark"
            >
              Memory Bank
            </button>
          </div>
        </div>
      ) : null}

      {quizStatus.kind === 'done' ? (
        <p className="bg-success/10 px-4 py-2 text-patient-sm text-success">
          Memory quiz updated.
        </p>
      ) : null}
      {quizStatus.kind === 'needs_facts' ? (
        <div className="flex items-center justify-between gap-2 bg-primary/5 px-4 py-2">
          <p className="text-patient-sm text-ink">
            Add at least {quizStatus.needed} people or life facts to the Memory Bank first
            ({quizStatus.have} so far) to generate a quiz.
          </p>
          <button
            type="button"
            onClick={() => router.push('/caregiver/memory-bank')}
            className="whitespace-nowrap text-sm font-semibold text-primary hover:text-primary-dark"
          >
            Memory Bank
          </button>
        </div>
      ) : null}
      {quizStatus.kind === 'error' ? (
        <p className="bg-danger/10 px-4 py-2 text-patient-sm text-danger">
          Could not refresh the quiz. Try again in a moment.
        </p>
      ) : null}

      <div className="flex gap-1 overflow-x-auto border-b border-line200 bg-white px-2">
        {(['cognitive', 'reminders', 'history', 'companion', 'family'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              'shrink-0 whitespace-nowrap px-4 py-3 text-caregiver-body font-semibold capitalize ' +
              (tab === t ? 'border-b-2 border-muga text-navy' : 'text-ink-muted')
            }
          >
            {t}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 py-4 md:px-8 md:py-6">
        {tab === 'cognitive' ? (
          <div className="flex flex-col gap-4">
            {!streak.isLoading ? (
              <div className="overflow-hidden rounded-card border border-line200 bg-white">
                <div className="flex items-center justify-between p-4">
                  <p className="text-caregiver-body text-ink-muted">Daily streak</p>
                  <p className="font-serif-display text-2xl font-bold text-navy">
                    {streak.current > 0 ? `🔥 ${streak.current} day${streak.current === 1 ? '' : 's'}` : 'No streak yet'}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-card border border-line200 bg-white">
              <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-serif-display text-lg font-semibold text-navy">This week</p>
                  <button
                    type="button"
                    onClick={generateDigest}
                    disabled={digestGenerating}
                    className="text-sm font-semibold text-primary hover:text-primary-dark disabled:opacity-50"
                  >
                    {digestGenerating ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
                {digests === null || (digestGenerating && digests.length === 0) ? (
                  <Skeleton height={60} />
                ) : digests.length === 0 ? (
                  <p className="text-caregiver-body text-ink-muted">No digest yet.</p>
                ) : (
                  <>
                    <p className="text-caregiver-body text-ink-muted">{digests[0].summaryText}</p>
                    <p className="text-patient-sm text-ink-muted">
                      Generated {new Date(digests[0].generatedAt).toLocaleDateString()}. Not medical advice.
                    </p>
                  </>
                )}
                {digests && digests.length > 1 ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-primary">Past weeks</summary>
                    <ul className="mt-2 flex flex-col gap-3">
                      {digests.slice(1).map((d) => (
                        <li key={d.id} className="border-t border-line200 pt-2">
                          <p className="text-patient-sm text-ink-muted">{new Date(d.generatedAt).toLocaleDateString()}</p>
                          <p className="text-caregiver-body text-ink-muted">{d.summaryText}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </div>

            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={
                  'rounded-card border p-3 ' +
                  (alert.severity === 'red' ? 'border-danger bg-danger/10' : 'border-warning bg-warning/10')
                }
              >
                <div className="flex items-center gap-2">
                  <TrafficLight status={alert.severity} size="sm" />
                  <span className="font-bold text-navy">{alert.title}</span>
                </div>
                <p className="line-clamp-2 text-caregiver-body text-ink-muted">{alert.description}</p>
                <BigButton
                  label="Mark resolved"
                  variant="secondary"
                  onClick={() => void resolveAlert(alert.id)}
                />
              </div>
            ))}

            <div data-testid="score-graph" className="overflow-hidden rounded-card border border-line200 bg-white">
              <div className="p-4">
                <CognitiveTrendChart
                  points={trend.points}
                  sessionDays={trend.sessionDays}
                  range={range}
                  onRangeChange={setRange}
                  isLoading={trend.isLoading}
                />
              </div>
            </div>

            {velocity ? (
              <div className="overflow-hidden rounded-card border border-line200 bg-white">
                <div className="p-4">
                  <p className="text-caregiver-body text-ink-muted">Cognitive Trend</p>
                  <p className={`font-serif-display text-2xl font-bold ${velocityClassName}`}>
                    {velocity.label}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-card border border-line200 bg-white">
              <div className="flex flex-col gap-3 p-4">
                <p className="font-serif-display text-lg font-semibold text-navy">Per-Game Breakdown</p>
                <GameBreakdownChart points={trend.points} isLoading={trend.isLoading} />
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'reminders' ? (
          <div className="flex flex-col gap-4">
            {adherence.isLoading ? (
              <Skeleton height={120} />
            ) : (
              <div className="overflow-hidden rounded-card border border-line200 bg-white">
                <div className="flex flex-col gap-4 p-4">
                <p className="font-serif-display text-patient-heading font-bold text-primary">
                  {adherence.overallPct}% reminders acknowledged this week
                </p>
                <div className="flex flex-col gap-3">
                  {REMINDER_TYPES.map((type) => {
                    const stat = adherence.byType[type] ?? { acked: 0, total: 0 };
                    const pct = stat.total > 0 ? (stat.acked / stat.total) * 100 : 0;
                    return (
                      <div key={type} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-caregiver-body text-navy">
                          <span aria-hidden="true">{REMINDER_ICON[type]}</span>
                          <span className="capitalize">{type}</span>
                          <span className="ml-auto text-ink-muted">
                            {stat.acked}/{stat.total}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-surface-muted">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <section>
                  <h2 className="text-caregiver-body font-semibold text-navy">Missed Reminders</h2>
                  {adherence.missed.length === 0 ? (
                    <p className="text-patient-sm text-ink-muted">None this week.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {adherence.missed.map((m, i) => (
                        <li key={i} className="text-patient-sm text-ink-muted">
                          {m.date} {m.time} · {m.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {tab === 'history' ? <SessionCalendar year={year} month={month} points={trend.points} /> : null}

        {tab === 'companion' ? (
          <div className="flex flex-col gap-3">
            {companionQuestions === null ? <Skeleton height={120} /> : null}

            {companionQuestions && companionQuestions.length === 0 ? (
              <p className="text-caregiver-body text-ink-muted">
                No questions asked yet.
              </p>
            ) : null}

            {(companionQuestions ?? []).map((q) => {
              const isSuggestion = !q.grounded && !q.flaggedForFollowup;
              const cardClass = q.flaggedForFollowup
                ? 'border-warning bg-warning/10'
                : isSuggestion
                  ? 'border-primary bg-primary/5'
                  : 'border-line200 bg-white';
              return (
                <div key={q.id} className={`rounded-card border p-3 ${cardClass}`}>
                  <p className="font-bold text-navy">{q.question}</p>
                  <p className="text-caregiver-body text-ink-muted">{q.answer}</p>
                  {q.flaggedForFollowup ? (
                    <p className="mt-1 text-patient-sm font-semibold text-warning">
                      Follow-up suggested. This question may need your attention.
                    </p>
                  ) : isSuggestion ? (
                    <button
                      type="button"
                      onClick={() => router.push('/caregiver/memory-bank')}
                      className="mt-1 text-patient-sm font-semibold text-primary hover:text-primary-dark"
                    >
                      Consider adding this to the Memory Bank
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {tab === 'family' ? (
          <div className="flex flex-col gap-6">
            <div className="rounded-card border border-line200 bg-white p-4">
              <p className="font-serif-display text-lg font-semibold text-navy">Share with family</p>
              <p className="mt-1 text-patient-sm text-ink-muted">
                Read-only weekly summary, plus this week&apos;s engagement. No raw session data, Memory
                Bank, or companion conversations are ever shared. Links expire after 30 days and can be
                revoked any time.
              </p>
              <div className="mt-3 flex gap-2">
                <label htmlFor="family-share-label" className="sr-only">
                  Family member label
                </label>
                <input
                  id="family-share-label"
                  value={newShareLabel}
                  onChange={(e) => setNewShareLabel(e.target.value)}
                  placeholder="e.g. Son in Delhi"
                  className="h-11 flex-1 rounded-control border border-line200 px-3 text-caregiver-body text-ink"
                />
                <button
                  type="button"
                  onClick={createFamilyShare}
                  disabled={creatingShare || !newShareLabel.trim()}
                  className="rounded-control bg-primary px-4 text-caregiver-body font-semibold text-ink-inverse disabled:opacity-50"
                >
                  {creatingShare ? 'Creating…' : 'Create link'}
                </button>
              </div>
            </div>

            <div className="rounded-card border border-line200 bg-white p-4">
              <p className="font-serif-display text-lg font-semibold text-navy">Post a message</p>
              <p className="mt-1 text-patient-sm text-ink-muted">
                Goes straight to the patient&apos;s home screen. No review link needed. Shown as a short
                card the patient can tap &ldquo;Seen&rdquo; on.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="message-sender-name" className="sr-only">
                    Your name
                  </label>
                  <input
                    id="message-sender-name"
                    value={newMessageSender}
                    onChange={(e) => setNewMessageSender(e.target.value)}
                    placeholder="Your name (optional)"
                    className="h-11 rounded-control border border-line200 px-3 text-caregiver-body text-ink sm:flex-1"
                  />
                  <label htmlFor="message-sender-relation" className="sr-only">
                    Relation to patient
                  </label>
                  <input
                    id="message-sender-relation"
                    value={newMessageRelation}
                    onChange={(e) => setNewMessageRelation(e.target.value)}
                    placeholder="Relation, e.g. Daughter"
                    className="h-11 rounded-control border border-line200 px-3 text-caregiver-body text-ink sm:flex-1"
                  />
                </div>
                <label htmlFor="message-text" className="sr-only">
                  Message
                </label>
                <textarea
                  id="message-text"
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Write a short message…"
                  maxLength={280}
                  rows={3}
                  className="rounded-control border border-line200 p-3 text-caregiver-body text-ink"
                />
                <label htmlFor="message-photo-url" className="sr-only">
                  Photo URL
                </label>
                <input
                  id="message-photo-url"
                  value={newMessagePhotoUrl}
                  onChange={(e) => setNewMessagePhotoUrl(e.target.value)}
                  placeholder="Photo URL (optional)"
                  className="h-11 rounded-control border border-line200 px-3 text-caregiver-body text-ink"
                />
                <button
                  type="button"
                  onClick={postFamilyMessage}
                  disabled={postingMessage || !newMessageText.trim()}
                  className="self-start rounded-control bg-primary px-4 py-2 text-caregiver-body font-semibold text-ink-inverse disabled:opacity-50"
                >
                  {postingMessage ? 'Posting…' : 'Post message'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-serif-display text-lg font-semibold text-navy">Active shares</p>
              {familyShares === null ? <Skeleton height={80} /> : null}
              {familyShares && familyShares.length === 0 ? (
                <p className="text-caregiver-body text-ink-muted">No family shares yet.</p>
              ) : null}
              {(familyShares ?? []).map((share) => {
                const revoked = Boolean(share.revoked_at);
                const expired = !revoked && new Date(share.expires_at).getTime() < Date.now();
                return (
                  <div
                    key={share.id}
                    className="flex items-center justify-between rounded-card border border-line200 bg-white p-3"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="font-bold text-navy">{share.label}</p>
                      <StatusBadge
                        tone={revoked ? 'danger' : expired ? 'warning' : 'success'}
                        label={
                          revoked
                            ? 'Revoked'
                            : expired
                              ? 'Expired'
                              : `Expires ${new Date(share.expires_at).toLocaleDateString()}`
                        }
                      />
                    </div>
                    {!revoked && !expired ? (
                      <button
                        type="button"
                        onClick={() => revokeFamilyShare(share.id)}
                        className="text-caregiver-body font-semibold text-danger"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-serif-display text-lg font-semibold text-navy">Notes awaiting review</p>
              {familyNotes === null ? <Skeleton height={80} /> : null}
              {familyNotes && familyNotes.length === 0 ? (
                <p className="text-caregiver-body text-ink-muted">Nothing waiting for review.</p>
              ) : null}
              {(familyNotes ?? []).map((note) => (
                <div key={note.id} className="rounded-card border border-line200 bg-white p-3">
                  <p className="text-caregiver-body text-ink">&ldquo;{note.text}&rdquo;</p>
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => moderateFamilyNote(note.id, 'approve')}
                      className="text-caregiver-body font-semibold text-success"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => moderateFamilyNote(note.id, 'reject')}
                      className="text-caregiver-body font-semibold text-danger"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PatientNav from '@/components/layout/PatientNav';
import BigButton from '@/components/ui/BigButton';
import Skeleton from '@/components/ui/Skeleton';
import TrafficLight, { type TriageStatus } from '@/components/ui/TrafficLight';
import ScoreGraph, { type GameType as ScoreGameType } from '@/components/ui/ScoreGraph';
import { authedFetch } from '@/lib/api/client';
import { MAX_LEVEL } from '@/lib/engine/difficulty';
import type { GameType, ReminderType } from '@/lib/supabase/types';

type Tab = 'cognitive' | 'reminders' | 'history';
type RangeOption = '30d' | '90d' | '180d';

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

interface TimelinePoint {
  date: string;
  accuracy: number;
  gameType: ScoreGameType;
  maxDifficultyReached: number;
}

interface AdherenceResponse {
  overallPct: number;
  byType: Record<string, { acked: number; total: number }>;
  missed: Array<{ date: string; time: string; label: string }>;
}

const CANONICAL_GAMES: GameType[] = ['object_hunt', 'word_stream', 'quick_tap', 'path_match'];
const GAME_LABELS: Record<GameType, string> = {
  object_hunt: 'Object Hunt',
  word_stream: 'Word Stream',
  quick_tap: 'Quick Tap',
  path_match: 'Path Match',
};
const SCORE_GAME_FOR: Record<GameType, ScoreGameType> = {
  object_hunt: 'object_hunt',
  word_stream: 'word_recall',
  quick_tap: 'quick_tap',
  path_match: 'path_trace',
};
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
  const [range, setRange] = useState<RangeOption>('30d');
  const [points, setPoints] = useState<TimelinePoint[] | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [adherence, setAdherence] = useState<AdherenceResponse | null>(null);
  const [error, setError] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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
    authedFetch<{ points: TimelinePoint[] }>(`/api/patients/${patientId}/timeline?range=${range}`)
      .then((body) => setPoints(body.points))
      .catch(() => setError(true));
  }, [patientId, range]);

  useEffect(() => {
    if (!patientId || tab !== 'reminders' || adherence) return;
    authedFetch<AdherenceResponse>(`/api/patients/${patientId}/adherence?range=7d`)
      .then(setAdherence)
      .catch(() => setError(true));
  }, [patientId, tab, adherence]);

  const resolveAlert = async (alertId: string) => {
    await authedFetch(`/api/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_resolved: true }),
    }).catch(() => setError(true));
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const velocity = useMemo(() => {
    if (!points || points.length === 0) return null;
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    const last7 = sorted.slice(-7);
    const prev7 = sorted.slice(-14, -7);
    if (last7.length === 0 || prev7.length === 0) return null;
    const avg = (xs: TimelinePoint[]) => xs.reduce((s, p) => s + p.accuracy, 0) / xs.length;
    const last7Avg = avg(last7);
    const prev7Avg = avg(prev7);
    if (last7Avg > prev7Avg + 5) return { label: '↑ Improving', className: 'text-success' };
    if (last7Avg < prev7Avg - 5) return { label: '↓ Declining', className: 'text-danger' };
    return { label: '→ Stable', className: 'text-ink-muted' };
  }, [points]);

  const difficultyByGame = useMemo(() => {
    const map = new Map<GameType, { level: number; lastPlayed: string }>();
    for (const canonical of CANONICAL_GAMES) {
      const matching = (points ?? []).filter((p) => p.gameType === SCORE_GAME_FOR[canonical]);
      if (matching.length === 0) continue;
      const latest = matching.reduce((a, b) => (a.date > b.date ? a : b));
      map.set(canonical, { level: latest.maxDifficultyReached, lastPlayed: latest.date });
    }
    return map;
  }, [points]);

  const { year, month } = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, []);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const accuracyByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of points ?? []) {
      if (!p.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) continue;
      map.set(p.date, p.accuracy);
    }
    return map;
  }, [points, year, month]);

  if (error) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-dashboard flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-caregiver-body text-ink-muted">Could not load data. Pull to refresh.</p>
        <BigButton label="Try Again" variant="primary" onClick={() => setError(false)} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-dashboard flex-col">
      <PatientNav
        title={patient ? patient.displayName : 'Patient'}
        onBack={() => router.push('/caregiver/patients')}
      />
      {patient ? (
        <div className="flex items-center gap-2 px-4 py-2">
          <TrafficLight status={patient.alertStatus} size="sm" />
          <span className="text-caregiver-body text-ink-muted">
            {patient.ageYears} · {patient.primaryLanguage}
          </span>
        </div>
      ) : null}

      <div className="flex border-b border-surface-muted">
        {(['cognitive', 'reminders', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              'flex-1 py-3 text-caregiver-body capitalize ' +
              (tab === t ? 'border-b-2 border-primary text-primary' : 'text-ink-muted')
            }
          >
            {t}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 py-4">
        {tab === 'cognitive' ? (
          <div className="flex flex-col gap-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={
                  'rounded-card p-3 ' + (alert.severity === 'red' ? 'bg-danger/10' : 'bg-warning/10')
                }
              >
                <div className="flex items-center gap-2">
                  <TrafficLight status={alert.severity} size="sm" />
                  <span className="font-bold text-ink">{alert.title}</span>
                </div>
                <p className="line-clamp-2 text-caregiver-body text-ink-muted">{alert.description}</p>
                <BigButton
                  label="Mark Resolved"
                  variant="secondary"
                  onClick={() => void resolveAlert(alert.id)}
                />
              </div>
            ))}

            <div role="group" aria-label="Timeline range" className="flex gap-2">
              {(['30d', '90d', '180d'] as RangeOption[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  aria-pressed={range === r}
                  className={
                    'rounded-card px-3 py-2 text-caregiver-body ' +
                    (range === r ? 'bg-primary text-ink-inverse' : 'bg-surface-muted text-ink')
                  }
                >
                  {r}
                </button>
              ))}
            </div>

            {points === null ? (
              <Skeleton height={240} />
            ) : (
              <div data-testid="score-graph">
                <ScoreGraph data={points} />
              </div>
            )}

            {velocity ? (
              <div className="mt-4 rounded-card bg-surface-card p-4">
                <p className="text-caregiver-body text-ink-muted">Cognitive Trend</p>
                <p className={`text-caregiver-heading font-bold ${velocity.className}`}>
                  {velocity.label}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              {CANONICAL_GAMES.map((game) => {
                const info = difficultyByGame.get(game);
                return (
                  <div key={game} className="rounded-card bg-surface-card p-3">
                    <p className="font-bold text-ink">{GAME_LABELS[game]}</p>
                    <p className="text-caregiver-body text-ink-muted">
                      {info ? `Level ${info.level} / ${MAX_LEVEL[game]}` : 'No sessions yet'}
                    </p>
                    {info ? (
                      <p className="text-patient-sm text-ink-muted">Last played {info.lastPlayed}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {tab === 'reminders' ? (
          <div className="flex flex-col gap-4">
            {adherence === null ? (
              <Skeleton height={120} />
            ) : (
              <>
                <p className="text-patient-heading font-bold text-primary">
                  {adherence.overallPct}% reminders acknowledged this week
                </p>
                <div className="flex flex-col gap-3">
                  {REMINDER_TYPES.map((type) => {
                    const stat = adherence.byType[type] ?? { acked: 0, total: 0 };
                    const pct = stat.total > 0 ? (stat.acked / stat.total) * 100 : 0;
                    return (
                      <div key={type} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-caregiver-body text-ink">
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
                  <h2 className="text-caregiver-body font-semibold text-ink">Missed Reminders</h2>
                  {adherence.missed.length === 0 ? (
                    <p className="text-patient-sm text-ink-muted">None this week.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {adherence.missed.map((m, i) => (
                        <li key={i} className="text-patient-sm text-ink-muted">
                          {m.date} {m.time} — {m.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        ) : null}

        {tab === 'history' ? (
          <div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <span key={i} className="text-patient-sm text-ink-muted">
                  {d}
                </span>
              ))}
              {Array.from({ length: firstWeekday }, (_, i) => (
                <span key={`pad-${i}`} aria-hidden="true" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const accuracy = accuracyByDate.get(dateStr);
                const hasData = accuracy !== undefined;
                const dotColor =
                  accuracy === undefined
                    ? undefined
                    : accuracy > 75
                      ? 'bg-success'
                      : accuracy >= 50
                        ? 'bg-warning'
                        : 'bg-danger';
                return (
                  <button
                    key={dateStr}
                    type="button"
                    data-testid="calendar-day"
                    onClick={() => hasData && setSelectedDay(dateStr)}
                    style={{ height: 40, width: 40 }}
                    className="mx-auto flex flex-col items-center justify-center"
                  >
                    <span className={hasData ? 'text-ink' : 'text-ink-muted'}>{day}</span>
                    {dotColor ? (
                      <span
                        aria-hidden="true"
                        style={{ height: 12, width: 12 }}
                        className={`rounded-full ${dotColor}`}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {selectedDay ? (
              <div
                className="fixed inset-x-0 bottom-16 z-40 rounded-t-tile bg-surface-card p-4 shadow-2xl transition-transform duration-300"
                role="dialog"
                aria-label={`Details for ${selectedDay}`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="mb-2 text-caregiver-body text-ink-muted"
                >
                  Close
                </button>
                <p className="font-bold text-ink">{selectedDay}</p>
                {(points ?? [])
                  .filter((p) => p.date === selectedDay)
                  .map((p, i) => (
                    <p key={i} className="text-caregiver-body text-ink">
                      {p.gameType}: {p.accuracy}%
                    </p>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}

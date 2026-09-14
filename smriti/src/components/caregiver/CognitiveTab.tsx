'use client';

import { useEffect, useMemo, useState } from 'react';
import Skeleton from '@/components/ui/Skeleton';
import TrafficLight, { type TriageStatus } from '@/components/ui/TrafficLight';
import StreakFlame from '@/components/ui/StreakFlame';
import CognitiveScoreCard from '@/components/caregiver/CognitiveScoreCard';
import WeekActivity from '@/components/caregiver/WeekActivity';
import Panel, { buttonClass } from '@/components/ui/Panel';
import Notice from '@/components/ui/Notice';
import CognitiveTrendChart from '@/components/caregiver/CognitiveTrendChart';
import GameBreakdownChart from '@/components/caregiver/GameBreakdownChart';
import SessionCalendar from '@/components/caregiver/SessionCalendar';
import { authedFetch } from '@/lib/api/client';
import { useCognitiveTrend, type TrendRange } from '@/hooks/useCognitiveTrend';
import { useGameStreak } from '@/hooks/useGameStreak';
import { useReminderAdherence } from '@/hooks/useReminderAdherence';
import { computeCognitiveScore, recentActivity, type ScoreRow } from '@/lib/dashboard/cognitiveScore';

export interface AlertRow {
  id: string;
  title: string;
  description: string | null;
  severity: TriageStatus;
}

interface DigestEntry {
  id: string;
  weekOf: string;
  summaryText: string;
  generatedAt: string;
}

export interface CognitiveTabProps {
  patientId: string;
  alerts: AlertRow[];
  onResolveAlert: (alertId: string) => void;
  resolveFailed: boolean;
  onError: () => void;
}

/**
 * The Cognitive section: alerts needing attention, the cognitive score,
 * streak/adherence-at-a-glance, the weekly digest, the accuracy chart, the
 * per-game breakdown and the session calendar. Owns only what's specific to
 * this tab (digest fetch/refresh); the alert list and its resolve action stay
 * on the page shell since the header's "needs attention" copy depends on them.
 */
export default function CognitiveTab({ patientId, alerts, onResolveAlert, resolveFailed, onError }: CognitiveTabProps) {
  const [range, setRange] = useState<TrendRange>('30d');
  const [digests, setDigests] = useState<DigestEntry[] | null>(null);
  const [digestGenerating, setDigestGenerating] = useState(false);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  // Both Dexie-backed (dexie-react-hooks' useLiveQuery under the hood) — no
  // network call, so this tab keeps working offline. See each hook's own
  // doc comment for the cross-device caveat (a summary only ever exists
  // locally on the device that wrote it; `/api/sync` never sends
  // `daily_summaries` back down — lib/db/sync.ts).
  const trend = useCognitiveTrend(patientId, range);
  const streak = useGameStreak(patientId);
  // Same live Dexie query the Reminders tab uses (useLiveQuery-backed, so a
  // second subscription here is cheap) — this tab only ever needs the
  // headline percentage, not the missed-reminder detail.
  const adherence = useReminderAdherence(patientId);
  // Fixed 30-day window for the score and the last-7-days chart, independent
  // of whichever range the accuracy chart is showing.
  const scoreTrend = useCognitiveTrend(patientId, '30d');

  const scoreRows = useMemo<ScoreRow[]>(
    () =>
      scoreTrend.points.map((p) => ({
        date: p.date,
        gameType: p.gameType,
        correctRounds: (p.accuracy / 100) * p.totalRounds,
        totalRounds: p.totalRounds,
        maxDifficultyReached: p.maxDifficultyReached,
      })),
    [scoreTrend.points],
  );
  const cognitiveScore = useMemo(() => computeCognitiveScore(scoreRows, today), [scoreRows, today]);
  const lastSevenDays = useMemo(() => recentActivity(scoreRows, today, 7), [scoreRows, today]);
  const daysPlayedThisWeek = lastSevenDays.filter((d) => d.accuracy !== null).length;

  const { year, month } = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, []);

  const generateDigest = () => {
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
    authedFetch<{ digests: DigestEntry[] }>(`/api/patients/${patientId}/digests`)
      .then((body) => {
        setDigests(body.digests);
        const latest = body.digests[0];
        if (!latest || Date.now() - new Date(latest.generatedAt).getTime() >= 7 * 24 * 60 * 60 * 1000) {
          generateDigest();
        }
      })
      .catch(() => {
        setDigests([]);
        onError();
      });
    // Fires once per patient, mirroring the digest-freshness check inside;
    // generateDigest is intentionally not a dependency (it closes over
    // `patientId`, which is the real dependency and is already listed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  return (
    <div className="flex flex-col gap-5">
      {alerts.length > 0 ? (
        <section aria-labelledby="alerts-heading">
          <h2 id="alerts-heading" className="mb-3 font-serif-display text-[1.375rem] font-medium text-ink">
            Needs your attention
          </h2>
          {resolveFailed ? (
            <div role="alert" className="mb-3">
              <Notice tone="danger">Could not mark it resolved. Check the connection and try again.</Notice>
            </div>
          ) : null}
          <ul className="flex flex-col gap-3">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={
                  'flex flex-col gap-3 rounded-card border p-4 sm:flex-row sm:items-center sm:gap-6 ' +
                  (alert.severity === 'red' ? 'border-danger/40 bg-danger/5' : 'border-warning/50 bg-warning/5')
                }
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <TrafficLight status={alert.severity} size="sm" />
                  <div className="min-w-0">
                    <p className="text-caregiver-body font-bold text-ink">{alert.title}</p>
                    {alert.description ? <p className="text-patient-sm text-ink-muted">{alert.description}</p> : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onResolveAlert(alert.id)}
                  className={`${buttonClass.secondary} w-full shrink-0 sm:w-auto`}
                >
                  Mark resolved
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <CognitiveScoreCard score={cognitiveScore} isLoading={scoreTrend.isLoading} />

        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label="At a glance" className="grid grid-cols-3 divide-x divide-line200 rounded-card border border-line200 bg-surface-card">
            <div className="flex flex-col items-center gap-1 px-2 py-4 text-center">
              <StreakFlame active={!streak.isLoading && streak.current > 0} size={30} />
              <p className="font-serif-display text-[1.625rem] font-medium leading-none text-ink">
                {streak.isLoading ? '–' : streak.current}
              </p>
              <p className="text-patient-sm text-ink-muted">Daily streak</p>
            </div>
            <div className="flex flex-col items-center justify-end gap-1 px-2 py-4 text-center">
              <p className="font-serif-display text-[1.625rem] font-medium leading-none text-ink">
                {daysPlayedThisWeek}
                <span className="text-base text-ink-muted">/7</span>
              </p>
              <p className="text-patient-sm text-ink-muted">Days played this week</p>
            </div>
            <div className="flex flex-col items-center justify-end gap-1 px-2 py-4 text-center">
              <p className="font-serif-display text-[1.625rem] font-medium leading-none text-ink">
                {adherence.isLoading ? '–' : `${adherence.overallPct}%`}
              </p>
              <p className="text-patient-sm text-ink-muted">Reminders taken</p>
            </div>
          </section>

          <Panel title="Last 7 days" description="Accuracy on each day they played.">
            <WeekActivity variant="full" days={lastSevenDays.map((d) => d.accuracy)} dates={lastSevenDays.map((d) => d.date)} />
          </Panel>
        </div>
      </div>

      <Panel
        title="This week"
        description="A plain-language summary of the week."
        action={
          <button type="button" onClick={generateDigest} disabled={digestGenerating} className={buttonClass.secondary}>
            {digestGenerating ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      >
        {digests === null || (digestGenerating && digests.length === 0) ? (
          <Skeleton height={60} />
        ) : digests.length === 0 ? (
          <p className="text-caregiver-body text-ink-muted">No digest yet.</p>
        ) : (
          <>
            <p className="max-w-[70ch] text-caregiver-body text-ink">{digests[0].summaryText}</p>
            <p className="mt-3 text-patient-sm text-ink-muted">
              Generated {new Date(digests[0].generatedAt).toLocaleDateString()}. Not medical advice.
            </p>
          </>
        )}
        {digests && digests.length > 1 ? (
          <details className="mt-4 border-t border-line200 pt-1">
            <summary className="flex min-h-touch-min cursor-pointer items-center text-caregiver-body font-bold text-primary-dark">
              Past weeks
            </summary>
            <ul className="flex flex-col gap-4 pb-1">
              {digests.slice(1).map((d) => (
                <li key={d.id}>
                  <p className="text-patient-sm font-bold text-ink-muted">{new Date(d.generatedAt).toLocaleDateString()}</p>
                  <p className="text-caregiver-body text-ink">{d.summaryText}</p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <div data-testid="score-graph" className="min-w-0 rounded-card border border-line200 bg-surface-card p-5">
          <h2 className="font-serif-display text-[1.375rem] font-medium leading-tight text-ink">Accuracy over time</h2>
          <p className="mb-4 mt-1 text-patient-sm text-ink-muted">Average across all games played each day.</p>
          <CognitiveTrendChart
            points={trend.points}
            sessionDays={trend.sessionDays}
            range={range}
            onRangeChange={setRange}
            isLoading={trend.isLoading}
          />
        </div>

        <Panel title="Per-Game Breakdown" description="Average accuracy for each game in this period." className="min-w-0">
          <GameBreakdownChart points={trend.points} isLoading={trend.isLoading} height={240} />
        </Panel>
      </div>

      <SessionCalendar year={year} month={month} points={trend.points} />
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import Skeleton from '@/components/ui/Skeleton';
import Panel from '@/components/ui/Panel';
import Notice from '@/components/ui/Notice';
import { formatShortDate } from '@/lib/dashboard/formatDate';
import {
  INACTIVITY_ALERT_DAYS,
  aggregateByDomain,
  challengeFit,
  summarizeActivityLevel,
  type ChallengeFit,
} from '@/lib/dashboard/activity';
import type { TrendPoint } from '@/lib/dashboard/trend';

export interface ActivityLevelPanelProps {
  points: TrendPoint[];
  today: string;
  isLoading?: boolean;
  /** Days of history to summarise. */
  windowDays?: number;
}

const FIT_COPY: Record<ChallengeFit, { title: string; detail: string }> = {
  'too-easy': {
    title: 'The games may be too easy',
    detail: 'Nearly everything is correct. The level rises on its own after strong sessions.',
  },
  'about-right': {
    title: 'The games are pitched about right',
    detail: 'Hard enough to be worth doing, easy enough to finish. Nothing to change.',
  },
  'too-hard': {
    title: 'The games may be too hard',
    detail: 'More is being missed than met. The level eases back on its own after weak sessions.',
  },
  unknown: { title: 'Not enough play yet', detail: 'A few sessions will show whether the level suits them.' },
};

/**
 * How much the patient is playing, in which parts of thinking, and whether
 * the difficulty is landing where it should.
 *
 * The rest of the Cognitive tab answers "how well are they doing?". A
 * caregiver or health worker also has to answer "are they using it at all?"
 * and "is what they are being given the right size?" — an unchanged accuracy
 * line means something quite different after nine days of play than after
 * one, and neither the score nor the accuracy chart distinguishes them.
 */
export default function ActivityLevelPanel({
  points,
  today,
  isLoading = false,
  windowDays = 14,
}: ActivityLevelPanelProps) {
  const activity = useMemo(() => summarizeActivityLevel(points, today, windowDays), [points, today, windowDays]);
  const domains = useMemo(() => aggregateByDomain(points), [points]);
  const fit = useMemo(() => challengeFit(points), [points]);

  if (isLoading) {
    return (
      <Panel title="Activity" description={`Play over the last ${windowDays} days.`}>
        <Skeleton height={200} />
      </Panel>
    );
  }

  const quiet = activity.daysSinceLastPlayed !== null && activity.daysSinceLastPlayed >= INACTIVITY_ALERT_DAYS;
  const maxRounds = Math.max(1, ...activity.days.map((d) => d.rounds));

  return (
    <Panel title="Activity" description={`Play over the last ${windowDays} days.`} className="min-w-0">
      {activity.daysPlayed === 0 ? (
        <p className="text-caregiver-body text-ink-muted">No games played in this period.</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div>
              <dt className="text-patient-sm text-ink-muted">Days played</dt>
              <dd className="font-serif-display text-[1.625rem] font-medium leading-none text-ink">
                {activity.daysPlayed}
                <span className="text-base text-ink-muted">/{windowDays}</span>
              </dd>
            </div>
            <div>
              <dt className="text-patient-sm text-ink-muted">Sessions</dt>
              <dd className="font-serif-display text-[1.625rem] font-medium leading-none text-ink">
                {activity.totalSessions}
              </dd>
            </div>
            <div>
              <dt className="text-patient-sm text-ink-muted">Rounds a day</dt>
              <dd className="font-serif-display text-[1.625rem] font-medium leading-none text-ink">
                {activity.averageRoundsPerDay.toFixed(1)}
              </dd>
            </div>
          </dl>

          <ol
            aria-label="Rounds played each day"
            className="mt-5 flex h-20 items-end gap-1"
            data-testid="activity-bars"
          >
            {activity.days.map((day) => (
              <li
                key={day.date}
                className="flex h-full flex-1 items-end"
                title={`${formatShortDate(day.date)}: ${day.rounds} rounds`}
              >
                <div
                  aria-hidden="true"
                  className={`w-full rounded-t ${day.rounds > 0 ? 'bg-primary' : 'bg-surface-muted'}`}
                  style={{ height: `${Math.max(4, (day.rounds / maxRounds) * 100)}%` }}
                />
              </li>
            ))}
          </ol>
          <p className="mt-2 text-patient-sm text-ink-muted">
            {activity.totalRounds} rounds in total
            {activity.daysSinceLastPlayed === 0
              ? ', including today'
              : activity.daysSinceLastPlayed !== null
                ? `, last played ${activity.daysSinceLastPlayed} day${activity.daysSinceLastPlayed === 1 ? '' : 's'} ago`
                : ''}
            .
          </p>
        </>
      )}

      {quiet ? (
        <div className="mt-4">
          <Notice tone="warning">
            Nothing played for {activity.daysSinceLastPlayed} days. A short session together is often enough to restart
            the habit.
          </Notice>
        </div>
      ) : null}

      {domains.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-caregiver-body font-bold text-ink">By kind of thinking</h3>
          <ul className="mt-3 flex flex-col gap-3" aria-label="Accuracy by kind of thinking">
            {domains.map((d) => {
              const pct = Math.round(d.accuracy);
              return (
                <li key={d.domain} data-testid="domain-row" className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-caregiver-body text-ink">{d.label}</span>
                    <span className="shrink-0 text-caregiver-body font-bold tabular-nums text-ink">{pct}%</span>
                  </div>
                  <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-patient-sm text-ink-muted">
                    {d.gamesPlayed} game{d.gamesPlayed === 1 ? '' : 's'}, {d.totalRounds} rounds.
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 border-t border-line200 pt-4">
        <p className="text-caregiver-body font-bold text-ink">{FIT_COPY[fit.fit].title}</p>
        <p className="mt-1 text-patient-sm text-ink-muted">
          {fit.accuracy !== null ? `${Math.round(fit.accuracy)}% correct overall. ` : ''}
          {FIT_COPY[fit.fit].detail}
        </p>
      </div>
    </Panel>
  );
}

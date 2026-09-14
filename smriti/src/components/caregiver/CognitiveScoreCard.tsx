import ScoreRing from '@/components/ui/ScoreRing';
import Skeleton from '@/components/ui/Skeleton';
import { BAND_LABEL, SCORE_WINDOW_DAYS, type CognitiveScore } from '@/lib/dashboard/cognitiveScore';

export interface CognitiveScoreCardProps {
  score: CognitiveScore | null;
  isLoading?: boolean;
}

function Part({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-patient-sm">
        <span className="font-bold text-ink">{label}</span>
        <span className="tabular-nums text-ink-muted">{detail}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(value)}%` }} />
      </div>
    </div>
  );
}

/**
 * The patient page's headline: one 0-100 cognitive score with its band,
 * the change from the previous fortnight, and the three parts it is made of,
 * so the number is never a black box. See lib/dashboard/cognitiveScore.ts.
 */
export default function CognitiveScoreCard({ score, isLoading = false }: CognitiveScoreCardProps) {
  return (
    <section
      aria-labelledby="cognitive-score-heading"
      className="rounded-card border border-line200 bg-surface-card p-5"
    >
      <h2 id="cognitive-score-heading" className="font-serif-display text-[1.375rem] font-medium leading-tight text-ink">
        Cognitive score
      </h2>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-5">
          <Skeleton width={152} height={152} className="rounded-full" />
          <Skeleton height={60} />
        </div>
      ) : !score ? (
        <p className="mt-2 text-caregiver-body text-ink-muted">
          No games played in the last {SCORE_WINDOW_DAYS} days. The score appears after the first session.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
            <ScoreRing value={score.score} size="lg" label={`Cognitive score ${score.score} out of 100`} />
            <div className="w-full text-center sm:text-left">
              <p className="font-serif-display text-[1.75rem] font-medium leading-tight text-ink">
                {BAND_LABEL[score.band]}
              </p>
              <p className="mt-1 text-caregiver-body text-ink">
                {score.delta === null
                  ? 'First fortnight with enough games to compare.'
                  : score.delta === 0
                    ? 'Same as the previous 2 weeks.'
                    : `${score.delta > 0 ? '↑ Up' : '↓ Down'} ${Math.abs(score.delta)} from the previous 2 weeks.`}
              </p>
              {!score.enoughData ? (
                <p className="mt-1 text-patient-sm font-bold text-ink-muted">
                  Early estimate: based on {score.daysPlayed} day{score.daysPlayed === 1 ? '' : 's'} of play.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-line200 pt-5">
            <Part label="Accuracy" value={score.accuracy} detail={`${Math.round(score.accuracy)}%`} />
            <Part label="Level reached" value={score.level} detail={`${Math.round(score.level)}% of top level`} />
            <Part
              label="Regular play"
              value={score.regularity}
              detail={`${score.daysPlayed} of ${SCORE_WINDOW_DAYS} days`}
            />
          </div>
          <p className="mt-4 text-patient-sm text-ink-muted">
            Last {SCORE_WINDOW_DAYS} days of games: 60% accuracy, 25% level, 15% regular play. A guide for
            conversations with their doctor, not a diagnosis.
          </p>
        </>
      )}
    </section>
  );
}

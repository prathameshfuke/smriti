import type { GameType } from '@/lib/supabase/types';
import type { LocalTelemetryEvent } from '@/lib/db/schema';
import type { ScoreBand } from '@/lib/dashboard/cognitiveScore';
import { computeFeatures, predictDifficultyClass, CONFIDENCE_THRESHOLD } from '@/lib/games/difficulty-ml';
import {
  MAX_LEVEL,
  adjustDifficulty,
  applyEducationBonus,
  getEducationBonus,
  type DifficultyState,
} from './difficulty';

/**
 * One place where "what level should this patient play next?" is decided.
 *
 * `difficulty.ts` answers that from the session alone — a streak counter
 * with an ML model (`lib/games/difficulty-ml.ts`) in front of it. This layer
 * adds the part neither of them can see: who the patient is. A patient the
 * dashboard already scores as needing close support should not be pushed up
 * a level by one good afternoon, and a patient with little schooling should
 * get the same allowance when the level is chosen that they already get when
 * the score is calculated.
 *
 * Every decision comes back with a plain-language `reason`, so a caregiver
 * looking at the difficulty history is never told only that the number
 * changed (see `lib/db/difficultyLog.ts`).
 *
 * This is an adaptation policy, not a clinical instrument — the same caveat
 * `difficulty-ml.ts` carries applies to everything here.
 */

/**
 * The band the loop aims for: hard enough to be worth doing, easy enough to
 * stay encouraging. Roughly the "desirable difficulty" range used in
 * cognitive training; the numbers are a product choice, not a clinical one.
 */
export const TARGET_ACCURACY_MIN = 70;
export const TARGET_ACCURACY_MAX = 85;

/** How near-perfect a session must be before a struggling patient moves up. */
const BAND_INCREASE_FLOOR: Record<ScoreBand, number> = {
  strong: 0,
  steady: 0,
  support: 85,
  'close-support': 95,
};

const BAND_LANGUAGE: Record<ScoreBand, string> = {
  strong: 'doing well',
  steady: 'steady',
  support: 'needing support',
  'close-support': 'needing close support',
};

export interface CognitiveProfile {
  /** From the 14-day dashboard score; null before there is enough data. */
  band: ScoreBand | null;
  educationYears: number;
}

export interface DifficultyDecisionInput {
  state: DifficultyState;
  gameType: GameType;
  /** Raw session accuracy, 0-100. The education bonus is applied here. */
  sessionAccuracy: number;
  /** This session's rounds, when the caller has them — feeds the ML model. */
  sessionEvents?: LocalTelemetryEvent[];
  profile: CognitiveProfile;
}

export interface DifficultyDecision {
  next: DifficultyState;
  /** What actually decided it: the model, the streak rule, or a safety guard. */
  source: 'model' | 'rule' | 'guard';
  /** One sentence a caregiver can read. */
  reason: string;
  /** Accuracy after the education bonus, which is what was judged. */
  adjustedAccuracy: number;
}

/**
 * Decides the next level for one completed session.
 *
 * Steps down are never blocked: a patient stuck above their level is the
 * failure mode that makes someone give up on the app, and it is the one
 * thing no guard here should ever be able to cause.
 */
export function decideNextLevel(input: DifficultyDecisionInput): DifficultyDecision {
  const { state, gameType, sessionEvents, profile } = input;
  const bonus = getEducationBonus(profile.educationYears);
  const adjustedAccuracy = applyEducationBonus(input.sessionAccuracy, bonus);

  const raw = adjustDifficulty(state, gameType, adjustedAccuracy, sessionEvents);
  const usedModel = !!sessionEvents && sessionEvents.length > 0;

  // The target band decides the direction; the model decides whether a step
  // up is actually earned. Left to itself the layer below chased accuracy
  // upward — a patient scoring 78%, squarely where we want them, kept being
  // pushed up until they were failing — and it needed two bad sessions in a
  // row before easing off someone who was already lost.
  //
  // Inside the band: nothing moves.
  // Below it: one step down, and no model verdict can veto that. A patient
  //   stuck above their level is what makes someone stop opening the app.
  // Above it: one step up, unless the model reads the session as not ready
  //   (fatigue, a late error streak, slowing reactions — the things plain
  //   accuracy hides).
  let steered: number;
  if (inTargetBand(adjustedAccuracy)) {
    steered = state.currentLevel;
  } else if (adjustedAccuracy < TARGET_ACCURACY_MIN) {
    steered = state.currentLevel - 1;
  } else {
    steered = modelHoldsBack(sessionEvents) ? state.currentLevel : state.currentLevel + 1;
  }

  // One level per session, whatever any layer below asked for. A two-level
  // jump is never what a patient with a memory condition needs, even when
  // the arithmetic supports it.
  const capped = Math.max(
    1,
    Math.min(
      MAX_LEVEL[gameType],
      Math.max(state.currentLevel - 1, Math.min(state.currentLevel + 1, steered)),
    ),
  );

  const goingUp = capped > state.currentLevel;
  const band = profile.band;

  if (goingUp && band && adjustedAccuracy < BAND_INCREASE_FLOOR[band]) {
    return {
      next: { ...raw, currentLevel: state.currentLevel },
      source: 'guard',
      reason:
        `Kept at level ${state.currentLevel}. Recent weeks show ${BAND_LANGUAGE[band]}, ` +
        `so the level only rises after a near-perfect game (this one was ${Math.round(adjustedAccuracy)}%).`,
      adjustedAccuracy,
    };
  }

  const next = { ...raw, currentLevel: capped };
  const source: DifficultyDecision['source'] = usedModel ? 'model' : 'rule';

  if (goingUp) {
    return {
      next,
      source,
      reason: `Moved up to level ${capped} after ${Math.round(adjustedAccuracy)}% correct.`,
      adjustedAccuracy,
    };
  }
  if (capped < state.currentLevel) {
    return {
      next,
      source,
      reason: `Eased back to level ${capped} after ${Math.round(adjustedAccuracy)}% correct, to keep the games winnable.`,
      adjustedAccuracy,
    };
  }
  return {
    next,
    source,
    reason: `Stayed at level ${capped} — ${Math.round(adjustedAccuracy)}% correct is about right for now.`,
    adjustedAccuracy,
  };
}

/**
 * Whether the model reads this session as one to hold rather than build on.
 * Only consulted for a step *up* — a confident "decrease" or "maintain" on a
 * high-accuracy session is exactly the case the model exists for: accurate,
 * but fading. Below the confidence threshold it says nothing.
 */
function modelHoldsBack(sessionEvents?: LocalTelemetryEvent[]): boolean {
  if (!sessionEvents || sessionEvents.length === 0) return false;
  const features = computeFeatures(sessionEvents);
  if (!features) return false;
  const { predictedClass, confidence } = predictDifficultyClass(features);
  return confidence >= CONFIDENCE_THRESHOLD && predictedClass !== 'increase';
}

/** Whether a session landed in the band the loop aims for. Used by the dashboard. */
export function inTargetBand(accuracy: number): boolean {
  return accuracy >= TARGET_ACCURACY_MIN && accuracy <= TARGET_ACCURACY_MAX;
}

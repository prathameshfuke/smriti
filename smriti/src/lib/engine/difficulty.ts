import type { GameType } from '@/lib/supabase/types';
import type { LocalTelemetryEvent } from '@/lib/db/schema';
import { computeFeatures, predictDifficultyClass, CONFIDENCE_THRESHOLD } from '@/lib/games/difficulty-ml';

export interface DifficultyState {
  currentLevel: number;
  consecutiveHighScores: number;
  consecutiveLowScores: number;
}

const HIGH_THRESHOLD = 80;
const LOW_THRESHOLD = 50;
const HIGH_STREAK_TO_LEVEL_UP = 3;
const LOW_STREAK_TO_LEVEL_DOWN = 2;
const MIN_LEVEL = 1;

/**
 * Ceiling per game, matched to each game's actual difficulty-parameter table
 * (e.g. Object Hunt L1-L10 tile counts) — going past it would ask for a
 * config that doesn't exist.
 */
export const MAX_LEVEL: Record<GameType, number> = {
  object_hunt: 10,
  word_stream: 6,
  quick_tap: 8,
  path_match: 8,
  memory_match: 6,
  memory_blocks: 8,
  frog_leap: 8,
  counting_boxes: 6,
  n_back: 5,
  larger_number: 6,
  memory_span: 8,
  fish_trace: 6,
  double_decision: 8,
  // A fixed 5-question quiz sourced from whatever Memory Bank facts exist
  // has no meaningful "harder" tier — this game never levels, unlike every
  // other one here.
  reminiscence_quiz: 1,
  // Level maps 1:1 to sequence length (3 items at L1, up to 7 at L5) — see
  // ROUTINE_RECALL_LEVELS in lib/games/routine-recall.ts. Capped at 5, not
  // higher, because a single calendar day rarely has more than ~7
  // acknowledged reminders to draw a sequence from.
  routine_recall: 5,
};

/**
 * The original difficulty decision: a 2-3 session streak counter. Kept
 * intact and exported so it stays independently testable — this is now the
 * fallback path `adjustDifficulty` reaches for whenever the ML model below
 * either has no session data to work with or isn't confident, not dead code.
 */
export function adjustDifficultyByRule(
  state: DifficultyState,
  gameType: GameType,
  sessionAccuracy: number,
): DifficultyState {
  const maxLevel = MAX_LEVEL[gameType];

  if (sessionAccuracy >= HIGH_THRESHOLD) {
    const consecutiveHighScores = state.consecutiveHighScores + 1;
    if (consecutiveHighScores >= HIGH_STREAK_TO_LEVEL_UP) {
      return {
        currentLevel: Math.min(maxLevel, state.currentLevel + 1),
        consecutiveHighScores: 0,
        consecutiveLowScores: 0,
      };
    }
    return { ...state, consecutiveHighScores, consecutiveLowScores: 0 };
  }

  if (sessionAccuracy < LOW_THRESHOLD) {
    const consecutiveLowScores = state.consecutiveLowScores + 1;
    if (consecutiveLowScores >= LOW_STREAK_TO_LEVEL_DOWN) {
      return {
        currentLevel: Math.max(MIN_LEVEL, state.currentLevel - 1),
        consecutiveHighScores: 0,
        consecutiveLowScores: 0,
      };
    }
    return { ...state, consecutiveLowScores, consecutiveHighScores: 0 };
  }

  return { ...state, consecutiveHighScores: 0, consecutiveLowScores: 0 };
}

/**
 * Adjusts difficulty from one completed session. Streak counters are the
 * caller's responsibility to persist across rounds within a sitting — only
 * `currentLevel` is meant to survive to the next day (see the patient's
 * `currentDifficulty` field).
 *
 * `sessionEvents` is optional and additive: existing call sites that don't
 * pass it keep the exact original streak-counter behavior, unchanged. When a
 * caller does pass its session's round telemetry, and the ML model (see
 * lib/games/difficulty-ml.ts — bootstrapped from this same rule engine, read
 * that file before trusting its output beyond what it actually is) is
 * confident about a class, that single-session decision is applied
 * immediately — no streak requirement — because the model's whole purpose is
 * weighing signals (fatigue, reaction time, error streak, domain accuracy)
 * the streak counter never sees. Below the confidence threshold, or with no
 * session data, this defers to `adjustDifficultyByRule` unchanged.
 */
export function adjustDifficulty(
  state: DifficultyState,
  gameType: GameType,
  sessionAccuracy: number,
  sessionEvents?: LocalTelemetryEvent[],
): DifficultyState {
  const maxLevel = MAX_LEVEL[gameType];

  if (sessionEvents && sessionEvents.length > 0) {
    const features = computeFeatures(sessionEvents);
    if (features) {
      const { predictedClass, confidence } = predictDifficultyClass(features);
      if (confidence >= CONFIDENCE_THRESHOLD) {
        if (predictedClass === 'increase') {
          return {
            currentLevel: Math.min(maxLevel, state.currentLevel + 1),
            consecutiveHighScores: 0,
            consecutiveLowScores: 0,
          };
        }
        if (predictedClass === 'decrease') {
          return {
            currentLevel: Math.max(MIN_LEVEL, state.currentLevel - 1),
            consecutiveHighScores: 0,
            consecutiveLowScores: 0,
          };
        }
        return { ...state, consecutiveHighScores: 0, consecutiveLowScores: 0 };
      }
    }
  }

  return adjustDifficultyByRule(state, gameType, sessionAccuracy);
}

/**
 * Lower education correlates with unfamiliarity with test-taking itself
 * (not lower cognition), so scoring gives a small accuracy bonus — standard
 * practice in cognitive assessments like the MoCA.
 */
export function getEducationBonus(educationYears: number): number {
  if (educationYears <= 6) return 2;
  if (educationYears <= 12) return 1;
  return 0;
}

export function applyEducationBonus(rawAccuracy: number, bonus: number): number {
  return Math.min(100, rawAccuracy + bonus);
}

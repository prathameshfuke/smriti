import type { GameType } from '@/lib/supabase/types';

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
};

/**
 * Adjusts difficulty from one completed session's accuracy. Streak counters
 * are the caller's responsibility to persist across rounds within a sitting
 * — only `currentLevel` is meant to survive to the next day (see the
 * patient's `currentDifficulty` field).
 */
export function adjustDifficulty(
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

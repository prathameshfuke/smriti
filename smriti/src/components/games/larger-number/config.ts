import { slower } from '@/lib/games/pacing';

export type DifficultySettings = {
  minNumber: number;
  maxNumber: number;
  minDifference: number;
  attempts: number;
  accuracy: number;
};

export const GAME_CONFIG = {
  gameTime: slower(30_000), // 30 seconds, slowed 20% (pacing.SLOWDOWN) per clinical feedback
  initialDifficulty: {
    minNumber: 10,
    maxNumber: 99, // 限制最大数字为两位数
    minDifference: 2,
    attempts: 25, // 从较小的次数开始
    accuracy: 90  // 初始准确率
  },
  difficultyAdjustment: {
    attemptsIncrement: 3, // 每次成功后增加的尝试次数
    minDifferenceDecrement: 1 // 每次成功后减少的最小差值
  },
  // 计算准确率的函数 - 允许错两个
  calculateRequiredAccuracy: (attempts: number): number => {
    // 允许错两个的准确率计算公式
    return Math.round(((attempts - 2) / attempts) * 100);
  }
} as const;

/**
 * The difficulty settings a patient at app level `level` should start on:
 * the initial settings with the per-success adjustment applied `level - 1`
 * times — exactly what the in-game ladder reaches after that many wins.
 */
export function difficultyForLevel(level: number): DifficultySettings {
  const steps = Math.max(0, Math.round(level) - 1);
  const { attemptsIncrement, minDifferenceDecrement } = GAME_CONFIG.difficultyAdjustment;
  const base = GAME_CONFIG.initialDifficulty;
  const attempts = base.attempts + attemptsIncrement * steps;
  return {
    ...base,
    minDifference: Math.max(1, base.minDifference - minDifferenceDecrement * steps),
    attempts,
    accuracy: steps === 0 ? base.accuracy : GAME_CONFIG.calculateRequiredAccuracy(attempts),
  };
} 
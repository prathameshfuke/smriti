import weightsJson from './difficulty-model-weights.json';
import type { LocalTelemetryEvent } from '@/lib/db/schema';

/**
 * ML-based difficulty adaptation — what this is and isn't.
 *
 * MODEL: a 3-class (decrease / maintain / increase) multinomial logistic
 * regression — a ~20-parameter weight matrix plus a softmax, evaluated here
 * with plain JS arithmetic. No ML runtime dependency (no tfjs/onnxruntime),
 * no network call, sub-millisecond inference.
 *
 * TRAINING: fit offline (scripts/train-difficulty-model.py, not shipped)
 * against ~10,000 synthetic sessions. The label for each synthetic session
 * is whatever the app's own pre-existing rule-based streak counter
 * (src/lib/engine/difficulty.ts) would have decided — there is no other
 * ground truth available yet. This is a legitimate bootstrap (a
 * first-generation model learning to approximate a known-good rule engine)
 * but it is NOT a clinically-validated signal, and it will not systematically
 * outperform the rule engine except where its 5 input features — rolling
 * accuracy, reaction-time z-score, error streak, domain accuracy, and
 * session fatigue — catch something session accuracy alone misses (e.g. a
 * patient who is accurate but visibly fatiguing, or accurate overall with a
 * late error streak). Do not describe this as clinically validated in any
 * documentation or pitch material; "bootstrapped from the existing adaptive
 * rule engine" is the accurate framing.
 *
 * FALLBACK: when the model's confidence is below CONFIDENCE_THRESHOLD, or
 * when the caller has no session event data to feed it, difficulty.ts falls
 * back to the original, untouched rule-based streak logic. That code path is
 * not deprecated — it is the safety net this model runs in front of.
 */

interface DifficultyModelWeights {
  classes: [DifficultyClass, DifficultyClass, DifficultyClass];
  featureNames: string[];
  coefficients: number[][];
  intercepts: number[];
}

export type DifficultyClass = 'decrease' | 'maintain' | 'increase';

export interface DifficultyFeatures {
  rollingAccuracy: number;
  reactionTimeZScore: number;
  errorStreak: number;
  domainAccuracy: number;
  sessionFatigue: number;
}

export interface DifficultyPrediction {
  predictedClass: DifficultyClass;
  confidence: number;
}

const WEIGHTS = weightsJson as unknown as DifficultyModelWeights;

/** Below this, the model isn't clearly picking one class — defer to the rule engine instead of guessing. */
export const CONFIDENCE_THRESHOLD = 0.4;

/**
 * Derives the 5 model features from one session's round-by-round telemetry.
 * `reactionTimeZScore` is computed against this session's OWN response-time
 * distribution (mean/stddev of its own rounds), not a persisted cross-session
 * personal baseline — that would need new storage this change doesn't add.
 * Documented substitution, not an oversight.
 */
export function computeFeatures(sessionEvents: LocalTelemetryEvent[]): DifficultyFeatures | null {
  if (sessionEvents.length === 0) return null;

  const correct = sessionEvents.map((e) => e.isCorrect);
  const responseTimes = sessionEvents
    .map((e) => e.responseTimeMs)
    .filter((rt): rt is number => rt != null);

  const last5 = correct.slice(-5);
  const rollingAccuracy = last5.filter(Boolean).length / last5.length;

  let reactionTimeZScore = 0;
  if (responseTimes.length > 0) {
    const mean = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const variance = responseTimes.reduce((a, b) => a + (b - mean) ** 2, 0) / responseTimes.length;
    const std = Math.sqrt(variance);
    reactionTimeZScore = std < 1e-6 ? 0 : (responseTimes[responseTimes.length - 1] - mean) / std;
  }

  let errorStreak = 0;
  for (let i = correct.length - 1; i >= 0; i -= 1) {
    if (correct[i]) break;
    errorStreak += 1;
  }

  const domainAccuracy = correct.filter(Boolean).length / correct.length;
  const sessionFatigue = Math.min(correct.length, 20) / 20;

  return {
    rollingAccuracy,
    reactionTimeZScore,
    errorStreak,
    domainAccuracy,
    sessionFatigue,
  };
}

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Pure matrix-math inference — no I/O, no allocation beyond a few small arrays, runs in well under 1ms. */
export function predictDifficultyClass(features: DifficultyFeatures): DifficultyPrediction {
  const x = [
    features.rollingAccuracy,
    features.reactionTimeZScore,
    features.errorStreak,
    features.domainAccuracy,
    features.sessionFatigue,
  ];

  const scores = WEIGHTS.coefficients.map(
    (row, i) => row.reduce((sum, w, j) => sum + w * x[j], 0) + WEIGHTS.intercepts[i],
  );
  const probs = softmax(scores);

  let bestIndex = 0;
  for (let i = 1; i < probs.length; i += 1) {
    if (probs[i] > probs[bestIndex]) bestIndex = i;
  }

  return {
    predictedClass: WEIGHTS.classes[bestIndex],
    confidence: probs[bestIndex],
  };
}

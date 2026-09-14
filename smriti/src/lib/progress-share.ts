/**
 * Inert stub for the reference project's shareable-progress-card feature.
 * This app doesn't persist a separate "progress history" for social
 * sharing (patient telemetry already lives in Dexie via
 * `src/lib/engine/telemetry.ts`), and sharing/comparison is explicitly out
 * of scope per the accessibility spec — kept at the same import
 * path/signatures so copied game components don't need editing.
 *
 * Not to be confused with the family-sharing feature (see
 * `src/lib/family/familyShareServer.ts`) — that is read-only digest access
 * plus one-directional encouragement notes for a caregiver-invited family
 * member, not a patient-facing progress card or comparison feature. This
 * stub stays inert; family-sharing is a separate, real module.
 */

export interface ProgressSnapshot {
  recordedAt: string;
  primaryValue: number;
}

export interface ProgressCardData {
  title: string;
  subtitle?: string;
  primaryLabel: string;
  primaryValue: string;
  trendText?: string;
  historyLabel?: string;
  [key: string]: unknown;
}

export function recordProgressSnapshot(_key: string, value: number): ProgressSnapshot[] {
  return [{ recordedAt: new Date().toISOString(), primaryValue: value }];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the documented reference-project call shape
export function getProgressInsights(history: ProgressSnapshot[], _direction: 'higher' | 'lower'): {
  sessions: number;
  previous: ProgressSnapshot | null;
  deltaFromPrevious: number | null;
  isImprovement: boolean;
} {
  return {
    sessions: history.length,
    previous: null,
    deltaFromPrevious: null,
    isImprovement: false,
  };
}

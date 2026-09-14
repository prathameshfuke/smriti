/**
 * Inert stub for the reference project's product-analytics client. This
 * offline-first app doesn't send behavioral telemetry to a third-party
 * analytics service — patient progress is tracked via
 * `src/lib/engine/telemetry.ts` instead. Kept at the same import
 * path/call-shape so copied game components don't need editing.
 */
type AnalyticsPayload = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- matches the reference client's call shape
function noop(_payload: AnalyticsPayload): void {
  return;
}

export const analytics = {
  game: {
    start: noop,
    complete: noop,
    fail: noop,
    settings: noop,
    social: noop,
    engagement: noop,
  },
  tutorial: {
    buttonClick: noop,
    start: noop,
    step: noop,
    complete: noop,
    exit: noop,
  },
  navigation: {
    recommendation: noop,
  },
  social: {
    share: noop,
  },
  engagement: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- matches the reference client's call shape
    pageTime: (_page: string, _ms: number): void => undefined,
  },
};

/**
 * Inert stub, aliased in place of the real `canvas-confetti` package (see
 * `next.config.js`). This app's accessibility spec explicitly lists confetti
 * among the effects to avoid on patient screens — the reference games' calls
 * are left in place (not edited) but resolve to this no-op instead.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- matches the real canvas-confetti package signature
export default function confetti(_options?: Record<string, unknown>): Promise<null> {
  return Promise.resolve(null);
}

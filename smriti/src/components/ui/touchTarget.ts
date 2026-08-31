/**
 * Minimum touch target for patient-facing controls, in pixels.
 *
 * Applied as an inline style rather than a utility class: this is a clinical
 * accessibility requirement for users with tremor and low vision, and it must
 * not depend on a stylesheet loading or a class surviving purge.
 */
export const TOUCH_TARGET_MIN_PX = 64;

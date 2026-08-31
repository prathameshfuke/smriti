/**
 * Touch target sizes for SMRITI, in pixels.
 *
 * Applied as inline styles rather than utility classes: these are clinical
 * accessibility requirements for users with tremor and low vision, and they
 * must not depend on a stylesheet loading or a class surviving purge.
 */

/** Floor for any patient-facing control. */
export const TOUCH_TARGET_MIN_PX = 64;

/** Primary patient actions and game tiles — the targets a tremoring hand aims at. */
export const BIG_TARGET_MIN_PX = 72;

/** Language buttons: chosen once, by a caregiver, on a denser setup screen. */
export const LANGUAGE_TARGET_MIN_PX = 56;

/** Height of the patient top bar. */
export const NAV_BAR_PX = 64;

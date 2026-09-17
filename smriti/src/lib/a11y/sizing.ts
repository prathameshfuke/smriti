/**
 * Text and icon size preferences — the one place the scale factors live.
 *
 * Both are device-wide display settings (like "People on this phone"), chosen
 * by a caregiver in Settings and applied as `data-text-size` /
 * `data-icon-size` attributes on <html>. globals.css turns those into:
 *
 *  - Text: the root font-size. Every text size, padding and gap in the app is
 *    rem-based, so boxes grow with their text instead of the text spilling out
 *    of a fixed box — that is what keeps a larger size from overlapping.
 *  - Icons: `--icon-scale`, applied with CSS `zoom` (not `transform: scale`),
 *    because zoom enlarges the icon's layout box too; a scaled transform only
 *    paints bigger and would draw over the label beside it.
 *
 * "sm" is today's look, so existing devices see no change until someone opts in.
 */

export const DISPLAY_SIZES = ['sm', 'md', 'lg'] as const;
export type DisplaySize = (typeof DISPLAY_SIZES)[number];

export const DEFAULT_DISPLAY_SIZE: DisplaySize = 'sm';

/** Multiplier on the browser's default root font-size (usually 16px). */
export const TEXT_SCALE: Record<DisplaySize, number> = { sm: 1, md: 1.125, lg: 1.25 };

/** Multiplier on every icon's own size. */
export const ICON_SCALE: Record<DisplaySize, number> = { sm: 1, md: 1.25, lg: 1.5 };

export const DISPLAY_SIZE_LABELS: Record<DisplaySize, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
};

export function isDisplaySize(value: unknown): value is DisplaySize {
  return typeof value === 'string' && (DISPLAY_SIZES as readonly string[]).includes(value);
}

export const TEXT_SIZE_ATTR = 'data-text-size';
export const ICON_SIZE_ATTR = 'data-icon-size';

/** Writes both preferences onto <html>. Unknown values fall back to the default. */
export function applyDisplaySizes(
  root: HTMLElement,
  textSize: unknown,
  iconSize: unknown,
): void {
  root.setAttribute(TEXT_SIZE_ATTR, isDisplaySize(textSize) ? textSize : DEFAULT_DISPLAY_SIZE);
  root.setAttribute(ICON_SIZE_ATTR, isDisplaySize(iconSize) ? iconSize : DEFAULT_DISPLAY_SIZE);
}

/**
 * Inline <head> script: applies the saved sizes before first paint, so a
 * Large-text device never flashes at Small and then jumps once React
 * hydrates. Reads the same `smriti.settings` key zustand persists to. Any
 * failure (private mode, corrupt JSON) leaves the defaults in place.
 */
export const DISPLAY_SIZE_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('smriti.settings')||'{}').state||{};var ok=['sm','md','lg'];var r=document.documentElement;r.setAttribute('${TEXT_SIZE_ATTR}',ok.indexOf(s.textSize)>-1?s.textSize:'sm');r.setAttribute('${ICON_SIZE_ATTR}',ok.indexOf(s.iconSize)>-1?s.iconSize:'sm');}catch(e){}})();`;

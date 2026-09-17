/**
 * Zoom lock — a device-wide, opt-in switch that removes pinch-zoom on top of
 * the always-on double-tap-zoom block in globals.css.
 *
 * Default is OFF: pinch-zoom stays reachable for low-vision patients, same
 * reasoning as the viewport export in layout.tsx (WCAG 1.4.4). A caregiver
 * who knows a specific patient never needs it can turn it on in Settings —
 * this is a per-device preference like text/icon size (see sizing.ts), not a
 * blanket app restriction.
 */

export const ZOOM_LOCK_ATTR = 'data-zoom-locked';

/** Writes the preference onto <html>. Anything but a real `true` is treated
 * as off, so a corrupt/unexpected stored value never silently locks zoom
 * out from under a low-vision patient. */
export function applyZoomLock(root: HTMLElement, zoomLocked: unknown): void {
  root.setAttribute(ZOOM_LOCK_ATTR, zoomLocked === true ? 'true' : 'false');
}

/**
 * Inline <head> script: applies the saved preference before first paint,
 * same pattern and same `smriti.settings` key as DISPLAY_SIZE_BOOT_SCRIPT,
 * so a locked device never flashes zoomable and then locks after hydration.
 * Any failure (private mode, corrupt JSON) leaves zoom unlocked.
 */
export const ZOOM_LOCK_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('smriti.settings')||'{}').state||{};document.documentElement.setAttribute('${ZOOM_LOCK_ATTR}',s.zoomLocked===true?'true':'false');}catch(e){}})();`;

/**
 * Zoom lock — a device-wide switch that removes pinch-zoom on top of the
 * always-on double-tap-zoom block in globals.css.
 *
 * Default is ON: a shaky tap or a mis-read pinch while dragging zooms the
 * patient's screen and they cannot get back out. A caregiver whose patient
 * needs to magnify the screen (low vision, WCAG 1.4.4) turns it off in
 * Settings — this is a per-device preference like text/icon size (see
 * sizing.ts). Devices that already saved a choice keep it.
 */

export const ZOOM_LOCK_ATTR = 'data-zoom-locked';

/** What a device with no saved choice gets. */
export const DEFAULT_ZOOM_LOCKED = true;

/** Writes the preference onto <html>. Only a real boolean is honoured; a
 * missing or corrupt stored value falls back to the default. */
export function applyZoomLock(root: HTMLElement, zoomLocked: unknown): void {
  const locked = typeof zoomLocked === 'boolean' ? zoomLocked : DEFAULT_ZOOM_LOCKED;
  root.setAttribute(ZOOM_LOCK_ATTR, locked ? 'true' : 'false');
}

/**
 * Inline <head> script: applies the saved preference before first paint,
 * same pattern and same `smriti.settings` key as DISPLAY_SIZE_BOOT_SCRIPT,
 * so a locked device never flashes zoomable and then locks after hydration.
 * No saved choice, or a non-boolean one, gets the default; a failure
 * (private mode, corrupt JSON) leaves the attribute the root layout rendered,
 * which is also the default.
 */
export const ZOOM_LOCK_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('smriti.settings')||'{}').state||{};var z=typeof s.zoomLocked==='boolean'?s.zoomLocked:${DEFAULT_ZOOM_LOCKED};document.documentElement.setAttribute('${ZOOM_LOCK_ATTR}',z?'true':'false');}catch(e){}})();`;

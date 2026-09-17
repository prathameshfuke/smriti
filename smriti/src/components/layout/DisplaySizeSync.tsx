'use client';

import { useEffect } from 'react';
import { applyDisplaySizes } from '@/lib/a11y/sizing';
import { applyZoomLock } from '@/lib/a11y/zoomLock';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Keeps <html data-text-size / data-icon-size / data-zoom-locked> in step
 * with settingsStore after hydration, so a change in Settings takes effect
 * on every screen at once. The first paint is handled by
 * DISPLAY_SIZE_BOOT_SCRIPT / ZOOM_LOCK_BOOT_SCRIPT in the root layout; this
 * only covers later changes. Renders nothing.
 */
export default function DisplaySizeSync() {
  const textSize = useSettingsStore((s) => s.textSize);
  const iconSize = useSettingsStore((s) => s.iconSize);
  const zoomLocked = useSettingsStore((s) => s.zoomLocked);
  useEffect(() => {
    applyDisplaySizes(document.documentElement, textSize, iconSize);
  }, [textSize, iconSize]);
  useEffect(() => {
    applyZoomLock(document.documentElement, zoomLocked);
  }, [zoomLocked]);
  return null;
}

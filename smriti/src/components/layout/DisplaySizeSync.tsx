'use client';

import { useEffect } from 'react';
import { applyDisplaySizes } from '@/lib/a11y/sizing';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Keeps <html data-text-size / data-icon-size> in step with settingsStore
 * after hydration, so a change in Settings takes effect on every screen at
 * once. The first paint is handled by DISPLAY_SIZE_BOOT_SCRIPT in the root
 * layout; this only covers later changes. Renders nothing.
 */
export default function DisplaySizeSync() {
  const textSize = useSettingsStore((s) => s.textSize);
  const iconSize = useSettingsStore((s) => s.iconSize);
  useEffect(() => {
    applyDisplaySizes(document.documentElement, textSize, iconSize);
  }, [textSize, iconSize]);
  return null;
}

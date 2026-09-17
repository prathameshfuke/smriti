'use client';

import { useId } from 'react';
import { Bell, Gamepad2, Type } from 'lucide-react';
import Icon from '@/components/Icon';
import { LANGUAGE_TARGET_MIN_PX } from '@/components/ui/touchTarget';
import { DISPLAY_SIZES, DISPLAY_SIZE_LABELS, type DisplaySize } from '@/lib/a11y/sizing';
import { useSettingsStore } from '@/stores/settingsStore';

interface SizeChoiceProps {
  legend: string;
  value: DisplaySize;
  onChange: (size: DisplaySize) => void;
}

/**
 * Three native radios drawn as one segmented row. Native inputs, not buttons,
 * so arrow keys move between sizes and screen readers announce "1 of 3".
 * The segments wrap onto their own lines rather than squeeze if Large text
 * no longer fits three across on a narrow phone.
 */
function SizeChoice({ legend, value, onChange }: SizeChoiceProps) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-caregiver-body font-bold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {DISPLAY_SIZES.map((size) => {
          const checked = size === value;
          return (
            <label
              key={size}
              style={{ minHeight: LANGUAGE_TARGET_MIN_PX }}
              className={
                'flex min-w-[6rem] flex-1 cursor-pointer items-center justify-center rounded-control px-4 py-2 text-center ' +
                'text-caregiver-body font-bold transition-colors ' +
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 ' +
                'has-[:focus-visible]:outline-primary-dark ' +
                (checked
                  ? 'bg-primary text-ink-inverse'
                  : 'border-2 border-ink-muted/60 bg-surface-card text-ink hover:bg-surface-muted')
              }
            >
              <input
                type="radio"
                name={name}
                value={size}
                checked={checked}
                onChange={() => onChange(size)}
                className="sr-only"
              />
              {DISPLAY_SIZE_LABELS[size]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Text and icon size for everything on this phone — patient and caregiver
 * screens alike. Lives in caregiver Settings only: like language, a patient
 * who shrinks the text by accident may not be able to find the way back.
 */
export default function DisplaySizeSettings() {
  const textSize = useSettingsStore((s) => s.textSize);
  const iconSize = useSettingsStore((s) => s.iconSize);
  const setTextSize = useSettingsStore((s) => s.setTextSize);
  const setIconSize = useSettingsStore((s) => s.setIconSize);

  return (
    <div className="flex flex-col gap-5">
      <SizeChoice legend="Text size" value={textSize} onChange={setTextSize} />
      <SizeChoice legend="Icon size" value={iconSize} onChange={setIconSize} />

      <div
        aria-label="Preview"
        role="group"
        className="flex flex-col gap-3 rounded-control border border-line200 bg-surface p-4"
      >
        <p className="text-patient-sm font-bold uppercase tracking-wide text-ink-muted">Preview</p>
        <div className="flex min-w-0 items-center gap-3">
          <Icon icon={Gamepad2} size={28} className="shrink-0 text-primary" />
          <span className="min-w-0 break-words text-patient-body font-bold text-ink">Memory Match</span>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <Icon icon={Bell} size={28} className="shrink-0 text-primary" />
          <span className="min-w-0 break-words text-patient-body text-ink">Take morning tablet at 8:00</span>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <Icon icon={Type} size={20} className="shrink-0 text-ink-muted" />
          <span className="min-w-0 break-words text-caregiver-body text-ink-muted">
            Changes apply to every screen on this phone.
          </span>
        </div>
      </div>
    </div>
  );
}

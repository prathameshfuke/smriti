'use client';

import { useEffect, useState } from 'react';
import { BIG_TARGET_MIN_PX } from '@/components/ui/touchTarget';
import { useTranslation } from '@/lib/i18n/provider';
import { narrate } from '@/lib/audio/narrate';
import { speak } from '@/lib/audio/speech';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { getTodayMood, logMood, todayLocalDate, type MoodValue } from '@/lib/engine/mood';

const OPTIONS: Array<{ value: MoodValue; image: string; labelKey: string }> = [
  { value: 'good', image: '/images/moods/good.png', labelKey: 'mood.good' },
  { value: 'okay', image: '/images/moods/okay.png', labelKey: 'mood.okay' },
  { value: 'low', image: '/images/moods/sad.png', labelKey: 'mood.low' },
];

/**
 * Optional once-a-day mood log on the patient home screen. Renders nothing
 * once today's answer is in — this is a log, not a nag — and never blocks
 * the rest of the screen while it loads.
 */
export default function MoodCheckIn({ patientId }: { patientId: string }) {
  const { t, language } = useTranslation();
  const { isOnline } = useOfflineStatus();
  const [today, setToday] = useState<MoodValue | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let lastDate = todayLocalDate();
    const refresh = () => {
      setToday(undefined);
      void getTodayMood(patientId).then((row) => {
        if (!cancelled) setToday(row?.value ?? null);
      });
    };
    refresh();
    // A tablet left open past local midnight otherwise keeps showing
    // yesterday's "Thank you for sharing!" indefinitely — same 60s
    // date-rollover check the home screen's own date line already uses.
    const interval = setInterval(() => {
      const date = todayLocalDate();
      if (date === lastDate) return;
      lastDate = date;
      refresh();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [patientId]);

  useEffect(() => {
    if (today === null) void narrate(t('mood.title'), language, isOnline);
    // Fire once, when the prompt first appears for the day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today === null]);

  if (today === undefined) return null;

  const answer = async (value: MoodValue) => {
    await logMood(patientId, value);
    setToday(value);
    // One neutral acknowledgment for every answer, "low" included: this is a
    // mood log, not a screening tool, and the caregiver alert only ever
    // fires after 3 consecutive low days (checkLowMoodAlert) — never after
    // one entry, so the acknowledgment must never imply otherwise.
    speak(t('mood.thanksPositive'), language);
  };

  return (
    <section aria-labelledby="mood-checkin-title" className="mt-8 rounded-card border border-line200 bg-surface-card p-5">
      <h2 id="mood-checkin-title" className="font-serif-display text-patient-heading font-medium text-ink">
        {t('mood.title')}
      </h2>
      {today ? (
        <p className="mt-3 text-patient-body font-bold text-ink">{t('mood.thanksPositive')}</p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-touch-gap">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => void answer(option.value)}
              aria-label={t(option.labelKey)}
              style={{ minHeight: BIG_TARGET_MIN_PX }}
              className="flex flex-col items-center gap-2 rounded-control px-2 py-3 transition-[transform,background-color] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 hover:bg-surface-muted focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-dark"
            >
              {/* Pre-cached illustration; carries the meaning for non-readers. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={option.image} alt="" role="presentation" className="h-16 w-16 object-contain" />
              <span className="text-center text-patient-sm font-bold text-ink">{t(option.labelKey)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

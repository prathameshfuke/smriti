'use client';

import { useCallback, useEffect, useState } from 'react';
import BigButton from './BigButton';
import { textActionClass } from './Panel';
import { useTranslation } from '@/lib/i18n/provider';
import { getDevicePatients } from '@/lib/auth/localSession';
import { getDeviceTrustToken } from '@/lib/auth/deviceTrust';
import { usePatientStore } from '@/stores/patientStore';
import {
  enableReminderNotifications,
  getNotifySupport,
  notificationPermission,
  type EnableResult,
} from '@/lib/push/client';
import { NOTIFICATION_STRING_KEYS } from '@/lib/push/reminderText';
import type { DeviceTrustToken } from '@/lib/db/schema';

const DISMISSED_KEY = 'smriti-notify-optin-dismissed';

type View = 'hidden' | 'ask' | 'install' | 'blocked' | 'on-full' | 'on-limited';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Private mode: it simply asks again next visit.
  }
}

/**
 * A plain-language opt-in for reminder notifications, shown once on the
 * patient home screen. Never asks by itself: the browser's own permission
 * prompt only appears after the person (or their caregiver) taps the button,
 * which is also the only way iPhones allow it. "Not now" is remembered.
 */
export default function NotificationOptIn() {
  const { t, language } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const [view, setView] = useState<View>('hidden');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const support = getNotifySupport();
    if (support === 'unsupported' || readDismissed()) return;
    const permission = notificationPermission();
    if (permission === 'granted') return;
    // Set from an effect: reads browser-only state that the server render cannot know.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(permission === 'denied' ? 'blocked' : support === 'needs-install' ? 'install' : 'ask');
  }, []);

  const dismiss = useCallback(() => {
    writeDismissed();
    setView('hidden');
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const patients = await getDevicePatients().catch(() => []);
      const patientIds = patients.length > 0 ? patients.map((p) => p.id) : currentPatient ? [currentPatient.id] : [];
      const tokens = (await Promise.all(patientIds.map((id) => getDeviceTrustToken(id)))).filter(
        (tk): tk is DeviceTrustToken => tk !== null,
      );
      const result: EnableResult = await enableReminderNotifications({
        title: 'SMRITI',
        strings: Object.fromEntries(NOTIFICATION_STRING_KEYS.map((k) => [k, t(`reminder.${k}`)])),
        language,
        patientIds,
        deviceTrustTokens: tokens,
      });
      if (result.permission === 'granted') {
        setView(result.push === 'subscribed' || result.periodicSync ? 'on-full' : 'on-limited');
      } else if (result.permission === 'denied') {
        setView('blocked');
      } else {
        setView('hidden');
      }
    } finally {
      setBusy(false);
    }
  }, [currentPatient, language, t]);

  if (view === 'hidden') return null;

  const message = {
    ask: t('push.body'),
    install: t('push.installFirst'),
    blocked: t('push.blocked'),
    'on-full': t('push.enabledFull'),
    'on-limited': t('push.enabledLimited'),
  }[view];

  return (
    <section
      aria-labelledby="notify-optin-title"
      data-testid="notification-optin"
      className="mt-4 rounded-card border-2 border-ink-muted/40 bg-surface-card p-5"
    >
      <h2 id="notify-optin-title" className="font-serif-display text-patient-heading font-medium leading-[1.1] text-ink">
        {t('push.title')}
      </h2>
      <p role="status" className="mt-3 text-patient-body text-ink">
        {message}
      </p>
      <div className="mt-5 flex flex-col gap-3">
        {view === 'ask' ? (
          <>
            <BigButton label={t('push.enable')} variant="primary" onClick={() => void enable()} disabled={busy} />
            <button type="button" onClick={dismiss} className={textActionClass}>
              {t('push.notNow')}
            </button>
          </>
        ) : (
          <button type="button" onClick={dismiss} className={textActionClass}>
            {t('push.close')}
          </button>
        )}
      </div>
    </section>
  );
}

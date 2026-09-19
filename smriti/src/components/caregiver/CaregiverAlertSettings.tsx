'use client';

import { useCallback, useEffect, useState } from 'react';
import { buttonClass } from '@/components/ui/Panel';
import { useTranslation } from '@/lib/i18n/provider';
import {
  disableCaregiverAlerts,
  enableCaregiverAlerts,
  getAlertsState,
  type AlertsChange,
  type AlertsState,
} from '@/lib/push/caregiverAlerts';

/**
 * Settings card for alerts on the caregiver's own phone (Web Push). Never
 * asks for permission by itself: the browser prompt only appears after the
 * "Turn on alerts" tap, which is also what iPhones require.
 */
export default function CaregiverAlertSettings() {
  const { t, language } = useTranslation();
  const [state, setState] = useState<AlertsState | 'loading'>('loading');
  const [notice, setNotice] = useState<AlertsChange | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAlertsState().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const change = useCallback(
    async (turnOn: boolean) => {
      setBusy(true);
      setNotice(null);
      try {
        const result = turnOn ? await enableCaregiverAlerts(language) : await disableCaregiverAlerts();
        if (result !== 'ok') setNotice(result);
        setState(await getAlertsState());
      } finally {
        setBusy(false);
      }
    },
    [language],
  );

  const message =
    notice === 'not_configured'
      ? t('alertOptIn.notConfigured')
      : notice === 'in_use'
        ? t('alertOptIn.inUse')
        : notice === 'failed'
          ? t('alertOptIn.failed')
          : {
              loading: '',
              unsupported: t('alertOptIn.unsupported'),
              'needs-install': t('alertOptIn.installFirst'),
              blocked: t('alertOptIn.blocked'),
              off: t('alertOptIn.body'),
              on: t('alertOptIn.on'),
            }[state];

  return (
    <div data-testid="caregiver-alert-settings" className="flex flex-col gap-4">
      <p role="status" className="text-caregiver-body text-ink">
        {message}
      </p>
      {state === 'off' ? (
        <button type="button" disabled={busy} onClick={() => void change(true)} className={buttonClass.primary}>
          {t('alertOptIn.enable')}
        </button>
      ) : null}
      {state === 'on' ? (
        <button type="button" disabled={busy} onClick={() => void change(false)} className={buttonClass.secondary}>
          {t('alertOptIn.disable')}
        </button>
      ) : null}
    </div>
  );
}

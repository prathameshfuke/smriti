/**
 * Delivers a newly raised alert to the owning caregiver as a Web Push.
 *
 * Call `scheduleAlertPush` only after the `alerts` row was inserted, on the
 * path that actually created it. The dedupe / resolve paths in the sync route
 * never reach it, so retries and re-syncs cannot notify twice, and resolving
 * an alert never notifies.
 *
 * The notification text is deliberately generic: lock screens are visible to
 * others, so it carries the patient's display name, a severity word and a
 * one-line reason, never scores, percentages or anything medication related.
 *
 * Wording comes from the `alertPush` block of the i18n locale files (server
 * side, no client code involved). A language with no such block (brx, mni)
 * falls back to English.
 */

import { after } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/client';
import { isPushConfigured, sendPushToCaregiver, type PushPayload } from './send';
import as from '@/lib/i18n/locales/as.json';
import bn from '@/lib/i18n/locales/bn.json';
import en from '@/lib/i18n/locales/en.json';
import hi from '@/lib/i18n/locales/hi.json';
import ne from '@/lib/i18n/locales/ne.json';

export type AlertKind = 'cognitive_drop' | 'missed_sessions' | 'low_adherence' | 'low_mood' | 'mood_today';
export type AlertSeverity = 'red' | 'yellow';

export interface NewAlert {
  alertId: string;
  caregiverId: string;
  patientId: string;
  type: AlertKind;
  severity: AlertSeverity;
}

type AlertStrings = typeof en.alertPush;
const CATALOGS: Record<string, AlertStrings | undefined> = { en: en.alertPush, as: as.alertPush, bn: bn.alertPush, hi: hi.alertPush, ne: ne.alertPush };

export function buildAlertPayload(alert: NewAlert, patientName: string, language: string | null | undefined): PushPayload {
  const s = (language ? CATALOGS[language] : undefined) ?? en.alertPush;
  // mood_today is always inserted already-resolved (see raiseAlert's `resolved`
  // doc comment) — a calm, single-day log, not a pattern to act on — so its
  // push must not read as "Needs attention"/"Urgent" like every other alert.
  const severity = alert.type === 'mood_today' ? s.severityInfo : alert.severity === 'red' ? s.severityRed : s.severityYellow;
  return {
    title: s.title.replace('{name}', patientName).replace('{severity}', severity),
    body: s[alert.type],
    tag: `alert-${alert.type}-${alert.patientId}`,
    url: `/caregiver/patients/${alert.patientId}`,
  };
}

/** Looks up the display name and language, then sends. Never rejects. */
export async function notifyNewAlert(alert: NewAlert): Promise<void> {
  try {
    if (!isPushConfigured()) return;
    // Service role: push_subscriptions is not readable with the caregiver's own session.
    const db = createServiceRoleClient();
    const [{ data: patient }, { data: caregiver }] = await Promise.all([
      db.from('patients').select('display_name').eq('id', alert.patientId).single(),
      db.from('caregivers').select('preferred_language').eq('id', alert.caregiverId).single(),
    ]);
    if (!patient) return;
    const payload = buildAlertPayload(alert, (patient as { display_name: string }).display_name, (caregiver as { preferred_language?: string } | null)?.preferred_language);
    await sendPushToCaregiver(db, alert.caregiverId, payload);
  } catch (err) {
    console.error('SMRITI: alert push failed', err instanceof Error ? err.message : 'unknown');
  }
}

/**
 * Fire and forget. Uses Next's `after()` so a serverless function is kept
 * alive until the push went out without delaying the response; outside a
 * request scope (tests, scripts) it falls back to a plain detached promise.
 */
export function scheduleAlertPush(alert: NewAlert): void {
  const task = () => notifyNewAlert(alert);
  try {
    after(task);
  } catch {
    void task();
  }
}

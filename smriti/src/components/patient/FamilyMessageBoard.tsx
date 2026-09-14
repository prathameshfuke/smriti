'use client';

import { useTranslation } from '@/lib/i18n/provider';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import BigButton from '@/components/ui/BigButton';
import type { LocalFamilyMessage } from '@/lib/db/schema';
import { acknowledgeFamilyMessage, getLocalFamilyMessages, pullFamilyMessages } from '@/lib/family/familyMessagesClient';

const MAX_VISIBLE = 5;
const REFRESH_INTERVAL_MS = 60_000;

/**
 * The kiosk-home "family message board" — a self-contained section that
 * reads/writes only its own Dexie table (`familyMessages`), so it composes
 * cleanly next to the existing single-note modal flow (`familyNote` state
 * in app/page.tsx) without touching it. Offline-first: renders from Dexie
 * immediately, then refreshes from the network in the background.
 *
 * Deliberately read-only for the patient beyond the single "Seen" tap —
 * no text entry, matching the "no patient text input" constraint for a
 * dementia-patient kiosk.
 */
export default function FamilyMessageBoard({ patientId }: { patientId: string }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<LocalFamilyMessage[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Render whatever is already cached immediately (offline-first), then
    // pull the network feed in the background and re-render from Dexie
    // again once it lands — same two-step shape as page.tsx's own
    // device-trust fetches, kept as `.then()` chains (rather than an
    // awaited helper invoked at the top of the effect) so every setState
    // happens from inside a promise callback, not the effect body itself.
    getLocalFamilyMessages(patientId).then((rows) => {
      if (!cancelled) setMessages(rows.slice(0, MAX_VISIBLE));
    });

    const refresh = () => {
      pullFamilyMessages(patientId).then(() =>
        getLocalFamilyMessages(patientId).then((rows) => {
          if (!cancelled) setMessages(rows.slice(0, MAX_VISIBLE));
        }),
      );
    };
    refresh();

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [patientId]);

  const onAcknowledge = async (messageId: string) => {
    // Optimistic local update so the button disappears immediately.
    setMessages((prev) =>
      prev ? prev.map((m) => (m.id === messageId ? { ...m, seenAt: new Date().toISOString() } : m)) : prev,
    );
    await acknowledgeFamilyMessage(patientId, messageId);
  };

  if (!messages || messages.length === 0) return null;

  return (
    <section aria-labelledby="family-messages-heading" className="flex flex-col gap-3">
      <h2
        id="family-messages-heading"
        className="flex items-center gap-2.5 font-serif-display text-[1.75rem] font-medium leading-tight text-ink"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/family-message.png" alt="" className="h-8 w-8" />
        {t('family.messagesTitle')}
      </h2>

      <ul className="flex flex-col gap-3">
        {messages.map((message) => (
          <li
            key={message.id}
            data-testid="family-message"
            className="flex flex-col gap-3 rounded-card border border-line200 bg-surface-card p-5"
          >
            {message.senderName ? (
              <p className="text-patient-sm font-bold text-ink-muted">
                {t('family.from', { name: message.senderName })}
                {message.senderRelation ? ` (${message.senderRelation})` : ''}
              </p>
            ) : null}

            {message.photoUrl ? (
              <Image
                src={message.photoUrl}
                alt=""
                width={320}
                height={200}
                unoptimized
                className="h-auto w-full rounded-tile object-cover"
              />
            ) : null}

            <p className="text-patient-body text-ink">{message.text}</p>

            {message.seenAt ? (
              <p className="flex items-center gap-2 text-patient-sm text-ink-muted" role="status">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/done-acknowledged.png" alt="" className="h-5 w-5" />
                {t('family.seen')}
              </p>
            ) : (
              <BigButton label={t('family.seen')} variant="success" onClick={() => void onAcknowledge(message.id)} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

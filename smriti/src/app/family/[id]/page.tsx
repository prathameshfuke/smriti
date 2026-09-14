'use client';

import { useEffect, useState } from 'react';
import BigButton from '@/components/ui/BigButton';
import Skeleton from '@/components/ui/Skeleton';
import { fieldClass, labelClass } from '@/components/ui/Panel';
import appIcon from '@/appicon.png';

interface FamilyView {
  label: string;
  summary: string | null;
  generatedAt: string | null;
  sessionsThisWeek: number;
}

type LoadState = { kind: 'loading' } | { kind: 'ready'; view: FamilyView } | { kind: 'invalid' } | { kind: 'error' };
type SendState = 'idle' | 'sending' | 'pending' | 'approved' | 'error';

const MAX_NOTE_LENGTH = 280;

/**
 * The page a family share link opens. No login: the share id in the URL is
 * the credential, checked server-side against its signature, expiry and
 * revocation (GET /api/family-share/[id]). Shows only what that route returns
 * (weekly summary and days played) and lets the family member leave a short
 * note for the patient's home screen (POST .../notes). Before this page
 * existed, "Create link" produced a share nobody could open.
 */
export default function FamilySharePage({ params }: { params: Promise<{ id: string }> }) {
  const [shareId, setShareId] = useState<string | null>(null);
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [text, setText] = useState('');
  const [send, setSend] = useState<SendState>('idle');

  useEffect(() => {
    let cancelled = false;
    params.then(({ id }) => {
      if (!cancelled) setShareId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!shareId) return;
    let cancelled = false;
    fetch(`/api/family-share/${encodeURIComponent(shareId)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401 || res.status === 404) return setLoad({ kind: 'invalid' });
        if (!res.ok) return setLoad({ kind: 'error' });
        setLoad({ kind: 'ready', view: (await res.json()) as FamilyView });
      })
      .catch(() => {
        if (!cancelled) setLoad({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [shareId, attempt]);

  const retry = () => {
    setLoad({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  const sendNote = async () => {
    if (!shareId || !text.trim()) return;
    setSend('sending');
    try {
      const res = await fetch(`/api/family-share/${encodeURIComponent(shareId)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          senderName: name.trim() || undefined,
          senderRelation: relation.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setSend('error');
        return;
      }
      const body = (await res.json()) as { status: 'pending' | 'approved' };
      setText('');
      setSend(body.status === 'approved' ? 'approved' : 'pending');
    } catch {
      setSend('error');
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-surface px-5 py-8">
      <p className="flex items-center gap-2.5 font-serif-display text-[1.375rem] font-medium text-ink">
        {/* eslint-disable-next-line @next/next/no-img-element -- 28px static brand mark */}
        <img src={appIcon.src} alt="" width={28} height={28} className="h-7 w-7" />
        SMRITI
      </p>

      {load.kind === 'loading' ? (
        <div className="mt-10 flex flex-col gap-3" aria-busy="true">
          <Skeleton height={40} width="70%" />
          <Skeleton height={120} />
        </div>
      ) : null}

      {load.kind === 'invalid' ? (
        <section className="mt-10 flex flex-col gap-3">
          <h1 className="font-serif-display text-[2rem] font-medium leading-tight text-ink">This link no longer works</h1>
          <p className="text-caregiver-body text-ink-muted">
            It may have expired or been turned off. Ask the caregiver to send you a new link.
          </p>
        </section>
      ) : null}

      {load.kind === 'error' ? (
        <section className="mt-10 flex flex-col gap-4">
          <h1 className="font-serif-display text-[2rem] font-medium leading-tight text-ink">Could not load this page</h1>
          <p className="text-caregiver-body text-ink-muted">Check your connection, then try again.</p>
          <BigButton label="Try again" variant="primary" onClick={retry} />
        </section>
      ) : null}

      {load.kind === 'ready' ? (
        <>
          <h1 className="mt-10 font-serif-display text-[2.25rem] font-medium leading-[1.1] text-ink">This week</h1>
          <p className="mt-2 text-caregiver-body text-ink-muted">Shared with {load.view.label}. Updated by their caregiver.</p>

          <section className="mt-6 rounded-card border border-line200 bg-surface-card p-5">
            <p className="font-serif-display text-[1.75rem] font-medium leading-tight text-ink">
              Played on {load.view.sessionsThisWeek} of the last 7 days
            </p>
            {load.view.summary ? (
              <>
                <p className="mt-4 text-caregiver-body text-ink">{load.view.summary}</p>
                {load.view.generatedAt ? (
                  <p className="mt-3 text-patient-sm text-ink-muted">
                    Written {new Date(load.view.generatedAt).toLocaleDateString()}. Not medical advice.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-caregiver-body text-ink-muted">No weekly summary yet.</p>
            )}
          </section>

          <section aria-labelledby="note-heading" className="mt-8 flex flex-col gap-4 rounded-card border border-line200 bg-surface-card p-5">
            <div>
              <h2 id="note-heading" className="font-serif-display text-[1.5rem] font-medium leading-tight text-ink">
                Send a short message
              </h2>
              <p className="mt-1 text-patient-sm text-ink-muted">It appears on their home screen as a card they can read.</p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="sm:flex-1">
                <label htmlFor="family-name" className={labelClass}>
                  Your name
                </label>
                <input id="family-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" className={fieldClass} />
              </div>
              <div className="sm:flex-1">
                <label htmlFor="family-relation" className={labelClass}>
                  Relation
                </label>
                <input
                  id="family-relation"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  placeholder="e.g. Son"
                  className={fieldClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor="family-message" className={labelClass}>
                Message
              </label>
              <textarea
                id="family-message"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (send !== 'sending') setSend('idle');
                }}
                maxLength={MAX_NOTE_LENGTH}
                rows={3}
                placeholder="Thinking of you today."
                className={fieldClass}
              />
              <p className="mt-1 text-right text-patient-sm text-ink-muted">
                {text.length}/{MAX_NOTE_LENGTH}
              </p>
            </div>
            <BigButton
              label={send === 'sending' ? 'Sending…' : 'Send message'}
              variant="primary"
              disabled={send === 'sending' || !text.trim()}
              onClick={() => void sendNote()}
            />
            <div role="status" className="empty:hidden">
              {send === 'pending' ? (
                <p className="text-caregiver-body font-bold text-ink">Sent. The caregiver will check it before it appears.</p>
              ) : null}
              {send === 'approved' ? <p className="text-caregiver-body font-bold text-ink">Sent. It will appear on their home screen.</p> : null}
              {send === 'error' ? (
                <p className="text-caregiver-body font-bold text-danger">Could not send. Check your connection and try again.</p>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

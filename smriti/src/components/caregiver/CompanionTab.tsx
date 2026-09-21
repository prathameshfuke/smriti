'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Skeleton from '@/components/ui/Skeleton';
import StatusBadge from '@/components/ui/StatusBadge';
import Panel, { buttonClass, textActionClass } from '@/components/ui/Panel';
import { authedFetch } from '@/lib/api/client';

interface CompanionQuestion {
  id: string;
  question: string;
  answer: string;
  grounded: boolean;
  flaggedForFollowup: boolean;
  createdAt: string;
  /** Turns of one conversation share this; null on turns logged before MIGRATION 015. */
  sessionId?: string | null;
}

/** Newest conversation first, turns inside it oldest first, the way it was spoken. */
function groupIntoConversations(turns: CompanionQuestion[]): CompanionQuestion[][] {
  const groups: CompanionQuestion[][] = [];
  for (const turn of turns) {
    const last = groups.at(-1);
    if (last && turn.sessionId && last[0].sessionId === turn.sessionId) last.push(turn);
    else groups.push([turn]);
  }
  return groups.map((group) => [...group].reverse());
}

function conversationDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export interface CompanionTabProps {
  patientId: string;
  onError: () => void;
}

/** Questions the patient asked the AI companion, and where the Memory Bank quiz comes from. */
export default function CompanionTab({ patientId, onError }: CompanionTabProps) {
  const router = useRouter();
  const [companionQuestions, setCompanionQuestions] = useState<CompanionQuestion[] | null>(null);

  useEffect(() => {
    authedFetch<{ questions: CompanionQuestion[] }>(`/api/patients/${patientId}/companion-activity`)
      .then((body) => setCompanionQuestions(body.questions))
      .catch(onError);
  }, [patientId, onError]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
      <section aria-labelledby="questions-heading" className="flex min-w-0 flex-col gap-3">
        <h2 id="questions-heading" className="font-serif-display text-[1.375rem] font-medium text-ink">
          Their conversations with Smriti
        </h2>
        {companionQuestions === null ? <Skeleton height={120} /> : null}
        {companionQuestions && companionQuestions.length === 0 ? (
          <p className="text-caregiver-body text-ink-muted">No conversations yet.</p>
        ) : null}
        {companionQuestions && companionQuestions.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {groupIntoConversations(companionQuestions).map((conversation) => (
              <li key={conversation[0].id} className="flex flex-col gap-3 rounded-card border border-line200 bg-surface-card p-4">
                <p className="text-patient-sm font-bold text-ink-muted">{conversationDate(conversation[0].createdAt)}</p>
                {conversation.map((turn) => {
                  const isSuggestion = !turn.grounded && !turn.flaggedForFollowup;
                  return (
                    <div key={turn.id} className="flex flex-col gap-1">
                      <p className="text-caregiver-body font-bold text-ink">{turn.question}</p>
                      <p className="text-caregiver-body text-ink-muted">{turn.answer}</p>
                      {turn.flaggedForFollowup ? (
                        <p className="mt-1">
                          <StatusBadge tone="warning" label="Follow-up suggested. This message may need your attention." />
                        </p>
                      ) : isSuggestion ? (
                        <button
                          type="button"
                          onClick={() => router.push('/caregiver/memory-bank')}
                          className={`${textActionClass} self-start`}
                        >
                          Consider adding this to the Memory Bank
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Panel
        className="lg:sticky lg:top-6"
        title="Memory quiz"
        description="The Family & Life quiz is made on the patient's phone from the Memory Bank each time they play, so it is always up to date. It needs at least 3 people or memories."
      >
        <button type="button" onClick={() => router.push('/caregiver/memory-bank')} className={`${buttonClass.secondary} w-full`}>
          Memory Bank
        </button>
      </Panel>
    </div>
  );
}

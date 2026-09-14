'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Skeleton from '@/components/ui/Skeleton';
import StatusBadge from '@/components/ui/StatusBadge';
import Panel, { buttonClass, textActionClass } from '@/components/ui/Panel';
import Notice from '@/components/ui/Notice';
import { authedFetch } from '@/lib/api/client';
import { createBrowserClient } from '@/lib/supabase/client';

interface CompanionQuestion {
  id: string;
  question: string;
  answer: string;
  grounded: boolean;
  flaggedForFollowup: boolean;
  createdAt: string;
}

type QuizStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done' }
  | { kind: 'needs_facts'; have: number; needed: number }
  | { kind: 'error' };

export interface CompanionTabProps {
  patientId: string;
  onError: () => void;
}

/** Questions the patient asked the AI companion, and the Memory Bank quiz refresh. */
export default function CompanionTab({ patientId, onError }: CompanionTabProps) {
  const router = useRouter();
  const [companionQuestions, setCompanionQuestions] = useState<CompanionQuestion[] | null>(null);
  const [quizStatus, setQuizStatus] = useState<QuizStatus>({ kind: 'idle' });

  useEffect(() => {
    authedFetch<{ questions: CompanionQuestion[] }>(`/api/patients/${patientId}/companion-activity`)
      .then((body) => setCompanionQuestions(body.questions))
      .catch(onError);
  }, [patientId, onError]);

  const refreshQuiz = async () => {
    setQuizStatus({ kind: 'loading' });
    // Not authedFetch here — it discards the response body on a non-2xx,
    // and the not-enough-facts case needs that body (`needed`/`have`) to
    // show the right prompt instead of a generic failure.
    const { data } = await createBrowserClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setQuizStatus({ kind: 'error' });
      return;
    }
    try {
      const res = await fetch('/api/ai/generate-reminiscence-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientId }),
      });
      const body = await res.json();
      if (res.ok) {
        setQuizStatus({ kind: 'done' });
      } else if (body.error === 'not_enough_facts') {
        setQuizStatus({ kind: 'needs_facts', have: body.have, needed: body.needed });
      } else {
        setQuizStatus({ kind: 'error' });
      }
    } catch {
      setQuizStatus({ kind: 'error' });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
      <section aria-labelledby="questions-heading" className="flex min-w-0 flex-col gap-3">
        <h2 id="questions-heading" className="font-serif-display text-[1.375rem] font-medium text-ink">
          Questions they asked
        </h2>
        {companionQuestions === null ? <Skeleton height={120} /> : null}
        {companionQuestions && companionQuestions.length === 0 ? (
          <p className="text-caregiver-body text-ink-muted">No questions asked yet.</p>
        ) : null}
        {companionQuestions && companionQuestions.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {companionQuestions.map((q) => {
              const isSuggestion = !q.grounded && !q.flaggedForFollowup;
              return (
                <li key={q.id} className="flex flex-col gap-1 rounded-card border border-line200 bg-surface-card p-4">
                  <p className="text-caregiver-body font-bold text-ink">{q.question}</p>
                  <p className="text-caregiver-body text-ink-muted">{q.answer}</p>
                  {q.flaggedForFollowup ? (
                    <p className="mt-2">
                      <StatusBadge tone="warning" label="Follow-up suggested. This question may need your attention." />
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
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <Panel
        title="Memory quiz"
        description="The Family & Life quiz is built from the Memory Bank. Refresh it after adding people or facts."
      >
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void refreshQuiz()}
            disabled={quizStatus.kind === 'loading'}
            className={`${buttonClass.primary} w-full`}
          >
            {quizStatus.kind === 'loading' ? 'Refreshing…' : 'Refresh Quiz'}
          </button>
          <button type="button" onClick={() => router.push('/caregiver/memory-bank')} className={`${buttonClass.secondary} w-full`}>
            Memory Bank
          </button>
          <div role="status" className="empty:hidden">
            {quizStatus.kind === 'done' ? <Notice tone="success">Memory quiz updated.</Notice> : null}
            {quizStatus.kind === 'needs_facts' ? (
              <Notice tone="warning">
                Add at least {quizStatus.needed} people or life facts to the Memory Bank first ({quizStatus.have} so far) to
                generate a quiz.
              </Notice>
            ) : null}
            {quizStatus.kind === 'error' ? <Notice tone="danger">Could not refresh the quiz. Try again in a moment.</Notice> : null}
          </div>
        </div>
      </Panel>
    </div>
  );
}

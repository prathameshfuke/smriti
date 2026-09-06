'use client';

import { useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import BigButton from '@/components/ui/BigButton';
import { speak } from '@/lib/audio/speech';
import { FALLBACK_TEXT } from '@/lib/ai/llm-client';
import { cacheAnswer, findCachedAnswer } from '@/lib/ai/companion-cache';
import { getDeviceTrustToken } from '@/lib/auth/deviceTrust';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { isUILanguage } from '@/lib/i18n/languages';
import { usePatientStore } from '@/stores/patientStore';

type Phase = 'idle' | 'recording' | 'thinking' | 'answered' | 'fallback';

interface AnswerState {
  text: string;
  fromCache: boolean;
}

const MIC_SIZE_PX = 96;

/** Browser dictation, used both as the Groq-failure/offline fallback and as
 * the sole transcript source when MediaRecorder can't record at all. No
 * true live partial-transcript display (see plan Decision 8) — Groq
 * Whisper, the primary transcriber, is batch-only, and running
 * SpeechRecognition purely for on-screen captions alongside MediaRecorder
 * means two concurrent mic consumers, a real cross-browser flakiness risk. */
function acquireViaSpeechRecognition(): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const Ctor =
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
  if (!Ctor) return Promise.resolve(null);

  return new Promise((resolve) => {
    const recognition = new Ctor();
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript;
      finish(typeof text === 'string' && text.length > 0 ? text : null);
    };
    recognition.onerror = () => finish(null);
    recognition.onend = () => finish(null);
    recognition.start();
  });
}

interface SpeechRecognitionLike {
  start(): void;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export default function CompanionPage() {
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const { isOnline } = useOfflineStatus();
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const mediaRecorderSupported = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';

  const speakAnswer = (text: string) => {
    const language =
      currentPatient && isUILanguage(currentPatient.primaryLanguage) ? currentPatient.primaryLanguage : 'en';
    speak(text, language);
  };

  const showFallback = () => {
    setAnswer({ text: FALLBACK_TEXT, fromCache: false });
    setPhase('fallback');
    speakAnswer(FALLBACK_TEXT);
  };

  const handleTranscript = async (text: string) => {
    setTranscript(text);
    const patientId = currentPatient?.id;
    if (!patientId) {
      showFallback();
      return;
    }

    const cached = await findCachedAnswer(patientId, text);
    if (cached) {
      setAnswer({ text: cached.answer, fromCache: true });
      setPhase('answered');
      speakAnswer(cached.answer);
      return;
    }

    if (!isOnline) {
      showFallback();
      return;
    }

    setPhase('thinking');
    try {
      const token = await getDeviceTrustToken();
      const res = await fetch('/api/ai/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, deviceTrustToken: token }),
      });
      const body = await res.json();
      // The route still returns 200 when both LLM providers are down — it
      // hands back llm-client's own transient-failure sentinel rather than
      // a real answer. Route that to the same fallback UI, and critically,
      // never cache it: caching it would keep serving "can't check that
      // right now" for this question even after the providers recover.
      if (!res.ok || typeof body.text !== 'string' || body.text === FALLBACK_TEXT) {
        showFallback();
        return;
      }
      setAnswer({ text: body.text, fromCache: false });
      setPhase('answered');
      speakAnswer(body.text);
      await cacheAnswer({
        id: uuid(),
        patientId,
        question: text,
        answer: body.text,
        grounded: Boolean(body.grounded),
        modelUsed: 'groq',
        createdAt: new Date().toISOString(),
      });
    } catch {
      showFallback();
    }
  };

  const acquireTranscript = async (): Promise<string | null> => {
    if (isOnline) {
      try {
        const token = await getDeviceTrustToken();
        const formData = new FormData();
        formData.append('audio', new Blob(chunksRef.current, { type: 'audio/webm' }), 'clip.webm');
        formData.append('deviceTrustToken', JSON.stringify(token));
        const res = await fetch('/api/ai/transcribe', { method: 'POST', body: formData });
        if (res.ok) {
          const body = await res.json();
          if (typeof body.text === 'string' && body.text.length > 0) return body.text;
        }
      } catch {
        // Fall through to browser dictation below.
      }
    }
    return acquireViaSpeechRecognition();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new window.MediaRecorder(stream);
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        setPhase('thinking');
        void (async () => {
          const text = await acquireTranscript();
          if (text) {
            await handleTranscript(text);
          } else {
            showFallback();
          }
        })();
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      showFallback();
    }
  };

  const onMicClick = () => {
    if (phase === 'recording') {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (phase !== 'idle') return;
    // Flips synchronously, before the async getUserMedia permission prompt
    // resolves — a tap should pulse immediately, not lag behind mic access.
    setPhase('recording');
    void startRecording();
  };

  const reset = () => {
    setPhase('idle');
    setTranscript('');
    setTextInput('');
    setAnswer(null);
  };

  const onTextSubmit = () => {
    if (!textInput.trim()) return;
    void handleTranscript(textInput.trim());
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-patient flex-col items-center gap-6 bg-canvas px-4 py-10">
      <h1 className="text-center text-2xl font-bold text-navy">Ask Smriti</h1>

      {mediaRecorderSupported ? (
        <button
          type="button"
          aria-label={phase === 'recording' ? 'Stop asking' : 'Ask a question'}
          onClick={onMicClick}
          disabled={phase === 'thinking'}
          style={{ height: MIC_SIZE_PX, width: MIC_SIZE_PX }}
          className={
            'flex items-center justify-center rounded-full bg-teal text-white shadow-md ' +
            'transition-transform active:scale-95 disabled:opacity-60 ' +
            (phase === 'recording' ? 'motion-safe:animate-pulse' : '')
          }
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <path d="M12 19v3" />
          </svg>
        </button>
      ) : (
        <div className="flex w-full flex-col gap-3">
          <label htmlFor="companion-text-question" className="text-patient-body text-ink">
            Type your question
          </label>
          <input
            id="companion-text-question"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onTextSubmit();
            }}
            style={{ minHeight: 56 }}
            className="rounded-card border border-gray-300 px-4 text-patient-body text-ink"
          />
          <BigButton label="Ask" variant="primary" onClick={onTextSubmit} />
        </div>
      )}

      {phase === 'idle' ? <p className="text-patient-body text-ink-muted">Ask me something</p> : null}
      {phase === 'recording' ? <p className="text-patient-body text-ink-muted">Listening…</p> : null}
      {phase === 'thinking' ? <p className="text-patient-body text-ink-muted">Thinking…</p> : null}
      {(phase === 'answered' || phase === 'fallback') && transcript ? (
        <p className="text-patient-sm text-gray-500">{transcript}</p>
      ) : null}

      {answer ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[24px] leading-snug text-ink">{answer.text}</p>
          <p className="text-sm text-gray-500">{answer.fromCache ? 'from earlier' : 'AI-generated answer'}</p>
        </div>
      ) : null}

      {phase === 'answered' || phase === 'fallback' ? (
        <BigButton label="Ask again" variant="secondary" onClick={reset} />
      ) : null}
    </main>
  );
}

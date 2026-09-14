'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Square } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import BigButton from '@/components/ui/BigButton';
import Icon from '@/components/Icon';
import PatientNav from '@/components/layout/PatientNav';
import { fieldClass } from '@/components/ui/Panel';
import { narrate } from '@/lib/audio/narrate';
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

const MIC_SIZE_PX = 128;

/** Bounds the whole /api/ai/transcribe round trip client-side — covers the
 * server's own worst case (20s Bhashini timeout + 15s Groq Whisper timeout)
 * plus margin, so a hung connection to this app's own server can't leave
 * the UI stuck in "thinking" indefinitely even if every server-side timeout
 * is honored correctly. */
const TRANSCRIBE_FETCH_TIMEOUT_MS = 40_000;

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

const subscribeNever = () => () => {};

interface SpeechRecognitionLike {
  start(): void;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export default function CompanionPage() {
  const router = useRouter();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const { isOnline } = useOfflineStatus();
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Read through useSyncExternalStore rather than a `typeof window` branch:
  // the branch rendered the typed-question form on the server and the mic on
  // the client, a hydration mismatch that threw on every load. The server
  // assumes support (every current mobile browser has MediaRecorder), so the
  // rare unsupported device is the only one that swaps after hydration.
  const mediaRecorderSupported = useSyncExternalStore(
    subscribeNever,
    () => typeof window.MediaRecorder !== 'undefined',
    () => true,
  );

  // Shared by speakAnswer (TTS) and acquireTranscript (ASR) — both need to
  // know which language this patient's device is in.
  const patientLanguage =
    currentPatient && isUILanguage(currentPatient.primaryLanguage) ? currentPatient.primaryLanguage : 'en';

  const speakAnswer = (text: string) => {
    void narrate(text, patientLanguage, isOnline);
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
        formData.append('language', patientLanguage);
        const res = await fetch('/api/ai/transcribe', {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(TRANSCRIBE_FETCH_TIMEOUT_MS),
        });
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
          try {
            const text = await acquireTranscript();
            if (text) {
              await handleTranscript(text);
            } else {
              showFallback();
            }
          } catch {
            // Last-resort net: acquireTranscript/handleTranscript already
            // catch everything they know about, but neither can catch a
            // synchronous throw from SpeechRecognition's constructor/start()
            // (thrown inside its own Promise executor, which auto-rejects).
            // Without this, phase stays 'thinking' forever with no code
            // path back out — exactly the hang this page must never allow.
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

  const prompt =
    phase === 'recording' ? 'Listening…' : phase === 'thinking' ? 'Thinking…' : phase === 'idle' ? 'Ask me something' : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-patient flex-col bg-canvas">
      <PatientNav title="Ask Smriti" onBack={() => router.push('/app')} />

      <main className="flex flex-1 flex-col gap-8 px-5 py-8">
        {prompt ? (
          <p aria-live="polite" className="font-serif-display text-[2.25rem] font-medium leading-[1.15] text-ink">
            {prompt}
          </p>
        ) : null}

        {mediaRecorderSupported ? (
          <button
            type="button"
            aria-label={phase === 'recording' ? 'Stop asking' : 'Ask a question'}
            onClick={onMicClick}
            disabled={phase === 'thinking' || phase === 'answered' || phase === 'fallback'}
            className="flex flex-col items-center gap-4 self-center rounded-card p-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-dark"
          >
            <span
              aria-hidden="true"
              style={{ height: MIC_SIZE_PX, width: MIC_SIZE_PX }}
              className={
                'relative flex items-center justify-center rounded-full text-ink-inverse transition-[transform,background-color] duration-150 active:scale-95 motion-reduce:active:scale-100 ' +
                (phase === 'recording' ? 'bg-primary-dark motion-safe:animate-pulse-ring' : 'bg-primary')
              }
            >
              {phase === 'recording' ? (
                <Icon icon={Square} size={48} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/images/ask-smriti.png" alt="" className="h-16 w-16" />
              )}
            </span>
            <span aria-hidden="true" className="text-patient-body font-bold text-ink">
              {phase === 'recording' ? 'Tap when you finish' : 'Tap and speak'}
            </span>
          </button>
        ) : (
          <div className="flex w-full flex-col gap-3">
            <label htmlFor="companion-text-question" className="text-patient-body font-bold text-ink">
              Type your question
            </label>
            <input
              id="companion-text-question"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onTextSubmit();
              }}
              style={{ minHeight: 64 }}
              className={`${fieldClass} text-patient-body`}
            />
            <BigButton label="Ask" variant="primary" onClick={onTextSubmit} />
          </div>
        )}

        {(phase === 'answered' || phase === 'fallback') && transcript ? (
          <div>
            <p className="text-patient-sm font-bold text-ink-muted">You asked</p>
            <p className="mt-1 text-patient-body text-ink">{transcript}</p>
          </div>
        ) : null}

        {answer ? (
          <div className="rounded-card border border-line200 bg-surface-card p-5">
            <p className="text-patient-body text-ink">{answer.text}</p>
            <p className="mt-3 text-patient-sm text-ink-muted">{answer.fromCache ? 'from earlier' : 'AI-generated answer'}</p>
          </div>
        ) : null}

        {phase === 'answered' || phase === 'fallback' ? (
          <BigButton label="Ask again" variant="primary" onClick={reset} />
        ) : null}
      </main>
    </div>
  );
}

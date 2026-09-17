'use client';

import { useTranslation } from '@/lib/i18n/provider';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
import { answerOffline } from '@/lib/ai/companion-offline';
import type { CompanionAnswerKind } from '@/lib/ai/companion-answer';
import { getDeviceTrustToken } from '@/lib/auth/deviceTrust';
import { loadConsent } from '@/lib/consent/consentClient';
import { isConsentValid } from '@/lib/consent/policy';
import { isUILanguage, type UILanguage } from '@/lib/i18n/languages';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { usePatientStore } from '@/stores/patientStore';

type Phase = 'idle' | 'recording' | 'thinking' | 'answered' | 'fallback';

/** What the caregiver agreed to for this patient, read from the phone's consent record. */
type Access = 'checking' | 'none' | 'text' | 'voice';

type AnswerSource = 'ai' | 'cache' | 'memoryBook';

interface AnswerState {
  text: string;
  source: AnswerSource;
}

const MIC_SIZE_PX = 128;

/** Bounds the whole /api/ai/transcribe round trip client-side — covers the
 * server's own worst case (20s Bhashini timeout + 15s Groq Whisper timeout)
 * plus margin, so a hung connection to this app's own server can't leave
 * the UI stuck in "thinking" indefinitely even if every server-side timeout
 * is honored correctly. */
const TRANSCRIBE_FETCH_TIMEOUT_MS = 40_000;

/** Bounds /api/ai/complete: translation in and out (8s each), two LLM
 * providers (15s each) and consent/fact lookups, plus margin. */
const COMPLETE_FETCH_TIMEOUT_MS = 60_000;

/** A patient who forgets to tap stop still gets an answer instead of an open mic. */
const MAX_RECORDING_MS = 30_000;

/** BCP-47 tags for browser dictation; without one it listens for the browser's own language. */
const RECOGNITION_LANG: Record<UILanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  as: 'as-IN',
  bn: 'bn-IN',
  ne: 'ne-NP',
  brx: 'hi-IN',
  mni: 'bn-IN',
};

/** Browser dictation, used both as the Groq-failure/offline fallback and as
 * the sole transcript source when MediaRecorder can't record at all. No
 * true live partial-transcript display (see plan Decision 8) — Groq
 * Whisper, the primary transcriber, is batch-only, and running
 * SpeechRecognition purely for on-screen captions alongside MediaRecorder
 * means two concurrent mic consumers, a real cross-browser flakiness risk. */
function acquireViaSpeechRecognition(language: UILanguage): Promise<string | null> {
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
    recognition.lang = RECOGNITION_LANG[language];
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
  lang: string;
  start(): void;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function localContext() {
  const now = new Date();
  return {
    date: now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function CompanionPage() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const { isOnline } = useOfflineStatus();
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  const [consentAccess, setAccess] = useState<Access>('checking');
  const [typing, setTyping] = useState(false);
  const [micError, setMicError] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Spoken answers and speech recognition use the same language as the
  // screen, which follows the patient's language (selectActivePatient).
  const patientLanguage = language;
  const patientId = currentPatient?.id;

  // Consent guardrail: Ask Smriti does nothing — no recording, no network —
  // unless the caregiver turned it on for this patient.
  const access: Access = patientId ? consentAccess : 'none';
  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    void loadConsent(patientId).then((consent) => {
      if (cancelled) return;
      setAccess(isConsentValid(consent, 'voice') ? 'voice' : isConsentValid(consent, 'ai') ? 'text' : 'none');
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  // Never leave the microphone open when the patient leaves the screen.
  useEffect(
    () => () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
    },
    [],
  );

  const speakAnswer = (text: string, answerLanguage: UILanguage = patientLanguage) => {
    void narrate(text, answerLanguage, isOnline);
  };

  const showFallback = (text = t('companion.unavailable')) => {
    setAnswer({ text, source: 'ai' });
    setPhase('fallback');
    speakAnswer(text);
  };

  /** The fixed replies use the app's own reviewed translations, not a machine translation. */
  const fixedReply = (kind: CompanionAnswerKind): string =>
    kind === 'distress' ? t('companion.distress') : kind === 'unknown' ? t('companion.notSure') : t('companion.unavailable');

  const handleTranscript = async (text: string) => {
    setTranscript(text);
    if (!patientId) {
      showFallback();
      return;
    }

    const cached = await findCachedAnswer(patientId, text, patientLanguage);
    if (cached) {
      setAnswer({ text: cached.answer, source: 'cache' });
      setPhase('answered');
      speakAnswer(cached.answer, isUILanguage(cached.language) ? cached.language : patientLanguage);
      return;
    }

    if (!isOnline) {
      const offline = await answerOffline(patientId, text);
      if (offline.kind === 'distress') {
        showFallback(t('companion.distress'));
      } else if (offline.kind === 'memoryBook') {
        setAnswer({ text: offline.text, source: 'memoryBook' });
        setPhase('answered');
        // Read as the caregiver wrote it; the voice follows the screen language.
        speakAnswer(offline.text);
      } else {
        showFallback();
      }
      return;
    }

    setPhase('thinking');
    try {
      const token = await getDeviceTrustToken();
      const res = await fetch('/api/ai/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          language: patientLanguage,
          clientContext: localContext(),
          deviceTrustToken: token,
        }),
        signal: AbortSignal.timeout(COMPLETE_FETCH_TIMEOUT_MS),
      });
      if (res.status === 403) {
        // Consent was withdrawn on another device and hasn't synced here yet.
        setAccess('none');
        reset();
        return;
      }
      const body = await res.json();
      const kind: CompanionAnswerKind =
        body.kind === 'unknown' || body.kind === 'distress' || body.kind === 'unavailable' ? body.kind : 'answer';
      // The route still returns 200 when both LLM providers are down — it
      // hands back llm-client's own transient-failure sentinel rather than
      // a real answer. Route that to the same fallback UI, and critically,
      // never cache it: caching it would keep serving "can't check that
      // right now" for this question even after the providers recover.
      if (!res.ok || typeof body.text !== 'string' || body.text === FALLBACK_TEXT || kind === 'unavailable') {
        showFallback();
        return;
      }
      if (kind !== 'answer') {
        const reply = fixedReply(kind);
        setAnswer({ text: reply, source: 'ai' });
        setPhase('answered');
        speakAnswer(reply);
        return;
      }
      const answerLanguage: UILanguage = isUILanguage(body.answerLanguage) ? body.answerLanguage : patientLanguage;
      setAnswer({ text: body.text, source: 'ai' });
      setPhase('answered');
      speakAnswer(body.text, answerLanguage);
      await cacheAnswer({
        id: uuid(),
        patientId,
        question: text,
        answer: body.text,
        grounded: Boolean(body.grounded),
        modelUsed: 'groq',
        createdAt: new Date().toISOString(),
        // An answer that came back untranslated is cached as English, so the
        // next ask in the patient's language tries translation again.
        language: answerLanguage,
      });
    } catch {
      showFallback();
    }
  };

  const acquireTranscript = async (mimeType: string): Promise<string | null> => {
    if (isOnline) {
      try {
        const token = await getDeviceTrustToken();
        const formData = new FormData();
        const type = mimeType || 'audio/webm';
        formData.append('audio', new Blob(chunksRef.current, { type }), 'clip');
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
    return acquireViaSpeechRecognition(patientLanguage);
  };

  const releaseMic = () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    autoStopRef.current = null;
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Permission denied or no microphone: offer typing rather than claim
      // the answer can't be checked.
      setPhase('idle');
      setMicError(true);
      setTyping(true);
      return;
    }
    try {
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new window.MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size !== 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        releaseMic();
        setPhase('thinking');
        void (async () => {
          try {
            // Safari records audio/mp4, not webm; the server picks a transcriber that accepts it.
            const text = await acquireTranscript(recorder.mimeType || chunksRef.current[0]?.type || '');
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
      autoStopRef.current = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, MAX_RECORDING_MS);
    } catch {
      releaseMic();
      showFallback();
    }
  };

  const onMicClick = () => {
    if (phase === 'recording') {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (phase !== 'idle') return;
    setMicError(false);
    // Flips synchronously, before the async getUserMedia permission prompt
    // resolves — a tap should pulse immediately, not lag behind mic access.
    setPhase('recording');
    void startRecording();
  };

  function reset() {
    setPhase('idle');
    setTranscript('');
    setTextInput('');
    setAnswer(null);
  }

  const onTextSubmit = () => {
    const question = textInput.trim();
    if (!question || phase === 'thinking') return;
    void handleTranscript(question);
  };

  const canSpeak = access === 'voice' && mediaRecorderSupported;
  const showTextForm = access !== 'checking' && access !== 'none' && (!canSpeak || typing);

  const prompt =
    phase === 'recording'
      ? t('companion.listening')
      : phase === 'thinking'
        ? t('companion.thinking')
        : phase === 'idle' && access !== 'none'
          ? t('companion.askMeSomething')
          : null;

  const sourceLabel =
    answer?.source === 'cache'
      ? t('companion.fromEarlier')
      : answer?.source === 'memoryBook'
        ? t('companion.fromMemoryBook')
        : t('companion.aiAnswer');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-patient flex-col bg-canvas">
      <PatientNav title={t('companion.title')} onBack={() => router.push('/app')} />

      <main className="flex flex-1 flex-col gap-8 px-5 py-8">
        {access === 'none' ? (
          <div className="rounded-card border border-line200 bg-surface-card p-5">
            <p className="text-patient-body text-ink">{t('companion.consentNeeded')}</p>
          </div>
        ) : null}

        {prompt && access !== 'checking' ? (
          <p aria-live="polite" className="font-serif-display text-[2.25rem] font-medium leading-[1.15] text-ink">
            {prompt}
          </p>
        ) : null}

        {micError ? (
          <p role="alert" className="text-patient-body text-ink">
            {t('companion.micUnavailable')}
          </p>
        ) : null}

        {canSpeak && !typing ? (
          <button
            type="button"
            aria-label={phase === 'recording' ? t('companion.stopAsking') : t('companion.askQuestion')}
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
              {phase === 'recording' ? t('companion.tapWhenFinished') : t('companion.tapAndSpeak')}
            </span>
          </button>
        ) : null}

        {showTextForm && (phase === 'idle' || phase === 'thinking') ? (
          <div className="flex w-full flex-col gap-3">
            <label htmlFor="companion-text-question" className="text-patient-body font-bold text-ink">
              {t('companion.typeQuestion')}
            </label>
            <input
              id="companion-text-question"
              value={textInput}
              maxLength={500}
              lang={patientLanguage}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onTextSubmit();
              }}
              style={{ minHeight: 64 }}
              className={`${fieldClass} text-patient-body`}
            />
            <BigButton
              label={t('companion.ask')}
              variant="primary"
              onClick={onTextSubmit}
              disabled={phase === 'thinking'}
            />
          </div>
        ) : null}

        {canSpeak && phase === 'idle' ? (
          <BigButton
            label={typing ? t('companion.speakInstead') : t('companion.typeInstead')}
            variant="secondary"
            onClick={() => {
              setMicError(false);
              setTyping((v) => !v);
            }}
          />
        ) : null}

        {(phase === 'answered' || phase === 'fallback') && transcript ? (
          <div>
            <p className="text-patient-sm font-bold text-ink-muted">{t('companion.youAsked')}</p>
            <p className="mt-1 text-patient-body text-ink">{transcript}</p>
          </div>
        ) : null}

        {answer ? (
          <div className="rounded-card border border-line200 bg-surface-card p-5">
            <p className="text-patient-body text-ink">{answer.text}</p>
            <p className="mt-3 text-patient-sm text-ink-muted">{sourceLabel}</p>
          </div>
        ) : null}

        {phase === 'answered' || phase === 'fallback' ? (
          <BigButton label={t('companion.askAgain')} variant="primary" onClick={reset} />
        ) : null}
      </main>
    </div>
  );
}

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
import { claimChannel } from '@/lib/audio/channel';
import { playBase64Audio } from '@/lib/audio/player';
import { cacheSpeech } from '@/lib/ai/speech-cache';
import { cacheAnswer, findCachedAnswer } from '@/lib/ai/companion-cache';
import { answerOffline } from '@/lib/ai/companion-offline';
import { getDeviceTrustToken } from '@/lib/auth/deviceTrust';
import { loadConsent } from '@/lib/consent/consentClient';
import { isConsentValid } from '@/lib/consent/policy';
import { isUILanguage, type UILanguage } from '@/lib/i18n/languages';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { usePatientStore } from '@/stores/patientStore';

type Phase = 'idle' | 'recording' | 'thinking';

/** What the caregiver agreed to for this patient, read from the phone's consent record. */
type Access = 'checking' | 'none' | 'text' | 'voice';

type ReplySource = 'ai' | 'cache' | 'memoryBook' | 'fixed';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: ReplySource;
  /** Memory Bank facts the reply was based on; sent back so follow-ups keep their subject. */
  factIds?: string[];
}

const MIC_SIZE_PX = 112;

/** Bounds the whole /api/ai/transcribe round trip client-side (server worst
 * case: 20s Bhashini + 15s Groq Whisper, plus margin), so a hung connection
 * can never leave the screen stuck. */
const TRANSCRIBE_FETCH_TIMEOUT_MS = 40_000;

/** Bounds /api/ai/converse: reply, independent check and speech, plus margin. */
const CONVERSE_FETCH_TIMEOUT_MS = 45_000;

/** A patient who forgets to tap stop still gets a reply instead of an open mic. */
const MAX_RECORDING_MS = 30_000;

/** After this long without a message, the next one starts a new conversation. */
const IDLE_RESET_MS = 10 * 60_000;

/** Turns sent as context with each message — matches the server's cap. */
const HISTORY_TURNS = 6;

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

interface SpeechRecognitionLike {
  lang: string;
  start(): void;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

/** Browser dictation, the fallback when server transcription fails or the phone is offline. */
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
  const [turns, setTurns] = useState<Turn[]>([]);
  const [textInput, setTextInput] = useState('');
  const [consentAccess, setAccess] = useState<Access>('checking');
  const [typing, setTyping] = useState(false);
  const [micError, setMicError] = useState(false);
  const sessionRef = useRef<{ id: string; lastAt: number }>({ id: uuid(), lastAt: 0 });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  // useSyncExternalStore, not a `typeof window` branch, so server and client
  // render the same markup; only a device without MediaRecorder swaps after hydration.
  const mediaRecorderSupported = useSyncExternalStore(
    subscribeNever,
    () => typeof window.MediaRecorder !== 'undefined',
    () => true,
  );

  const patientLanguage = language;
  const patientId = currentPatient?.id;
  const access: Access = patientId ? consentAccess : 'none';

  // Consent guardrail: nothing is recorded or sent unless the caregiver turned Ask Smriti on.
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

  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [turns, phase]);

  const addTurn = (turn: Omit<Turn, 'id'>) => setTurns((prev) => [...prev, { ...turn, id: uuid() }]);

  const reply = (text: string, source: ReplySource, answerLanguage: UILanguage = patientLanguage, factIds?: string[]) => {
    addTurn({ role: 'assistant', text, source, factIds });
    void narrate(text, answerLanguage, isOnline);
  };

  const newConversation = () => {
    setTurns([]);
    sessionRef.current = { id: uuid(), lastAt: 0 };
  };

  const sendMessage = async (text: string) => {
    if (!patientId) return;
    const now = Date.now();
    let history = turns;
    if (sessionRef.current.lastAt && now - sessionRef.current.lastAt > IDLE_RESET_MS) {
      sessionRef.current = { id: uuid(), lastAt: now };
      history = [];
      setTurns([]);
    }
    sessionRef.current.lastAt = now;
    addTurn({ role: 'user', text });
    setTextInput('');

    // A first question asked before, word for word, is answered from the phone.
    if (history.length === 0) {
      const cached = await findCachedAnswer(patientId, text, patientLanguage);
      if (cached) {
        reply(cached.answer, 'cache', isUILanguage(cached.language) ? cached.language : patientLanguage);
        return;
      }
    }

    if (!isOnline) {
      const offline = await answerOffline(patientId, text);
      if (offline.kind === 'distress') reply(t('companion.distress'), 'fixed');
      else if (offline.kind === 'memoryBook') reply(offline.text, 'memoryBook');
      else reply(t('companion.unavailable'), 'fixed');
      return;
    }

    setPhase('thinking');
    try {
      const token = await getDeviceTrustToken();
      const res = await fetch('/api/ai/converse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: history.slice(-HISTORY_TURNS).map((turn) => ({ role: turn.role, text: turn.text, factIds: turn.factIds })),
          language: patientLanguage,
          clientContext: localContext(),
          sessionId: sessionRef.current.id,
          speak: true,
          deviceTrustToken: token,
        }),
        signal: AbortSignal.timeout(CONVERSE_FETCH_TIMEOUT_MS),
      });
      if (res.status === 403) {
        // Consent was withdrawn on another device and hasn't synced here yet.
        setAccess('none');
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.kind === 'unavailable' || (body.kind === 'answer' && typeof body.text !== 'string')) {
        reply(t('companion.unavailable'), 'fixed');
        return;
      }
      if (body.kind === 'distress') {
        reply(t('companion.distress'), 'fixed');
        return;
      }
      if (body.kind === 'unknown') {
        reply(t('companion.notSure'), 'fixed');
        return;
      }

      const answerLanguage: UILanguage = isUILanguage(body.answerLanguage) ? body.answerLanguage : patientLanguage;
      const factIds = Array.isArray(body.factIds) ? body.factIds.filter((id: unknown) => typeof id === 'string') : [];
      if (body.audio && typeof body.audio.audioBase64 === 'string') {
        // Speech came back with the reply: play it now and keep it for next time.
        addTurn({ role: 'assistant', text: body.text, source: 'ai', factIds });
        playBase64Audio(body.audio.audioBase64, body.audio.audioFormat, body.text, answerLanguage, claimChannel());
        void cacheSpeech({
          language: answerLanguage,
          text: body.text,
          audioBase64: body.audio.audioBase64,
          audioFormat: body.audio.audioFormat,
        }).catch(() => undefined);
      } else {
        reply(body.text, 'ai', answerLanguage, factIds);
      }
      // Only a first question stands alone well enough to answer again from the cache.
      if (history.length === 0 && body.grounded) {
        // Fire-and-forget: the reply is already on screen, and the patient
        // should be able to reply again without waiting for a local write.
        void cacheAnswer({
          id: uuid(),
          patientId,
          question: text,
          answer: body.text,
          grounded: true,
          modelUsed: 'groq',
          createdAt: new Date().toISOString(),
          language: answerLanguage,
        }).catch(() => undefined);
      }
    } catch {
      reply(t('companion.unavailable'), 'fixed');
    } finally {
      setPhase('idle');
    }
  };

  const acquireTranscript = async (mimeType: string): Promise<string | null> => {
    if (isOnline) {
      try {
        const token = await getDeviceTrustToken();
        const formData = new FormData();
        formData.append('audio', new Blob(chunksRef.current, { type: mimeType || 'audio/webm' }), 'clip');
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
      // Permission refused or no microphone: offer typing instead of a dead end.
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
              await sendMessage(text);
            } else {
              reply(t('companion.didNotHear'), 'fixed');
            }
          } catch {
            // Last-resort net for a synchronous SpeechRecognition throw: the
            // screen must never stay in "thinking".
            reply(t('companion.unavailable'), 'fixed');
          } finally {
            setPhase('idle');
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
      setPhase('idle');
      reply(t('companion.unavailable'), 'fixed');
    }
  };

  const onMicClick = () => {
    if (phase === 'recording') {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (phase !== 'idle') return;
    setMicError(false);
    // Flips before the permission prompt resolves, so the tap pulses at once.
    setPhase('recording');
    void startRecording();
  };

  const onTextSubmit = () => {
    const message = textInput.trim();
    if (!message || phase !== 'idle') return;
    void sendMessage(message);
  };

  const canSpeak = access === 'voice' && mediaRecorderSupported;
  const showTextForm = access === 'text' || access === 'voice' ? !canSpeak || typing : false;
  const hasTurns = turns.length > 0;

  const status =
    phase === 'recording'
      ? t('companion.listening')
      : phase === 'thinking'
        ? t('companion.thinking')
        : !hasTurns && access !== 'none' && access !== 'checking'
          ? t('companion.askMeSomething')
          : null;

  const sourceLabel = (source: ReplySource | undefined) =>
    source === 'cache'
      ? t('companion.fromEarlier')
      : source === 'memoryBook'
        ? t('companion.fromMemoryBook')
        : source === 'ai'
          ? t('companion.aiAnswer')
          : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-patient flex-col bg-canvas">
      <PatientNav title={t('companion.title')} onBack={() => router.push('/app')} />

      <main className="flex flex-1 flex-col gap-6 px-5 py-6">
        {access === 'none' ? (
          <div className="rounded-card border border-line200 bg-surface-card p-5">
            <p className="text-patient-body text-ink">{t('companion.consentNeeded')}</p>
          </div>
        ) : null}

        {hasTurns ? (
          <ol aria-label={t('companion.conversation')} className="flex flex-col gap-4">
            {turns.map((turn, index) => {
              const label = turn.role === 'assistant' ? sourceLabel(turn.source) : null;
              const isLatest = index === turns.length - 1;
              return (
                <li
                  key={turn.id}
                  className={turn.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'}
                >
                  <span className="mb-1 text-patient-sm font-bold text-ink-muted">
                    {turn.role === 'user' ? t('companion.you') : t('companion.smriti')}
                  </span>
                  <div
                    aria-live={turn.role === 'assistant' && isLatest ? 'polite' : undefined}
                    className={
                      'max-w-[88%] rounded-card px-5 py-4 text-patient-body ' +
                      (turn.role === 'user'
                        ? 'bg-primary text-ink-inverse'
                        : 'border border-line200 bg-surface-card text-ink')
                    }
                  >
                    <p>{turn.text}</p>
                    {label ? <p className="mt-2 text-patient-sm text-ink-muted">{label}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}

        {status ? (
          <p
            aria-live="polite"
            className={
              hasTurns
                ? 'text-patient-body font-bold text-ink-muted'
                : 'font-serif-display text-[2.25rem] font-medium leading-[1.15] text-ink'
            }
          >
            {status}
          </p>
        ) : null}

        <div ref={threadEndRef} />

        <div className="mt-auto flex flex-col gap-4">
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
              disabled={phase === 'thinking'}
              className="flex flex-col items-center gap-3 self-center rounded-card p-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-dark"
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
                  <Icon icon={Square} size={44} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/images/ask-smriti.png" alt="" className="h-14 w-14" />
                )}
              </span>
              <span aria-hidden="true" className="text-patient-body font-bold text-ink">
                {phase === 'recording'
                  ? t('companion.tapWhenFinished')
                  : hasTurns
                    ? t('companion.tapToReply')
                    : t('companion.tapAndSpeak')}
              </span>
            </button>
          ) : null}

          {showTextForm ? (
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
              <BigButton label={t('companion.ask')} variant="primary" onClick={onTextSubmit} disabled={phase !== 'idle'} />
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

          {hasTurns && phase === 'idle' ? (
            <BigButton label={t('companion.newConversation')} variant="secondary" onClick={newConversation} />
          ) : null}
        </div>
      </main>
    </div>
  );
}

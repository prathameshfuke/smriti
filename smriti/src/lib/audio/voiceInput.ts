'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getDeviceTrustToken } from '@/lib/auth/deviceTrust';
import type { UILanguage } from '@/lib/i18n/languages';

/** Same client-side bound as the companion's transcribe round trip. */
const TRANSCRIBE_FETCH_TIMEOUT_MS = 40_000;

/** Browser dictation tags; Indian English/Hindi/etc. recognise local accents better. */
const RECOGNITION_TAG: Record<UILanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  as: 'as-IN',
  brx: 'hi-IN',
  mni: 'bn-IN',
  bn: 'bn-IN',
  ne: 'ne-NP',
};

interface RecognitionResultList {
  length: number;
  [i: number]: { isFinal?: boolean; [j: number]: { transcript: string } };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type VoiceMode = 'recognition' | 'recorder' | 'none';

function detectMode(): VoiceMode {
  if (recognitionCtor()) return 'recognition';
  if (typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && navigator.mediaDevices) {
    return 'recorder';
  }
  return 'none';
}

const subscribeNever = () => () => {};

export type VoiceStatus = 'idle' | 'listening' | 'transcribing' | 'error';

/**
 * Tap-to-talk answers for word games. Uses live browser dictation where it
 * exists (Chrome/Edge/Android, Safari); otherwise records a clip and sends
 * it to /api/ai/transcribe, like the companion does. Each recognised chunk
 * of text is handed to `onText` as it arrives.
 */
export function useVoiceInput(language: UILanguage, isOnline: boolean, onText: (text: string) => void) {
  const mode = useSyncExternalStore(subscribeNever, detectMode, () => 'none' as VoiceMode);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    if (status === 'listening' || status === 'transcribing') return;

    const Ctor = recognitionCtor();
    if (Ctor) {
      const recognition = new Ctor();
      recognition.lang = RECOGNITION_TAG[language] ?? 'en-IN';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const text = event.results[i]?.[0]?.transcript;
          if (typeof text === 'string' && text.trim()) onTextRef.current(text);
        }
      };
      recognition.onerror = () => setStatus('error');
      recognition.onend = () => {
        recognitionRef.current = null;
        setStatus((s) => (s === 'listening' ? 'idle' : s));
      };
      recognitionRef.current = recognition;
      setStatus('listening');
      try {
        recognition.start();
      } catch {
        setStatus('error');
      }
      return;
    }

    if (!isOnline || typeof window.MediaRecorder === 'undefined') {
      setStatus('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const recorder = new window.MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        setStatus('transcribing');
        try {
          const token = await getDeviceTrustToken();
          const formData = new FormData();
          formData.append('audio', new Blob(chunks, { type: 'audio/webm' }), 'clip.webm');
          formData.append('deviceTrustToken', JSON.stringify(token));
          formData.append('language', language);
          const res = await fetch('/api/ai/transcribe', {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(TRANSCRIBE_FETCH_TIMEOUT_MS),
          });
          const body = res.ok ? await res.json() : null;
          if (typeof body?.text === 'string' && body.text.length > 0) {
            onTextRef.current(body.text);
            setStatus('idle');
          } else {
            setStatus('error');
          }
        } catch {
          setStatus('error');
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus('listening');
    } catch {
      // Mic permission denied or no microphone.
      setStatus('error');
    }
  }, [status, language, isOnline]);

  return { supported: mode !== 'none', status, start, stop };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,!?।;:'"()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Which of `targets` were said in `transcript`. Matches whole words (or a
 * whole multi-word phrase), plus a simple plural/"s" tolerance for English,
 * so "umbrellas" still counts for "Umbrella".
 */
export function matchSpokenWords(transcript: string, targets: string[]): string[] {
  const said = ` ${normalize(transcript)} `;
  return targets.filter((target) => {
    const t = normalize(target);
    if (!t) return false;
    return said.includes(` ${t} `) || said.includes(` ${t}s `) || said.includes(` ${t}es `);
  });
}

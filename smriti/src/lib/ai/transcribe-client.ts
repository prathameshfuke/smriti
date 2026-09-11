/**
 * Single entry point for audio transcription. Sibling to `llm-client.ts`,
 * not merged into it — a different endpoint (`/audio/transcriptions`),
 * request shape (multipart, not JSON), and response shape (`{ text, ... }`,
 * not `choices[0].message.content`).
 *
 * Server-only: reads GROQ_API_KEY from process.env. Never import this from
 * a Client Component.
 */

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL = 'whisper-large-v3-turbo';

/** A hung connection must not block the companion's recording→thinking flow
 * forever — same 15s bound as llm-client.ts's provider timeout. This was the
 * one external call in the whole ASR/TTS/LLM pipeline without an enforced
 * timeout; the Bhashini-first routing for hi/as now falls through here on
 * every ASR failure, turning a pre-existing gap into a reachable hang. */
const GROQ_TIMEOUT_MS = 15_000;

export interface TranscribeResult {
  text: string;
  model: string;
}

/**
 * Transcribes one audio clip via Groq Whisper. Throws — never swallows —
 * on a missing key, a non-ok response, or an empty transcript. There is no
 * second provider to fall through to here, so the caller (the API route)
 * decides what happens next (the client falls back to browser
 * `SpeechRecognition`).
 */
export async function transcribeAudio(audio: Blob): Promise<TranscribeResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const formData = new FormData();
  formData.append('file', audio, 'clip.webm');
  formData.append('model', GROQ_MODEL);

  const response = await fetch(GROQ_TRANSCRIBE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Transcription provider returned ${response.status}`);
  }

  const body = await response.json();
  const text = body?.text;
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Transcription provider returned an empty transcript');
  }

  return { text, model: `groq/${GROQ_MODEL}` };
}

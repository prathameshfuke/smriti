import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { db } from '@/lib/db/schema';
import { findCachedSpeech } from '@/lib/ai/speech-cache';
import { usePatientStore } from '@/stores/patientStore';
import { I18nProvider } from '@/lib/i18n/provider';

// The patient-home HomePage rendered below calls useTranslation() (My Progress button).
function render(ui: Parameters<typeof rtlRender>[0], options?: Parameters<typeof rtlRender>[1]) {
  return rtlRender(ui, { wrapper: I18nProvider, ...options });
}

const push = vi.fn();
const router = { push, replace: vi.fn() };
let pathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => pathname,
}));

const getSession = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession } }),
}));

vi.mock('@/lib/audio/speech', () => ({ speak: vi.fn(), GAME_SPEECH_RATE: 0.9 }));

vi.mock('@/lib/auth/deviceTrust', () => ({
  getDeviceTrustToken: vi.fn().mockResolvedValue({
    patientId: 'p1',
    issuedAt: Date.now(),
    issuedBy: 'cg1',
    signature: 'sig',
  }),
  isTokenWellFormed: vi.fn(() => true),
}));

const testPatient = {
  id: 'p1',
  caregiverId: 'c1',
  displayName: 'Aai',
  ageYears: 72,
  gender: 'female' as const,
  educationYears: 4,
  primaryLanguage: 'en',
  sessionDurationMinutes: 10,
  isActive: true,
  currentDifficulty: {},
  updatedAt: new Date().toISOString(),
  syncedAt: null,
};

/** Minimal fake MediaRecorder: `stop()` synchronously fires `ondataavailable`
 * then `onstop`, mirroring the real API's event contract closely enough for
 * the component's stop-handler to run in the same tick. */
class FakeMediaRecorder {
  static isTypeSupported = () => true;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  state: 'inactive' | 'recording' = 'inactive';
  constructor() {}
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['fake-audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

function installMediaRecorder() {
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  Object.defineProperty(window.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue({}) },
    configurable: true,
  });
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

/** Ask Smriti with voice turned on, as a caregiver would have agreed during onboarding. */
async function giveConsent(overrides: Partial<import('@/lib/db/schema').LocalConsent> = {}) {
  await db.consents.put({
    patientId: 'p1',
    version: 2,
    careProfile: true,
    guardianAttested: true,
    aiCompanion: true,
    voiceProcessing: true,
    consentedBy: 'c1',
    consentedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    synced: true,
    ...overrides,
  });
}

beforeEach(async () => {
  await db.aiConversationLog.clear();
  await db.consents.clear();
  await db.memoryBankEntries.clear();
  await giveConsent();
  usePatientStore.setState({ currentPatient: testPatient });
  push.mockClear();
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  setOnline(true);
  pathname = '/';
});

afterEach(() => {
  vi.unstubAllGlobals();
  usePatientStore.setState(usePatientStore.getInitialState(), true);
});

// ---------------------------------------------------------------------------
// Companion page
// ---------------------------------------------------------------------------
/** A reply from /api/ai/converse. */
function converseReply(body: Record<string, unknown>) {
  return { ok: true, status: 200, json: async () => ({ kind: 'answer', grounded: true, factIds: [], answerLanguage: 'en', ...body }) };
}

function stubConverse(impl: (url: string, init?: RequestInit) => unknown) {
  const fetchMock = vi.fn().mockImplementation(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Only the conversation requests — narration also calls /api/ai/speak. */
function converseCalls(fetchMock: ReturnType<typeof vi.fn>): Array<Record<string, unknown>> {
  return fetchMock.mock.calls
    .filter((call) => String(call[0]).includes('/api/ai/converse'))
    .map((call) => JSON.parse(String((call[1] as RequestInit).body)));
}

async function ask(question: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Type instead' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
}

describe('CompanionPage', () => {
  it('renders a mic button and an invitation to speak on load', async () => {
    installMediaRecorder();
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    expect(await screen.findByRole('button', { name: 'Ask a question' })).toBeInTheDocument();
    expect(screen.getByText(/ask me something/i)).toBeInTheDocument();
  });

  it('keeps both sides of the conversation on screen and sends the earlier turns with the next message', async () => {
    installMediaRecorder();
    const fetchMock = stubConverse((url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return converseReply({
        text: body.message === 'who is Raju' ? 'Raju is your son.' : 'He lives in Guwahati.',
        factIds: ['m:e1'],
      });
    });
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    await ask('who is Raju');
    expect(await screen.findByText('Raju is your son.')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'and where does he live?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('He lives in Guwahati.')).toBeInTheDocument();

    // Both questions and both replies stay visible.
    expect(screen.getByText('who is Raju')).toBeInTheDocument();
    expect(screen.getByText('and where does he live?')).toBeInTheDocument();

    const [first, second] = converseCalls(fetchMock);
    expect(second.history).toEqual([
      { role: 'user', text: 'who is Raju' },
      { role: 'assistant', text: 'Raju is your son.', factIds: ['m:e1'] },
    ]);
    expect(second.sessionId).toBe(first.sessionId);
    expect(first).toMatchObject({ message: 'who is Raju', language: 'en', speak: true, history: [] });
    expect(String((first.clientContext as { date: string }).date)).toMatch(/\d{4}/);
  });

  it('starts a fresh conversation when asked, sending no earlier turns', async () => {
    installMediaRecorder();
    const fetchMock = stubConverse(() => converseReply({ text: 'Hello!' }));
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    await ask('hello');
    expect(await screen.findByText('Hello!')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /start a new conversation/i }));
    expect(screen.queryByText('hello')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello again' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    await screen.findByText('hello again');
    await waitFor(() => expect(converseCalls(fetchMock)).toHaveLength(2));
    const [first, second] = converseCalls(fetchMock);
    expect(second.history).toEqual([]);
    expect(second.sessionId).not.toBe(first.sessionId);
  });

  it('plays the speech the server sent with the reply instead of asking for it again', async () => {
    installMediaRecorder();
    const fetchMock = stubConverse(() => converseReply({ text: 'Hello!', audio: { audioBase64: 'QUJD', audioFormat: 'wav' } }));
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    await ask('hello');
    await screen.findByText('Hello!');

    // The reply arrived with its audio, so no separate /api/ai/speak request.
    expect(fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u !== '/api/health')).toEqual(['/api/ai/converse']);
    expect(await findCachedSpeech('en', 'Hello!')).toMatchObject({ audioBase64: 'QUJD' });
  });

  it('shows its own reviewed wording for the fixed replies, and never caches them', async () => {
    installMediaRecorder();
    stubConverse(() => ({ ok: true, status: 200, json: async () => ({ kind: 'unknown', text: '', grounded: false }) }));
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    await ask('where does my daughter live');

    expect(await screen.findByText(/not sure about that/i)).toBeInTheDocument();
    expect(await db.aiConversationLog.count()).toBe(0);
  });

  it('shows the helpline wording when the server reports distress', async () => {
    installMediaRecorder();
    stubConverse(() => ({ ok: true, status: 200, json: async () => ({ kind: 'distress', text: 'x' }) }));
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    await ask('I feel hopeless');

    expect(await screen.findByText(/14416/)).toBeInTheDocument();
  });

  it('never stays stuck in "thinking" when the request hangs past its timeout', async () => {
    installMediaRecorder();
    stubConverse(() => Promise.reject(new Error('The operation was aborted')));
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    await ask('who is Raju');

    expect(await screen.findByText(/can't check that right now|try again in a moment/i)).toBeInTheDocument();
    expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument();
  });

  it('records, transcribes and answers a spoken question', async () => {
    installMediaRecorder();
    stubConverse((url: string) =>
      url.includes('/api/ai/transcribe')
        ? { ok: true, status: 200, json: async () => ({ text: 'what is my medication' }) }
        : converseReply({ text: 'One red pill after breakfast.' }),
    );
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    const micButton = await screen.findByRole('button', { name: 'Ask a question' });
    fireEvent.click(micButton);
    await screen.findByRole('button', { name: /stop/i });
    fireEvent.click(micButton);

    expect(await screen.findByText('One red pill after breakfast.')).toBeInTheDocument();
    expect(screen.getByText('what is my medication')).toBeInTheDocument();
  });

  it('answers a repeated first question from the phone, with no request at all', async () => {
    installMediaRecorder();
    await db.aiConversationLog.put({
      id: 'cached-1',
      patientId: 'p1',
      question: 'what is my medication',
      answer: 'One red pill after breakfast.',
      grounded: true,
      modelUsed: 'groq',
      createdAt: new Date().toISOString(),
      language: 'en',
    });
    const fetchMock = stubConverse(() => {
      throw new Error('should not reach the network on a cache hit');
    });
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    await ask('what is my medication');

    expect(await screen.findByText('One red pill after breakfast.')).toBeInTheDocument();
    expect(screen.getByText(/from earlier/i)).toBeInTheDocument();
    expect(converseCalls(fetchMock)).toEqual([]);
  });

  it('renders the typing form and no mic when MediaRecorder is unavailable', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    expect(await screen.findByRole('textbox')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask a question' })).not.toBeInTheDocument();
  });
});

describe('CompanionPage — consent, offline and microphone', () => {
  it('does not offer the mic or typing, and explains why, when the caregiver has not turned Ask Smriti on', async () => {
    installMediaRecorder();
    await db.consents.clear();
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    expect(await screen.findByText(/ask smriti is not turned on/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask a question' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('offers typing only, never the microphone, when voice is off', async () => {
    installMediaRecorder();
    await giveConsent({ voiceProcessing: false });
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    expect(await screen.findByRole('textbox')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask a question' })).not.toBeInTheDocument();
  });

  it('stops asking as soon as consent is withdrawn elsewhere (403 from the server)', async () => {
    installMediaRecorder();
    stubConverse(() => ({ ok: false, status: 403, json: async () => ({ error: 'consent_required' }) }));
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    await ask('who is Raju');

    expect(await screen.findByText(/ask smriti is not turned on/i)).toBeInTheDocument();
  });

  it('answers offline from the Memory Bank, with no network call', async () => {
    installMediaRecorder();
    setOnline(false);
    await db.memoryBankEntries.put({
      id: 'e1',
      patientId: 'p1',
      category: 'person',
      title: 'Raju',
      detail: 'Your son, visits on Sundays',
      photoUrl: null,
      relationship: 'son',
      active: true,
      createdBy: 'c1',
      updatedAt: new Date().toISOString(),
      synced: true,
    });
    const fetchMock = stubConverse(() => {
      throw new Error('offline: no request expected');
    });
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    await ask('who is Raju');

    expect(await screen.findByText('Raju (son): Your son, visits on Sundays')).toBeInTheDocument();
    expect(screen.getByText(/from your memory book/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('offers typing instead of a dead end when microphone permission is refused', async () => {
    installMediaRecorder();
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')) },
      configurable: true,
    });
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Ask a question' }));

    expect(await screen.findByText(/microphone could not be used/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// "Ask Smriti" entry point on the patient home screen
// ---------------------------------------------------------------------------
describe('HomePage "Ask Smriti" button', () => {
  it('renders and navigates to /companion', async () => {
    const { default: HomePage } = await import('@/app/app/page');
    render(<HomePage />);

    const button = screen.getByRole('button', { name: /ask smriti/i });
    fireEvent.click(button);
    expect(push).toHaveBeenCalledWith('/companion');
  });
});

// ---------------------------------------------------------------------------
// Caregiver "Companion" tab on the patient detail page
// ---------------------------------------------------------------------------
describe('Caregiver patient detail — Companion tab', () => {
  it('fetches and renders the last questions with grounded/flagged status on first selection, once', async () => {
    pathname = '/caregiver/patients/p1';
    const questions = [
      { id: 'q1', question: 'who visits on Sundays', answer: 'Raju does.', grounded: true, flaggedForFollowup: false, createdAt: new Date(2026, 0, 3).toISOString() },
      { id: 'q2', question: 'what is the capital of France', answer: "I'm not sure about that. You could ask your caregiver.", grounded: false, flaggedForFollowup: false, createdAt: new Date(2026, 0, 2).toISOString() },
      { id: 'q3', question: 'I feel scared', answer: 'Please call 14416 (Tele-MANAS).', grounded: false, flaggedForFollowup: true, createdAt: new Date(2026, 0, 1).toISOString() },
    ];
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/companion-activity')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ questions }) });
      }
      if (url.includes('/timeline')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ points: [] }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ patients: [] }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: PatientDetailPage } = await import('@/app/caregiver/patients/[id]/page');
    render(<PatientDetailPage params={Promise.resolve({ id: 'p1' })} />);

    fireEvent.click(await screen.findByRole('button', { name: /companion/i }));

    expect(await screen.findByText('who visits on Sundays')).toBeInTheDocument();
    expect(screen.getByText(/consider adding/i)).toBeInTheDocument();
    expect(screen.getByText(/follow.?up/i)).toBeInTheDocument();

    const callCountAfterFirst = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/companion-activity')).length;
    fireEvent.click(screen.getByRole('button', { name: /companion/i }));
    const callCountAfterSecond = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/companion-activity')).length;
    expect(callCountAfterSecond).toBe(callCountAfterFirst);
  });
});

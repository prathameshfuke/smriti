import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { db } from '@/lib/db/schema';
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

beforeEach(async () => {
  await db.aiConversationLog.clear();
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
describe('CompanionPage', () => {
  it('renders a mic button and instructions on load', async () => {
    installMediaRecorder();
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    expect(screen.getByRole('button', { name: /ask/i })).toBeInTheDocument();
    expect(screen.getByText(/ask me something/i)).toBeInTheDocument();
  });

  it('renders the answer after a record → transcribe → answer flow', async () => {
    installMediaRecorder();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/ai/transcribe')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ text: 'what is my medication' }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ text: 'One red pill after breakfast.', grounded: true }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    const micButton = screen.getByRole('button', { name: /ask/i });
    fireEvent.click(micButton); // start
    await screen.findByRole('button', { name: /stop/i }); // wait for recording to actually establish
    fireEvent.click(micButton); // stop

    expect(await screen.findByText('One red pill after breakfast.')).toBeInTheDocument();
    expect(screen.getByText(/ai-generated answer/i)).toBeInTheDocument();
  });

  it('renders a text input instead of the mic button when MediaRecorder is unavailable', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    expect(screen.queryByRole('button', { name: 'Ask a question' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows the fallback immediately when offline, without calling the network', async () => {
    installMediaRecorder();
    setOnline(false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    const micButton = screen.getByRole('button', { name: /ask/i });
    fireEvent.click(micButton);
    await screen.findByRole('button', { name: /stop/i });
    fireEvent.click(micButton);

    expect(
      await screen.findByText(/can't check that right now|try again in a moment/i),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reaches the fallback phase, never stays stuck in "thinking", when /api/ai/transcribe hangs past its timeout', async () => {
    // Simulates what AbortSignal.timeout() produces on the client once every
    // server-side provider (Bhashini ASR, then Groq Whisper) has exhausted
    // its own timeout and the transcribe route itself never responds —
    // same rejected-fetch approach as sync.test.ts, no real waiting.
    installMediaRecorder();
    const fetchMock = vi.fn().mockRejectedValue(new Error('The operation was aborted'));
    vi.stubGlobal('fetch', fetchMock);

    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    const micButton = screen.getByRole('button', { name: /ask/i });
    fireEvent.click(micButton);
    await screen.findByRole('button', { name: /stop/i });
    fireEvent.click(micButton);

    expect(
      await screen.findByText(/can't check that right now|try again in a moment/i),
    ).toBeInTheDocument();
  });

  it('shows the fallback and does not cache it when /api/ai/complete returns the LLM-outage sentinel (200 OK, both providers down)', async () => {
    installMediaRecorder();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/ai/transcribe')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ text: 'what is my medication' }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          text: "I can't check that right now. Try again in a moment, or ask your caregiver.",
          grounded: false,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    const micButton = screen.getByRole('button', { name: /ask/i });
    fireEvent.click(micButton);
    await screen.findByRole('button', { name: /stop/i });
    fireEvent.click(micButton);

    expect(await screen.findByText(/can't check that right now/i)).toBeInTheDocument();
    const cached = await db.aiConversationLog.where('patientId').equals('p1').toArray();
    expect(cached).toHaveLength(0);
  });

  it('shows a cached answer with a "from earlier" label and never calls /api/ai/complete', async () => {
    installMediaRecorder();
    await db.aiConversationLog.put({
      id: 'cached-1',
      patientId: 'p1',
      question: 'what is my medication',
      answer: 'One red pill after breakfast.',
      grounded: true,
      modelUsed: 'groq/llama-3.1-8b-instant',
      createdAt: new Date().toISOString(),
    });

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/ai/transcribe')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ text: 'what is my medication' }) });
      }
      throw new Error('should not call /api/ai/complete on a cache hit');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    const micButton = screen.getByRole('button', { name: /ask/i });
    fireEvent.click(micButton);
    await screen.findByRole('button', { name: /stop/i });
    fireEvent.click(micButton);

    expect(await screen.findByText('One red pill after breakfast.')).toBeInTheDocument();
    expect(screen.getByText(/from earlier/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/ai/complete'), expect.anything());
  });

  it('reaches the fallback phase, never stays stuck in "thinking", when browser dictation throws synchronously (SpeechRecognition.start() failure)', async () => {
    // Forces the network path to fall through so acquireTranscript reaches
    // its SpeechRecognition fallback, then makes that constructor throw —
    // the one failure mode neither acquireTranscript's nor handleTranscript's
    // own try/catch can see, since it happens inside a Promise executor.
    installMediaRecorder();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    vi.stubGlobal(
      'SpeechRecognition',
      class {
        constructor() {
          throw new Error('SpeechRecognition.start() failed');
        }
      },
    );

    const { default: CompanionPage } = await import('@/app/companion/page');
    render(<CompanionPage />);

    const micButton = screen.getByRole('button', { name: /ask/i });
    fireEvent.click(micButton);
    await screen.findByRole('button', { name: /stop/i });
    fireEvent.click(micButton);

    expect(
      await screen.findByText(/can't check that right now|try again in a moment/i),
    ).toBeInTheDocument();
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

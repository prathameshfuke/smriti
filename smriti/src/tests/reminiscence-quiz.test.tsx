import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// The param's type is what keeps later .mockImplementation((table: string) => ...)
// calls in this file type-checking against the same shape.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const serviceFromMock = vi.fn((_table: string) => makeChain({ data: [], error: null }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const callerFromMock = vi.fn((_table: string) => makeChain({ data: [], error: null }));
const getUser = vi.fn();

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'upsert', 'update']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return chain;
}

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createServerClient: () => ({ auth: { getUser }, from: callerFromMock }),
  createServiceRoleClient: () => ({ from: serviceFromMock }),
}));

vi.mock('@/lib/ai/llm-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/llm-client')>();
  return { ...actual, callLLM: vi.fn() };
});

vi.mock('@/lib/audio/speech', () => ({ speak: vi.fn(), GAME_SPEECH_RATE: 0.9 }));
vi.mock('@/lib/i18n/provider', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
    language: 'en' as const,
  }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/games/reminiscence-quiz',
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => QUIZ_UI_EN[key as keyof typeof QUIZ_UI_EN] ?? key,
  useLocale: () => 'en',
  NextIntlClientProvider: ({ children }: { children: ReactNode }) => children,
}));

const QUIZ_UI_EN = {
  correct: 'Correct!',
  tryTogether: "Let's remember together.",
  next: 'Next',
  finish: 'Finish',
  backHome: 'Back to Home',
};

const PERSON_ENTRIES = [
  { title: 'Raju', detail: 'Your son, visits on Sundays', relationship: 'son', category: 'person' },
  { title: 'Meena', detail: 'Your daughter, lives in Guwahati', relationship: 'daughter', category: 'person' },
  { title: 'Wedding day', detail: 'You got married in 1968 in Tezpur', relationship: null, category: 'life_fact' },
];

function validQuizJson() {
  return JSON.stringify([
    { question: 'Who visits on Sundays?', options: ['Raju', 'Meena', 'Wedding day'], correctIndex: 0, entryTitle: 'Raju' },
    { question: 'Who lives in Guwahati?', options: ['Wedding day', 'Meena', 'Raju'], correctIndex: 1, entryTitle: 'Meena' },
    { question: 'Where did you marry?', options: ['Tezpur', 'Guwahati', 'Sunday'], correctIndex: 0, entryTitle: 'Wedding day' },
    { question: 'What is Raju to you?', options: ['Son', 'Daughter', 'Friend'], correctIndex: 0, entryTitle: 'Raju' },
    { question: 'What is Meena to you?', options: ['Son', 'Daughter', 'Neighbor'], correctIndex: 1, entryTitle: 'Meena' },
  ]);
}

function makeAuthedRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/ai/generate-reminiscence-quiz', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  getUser.mockReset();
  serviceFromMock.mockReset();
  callerFromMock.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  callerFromMock.mockImplementation((table: string) => {
    if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
    if (table === 'patients') return makeChain({ data: { id: 'p1' }, error: null });
    return makeChain({ data: [], error: null });
  });
  serviceFromMock.mockImplementation(() => makeChain({ data: [], error: null }));
  const { callLLM } = await import('@/lib/ai/llm-client');
  vi.mocked(callLLM).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// validateQuizQuestions (pure)
// ---------------------------------------------------------------------------
describe('validateQuizQuestions', () => {
  it('accepts a well-formed 5-question response', async () => {
    const { validateQuizQuestions } = await import('@/lib/ai/reminiscence-quiz');
    const result = validateQuizQuestions(validQuizJson(), PERSON_ENTRIES.map((e) => e.title));
    expect(result).not.toBeNull();
    expect(result).toHaveLength(5);
    expect(result?.[0].entryTitle).toBe('Raju');
  });

  it('rejects a response with the wrong number of questions', async () => {
    const { validateQuizQuestions } = await import('@/lib/ai/reminiscence-quiz');
    const short = JSON.stringify(JSON.parse(validQuizJson()).slice(0, 3));
    expect(validateQuizQuestions(short, PERSON_ENTRIES.map((e) => e.title))).toBeNull();
  });

  it('rejects a correctIndex out of range', async () => {
    const { validateQuizQuestions } = await import('@/lib/ai/reminiscence-quiz');
    const bad = JSON.parse(validQuizJson());
    bad[0].correctIndex = 3;
    expect(validateQuizQuestions(JSON.stringify(bad), PERSON_ENTRIES.map((e) => e.title))).toBeNull();
  });

  it('rejects an entryTitle that does not match a real entry', async () => {
    const { validateQuizQuestions } = await import('@/lib/ai/reminiscence-quiz');
    const bad = JSON.parse(validQuizJson());
    bad[0].entryTitle = 'Someone Invented';
    expect(validateQuizQuestions(JSON.stringify(bad), PERSON_ENTRIES.map((e) => e.title))).toBeNull();
  });

  it('rejects invalid JSON without throwing', async () => {
    const { validateQuizQuestions } = await import('@/lib/ai/reminiscence-quiz');
    expect(validateQuizQuestions('not json at all', PERSON_ENTRIES.map((e) => e.title))).toBeNull();
  });

  it('tolerates a markdown code fence around the JSON', async () => {
    const { validateQuizQuestions } = await import('@/lib/ai/reminiscence-quiz');
    const fenced = '```json\n' + validQuizJson() + '\n```';
    expect(validateQuizQuestions(fenced, PERSON_ENTRIES.map((e) => e.title))).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// POST /api/ai/generate-reminiscence-quiz
// ---------------------------------------------------------------------------
describe('POST /api/ai/generate-reminiscence-quiz', () => {
  it('produces exactly 5 valid questions and stores them', async () => {
    const factsChain = makeChain({ data: PERSON_ENTRIES, error: null });
    const quizChain = makeChain({ data: null, error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === 'memory_bank_entries') return factsChain;
      if (table === 'reminiscence_quizzes') return quizChain;
      return makeChain({ data: [], error: null });
    });
    const { callLLM } = await import('@/lib/ai/llm-client');
    vi.mocked(callLLM).mockResolvedValue({ text: validQuizJson(), model: 'groq/llama-3.1-8b-instant', grounded: true });

    const { POST } = await import('@/app/api/ai/generate-reminiscence-quiz/route');
    const res = await POST(makeAuthedRequest({ patientId: 'p1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toHaveLength(5);
    expect(quizChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ patient_id: 'p1' }),
      expect.anything(),
    );
  });

  it('refuses with an explanation when Memory Bank has fewer than 3 person/life_fact entries, without calling the LLM', async () => {
    serviceFromMock.mockImplementation((table: string) =>
      table === 'memory_bank_entries' ? makeChain({ data: PERSON_ENTRIES.slice(0, 2), error: null }) : makeChain({ data: [], error: null }),
    );
    const { callLLM } = await import('@/lib/ai/llm-client');

    const { POST } = await import('@/app/api/ai/generate-reminiscence-quiz/route');
    const res = await POST(makeAuthedRequest({ patientId: 'p1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('not_enough_facts');
    expect(body.needed).toBe(3);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('does not crash and does not overwrite the existing cached quiz on malformed LLM output', async () => {
    const factsChain = makeChain({ data: PERSON_ENTRIES, error: null });
    const quizChain = makeChain({ data: null, error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === 'memory_bank_entries') return factsChain;
      if (table === 'reminiscence_quizzes') return quizChain;
      return makeChain({ data: [], error: null });
    });
    const { callLLM } = await import('@/lib/ai/llm-client');
    vi.mocked(callLLM).mockResolvedValue({ text: 'not valid json {{{', model: 'groq/llama-3.1-8b-instant', grounded: true });

    const { POST } = await import('@/app/api/ai/generate-reminiscence-quiz/route');
    const res = await POST(makeAuthedRequest({ patientId: 'p1' }));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('invalid_quiz_generated');
    expect(quizChain.upsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// reminiscence-quiz/GameComponent.tsx
// ---------------------------------------------------------------------------
const sampleQuiz = {
  id: 'quiz-1',
  patientId: 'p1',
  questions: [
    { question: 'Who visits on Sundays?', options: ['Raju', 'Meena', 'Wedding day'], correctIndex: 0, entryTitle: 'Raju' },
    { question: 'Who lives in Guwahati?', options: ['Wedding day', 'Meena', 'Raju'], correctIndex: 1, entryTitle: 'Meena' },
    { question: 'Where did you marry?', options: ['Tezpur', 'Guwahati', 'Sunday'], correctIndex: 0, entryTitle: 'Wedding day' },
    { question: 'What is Raju to you?', options: ['Son', 'Daughter', 'Friend'], correctIndex: 0, entryTitle: 'Raju' },
    { question: 'What is Meena to you?', options: ['Son', 'Daughter', 'Neighbor'], correctIndex: 1, entryTitle: 'Meena' },
  ],
  generatedAt: new Date().toISOString(),
};

describe('reminiscence-quiz GameComponent', () => {
  it('renders the first question, its 3 options, and a photo when the entry has one', async () => {
    const { default: GameComponent } = await import('@/components/games/reminiscence-quiz/GameComponent');
    render(
      <GameComponent
        quiz={sampleQuiz}
        entryPhotos={{ Raju: 'data:image/png;base64,abc', Meena: null, 'Wedding day': null }}
        onComplete={vi.fn()}
        onGoHome={vi.fn()}
      />,
    );

    expect(screen.getByText('Who visits on Sundays?')).toBeInTheDocument();
    expect(screen.getByText('Raju')).toBeInTheDocument();
    expect(screen.getByText('Meena')).toBeInTheDocument();
    expect(screen.getByText('Wedding day')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,abc');
  });

  it('never shows negative/wrong language on a miss and still awards at least 1 star for an all-wrong run', async () => {
    const onComplete = vi.fn();
    const { default: GameComponent } = await import('@/components/games/reminiscence-quiz/GameComponent');
    render(
      <GameComponent quiz={sampleQuiz} entryPhotos={{}} onComplete={onComplete} onGoHome={vi.fn()} />,
    );

    for (const q of sampleQuiz.questions) {
      const wrongIndex = (q.correctIndex + 1) % 3;
      fireEvent.click(screen.getByText(q.options[wrongIndex]));
      const bodyText = document.body.textContent ?? '';
      expect(bodyText).not.toMatch(/\b(wrong|incorrect|failed|mistake)\b/i);
      const advance = screen.queryByRole('button', { name: /next|finish/i });
      if (advance) fireEvent.click(advance);
    }

    expect(onComplete).toHaveBeenCalledWith(0);
    expect(screen.getByRole('img', { name: 'game.starsLabel:1' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// reminiscence-quiz/page.tsx — offline play from the Dexie cache
// ---------------------------------------------------------------------------
describe('ReminiscenceQuizPage', () => {
  it('plays fully from the cached Dexie quiz with no network call', async () => {
    const { db } = await import('@/lib/db/schema');
    const { usePatientStore } = await import('@/stores/patientStore');
    await db.reminiscenceQuizzes.clear();
    await db.reminiscenceQuizzes.put(sampleQuiz);
    usePatientStore.setState({
      currentPatient: {
        id: 'p1',
        caregiverId: 'c1',
        displayName: 'Aai',
        ageYears: 72,
        gender: 'female',
        educationYears: 4,
        primaryLanguage: 'en',
        sessionDurationMinutes: 10,
        isActive: true,
        currentDifficulty: {},
        updatedAt: new Date().toISOString(),
        syncedAt: null,
      },
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { default: ReminiscenceQuizPage } = await import('@/app/games/reminiscence-quiz/page');
    render(<ReminiscenceQuizPage />);

    expect(await screen.findByText('Who visits on Sundays?')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    usePatientStore.setState(usePatientStore.getInitialState(), true);
    vi.unstubAllGlobals();
  });
});


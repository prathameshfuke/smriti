import { describe, it, expect, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LocalMemoryBankEntry } from '@/lib/db/schema';

vi.mock('@/lib/audio/speech', () => ({ speak: vi.fn() }));
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

function memoryEntry(
  id: string,
  title: string,
  detail: string,
  category: LocalMemoryBankEntry['category'],
  relationship: string | null = null,
): LocalMemoryBankEntry {
  return {
    id,
    patientId: 'p1',
    category,
    title,
    detail,
    photoUrl: null,
    relationship,
    active: true,
    createdBy: 'c1',
    updatedAt: '2026-09-01T00:00:00.000Z',
    synced: true,
  };
}

const MEMORY_ENTRIES: LocalMemoryBankEntry[] = [
  memoryEntry('e1', 'Raju', 'Your son, visits on Sundays', 'person', 'son'),
  memoryEntry('e2', 'Meena', 'Your daughter, lives in Guwahati', 'person', 'daughter'),
  memoryEntry('e3', 'Wedding day', 'You got married in 1968 in Tezpur', 'life_fact'),
];

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
  const patientRow = {
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

  afterEach(async () => {
    const { usePatientStore } = await import('@/stores/patientStore');
    usePatientStore.setState(usePatientStore.getInitialState(), true);
    vi.unstubAllGlobals();
  });

  it('builds the quiz from the Memory Bank on the phone and plays it with no network call', async () => {
    const { db } = await import('@/lib/db/schema');
    const { usePatientStore } = await import('@/stores/patientStore');
    await db.memoryBankEntries.clear();
    await db.memoryBankEntries.bulkPut(MEMORY_ENTRIES);
    usePatientStore.setState({ currentPatient: patientRow });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { default: ReminiscenceQuizPage } = await import('@/app/games/reminiscence-quiz/page');
    render(<ReminiscenceQuizPage />);

    // Every option on screen is a Memory Bank title.
    const options = await screen.findAllByRole('button', { name: /^(Raju|Meena|Wedding day)$/ });
    expect(options).toHaveLength(3);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('explains what is needed instead of showing a blank screen when the Memory Bank is too small', async () => {
    const { db } = await import('@/lib/db/schema');
    const { usePatientStore } = await import('@/stores/patientStore');
    await db.memoryBankEntries.clear();
    await db.memoryBankEntries.put(MEMORY_ENTRIES[0]);
    usePatientStore.setState({ currentPatient: patientRow });

    const { default: ReminiscenceQuizPage } = await import('@/app/games/reminiscence-quiz/page');
    render(<ReminiscenceQuizPage />);

    expect(await screen.findByText('game.reminiscenceQuiz.noQuiz')).toBeInTheDocument();
  });

  it('never renders blank when no patient is selected', async () => {
    const { default: ReminiscenceQuizPage } = await import('@/app/games/reminiscence-quiz/page');
    render(<ReminiscenceQuizPage />);
    expect(await screen.findByText('game.reminiscenceQuiz.noQuiz')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// lib/games/memory-quiz.ts
// ---------------------------------------------------------------------------
describe('buildMemoryQuiz', () => {
  const wording = {
    whoIsThis: () => 'Who is this?',
    whoIsYour: (relationship: string) => `Who is your ${relationship}?`,
    whichIsAbout: (detail: string) => `Which is about: ${detail}`,
  };

  function seeded(seed = 1) {
    let x = seed;
    return () => {
      x = (x * 16807) % 2147483647;
      return (x - 1) / 2147483646;
    };
  }

  it('uses only Memory Bank titles as answers, with the correct one always among the options', async () => {
    const { buildMemoryQuiz } = await import('@/lib/games/memory-quiz');
    const quiz = buildMemoryQuiz('p1', MEMORY_ENTRIES, wording, seeded(7));
    const titles = MEMORY_ENTRIES.map((e) => e.title);
    expect(quiz).not.toBeNull();
    for (const q of quiz!.questions) {
      expect(q.options).toHaveLength(3);
      expect(new Set(q.options).size).toBe(3);
      q.options.forEach((o) => expect(titles).toContain(o));
      expect(q.options[q.correctIndex]).toBe(q.entryTitle);
    }
  });

  it('asks about each entry at most once and never more than 5 questions', async () => {
    const { buildMemoryQuiz } = await import('@/lib/games/memory-quiz');
    const many = Array.from({ length: 12 }, (_, i) => memoryEntry(`e${i}`, `Place ${i}`, `Detail number ${i}`, 'life_fact'));
    const quiz = buildMemoryQuiz('p1', many, wording, seeded(3))!;
    expect(quiz.questions).toHaveLength(5);
    expect(new Set(quiz.questions.map((q) => q.entryTitle)).size).toBe(5);
  });

  it('shows a photo only when the question is "who is this", so the photo never gives an answer away', async () => {
    const { buildMemoryQuiz } = await import('@/lib/games/memory-quiz');
    const people = [
      { ...memoryEntry('a', 'Raju', 'Visits on Sundays', 'person', 'son'), photoUrl: 'data:image/png;base64,a' },
      memoryEntry('b', 'Meena', 'Lives in Guwahati', 'person', 'daughter'),
      memoryEntry('c', 'Hari', 'Lives next door', 'person', 'neighbour'),
    ];
    const quiz = buildMemoryQuiz('p1', people, wording, seeded(11))!;
    const raju = quiz.questions.find((q) => q.entryTitle === 'Raju')!;
    expect(raju).toMatchObject({ question: 'Who is this?', showPhoto: true });
    quiz.questions.filter((q) => q.entryTitle !== 'Raju').forEach((q) => expect(q.showPhoto).toBe(false));
  });

  it('never offers another person with the same relationship as a wrong answer', async () => {
    const { buildMemoryQuiz } = await import('@/lib/games/memory-quiz');
    const entries = [
      memoryEntry('a', 'Raju', '', 'person', 'son'),
      memoryEntry('b', 'Ravi', '', 'person', 'son'),
      memoryEntry('c', 'Meena', '', 'person', 'daughter'),
      memoryEntry('d', 'Home', 'Jorhat', 'life_fact'),
    ];
    for (let seed = 1; seed < 20; seed++) {
      const quiz = buildMemoryQuiz('p1', entries, wording, seeded(seed))!;
      for (const q of quiz.questions.filter((x) => x.question === 'Who is your son?')) {
        const sons = q.options.filter((o) => o === 'Raju' || o === 'Ravi');
        expect(sons).toHaveLength(1);
      }
    }
  });

  it('returns null with fewer than 3 entries, ignoring removed ones', async () => {
    const { buildMemoryQuiz } = await import('@/lib/games/memory-quiz');
    const entries = [
      memoryEntry('a', 'Raju', 'x', 'person'),
      memoryEntry('b', 'Meena', 'y', 'person'),
      { ...memoryEntry('c', 'Hari', 'z', 'person'), active: false },
    ];
    expect(buildMemoryQuiz('p1', entries, wording)).toBeNull();
  });
});

import type { LocalMemoryBankEntry, LocalReminiscenceQuiz, ReminiscenceQuizQuestion } from '@/lib/db/schema';

/**
 * Builds the Family & Life quiz on the phone, from the patient's own Memory
 * Bank and nothing else, every time it is played.
 *
 * This replaced an AI-generated quiz the caregiver had to "refresh" from the
 * dashboard. That quiz was only ever saved on the server; nothing copied it
 * to the patient's phone, so the game always opened empty. Building it here
 * needs no network, no AI provider, stays in step with every Memory Bank
 * edit, and can't invent a question about something the caregiver never
 * wrote down.
 */

/** Fewer entries than this can't give each question two different wrong answers. */
export const MIN_QUIZ_ENTRIES = 3;
export const MAX_QUIZ_QUESTIONS = 5;
const OPTION_COUNT = 3;

/** Question wording, supplied by the caller in the patient's language. */
export interface QuizWording {
  /** A person's photo is shown; the answer is their name. */
  whoIsThis: () => string;
  /** e.g. "Who is your son?" — `relationship` exactly as the caregiver wrote it. */
  whoIsYour: (relationship: string) => string;
  /** The detail is shown; the answer is the entry it belongs to. */
  whichIsAbout: (detail: string) => string;
}

type Random = () => number;

function shuffle<T>(items: T[], random: Random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const clean = (s: string | null | undefined) => (s ?? '').trim();
const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** Entries that can be asked about: active, titled, one per title (a repeated title would make two options identical). */
function usableEntries(entries: LocalMemoryBankEntry[]): LocalMemoryBankEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const title = clean(e.title);
    const key = title.toLocaleLowerCase();
    if (!e.active || !title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Two wrong answers for `subject`, preferring entries of the same kind (a
 * person's name among names, not among "Wedding day"), and skipping any that
 * would also be a correct answer (another person with the same relationship).
 */
function distractors(
  subject: LocalMemoryBankEntry,
  pool: LocalMemoryBankEntry[],
  random: Random,
  alsoCorrect: (e: LocalMemoryBankEntry) => boolean = () => false,
): string[] | null {
  const others = pool.filter((e) => e.id !== subject.id && !alsoCorrect(e));
  const sameKind = shuffle(others.filter((e) => e.category === subject.category), random);
  const otherKind = shuffle(others.filter((e) => e.category !== subject.category), random);
  const picked = [...sameKind, ...otherKind].slice(0, OPTION_COUNT - 1).map((e) => clean(e.title));
  return picked.length === OPTION_COUNT - 1 ? picked : null;
}

function question(
  text: string,
  subject: LocalMemoryBankEntry,
  wrong: string[],
  random: Random,
  showPhoto: boolean,
): ReminiscenceQuizQuestion {
  const answer = clean(subject.title);
  const options = shuffle([answer, ...wrong], random);
  return { question: text, options, correctIndex: options.indexOf(answer), entryTitle: answer, showPhoto };
}

/**
 * Returns a quiz of up to 5 questions, or null when the Memory Bank has fewer
 * than 3 usable entries. Each entry is asked about at most once. For each
 * entry the most personal question available is used: a person's photo,
 * then their relationship, then the detail the caregiver wrote.
 */
export function buildMemoryQuiz(
  patientId: string,
  entries: LocalMemoryBankEntry[],
  wording: QuizWording,
  random: Random = Math.random,
): LocalReminiscenceQuiz | null {
  const pool = usableEntries(entries);
  if (pool.length < MIN_QUIZ_ENTRIES) return null;

  const questions: ReminiscenceQuizQuestion[] = [];
  for (const subject of shuffle(pool, random)) {
    if (questions.length >= MAX_QUIZ_QUESTIONS) break;
    const relationship = clean(subject.relationship);
    const detail = clean(subject.detail);
    const people = pool.filter((e) => e.category === 'person');

    if (subject.category === 'person' && subject.photoUrl && people.length >= OPTION_COUNT) {
      const wrong = distractors(subject, people, random);
      if (wrong) {
        questions.push(question(wording.whoIsThis(), subject, wrong, random, true));
        continue;
      }
    }
    if (subject.category === 'person' && relationship) {
      const wrong = distractors(subject, pool, random, (e) => same(clean(e.relationship), relationship));
      if (wrong) {
        questions.push(question(wording.whoIsYour(relationship), subject, wrong, random, false));
        continue;
      }
    }
    if (detail) {
      // A detail that names its own title gives the answer away.
      if (detail.toLocaleLowerCase().includes(clean(subject.title).toLocaleLowerCase())) continue;
      const wrong = distractors(subject, pool, random);
      if (wrong) questions.push(question(wording.whichIsAbout(detail), subject, wrong, random, false));
    }
  }

  if (questions.length === 0) return null;
  return {
    id: `memory-quiz-${patientId}`,
    patientId,
    questions,
    generatedAt: new Date().toISOString(),
  };
}

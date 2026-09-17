/**
 * Retrieval for Ask Smriti: picks which of a patient's Memory Bank entries a
 * question is about. Pure, so the same ranking
 * runs on the server before the LLM call and on the phone to answer offline.
 *
 * Lexical on purpose. Memory Banks are small (tens of entries), written by
 * one caregiver, and full of names — exact and prefix word matches, weighted
 * by where they occur, plus a nudge from the kind of question ("who" → a
 * person, "medicine" → medication) find the right entry without an embedding
 * service that would be one more place patient data is sent.
 */

export type CompanionFactKind = 'person' | 'schedule' | 'life_fact' | 'medication';

export interface CompanionFact {
  id: string;
  kind: CompanionFactKind;
  title: string;
  detail: string;
  relationship: string | null;
}

export interface RankedFact {
  fact: CompanionFact;
  score: number;
}

/** Most facts sent to the model for one question — also stated in the privacy notice. */
export const MAX_FACTS_PER_QUESTION = 12;

/** A match this strong is a confident enough hit to read the entry back offline. */
export const LOCAL_ANSWER_MIN_SCORE = 3;

const STOPWORDS = new Set([
  // English
  'the', 'a', 'an', 'is', 'was', 'are', 'were', 'and', 'or', 'to', 'of', 'in', 'on', 'at', 'for', 'with',
  'your', 'you', 'he', 'she', 'they', 'it', 'his', 'her', 'their', 'this', 'that', 'not', 'sure', 'about',
  'ask', 'my', 'me', 'we', 'us', 'do', 'does', 'did', 'can', 'could', 'will', 'what', 'whats', 'who', 'whos',
  'where', 'when', 'which', 'how', 'why', 'have', 'has', 'had', 'there', 'please', 'tell', 'know', 'from',
  'our', 'am', 'be', 'been', 'any', 'some',
  // Romanised Hindi
  'ke', 'ki', 'ka', 'hai', 'aur', 'se', 'ko', 'ek', 'mera', 'meri', 'mere', 'kya', 'kaun', 'kab', 'kahan',
  // Hindi / Nepali (Devanagari)
  'है', 'और', 'का', 'की', 'के', 'को', 'से', 'में', 'मेरा', 'मेरी', 'मेरे', 'क्या', 'कौन', 'कब', 'कहाँ', 'कहां', 'मेरो', 'छ',
  // Assamese / Bengali
  'মোৰ', 'আমাৰ', 'কি', 'কোন', 'কেতিয়া', 'ক’ত', 'আমার', 'কী', 'কখন', 'কোথায়', 'আছে', 'হয়',
]);

/** Lowercased significant words in any script. Latin words need 3+ letters; other scripts carry more per letter. */
export function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((w) => {
      if (!w || STOPWORDS.has(w)) return false;
      return /^[a-z0-9]+$/.test(w) ? w.length > 2 : w.length > 1;
    });
}

/** Question words that say which kind of fact is wanted, checked on the English form of the question. */
const INTENT_HINTS: Array<{ pattern: RegExp; kinds: CompanionFactKind[] }> = [
  { pattern: /\b(who|name|son|daughter|wife|husband|brother|sister|grand\w*|friend|neighbou?r|family|visit\w*)\b/i, kinds: ['person'] },
  { pattern: /\b(medicine|medication|tablet|pill|dose|drug|insulin|capsule)s?\b/i, kinds: ['medication'] },
  { pattern: /\b(when|time|today|tomorrow|appointment|doctor|clinic|hospital|schedule|routine|morning|evening|night)\b/i, kinds: ['schedule'] },
  { pattern: /\b(where|live|home|born|village|town|house|work\w*|job|school|married)\b/i, kinds: ['life_fact'] },
];

function intentKinds(questions: string[]): Set<CompanionFactKind> {
  const kinds = new Set<CompanionFactKind>();
  for (const q of questions) {
    for (const hint of INTENT_HINTS) {
      if (hint.pattern.test(q)) hint.kinds.forEach((k) => kinds.add(k));
    }
  }
  return kinds;
}

function wordsMatch(query: string, target: string): boolean {
  if (query === target) return true;
  // Inflections: "grandson"/"grandsons", "doctor"/"doctor's" (after split), "पोता"/"पोते".
  const shorter = query.length <= target.length ? query : target;
  const longer = shorter === query ? target : query;
  return shorter.length >= 4 && longer.startsWith(shorter.slice(0, Math.max(4, shorter.length - 1)));
}

function fieldScore(queryWords: string[], fieldWords: string[], weight: number): number {
  let score = 0;
  for (const q of queryWords) {
    if (fieldWords.some((f) => wordsMatch(q, f))) score += weight;
  }
  return score;
}

/**
 * Scores every fact against the question in all the forms given (the
 * patient's own words and, when translated, English) and returns them best
 * first. Title matches count most, then relationship, then detail; a fact of
 * the kind the question asks for gets a small boost so "who is Raju" beats
 * an entry that mentions Raju in passing.
 */
export function rankFacts(questions: string[], facts: CompanionFact[]): RankedFact[] {
  const queryWords = [...new Set(questions.flatMap(significantWords))];
  const wanted = intentKinds(questions);

  return facts
    .map((fact, index) => {
      let score =
        fieldScore(queryWords, significantWords(fact.title), 3) +
        fieldScore(queryWords, significantWords(fact.relationship ?? ''), 2) +
        fieldScore(queryWords, significantWords(fact.detail), 1);
      if (score > 0 && wanted.has(fact.kind)) score += 1;
      return { fact, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ fact, score }) => ({ fact, score }));
}

/**
 * The facts to put in front of the model: the best matches, capped at
 * MAX_FACTS_PER_QUESTION. When nothing matches by word (a question phrased
 * very differently from how the caregiver wrote the entry, or across
 * scripts), facts of the kind asked about come first, then the rest, still
 * capped — the model then decides, and says it is not sure when none fit.
 */
export function selectFactsForPrompt(questions: string[], facts: CompanionFact[]): CompanionFact[] {
  const ranked = rankFacts(questions, facts);
  // A Memory Bank small enough to send whole goes whole, best matches first:
  // the model reads every script, where word matching can't cross from an
  // Assamese question to an English entry.
  if (facts.length <= MAX_FACTS_PER_QUESTION) return ranked.map((r) => r.fact);
  const matched = ranked.filter((r) => r.score > 0);
  if (matched.length > 0) {
    // Every match plus a few unmatched entries of context, when there is room:
    // "where does my grandson study" may need an entry that never says "grandson".
    return ranked.slice(0, Math.min(MAX_FACTS_PER_QUESTION, matched.length + 3)).map((r) => r.fact);
  }
  const wanted = intentKinds(questions);
  const byKind = [...facts].sort((a, b) => Number(wanted.has(b.kind)) - Number(wanted.has(a.kind)));
  return byKind.slice(0, MAX_FACTS_PER_QUESTION);
}

/** Plain one-line form of a fact, used in the prompt and read back offline. */
export function describeFact(fact: CompanionFact): string {
  const title = fact.relationship ? `${fact.title} (${fact.relationship})` : fact.title;
  return fact.detail ? `${title}: ${fact.detail}` : title;
}

/**
 * Offline answer: the single best-matching entry, read back as the caregiver
 * wrote it, only when the match is strong and clearly ahead of the runner-up.
 * Anything less returns null and the phone says it can't check right now —
 * a wrong entry read confidently to a person with memory loss is worse than
 * no answer.
 */
export function bestLocalFact(question: string, facts: CompanionFact[]): CompanionFact | null {
  const [best, second] = rankFacts([question], facts);
  if (!best || best.score < LOCAL_ANSWER_MIN_SCORE) return null;
  if (second && second.score === best.score) return null;
  return best.fact;
}

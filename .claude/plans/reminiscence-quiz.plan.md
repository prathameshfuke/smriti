# Plan: Reminiscence Quiz (AI-Generated, from Memory Bank)

**Source**: free-form spec (not a `.prd.md`)
**Complexity**: Large (1 new Supabase table + Dexie mirror, 1 new API route, 1 new game page + component, i18n messages, 3 tile-array integrations)

## Summary

Adds a 5-question multiple-choice quiz generated once (server-side, cached) from a patient's
own Memory Bank `person`/`life_fact` entries, played offline afterward like any other game.
A caregiver-triggered "Refresh Quiz" regenerates it; malformed LLM output never overwrites a
previously-good cached quiz.

## Requirements Correction (read this first)

The spec calls this "a 6th game type" using "the same GameWrapper... pattern as the existing
5 games." Neither is accurate against the current repo:

- **13 games already exist**, not 5: `object_hunt, word_stream, quick_tap, path_match` (the
  original 4, hand-built) plus `memory_match, memory_blocks, frog_leap, counting_boxes, n_back,
  larger_number, memory_span, fish_trace, double_decision` (9 more, added since). This is the
  **14th** `GameType`.
- **No component named `GameWrapper` exists anywhere** (`grep -rl GameWrapper src` — zero hits).
  The real shared pattern across the 9 newer games is: a thin `page.tsx` (`ErrorBoundary` →
  `PatientNav` → session lifecycle → `NextIntlClientProvider` with a per-game `messages.ts`) that
  renders a per-game `GameComponent.tsx`, which itself renders the shared
  `src/components/games/SessionComplete.tsx` at the end (stars, encouragement copy, "Back to
  Home"). This plan mirrors that — the majority convention (9/13 games), not the older 4-game
  style — since the spec's own "GameWrapper" framing points at *a* shared pattern, just not one
  that exists under that name.

Neither correction changes what's being built, only which existing code it should mirror.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Page/component split | `src/app/games/counting-boxes/page.tsx` + `src/components/games/counting-boxes/GameComponent.tsx` | thin page (session lifecycle, difficulty, telemetry) around a dumb `GameComponent` that calls `onComplete(accuracyPct, roundsPlayed)` |
| Star scoring | `src/lib/engine/scoring.ts` `starsFromRate()` | `Math.max(1, ...)` — never rounds to 0 stars. Reused directly, not reimplemented — this *is* the "always at least 1 star" rule |
| Session-end screen | `src/components/games/SessionComplete.tsx` | shared component, `ENCOURAGEMENT` copy has no fail/error vocabulary at any star count — reused as-is |
| i18n | `src/components/games/counting-boxes/messages.ts` + `NextIntlClientProvider` | per-game message dictionary keyed by language, matching the 9-game convention (not the older `useTranslation()` hook) |
| API route auth | `src/app/api/patients/[id]/timeline/route.ts` | `authenticateRequest` → caregiver lookup → ownership check |
| LLM call | `src/lib/ai/llm-client.ts` `callLLM()` | single entry point; this route is the first caller that needs *structured* (JSON) output, not prose |
| Dexie table addition | `src/lib/db/schema.ts` `memoryBankEntries`/`aiConversationLog` (added this session to the same `version(1).stores()` call) | additive table in the existing version — no installs outside this dev machine yet, so no migration path needed |

## Gaps / Decisions Before Coding

1. **Quiz JSON needs one more field than the spec's literal shape.** Spec's schema is
   `{question, options: [3], correctIndex}`. But spec Part 1 step 3 requires validating that
   "question references a real entry," and Part 2 requires showing "a large photo... when the
   question references a person entry with a photo_url" — neither is possible without knowing
   *which* entry a question is about. The system prompt instructs the model to also emit
   `entryTitle` (must exactly match one of the fed-in facts' `title` verbatim), and validation
   checks that match. The UI looks up `photo_url` by that title at render time, not by an id
   (simpler than round-tripping a UUID through the model).
2. **"Nightly if online" is out of scope.** Nothing in this codebase runs on a schedule — no
   cron, no Vercel Cron config, no background job runner. Building one is a much bigger,
   separate piece of infrastructure than this feature warrants. Only the caregiver-triggered
   "Refresh Quiz" path ships; the button lives on the patient detail page
   (`caregiver/patients/[id]/page.tsx`), mirroring the existing "Memory Bank" link button there.
3. **The generation route is caregiver-authed only**, unlike `/api/ai/complete`'s dual path —
   only a caregiver ever triggers regeneration (there's no patient-facing "regenerate" control
   per the spec), so it's a single `authenticateRequest` + ownership check, no device-trust
   branch.
4. **No difficulty progression for this game.** A fixed 5-question quiz sourced from whatever
   Memory Bank facts exist has no meaningful "harder" tier the way object-hunt's tile count or
   n-back's n does. `MAX_LEVEL.reminiscence_quiz = 1`, no `adjustDifficulty` call, tile always
   shows 1 filled dot. This is a real narrowing of "same telemetry/scoring/offline pattern as
   the existing games" — flagging it since difficulty-leveling is part of that pattern for every
   other game.
5. **Quiz content stays English regardless of the patient's `primaryLanguage`.** The spec's
   generation prompt has no per-language instruction, and generating+validating in multiple
   languages is real added scope. `speak()` is called with `'en'` for the quiz's own generated
   text specifically (the static UI chrome around it still goes through the per-game
   `messages.ts`/i18n as normal) — same "fall back to a fixed language for AI content" precedent
   the companion feature already established.
6. **Telemetry logs once per completed quiz, not once per question** — mirrors
   `counting-boxes`'s single end-of-round `logEvent` (`roundNumber: 5, isCorrect: accuracyPct >=
   50, metadata: { accuracyPct }`), the simplest of the patterns already in the codebase, not the
   older per-attempt logging object-hunt uses.
7. **Dexie table added to the existing `version(1)` call**, not a new version — same precedent
   already used twice this session for `caregivers`/`memoryBankEntries`/`aiConversationLog`.
8. **Malformed-JSON handling is a full parse-and-shape validation, not just `JSON.parse` success.**
   Checks: response parses as JSON, is an array of exactly 5 items, each has a non-empty
   `question`, exactly 3 non-empty `options`, `correctIndex` is an integer 0-2, and `entryTitle`
   matches one of the fetched entries' titles. Any single item failing any check fails the whole
   batch (no partial quizzes) — on failure, log the raw response server-side for debugging and
   return an error; the existing cached quiz (if any) is never touched, i.e. the write to
   `reminiscence_quizzes` only happens after every check passes.

## Files to Change

| File | Action | Why |
|---|---|---|
| `smriti/docs/03_DATABASE.md` | UPDATE | Migration 006: `reminiscence_quizzes` table |
| `smriti/src/lib/supabase/types.ts` | UPDATE | `GameType` gains `'reminiscence_quiz'`; new `ReminiscenceQuiz` row type |
| `smriti/src/lib/db/schema.ts` | UPDATE | `LocalReminiscenceQuiz` interface + `reminiscenceQuizzes` table (offline mirror) |
| `smriti/src/lib/engine/difficulty.ts` | UPDATE | `MAX_LEVEL.reminiscence_quiz = 1` (TS forces this — `Record<GameType, number>`) |
| `smriti/src/app/api/ai/generate-reminiscence-quiz/route.ts` | CREATE | Fetch facts → under-3 check → `callLLM` → validate → store or preserve-existing |
| `smriti/src/components/games/reminiscence-quiz/GameComponent.tsx` | CREATE | Question/options/photo UI, ends in `SessionComplete` |
| `smriti/src/components/games/reminiscence-quiz/messages.ts` | CREATE | Static UI chrome strings, per-language (en/hi/as) |
| `smriti/src/app/games/reminiscence-quiz/page.tsx` | CREATE | Thin page: session lifecycle + loads the cached quiz from Dexie |
| `smriti/src/app/caregiver/patients/[id]/page.tsx` | UPDATE | "Refresh Quiz" button |
| `smriti/src/app/app/page.tsx` | UPDATE | 14th `GameTile` in the `GAMES` array |
| `smriti/src/app/page.tsx` (landing) | UPDATE | 14th entry in the game-showcase array, heading count 13→14 |
| `smriti/public/images/game-reminiscence-quiz.svg` | CREATE | Placeholder tile art, matching the existing per-game SVGs |
| `smriti/src/tests/reminiscence-quiz.test.tsx` | CREATE | RED-first, per the spec's own named file — covers both the route and the component |

## Tasks

### Task 1: Schema — Supabase migration + types + Dexie mirror + `MAX_LEVEL`
- **Action**: Migration 006 (`reminiscence_quizzes`: id, patient_id, questions jsonb, generated_at, RLS mirroring `memory_bank_entries`'s caregiver-ownership policy). Add `'reminiscence_quiz'` to `GameType`, add `ReminiscenceQuiz` row type to `supabase/types.ts`. Add `LocalReminiscenceQuiz` (`id, patientId, questions: QuizQuestion[], generatedAt`) to the Dexie `version(1).stores()` call. Add the forced `MAX_LEVEL` entry.
- **Mirror**: Migration 004/005 style; `memoryBankEntries`/`aiConversationLog` additive-table precedent.
- **Validate**: `npx tsc --noEmit` — every `Record<GameType, ...>` in the codebase (there are a few: `MAX_LEVEL`, dashboard/detail-page label maps) now must include the new key, which is exactly the point of using a `Record` — the compiler finds every spot that needs updating.

### Task 2: `POST /api/ai/generate-reminiscence-quiz`
- **Action**: Caregiver-authed (`authenticateRequest` → caregiver → ownership on `patientId` from the body). Fetch active `memory_bank_entries` where `category in ('person','life_fact')`. Fewer than 3 → return `{ error: 'not_enough_facts', needed: 3, have: N }` without calling the LLM. Otherwise build the system prompt (facts + the 5-question/3-option/`entryTitle` JSON instruction), call `callLLM`, `JSON.parse` the result (catch → treat as invalid), validate per Decision 8. Valid → upsert one row in `reminiscence_quizzes` for this patient (replacing any existing row), return the questions. Invalid → log the raw text server-side, return `{ error: 'invalid_quiz_generated' }`, existing row untouched.
- **Mirror**: `timeline/route.ts`'s auth block; `complete/route.ts`'s fact-fetch shape.
- **Validate**: tests — exactly 5 questions, each with 3 options and a valid `correctIndex`, `entryTitle` matching a real fetched entry; under-3-facts request never calls `callLLM` and returns the explanatory error; a mocked malformed LLM response (wrong array length, `correctIndex` out of range, missing field) does not write to `reminiscence_quizzes` and a subsequently-fetched "existing quiz" is unchanged.

### Task 3: `reminiscence-quiz/GameComponent.tsx`
- **Action**: Props `{ quiz: LocalReminiscenceQuiz; onComplete: (accuracyPct: number) => void }`. One question at a time; looks up the matching Memory Bank entry by `entryTitle` (passed in alongside the quiz, or fetched once via `db.memoryBankEntries`) and shows its `photoUrl` when present. 3 answer buttons, 64px+ (`TOUCH_TARGET_MIN_PX`). On a miss: no red/wrong styling or "incorrect" text — "Let's remember together" copy, then reveal the correct option, then continue. At the end: `SessionComplete` with `starsFromRate(correctCount / 5)`.
- **Mirror**: `counting-boxes/GameComponent.tsx`'s `onComplete` contract; `SessionComplete`'s existing no-fail-vocabulary convention (this game just needs the same discipline applied to the miss-feedback copy, which the other games don't have since they're speed/recall games without a "correct answer reveal" moment).
- **Validate**: tests — renders the question text, 3 options, and the photo when the resolved entry has a `photoUrl`; a wrong selection never renders "wrong"/"incorrect"/similar and reveals the right answer instead; completing with 0/5 correct still renders 1 star via `SessionComplete`.

### Task 4: `reminiscence-quiz/page.tsx` + `messages.ts`
- **Action**: On mount, load the cached quiz for `currentPatient.id` from `db.reminiscenceQuizzes` (not a network call — this is the offline-play path). No cached quiz → show a message pointing back to the caregiver ("ask your caregiver to set up the memory quiz") rather than a blank/broken game. `onComplete` wires `adjustDifficulty` is *not* called (Decision 4) — just `logEvent` (single event, Decision 6) and `buildDailySummary`.
- **Mirror**: `counting-boxes/page.tsx` structurally, minus the difficulty-adjustment call.
- **Validate**: tests — a seeded Dexie quiz renders playable; no cached quiz renders the caregiver-setup message instead of a broken game; completing the quiz calls `logEvent` once with the session's accuracy.

### Task 5: Caregiver "Refresh Quiz" button
- **Action**: Small button on `caregiver/patients/[id]/page.tsx` (near the existing "Memory Bank" link) that `authedFetch`-POSTs to the new route. Fewer-than-3-facts response renders a prompt to add people, linking to `/caregiver/memory-bank`, instead of a generic error.
- **Mirror**: the existing "Memory Bank" button's placement/styling on that page.
- **Validate**: test — clicking it posts to the route; the under-3-facts response renders the Memory Bank prompt, not a generic failure state.

### Task 6: Tile integration (patient home + landing page)
- **Action**: Add the `GameTile`/showcase entries per Files-to-Change, using the placeholder SVG, "Memory Match: Family & Life" label, "Reminiscence recall" clinical-basis line on the landing page.
- **Validate**: existing home-page and landing-page tests still pass; extend one assertion each for the new tile's presence.

## Validation

```bash
cd smriti
npx vitest run src/tests/reminiscence-quiz.test.tsx   # RED first, then GREEN
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| LLM invents an `entryTitle` that doesn't exactly match (casing/whitespace) a real fact's title | Medium | Validation normalizes both sides (trim/lowercase) before comparing, same normalization style as the companion's cache-matching |
| A caregiver refreshes the quiz while the patient is mid-quiz on the old one | Low | Out of scope — the running session already has its questions in local component state; only the *next* play picks up the refreshed Dexie row |
| `reminiscence_quizzes` upsert races with itself if "Refresh Quiz" is double-tapped | Low | Simple `upsert`/replace-by-`patient_id` write, not an insert — a duplicate is idempotent, not a duplicate row |

## Acceptance
- [ ] All 6 tasks complete, tests written before implementation per file
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass
- [ ] A malformed LLM response never overwrites a previously-valid cached quiz
- [ ] No miss-feedback copy anywhere uses fail/wrong/incorrect-style language; every completed quiz shows at least 1 star
- [ ] The quiz is playable with the network fully disconnected once a quiz has been generated once

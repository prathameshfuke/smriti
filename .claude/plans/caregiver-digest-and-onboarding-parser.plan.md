# Plan: Weekly Digest + Free-Form Onboarding Parser

**Source**: free-form spec (not a `.prd.md`)
**Complexity**: Large (2 new API routes, 1 new Supabase table + RLS, 1 shared prompt-safety
lib, 1 existing route extended, 2 UI surfaces)

## Summary

Part A: a weekly, plain-language, non-clinical activity summary generated from data already
collected (game scores, companion grounded-ratio, reminder adherence), with a forbidden-word
safety net (retry once, then a templated fallback) and a scroll-back history. Part B: a
free-text/voice "Quick add" on the Memory Bank editor that extracts candidate entries via the
LLM, shown on a review screen the caregiver must explicitly confirm before anything is written.

## Requirements Corrections

- **"All 6 games"** (Part A step 1) — the app now has **14** games as of this session (the
  reminiscence quiz was the 14th). The digest pulls `daily_summaries` across whatever
  `game_type`s actually have rows that week, not a hardcoded list.
- **"Matches existing `options_card_display` pattern"** — no such name exists anywhere in the
  codebase (`grep -rn "options_card"` — zero hits). Using the caregiver section's actual,
  repeated card convention instead: `rounded-card border border-gray-300 bg-white shadow-sm`
  with a colored top strip, the same shape used by the dashboard's stat cards and the patient
  detail page's score-graph card.
- **"Caregiver dashboard load"** (Part A) is the multi-patient overview
  (`caregiver/dashboard/page.tsx`) — a list of patient cards with no per-patient content. A
  weekly digest is inherently per-patient (game scores, reminders, companion log all key off
  one patient). This lands on the patient detail page's `cognitive` tab instead — same
  correction already made for the companion-activity tab and the reminiscence-quiz refresh
  button earlier this session.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| 7-day window computation | `src/app/api/patients/[id]/adherence/route.ts` `dateRange()` | exact same date-array helper, reused verbatim for the digest's 7-day pull |
| Caregiver-only API auth | `src/app/api/ai/generate-reminiscence-quiz/route.ts` | `authenticateRequest` → caregiver → ownership, no device-trust branch |
| LLM call + JSON validation | `src/lib/ai/reminiscence-quiz.ts` `validateQuizQuestions` | pure, testable validator; route stays thin |
| Review-before-write UI | `src/app/caregiver/memory-bank/page.tsx` existing add/edit dialog | same `role="dialog"` modal pattern, same `BigButton` Cancel/Save pair — the parser's review screen is one more dialog variant, not a new pattern |
| Per-patient tab content | `caregiver/patients/[id]/page.tsx` `companion`/`reminders` tabs | lazy-fetch-on-first-relevant-render guard |
| Voice capture | `src/app/companion/page.tsx` | MediaRecorder → `/api/ai/transcribe` → fallback to browser SpeechRecognition — reused as-is for the parser's mic button |

## Gaps / Decisions Before Coding

1. **`/api/ai/transcribe` needs a caregiver auth path added.** It's currently device-trust-only
   (Prompt 2 built it for the patient kiosk exclusively). Part B's mic button runs in a
   caregiver's authenticated browser session, which has no device-trust token. Extending that
   route with a second branch — a valid caregiver Bearer token also authorizes the call, no
   patient ownership check needed since transcription touches no patient data — mirrors
   `/api/ai/complete`'s existing device-trust-OR-caregiver-Bearer shape exactly, rather than
   forking a duplicate transcription route.
2. **Digest storage is Supabase-only, no Dexie mirror.** Every caregiver-side surface built this
   session (companion activity, reminiscence-quiz refresh) fetches live via `authedFetch` with
   no offline path — the caregiver section already assumes a Supabase session exists
   (`isSupabaseConfigured` guard on login). Same call here.
3. **Forbidden-word enforcement is a real retry loop, not a prompt instruction trusted blindly.**
   `containsForbiddenWord()` (dementia/decline/cognition/condition, case-insensitive, word
   boundaries) runs on the LLM's output. First hit → regenerate once with the same prompt. Second
   hit → discard the LLM text entirely and use a fixed template
   (`"This week: {gamesSummary}. {adherenceSummary}."`, built from the raw numbers, no LLM
   involved) — never a partially-redacted LLM sentence, since redacting a clinical word out of a
   sentence built around it usually leaves a worse, half-broken sentence.
4. **Onboarding-parser categories are `person | life_fact | schedule` only**, matching the
   spec's own enumeration verbatim — `medication` is a real category in `memory_bank_entries`
   but the spec never asks the parser to extract it (medication facts from a free-text
   description are exactly the kind of detail worth a caregiver typing carefully, not an LLM
   guessing at). Validation rejects any other category value.
5. **The parser route does not touch the database at all.** It's a pure text-in, JSON-out
   transform — no `memory_bank_entries` write, no new table. The review screen holds extracted
   entries in client component state; "Confirm" calls the existing
   `useMemoryBankStore().addEntry()` once per approved entry — the same write path the manual
   form already uses, satisfying "the caregiver always has final approval" by construction
   rather than by a server-side flag.
6. **Digest auto-generation trigger**: on first render of the patient detail page's `cognitive`
   tab, fetch the latest digest; if none exists or it's 7+ days old, auto-POST generate once
   (mirrors the companion/reminders tabs' lazy-fetch-once guard). A caregiver can also force it
   sooner with a "Refresh" button, same UX as the reminiscence-quiz button — but the route itself
   still enforces "never more than once a day" server-side (Decision 8), so mashing the button
   can't burn the rate limit.
7. **Scroll-back history** is a simple `GET /api/patients/[id]/digests?limit=12` (most recent
   first) — no pagination cursor, a caregiver has at most 52 digests a year.
8. **Server-side "not more than once a day" guard** lives in the generate route itself (checks
   the most recent digest's `generated_at`), not just in the UI's trigger logic — the UI check in
   Decision 6 is a courtesy that avoids an unnecessary request, not the actual enforcement.

## Files to Change

| File | Action | Why |
|---|---|---|
| `smriti/docs/03_DATABASE.md` | UPDATE | Migration 007: `caregiver_digests` table |
| `smriti/src/lib/supabase/types.ts` | UPDATE | `CaregiverDigest` row type |
| `smriti/src/lib/ai/digest-safety.ts` | CREATE | `containsForbiddenWord()`, `buildFallbackDigest()`, `shouldRegenerateDigest()` |
| `smriti/src/lib/ai/onboarding-parser.ts` | CREATE | `validateParsedEntries()` — pure JSON-shape validator, mirrors `reminiscence-quiz.ts` |
| `smriti/src/app/api/ai/generate-digest/route.ts` | CREATE | 7-day pull → prompt → generate → forbidden-word retry/fallback → store |
| `smriti/src/app/api/patients/[id]/digests/route.ts` | CREATE | GET, last N digests |
| `smriti/src/app/api/ai/parse-onboarding-text/route.ts` | CREATE | text → validated entries, no DB write |
| `smriti/src/app/api/ai/transcribe/route.ts` | UPDATE | add caregiver-Bearer auth branch alongside device-trust |
| `smriti/src/app/caregiver/patients/[id]/page.tsx` | UPDATE | digest card at the top of the `cognitive` tab |
| `smriti/src/app/caregiver/memory-bank/page.tsx` | UPDATE | "Quick add" toggle: textarea + mic → extract → review dialog → confirm |
| `smriti/src/tests/digest.test.ts` | CREATE | RED-first, route + `digest-safety.ts` |
| `smriti/src/tests/onboarding-parser.test.tsx` | CREATE | RED-first, route + validator + review-screen UI |

## Tasks

### Task 1: Schema — migration + types
- **Action**: `caregiver_digests` (id, patient_id, week_of DATE, summary_text, generated_at,
  UNIQUE on `(patient_id, week_of)` so a same-week regeneration replaces rather than duplicates).
  RLS mirrors `memory_bank_entries`. Add `CaregiverDigest` to `supabase/types.ts` and the
  `Database.public.Tables` map.
- **Mirror**: Migration 006's shape (this session's reminiscence-quiz migration).
- **Validate**: `npx tsc --noEmit`.

### Task 2: `digest-safety.ts`
- **Action**: `FORBIDDEN_WORDS = ['dementia', 'decline', 'cognition', 'condition']`,
  `containsForbiddenWord(text): boolean` (word-boundary regex, case-insensitive).
  `buildFallbackDigest(stats): string` — a fixed template built only from numbers (games played,
  average accuracy, reminder adherence %), never free text. `shouldRegenerateDigest(lastGeneratedAt:
  string | null): boolean` — true when null or ≥7 days old.
- **Validate**: tests — each forbidden word detected standalone and mid-sentence; a clean sentence
  with none of them passes; `shouldRegenerateDigest` true for null/8-days-old, false for
  today/3-days-old; `buildFallbackDigest` output itself contains none of the forbidden words
  (a template-correctness check, not just an LLM-output check).

### Task 3: `POST /api/ai/generate-digest`
- **Action**: Caregiver-authed. Server-side `shouldRegenerateDigest` check against the existing
  row for `(patientId, currentWeekOf)` — too-soon → return the existing digest unchanged, no LLM
  call. Otherwise pull 7 days of `daily_summaries` (all game types present), `ai_conversation_log`
  grounded/total, `reminder_acks` adherence (via `dateRange`/join logic mirrored from
  `adherence/route.ts`). Build the prompt, call `callLLM`, check `containsForbiddenWord` — hit →
  one regeneration attempt → still a hit → `buildFallbackDigest`. Upsert by `(patient_id,
  week_of)`.
- **Mirror**: `generate-reminiscence-quiz/route.ts`'s auth block and upsert-by-unique-key shape.
- **Validate**: tests — pulls exactly the 7-day window (mock rows just outside the window never
  appear in the prompt data passed to `callLLM`); non-empty summary on success; a mocked
  forbidden-word-containing response triggers exactly one extra `callLLM` call, and a
  still-forbidden second response results in `buildFallbackDigest`'s output being stored, never
  the LLM's text; a request with an existing digest generated today returns it unchanged and
  never calls `callLLM`.

### Task 4: `GET /api/patients/[id]/digests`
- **Action**: Caregiver-authed, ownership-checked, returns the last 12 digests newest-first.
- **Mirror**: `companion-activity/route.ts`, structurally identical.
- **Validate**: test — returns digests newest-first, capped at 12.

### Task 5: `onboarding-parser.ts` + `POST /api/ai/parse-onboarding-text`
- **Action**: `validateParsedEntries(raw, ...)`: parses JSON, requires an array, each item has a
  non-empty `title`/`detail`, `category` in `person|life_fact|schedule`, `relationship` is a
  string or null. Route: caregiver-authed (no patientId/ownership needed — extraction doesn't
  touch any patient's data), calls `callLLM` with the extraction prompt, validates, returns
  `{ entries }` on success or `{ error: 'invalid_extraction' }` (502) on failure — no DB write
  either way.
- **Mirror**: `reminiscence-quiz.ts`'s validation style; `distress-keywords.ts`'s "pure module,
  route stays thin" split.
- **Validate**: tests — a paragraph naming multiple people extracts multiple entries with correct
  fields; a `category` outside the allowed 3 fails validation; malformed JSON returns the error
  response without throwing.

### Task 6: `/api/ai/transcribe` — caregiver auth branch
- **Action**: After the existing device-trust check fails, try `authenticateRequest(request)`
  (Bearer header) before returning 401 — either one authorizes the call.
- **Mirror**: `/api/ai/complete`'s existing dual-path structure.
- **Validate**: tests — a valid caregiver Bearer token (no device-trust field) now succeeds; the
  existing device-trust tests keep passing unchanged; a request with neither still 401s.

### Task 7: Memory Bank "Quick add"
- **Action**: A toggle above the existing category sections switches between the current manual
  form and a `textarea` ("Tell us about your family — just write naturally") plus a mic button
  (MediaRecorder → `/api/ai/transcribe` with the caregiver's Bearer token → fills the textarea).
  "Extract" posts to `/api/ai/parse-onboarding-text`, opens a review dialog listing each entry
  with editable fields and a remove control. "Confirm & Save" calls `addEntry()` once per
  remaining entry, closes the dialog, and does nothing else on Cancel.
- **Mirror**: the existing add/edit `role="dialog"` in this same file; `companion/page.tsx`'s
  MediaRecorder/transcribe flow.
- **Validate**: tests — a mocked extraction response renders a review row per entry; removing a
  row before confirming means it's never passed to `addEntry`; confirming calls `addEntry` once
  per remaining row and only after the click (never on extraction alone); a malformed/failed
  extraction shows an error message, not a crash, and `addEntry` is never called.

### Task 8: Patient detail page — digest card
- **Action**: At the top of the `cognitive` tab: on first render of that tab, `GET` the latest
  digest; if none or 7+ days old, auto-`POST` generate once. Card shows the summary text,
  "Generated {date}", a "not medical advice" footnote, and a manual "Refresh" button. Past weeks
  are a simple scrollable list below the current card (from the same GET response).
- **Mirror**: the reminiscence-quiz "Refresh Quiz" button's loading/error states on this same
  page; the companion tab's lazy-fetch-on-tab-render guard.
- **Validate**: test — a stale/missing digest triggers exactly one generate call on tab render; a
  fresh (< 7 days) digest renders without calling generate; manual Refresh always calls generate
  regardless of freshness (server-side Decision 8 still governs whether that call actually
  regenerates or just returns the existing row).

## Validation

```bash
cd smriti
npx vitest run src/tests/digest.test.ts src/tests/onboarding-parser.test.tsx   # RED first, then GREEN
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| LLM ignores "3-4 sentences" and produces something much longer, making forbidden-word regex matches harder to reason about | Low | The regex checks the whole string regardless of length — not sentence-count-dependent |
| The one-retry-then-template fallback could itself become the common case if the model has a habit of reaching for clinical vocabulary | Medium | Acceptable — the fallback is still accurate (built from real numbers), just less warm; flagging so a low first-week fallback rate isn't mistaken for a bug |
| Caregiver Bearer token added to `/api/ai/transcribe` slightly widens who can spend Groq credits on that route (any authenticated caregiver, not just a trusted kiosk) | Low | Still requires real Supabase auth, not anonymous — same trust level the rest of the caregiver API surface already extends |

## Acceptance
- [ ] All 8 tasks complete, tests written before implementation per file
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass
- [ ] No digest ever stored contains a forbidden word, including the fallback template
- [ ] No `memory_bank_entries` write happens without an explicit confirm click on the review screen
- [ ] `/api/ai/complete`'s and the reminiscence-quiz route's existing tests still pass unchanged after the transcribe-route edit

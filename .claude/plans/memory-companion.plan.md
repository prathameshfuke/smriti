# Plan: Patient-Facing Voice Memory Companion

**Source**: free-form spec (not a `.prd.md`)
**Complexity**: Large (2 new libs, 2 new API routes, 1 extended API route, 1 new UI page, 1 caregiver tab, 1 DB migration)

## Summary

Builds the patient-facing "Ask Smriti" voice companion: record a question, transcribe it
(Groq Whisper, browser `SpeechRecognition` fallback), answer it strictly from that patient's
Memory Bank facts via the existing shared `callLLM`, speak the answer back, and log every
exchange for caregiver visibility. Reuses the grounded-QA route that already exists
(`POST /api/ai/complete`) instead of building a parallel `/api/ai/companion-answer` route, and
adds a same-session/short-window distress-keyword safety net ahead of every LLM call.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Server-only provider client | `src/lib/ai/llm-client.ts` | single exported entry point, doc-commented "never call the provider directly," throw-per-provider caught by the caller |
| API route auth | `src/app/api/ai/complete/route.ts`, `src/app/api/patients/[id]/timeline/route.ts` | device-trust-token validation for kiosk calls; `authenticateRequest` → caregiver lookup → ownership check for caregiver calls |
| Caregiver tab fetch | `src/app/caregiver/patients/[id]/page.tsx` (`reminders`/`adherence` tab) | lazy-fetch on first tab selection, guarded so it only fires once |
| Offline detection | `src/hooks/useOfflineStatus.ts` | debounced `isOnline` boolean — reuse this hook, don't re-read `navigator.onLine` directly |
| Text-to-speech | `src/lib/audio/speech.ts` | `speak(text, language: UILanguage)` — guarded no-op off-jsdom/off-Web-Speech; callers never touch `window.speechSynthesis` |
| Touch targets | `src/components/ui/touchTarget.ts` | named px constants (`TOUCH_TARGET_MIN_PX = 64`), inline `style`, never a bare number for anything reused |
| Local cache table shape | `src/lib/db/schema.ts` (`LocalAiConversationLog` / `db.aiConversationLog`) | already has exactly the fields a "last 5 answered" cache needs — reuse it, don't add a new Dexie table |
| Tests | `src/tests/llm-client.test.ts` | Vitest + `vi.stubGlobal('fetch', ...)` per test, not a global mock in `setup.ts` |

## Gaps / Decisions Before Coding

1. **Reusing `/api/ai/complete` instead of a new `/api/ai/companion-answer` route.** The spec names a new route, but `/api/ai/complete` already does ~90% of Part 2 step 4: it validates the device-trust token, fetches active `memory_bank_entries` for that `patient_id` server-side, builds a facts-only system prompt, calls `callLLM`, and logs to `ai_conversation_log`. Building a second, near-duplicate route would fork the safety-critical grounding logic into two places that have to stay in sync. This plan extends `/api/ai/complete` instead (distress short-circuit, zero-facts short-circuit, the spec's exact fallback wording) and points the new UI at it. If a genuinely separate endpoint is wanted later (different rate limits, different auth), it's a rename, not a rewrite — flag this in review if it matters.
2. **Zero-active-facts short-circuit.** Rather than trust the LLM to always obey "if the question cannot be answered, say exactly: I'm not sure about that — you could ask your caregiver," the route skips `callLLM` entirely when a patient has **no active Memory Bank entries at all** and returns that exact string directly. This makes the "refuses to answer with zero facts" test deterministic (no LLM mock needed) and is strictly safer than hoping a small, fast model (`llama-3.1-8b-instant`) never guesses. `isGroundedAnswer()` also gets this exact phrase added to its existing regex list (additive, not a replacement) so a case where facts exist but don't cover the question is still detected as ungrounded.
3. **Distress severity tiers, not one flat list.** The spec itself only asks "scared" / "help me" to trigger when "used repeatedly" — unlike "want to die" / "hurt myself," which are unambiguous on a single utterance. Flattening that (triggering on any single occurrence of "scared") would make the companion refuse ordinary questions like "help me find my glasses," crying wolf on a safety feature. Decision: `HIGH` phrases short-circuit on the first occurrence; `LOW` phrases short-circuit only when the current question plus the patient's last 5 logged questions contain **2 or more** `LOW` matches combined. Both lists and the threshold live in one config module (`distress-keywords.ts`), matching the spec's "configurable list" framing.
4. **New `ai_conversation_log.flagged_for_followup` column.** The spec says a distress short-circuit should be "flagged for caregiver follow-up," but the existing log schema only has `grounded` (true/false). Reusing `grounded: false` for distress rows would make them visually indistinguishable from an ordinary "patient asked something outside the Memory Bank" row on the caregiver dashboard — the wrong signal to blend together. Adds one `BOOLEAN NOT NULL DEFAULT false` column via a new migration instead.
5. **"1-red-alert-per-48h budget" is descriptive, not a real mechanism to hook into.** Nothing in the codebase currently enforces any such cap — the `alerts` table's cognitive-drop trigger has no rate limit at all. Reading this instruction as: render the ungrounded-question suggestion with its own gentle, non-`TrafficLight`/non-danger styling, and never write to the `alerts` table for it. Nothing to change in the alerts system itself.
6. **"Companion activity" goes on the per-patient detail page, not the multi-patient overview.** The spec says "the existing caregiver dashboard," but `caregiver/dashboard/page.tsx` is a multi-patient list with no per-patient content, while `caregiver/patients/[id]/page.tsx` already hosts three per-patient tabs (cognitive/reminders/history) fed by per-patient API routes. Companion questions are inherently per-patient, so this adds a fourth tab there — architecturally consistent even though the spec's wording points at the wrong file.
7. **56px vs. the app's real 64px floor.** The spec says "56px+ targets"; this codebase's own patient-facing floor is `TOUCH_TARGET_MIN_PX = 64` (56px is reserved for `LANGUAGE_TARGET_MIN_PX`, a denser *caregiver* setup screen, not patient-facing). Using 64px satisfies "56px+" and keeps the app internally consistent. The mic button's spec'd 96px already clears both.
8. **No true word-by-word live transcript while speaking.** The spec's "replaced by live transcript while the patient is speaking" is exactly what browser `SpeechRecognition`'s `interimResults` gives you, but Groq Whisper (the spec's primary, better-accuracy transcriber for Assamese/Hindi) is batch-only — it returns text after the recording stops, not during. Running `SpeechRecognition` purely for live captioning *and* `MediaRecorder` for the actual Groq upload at the same time means two concurrent mic consumers, a known source of cross-browser flakiness. This plan shows a simple "Listening…" state during recording and fills in the transcript once one is available (Groq, or the `SpeechRecognition` fallback's own result) — a real narrowing of that one bullet, flagging it since true live captioning is a reasonable follow-up once this ships and gets tested on the actual kiosk hardware/browser.
9. **Offline handling reuses the Groq-failure fallback path, not a separate branch.** `useOfflineStatus().isOnline === false` just means "don't bother attempting the `/api/ai/transcribe` or `/api/ai/complete` fetch and wait on a timeout" — it feeds into the *same* "Groq failed → try browser `SpeechRecognition`" / "LLM unreachable → cached answer or graceful fallback" logic that already has to exist for a flaky-but-technically-online connection. No offline-specific code path beyond skipping the fetch attempt itself.
10. **Cache lookup runs on every transcript, online or offline.** Matching a fresh transcript against the last-5 cache (exact match after normalizing case/punctuation/whitespace — not fuzzy substring, to avoid confidently showing the wrong cached answer) is cheap and correct to run unconditionally; it happens to also satisfy "even offline" since it never depends on network. Exact-normalized-match only, not substring, to avoid two different questions that happen to share words producing a false hit.
11. **`transcribeAudio` needs its own module**, not folded into `llm-client.ts` — different endpoint (`/audio/transcriptions`), different request shape (multipart, `file` + `model` fields per Groq's docs), different response shape (`{ text, language, duration, segments }` vs. chat's `choices[0].message.content`). Mirrors `llm-client.ts`'s single-entry-point discipline as a sibling module, not a merged one.
12. **`/api/ai/transcribe` still requires the device-trust token** (sent as a stringified form field alongside the audio blob), even though the spec doesn't say so explicitly — otherwise it's an unauthenticated route that spends paid Groq credits on every request. Simpler than `/complete`'s dual auth path since only the kiosk ever records audio; no caregiver-Bearer branch needed here.

## Files to Change

| File | Action | Why |
|---|---|---|
| `smriti/docs/03_DATABASE.md` | UPDATE | Migration 005: `ai_conversation_log.flagged_for_followup` |
| `smriti/src/lib/supabase/types.ts` | UPDATE | Add `flagged_for_followup: boolean` to `AiConversationLog` |
| `smriti/src/lib/ai/llm-client.ts` | UPDATE | Export `FALLBACK_TEXT` so the companion page can reuse the exact wording instead of a near-duplicate string |
| `smriti/src/lib/ai/distress-keywords.ts` | CREATE | High/low severity phrase lists + `matchSeverity()` + `TELE_MANAS_RESPONSE` |
| `smriti/src/lib/ai/transcribe-client.ts` | CREATE | `transcribeAudio()` — Groq Whisper multipart call |
| `smriti/src/lib/ai/companion-cache.ts` | CREATE | `findCachedAnswer()` / `cacheAnswer()` over `db.aiConversationLog`, trimmed to 5 per patient |
| `smriti/src/app/api/ai/transcribe/route.ts` | CREATE | Device-trust-gated Groq Whisper proxy |
| `smriti/src/app/api/ai/complete/route.ts` | UPDATE | Distress short-circuit, zero-facts short-circuit, exact fallback wording, `flagged_for_followup` |
| `smriti/src/app/api/patients/[id]/companion-activity/route.ts` | CREATE | Caregiver-authed, last 10 log rows for one patient |
| `smriti/src/app/companion/page.tsx` | CREATE | Patient-facing voice companion UI |
| `smriti/src/app/app/page.tsx` | UPDATE | Add the "Ask Smriti" entry button |
| `smriti/src/app/caregiver/patients/[id]/page.tsx` | UPDATE | Fourth "Companion" tab |
| `smriti/src/tests/companion-api.test.ts` | CREATE | RED-first tests for all three API routes + the two new lib modules |
| `smriti/src/tests/companion.test.tsx` | CREATE | RED-first tests for the companion page and the caregiver tab |

## Tasks

### Task 1: `flagged_for_followup` migration
- **Action**: Append a Migration 005 SQL block to `docs/03_DATABASE.md` adding the column (+ a partial index mirroring `idx_alerts_caregiver_unread`'s style, scoped to `WHERE flagged_for_followup`). Add the field to `AiConversationLog` in `supabase/types.ts` (its `Insertable`/`Updatable` derive automatically).
- **Mirror**: `03_DATABASE.md` Migration 004's own block; `idx_alerts_caregiver_unread` partial-index style.
- **Validate**: `npx tsc --noEmit` — every existing `.insert()`/read of `ai_conversation_log` still type-checks with the new field present.

### Task 2: Export `FALLBACK_TEXT`
- **Action**: Add `export` to the existing `const FALLBACK_TEXT` in `llm-client.ts`. No behavior change.
- **Validate**: `llm-client.test.ts` passes unchanged.

### Task 3: `distress-keywords.ts`
- **Action**: `HIGH_SEVERITY_PATTERNS` (want to die, kill myself, hurt myself, end my life, suicide), `LOW_SEVERITY_PATTERNS` (scared, help me), `matchSeverity(text): 'high' | 'low' | null`, `TELE_MANAS_RESPONSE` (warm, fixed string surfacing 14416).
- **Validate**: tests — a high-severity phrase matches `'high'` on the first occurrence; a low-severity phrase alone matches `'low'` (repetition counting is the caller's job, not this module's); unrelated text matches `null`; matching is case-insensitive.

### Task 4: `companion-cache.ts`
- **Action**: `normalizeQuestion(text)` (lowercase, strip punctuation, collapse whitespace, trim); `findCachedAnswer(patientId, question): Promise<LocalAiConversationLog | null>` — exact match on the normalized form, scoped to `patientId`; `cacheAnswer(entry): Promise<void>` — `db.aiConversationLog.put(entry)` then delete any rows for that `patientId` beyond the 5 newest by `createdAt`.
- **Mirror**: `memoryBankStore.ts`'s private scoped-query-helper shape (`activeEntriesFor`).
- **Validate**: tests — caching a 6th entry for a patient leaves exactly 5, the newest ones; a normalized exact match is found regardless of punctuation/casing differences; no match returns `null`; an entry cached under a different `patientId` is never returned.

### Task 5: `transcribe-client.ts`
- **Action**: `transcribeAudio(audio: Blob): Promise<{ text: string; model: string }>` — POSTs `multipart/form-data` to `https://api.groq.com/openai/v1/audio/transcriptions` with `file` (the blob) and `model: 'whisper-large-v3-turbo'` fields, `Authorization: Bearer ${GROQ_API_KEY}`. Throws (doesn't swallow) on a missing key, non-ok response, or empty `text` — there's no second provider to fall through to here, so the caller (the route) decides what happens next.
- **Mirror**: `llm-client.ts`'s `callProvider()` — same fetch/parse/throw shape and server-only doc comment.
- **Validate**: tests — a successful response returns `{ text, model }`; a non-ok response throws; a missing `GROQ_API_KEY` throws without calling `fetch`.

### Task 6: `POST /api/ai/transcribe`
- **Action**: Parse the multipart body (`audio` blob field, `deviceTrustToken` JSON-string field). 401 if the token is missing or fails `validateToken`. Call `transcribeAudio`; on success return `{ text }`; on throw, return `502 { error: 'transcription_failed' }` (no retry — the client falls back to browser `SpeechRecognition`).
- **Mirror**: `/api/ai/complete/route.ts`'s device-token validation block (patient-device path only — no caregiver-Bearer branch, since only the kiosk records audio).
- **Validate**: tests — valid token + successful transcription → 200 + text; missing/invalid token → 401, `transcribeAudio` never invoked; a `transcribeAudio` throw → 502.

### Task 7: Extend `POST /api/ai/complete`
- **Action**: After resolving `patientId` (existing auth block, untouched) and before calling `callLLM`: (a) `matchSeverity(question)` — `'high'` inserts a `flagged_for_followup: true, grounded: false, model_used: 'distress-shortcircuit'` log row and returns `TELE_MANAS_RESPONSE` immediately, no LLM call; `'low'` queries the patient's last 5 `ai_conversation_log.question` rows, counts `LOW` matches among those plus the current question, and only short-circuits (same as `'high'`) at 2+. (b) if `factLines` is empty, insert a `grounded: false, model_used: 'none'` row and return the exact fallback string directly, no LLM call. (c) Update `systemPrompt` to the spec's exact wording (facts verbatim, the exact "I'm not sure about that — you could ask your caregiver." instruction, 3-sentence cap, warm/simple tone). (d) Add that exact phrase to `isGroundedAnswer`'s pattern list (additive). (e) Every other insert now sets `flagged_for_followup: false`.
- **Mirror**: existing device-token/caregiver-Bearer auth branching is untouched — only the logic between "auth resolved" and "build response" changes.
- **Validate**: tests (first real coverage for this route) — zero active facts → exact fallback text, `callLLM` never invoked; a high-severity phrase → `TELE_MANAS_RESPONSE`, `callLLM` never invoked, inserted row has `flagged_for_followup: true`; a low-severity phrase seen once → normal LLM path; seen twice within the last 5 logged questions → short-circuits; the system prompt handed to `callLLM` contains every active fact's title and detail verbatim.

### Task 8: `GET /api/patients/[id]/companion-activity`
- **Action**: `authenticateRequest` → caregiver lookup → ownership check (verbatim from `timeline/route.ts`) → `select id, question, answer, grounded, flagged_for_followup, created_at from ai_conversation_log where patient_id = :id order by created_at desc limit 10` → map to camelCase → `{ questions: [...] }`.
- **Mirror**: `timeline/route.ts`, structurally identical.
- **Validate**: tests — no auth → 401; patient not owned by the caller → 404; returns at most 10 rows, newest first, with `grounded`/`flaggedForFollowup` intact.

### Task 9: `companion/page.tsx`
- **Action**: Mic button (96px, `motion-safe:animate-pulse` while recording, gated the same way `GamosaTexture`'s drift animation is). Feature-checks `MediaRecorder`; falls back to a text `<input>` when unavailable. On stop: if `useOfflineStatus().isOnline` is false, skip straight to browser `SpeechRecognition` (if present) or the fallback text — never attempt a fetch that will hang. Otherwise `POST /api/ai/transcribe` (device-trust token from `getDeviceTrustToken()`); on failure, fall back to `SpeechRecognition`; if neither yields text, show `FALLBACK_TEXT` (imported, not re-typed). With a transcript: `findCachedAnswer` first — a hit renders the cached answer with a small "from earlier" label and speaks it, skipping `/api/ai/complete` entirely; a miss while offline shows `FALLBACK_TEXT` with no fetch; a miss while online calls `POST /api/ai/complete`, renders the answer with the "AI-generated answer" label, speaks it via `speak(text, isUILanguage(patient.primaryLanguage) ? patient.primaryLanguage : 'en')`, and caches it via `cacheAnswer`. "Ask again" (`BigButton`, `variant="secondary"`) resets to the idle state.
- **Mirror**: `PinDialog`'s timer-cleanup `useEffect` pattern for any interval/timeout; `BigButton`/`TOUCH_TARGET_MIN_PX` conventions; `speak()` + `isUILanguage`; `useOfflineStatus()`; `getDeviceTrustToken()`.
- **Validate**: tests — mic button and instructions render on load; a mocked record→transcribe→answer flow renders the answer text; `MediaRecorder`-unavailable renders a text input instead of the mic button; `navigator.onLine = false` renders the fallback immediately with the transcribe/complete fetches never called; a cache hit shows the "from earlier" label and never calls `/api/ai/complete`.

### Task 10: "Ask Smriti" entry point
- **Action**: Add a `BigButton` on `src/app/app/page.tsx` (alongside "Reminders" / "My Progress") linking to `/companion`.
- **Validate**: existing home-page tests still pass; add one assertion that the button renders and navigates to `/companion`.

### Task 11: Caregiver "Companion" tab
- **Action**: Add `'companion'` to `Tab` in `caregiver/patients/[id]/page.tsx` and the tab-button row. On first selection, `authedFetch('/api/patients/${patientId}/companion-activity')` (same lazy-fetch-once guard as the `reminders`/`adherence` effect). Render the 10 rows: grounded rows plain; ungrounded-and-not-flagged rows get a gentle, non-danger styled suggestion ("consider adding this to the Memory Bank") linking to `/caregiver/memory-bank`; `flagged_for_followup` rows get a distinct, more visible — but still not `alerts`-table/`TrafficLight`-red — note that follow-up is suggested.
- **Mirror**: the `reminders` tab's lazy-fetch-on-select effect.
- **Validate**: tests — selecting the tab fetches and renders up to 10 rows; grounded vs. ungrounded rows are visually distinguishable; a flagged row shows the follow-up note; the fetch fires once per tab selection, not on every render.

## Validation

```bash
cd smriti
npx vitest run src/tests/companion-api.test.ts src/tests/companion.test.tsx   # RED first, then GREEN
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `isGroundedAnswer`'s phrase-matching misses a creative LLM paraphrase of "I don't know" | Medium | Defense in depth: keep the existing 3 regexes *and* the new exact phrase; the zero-facts case (the one the tests pin down) never reaches the LLM at all |
| Distress `LOW` list ("scared"/"help me") still false-positives after 2 genuinely unrelated uses | Medium | Accepted — the resulting message is warm and non-alarming, not an actual alert; worst case is an unnecessary gentle nudge, not harm |
| `MediaRecorder`'s default `audio/webm` output vs. Groq's accepted formats | Low | Confirmed against Groq's docs: `webm` is explicitly accepted, no transcoding needed |
| Two new browser APIs (`MediaRecorder`, `SpeechRecognition`) have zero test precedent in this codebase | Medium | Per-test `vi.stubGlobal`, matching `llm-client.test.ts`'s convention — not a global `setup.ts` mock, so nothing else is affected |
| Dropping true live word-by-word transcript display (Decision 8) undersells the spec's UX bullet | Confirmed, accepted | Flagged explicitly; a real follow-up if a "Listening…" state proves unsatisfying on real hardware |

## Acceptance
- [ ] All 11 tasks complete, tests written before implementation per file
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass
- [ ] No new route duplicates `/api/ai/complete`'s grounding logic
- [ ] Every `/api/ai/complete` response path (distress, zero-facts, normal grounded, normal ungrounded, LLM failure) writes exactly one `ai_conversation_log` row with the correct `grounded`/`flagged_for_followup` pair
- [ ] Companion page never calls a network route while `useOfflineStatus().isOnline` is false

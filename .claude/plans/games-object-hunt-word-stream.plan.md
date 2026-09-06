# Plan: Object Hunt + Word Stream (Games 1 & 2)

**Source**: free-form spec (not a `.prd.md`)
**Complexity**: Large (3 engine modules, 1 data module, 1 shared component, 2 full game pages, 1 store method, 1 speech helper, 1 bug-fix carryover)

## Summary

Implements the first two of the four cognitive games — Object Hunt (CANTAB PAL-style
paired-associate learning) and Word Stream (MoCA-style delayed recall) — plus the
shared engine (telemetry logging, adaptive difficulty, daily summaries) and the
12-item NER cultural object bank both games draw from.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Store shape | `src/stores/patientStore.ts` | zustand store, private scoped-query helper, `set()` after every write |
| Transaction + queue | `src/stores/gameStore.ts:88-104` | every local write happens inside `db.transaction(...)` alongside `buildQueueItem` |
| Component API | `src/components/ui/ProgressRing.tsx` | sized-variant lookup table (`DIMENSIONS`), typed props, clamped numeric input |
| Pure engine functions | none yet — `src/lib/engine/{telemetry,difficulty}.ts` are empty stubs (`export {}`) left by the original scaffold | first real usage; no existing pattern to mirror, following plain typed function exports |
| i18n | `src/lib/i18n/provider.tsx`, `src/tests/data-layer/i18n.test.tsx` | `useTranslation()` → `{ t, language }`; **first page-level use** — every existing page is raw English strings |
| Tests | `src/tests/pages.test.tsx`, `src/tests/fixes.test.ts` | Vitest + RTL, `vi.mock` for browser APIs the jsdom env lacks (see Web Speech below) |

## Gaps / Decisions Before Coding

1. **Two different `logEvent` shapes already exist or are being asked for.** `gameStore.logEvent(round: RoundResult)` derives `id`/`sessionId`/`patientId`/`eventTimestamp` internally and only buffers in memory (flushed to Dexie at `endSession`). The spec's `engine/telemetry.ts logEvent(event: Omit<LocalTelemetryEvent,'id'|'synced'>)` takes a *fuller* event (caller supplies `sessionId`/`patientId`/`eventTimestamp`) and writes to Dexie **immediately**, then also pushes into `gameStore.sessionEvents`. Decision: `engine/telemetry.ts` is a **new, lower-level primitive** — it does not call `gameStore.logEvent` (that would double-generate ids for the same round). It generates the id itself, writes it to `db.telemetryEvents` right away (durability against a mid-round crash on 2G/3G — the whole point of offline-first), and appends that exact object into `gameStore.sessionEvents` via `useGameStore.setState`. `endSession`'s existing `bulkPut` at session end becomes a harmless idempotent re-write of the same rows (same ids), not a duplicate. The two games in this plan use `engine/telemetry.logEvent` exclusively, never `gameStore.logEvent`. `gameStore.logEvent` is untouched and keeps its own tests/behavior for whatever calls it later.
2. **No active-session guard on the new `logEvent`.** Mirrors `gameStore`'s M5 protection: if `useGameStore.getState().activeSession` is null, increment `useGameStore.getState().droppedEvents` and `console.error`, same as the existing safety net, rather than writing an orphaned telemetry row.
3. **`DifficultyState`'s consecutive counters have nowhere to persist.** `LocalPatient.currentDifficulty` is `Record<string, number>` — level only, no streak fields, and the spec doesn't add any. Decision: `DifficultyState` lives in the game page's `useState`, seeded fresh each session as `{ currentLevel: patient.currentDifficulty[gameType] ?? 1, consecutiveHighScores: 0, consecutiveLowScores: 0 }`. Streaks accumulate across "Keep Going" rounds within one sitting and reset when the patient leaves; only `currentLevel` is written back to Dexie. This is a real behavior narrowing versus a naive reading of "3 consecutive high scores" as a cross-day streak — flagging it explicitly since it changes what "consecutive" means.
4. **Tailwind cannot JIT a template-literal color class.** `` `bg-[${obj.categoryColor}]/20` `` never appears as a literal string in source, so Tailwind's content scanner won't generate it — the class silently does nothing at runtime. `ObjectGrid`'s revealed-tile background (driven by data, not a fixed token) uses inline `style={{ backgroundColor: `${categoryColor}33` }}` (hex + alpha) instead of a Tailwind arbitrary-value class. Ring/flash colors for correct/wrong stay as real Tailwind tokens (`ring-success`, `bg-warning/20`) since those are fixed, not data-driven.
5. **i18n scope stays narrow.** Only `t('game.correct')` and `t('game.tryAgain')` are wired through `useTranslation()`, since those two keys already exist identically in `en.json`/`as.json`/`hi.json`. Every other new spoken/display string this plan introduces ("Where was the {object}?", "Which items did we show you?", round-complete encouragement) is **not** added to the locale catalogs — per this project's standing rule (from the data-layer PRD) not to guess Assamese/Hindi translations, these stay plain English literals in code, same as every other page in the app today.
6. **`db.dailySummaries` upsert needs a lookup first.** The table's primary key is a random `id`, not the compound `[patientId+summaryDate+gameType]` index — `buildDailySummary` must query that compound index for an existing row's `id` before `put`, or every call creates a duplicate summary row instead of upserting.
7. **`eloRating` is out of scope.** `LocalDailySummary.eloRating` exists on the schema but nothing in this spec computes it. `buildDailySummary` carries the existing value through unchanged on update, defaults to `0` on insert.
8. **Blocking dependency, bundled in per your answer:** onboarding's `finish()` (`src/app/caregiver/onboarding/page.tsx`) never calls `usePatientStore.getState().setCurrentPatient()` after `addPatient()` — flagged HIGH in the last code review, still unfixed. Both game pages need a real `currentPatient` to call `startSession(patientId)`. **Task 0** below is the one-line fix, bundled into this plan so the games are reachable end-to-end, not just unit-testable in isolation.
9. **`window.speechSynthesis` doesn't exist in jsdom.** A new `src/lib/audio/speech.ts` (this directory was listed as "never started" in the last saved session — natural fit) exports `speak(text: string): void`, guarded to no-op when `typeof window === 'undefined' || !window.speechSynthesis`. Both game pages call this helper, never `window.speechSynthesis` directly — keeps the guard in one place and makes it mockable with a single `vi.mock('@/lib/audio/speech')` per test file, avoiding a repeat of last session's fake-timer test-poisoning mistake (documented in memory: a test that throws before `vi.useRealTimers()` breaks every later test in the file — this plan's timer-driven tests use real short timeouts + `act()`, not fake timers, following the fix already applied in `pages.test.tsx`).

## Files to Change

| File | Action | Why |
|---|---|---|
| `smriti/src/app/caregiver/onboarding/page.tsx` | UPDATE | Task 0 — bundled HIGH fix: call `setCurrentPatient()` after `addPatient()` |
| `smriti/src/lib/engine/telemetry.ts` | REPLACE | Currently `export {}` stub |
| `smriti/src/lib/engine/difficulty.ts` | REPLACE | Currently `export {}` stub |
| `smriti/src/lib/engine/objects.ts` | CREATE | 12-object NER cultural data |
| `smriti/src/lib/audio/speech.ts` | CREATE | `speak()` guard around Web Speech API |
| `smriti/src/stores/patientStore.ts` | UPDATE | Add `updateDifficulty(patientId, gameType, level)` |
| `smriti/src/components/games/ObjectGrid.tsx` | CREATE | Shared reveal/recall grid |
| `smriti/src/app/games/object-hunt/page.tsx` | REPLACE | Currently a 3-line stub |
| `smriti/src/app/games/word-stream/page.tsx` | REPLACE | Currently a 3-line stub |
| `smriti/src/tests/engine.test.ts` | CREATE | Pure-function tests for telemetry + difficulty |
| `smriti/src/tests/games.test.tsx` | CREATE | ObjectGrid + both game pages |

## Tasks

### Task 0: Fix onboarding's missing `setCurrentPatient` call
- **Action**: In `finish()`, after `await addPatient(patient)`, call `usePatientStore.getState().setCurrentPatient(patient)`.
- **Validate**: extend the existing onboarding happy-path test in `pages.test.tsx` to assert `usePatientStore.getState().currentPatient?.id` matches the created patient.

### Task 1: `engine/objects.ts`
- **Action**: `export const OBJECTS: SmritiObject[]` — 12 entries exactly as specified (id, `name: {en,as,hi}`, emoji, category, categoryColor). `export function pickObjects(count: number, exclude?: string[]): SmritiObject[]` — random sample without replacement, used by both games for target/distractor selection (selection algorithm isn't specified; uniform random is the assumption).
- **Validate**: test — 12 objects, all ids unique, `pickObjects(4)` returns 4 distinct objects, `exclude` is honored.

### Task 2: `engine/telemetry.ts`
- **Action**: `logEvent(event: Omit<LocalTelemetryEvent,'id'|'synced'>): Promise<void>` per Gap #1/#2 above. `buildDailySummary(patientId, date, gameType): Promise<LocalDailySummary>` per Gap #6 — query `telemetryEvents` by `patientId` + filter `gameType`/`eventTimestamp` prefix, compute aggregates, upsert by compound-index lookup.
- **Mirror**: `gameStore.ts:88-104` transaction pattern for the Dexie write; `patientStore.ts`'s private-helper pattern for the compound-index lookup.
- **Validate**: tests — `logEvent` writes a row with a fresh id and appends to `gameStore.sessionEvents`; `logEvent` with no active session increments `droppedEvents` and writes nothing; `buildDailySummary` aggregates totals/avg/max correctly from 3 seeded events; calling it twice for the same patient/date/gameType updates one row, not two.

### Task 3: `engine/difficulty.ts`
- **Action**: `adjustDifficulty(state, gameType, sessionAccuracy): DifficultyState` and `getEducationBonus`/`applyEducationBonus` exactly per spec's thresholds and per-game max levels (mapped to real `GameType` values: `object_hunt=10, word_stream=6, quick_tap=8, path_match=8`).
- **Validate**: tests — 3 consecutive ≥80% raises level by 1 (capped at game max); 2 consecutive <50% lowers level by 1 (floored at 1); a score in 50-79% resets both counters and leaves level unchanged; education bonus table matches spec; `applyEducationBonus` clamps at 100.

### Task 4: `audio/speech.ts`
- **Action**: `speak(text: string): void` — no-ops when Web Speech is unavailable (jsdom, and any browser without it).
- **Validate**: test — calling `speak()` in the jsdom test env doesn't throw.

### Task 5: `patientStore.updateDifficulty`
- **Action**: Reads the patient, sets `currentDifficulty[gameType] = level`, writes back inside a `db.transaction` with a `syncQueue` row (mirrors `addPatient`), and updates `currentPatient` in state if it's the same patient — this is what keeps the home-screen `GameTile` difficulty dots in sync without a reload.
- **Validate**: test — after `updateDifficulty`, both the Dexie row and `usePatientStore.getState().currentPatient.currentDifficulty[gameType]` reflect the new level.

### Task 6: `ObjectGrid.tsx`
- **Action**: Props and states exactly per spec (2/3/4-column layout by `totalTiles`, 64×64px min, revealed/hidden/correct-flash/wrong-flash states, target card, tap only live in `'recall'`).
- **Mirror**: `TrafficLight.tsx`'s glyph-plus-color pattern for conveying state without color alone (correct/wrong flashes get a checkmark/cross glyph too, not just a ring color, for the same WCAG 1.4.1 reason already established in this codebase).
- **Validate**: tests — grid column count matches tile count; hidden tile shows `?`; revealed tile shows the emoji; tap is inert outside `'recall'`; tapping the correct tile in recall fires `onTileSelect`.

### Task 7: `games/object-hunt/page.tsx`
- **Action**: Full phase machine (`instruction → reveal → recall → round_complete → session_complete`) per spec's per-level timing table. Calls `startSession` on mount, `engine/telemetry.logEvent` per recall attempt, `adjustDifficulty` + `patientStore.updateDifficulty` at round-complete, `buildDailySummary` + `gameStore.endSession()` at session-complete.
- **Mirror**: `PatientNav` back-button suppression pattern (`disabled` prop already exists on nothing — will pass no `onBack` while `isSessionActive`, consistent with "no way to accidentally lose your place mid-round").
- **Validate**: tests — instruction phase auto-advances after its timer; reveal opens the correct number of tiles for a given level; a correct recall tap logs an event and advances the target; round-complete shows the right star count for a given accuracy and never shows discouraging text; Keep Going starts another round; Finish Session calls `buildDailySummary` and `endSession`.

### Task 8: `games/word-stream/page.tsx`
- **Action**: START phase (only when `wordStreamItems` is empty) shows N items per level, then `setWordStreamItems` and returns home. RECALL phase (only when `wordStreamItems` is populated) shows a distractor grid, computes hits/misses/false-alarms, logs one event, clears `wordStreamItems`, returns home.
- **Validate**: tests — START picks the right item count per level and populates the store; RECALL grid includes all original items plus distractors up to the level's total; toggling selection updates the visual state; Done computes hits/misses/false-alarms correctly against a known fixture; clears `wordStreamItems` on completion.

## Validation

```bash
cd smriti
npx vitest run src/tests/engine.test.ts src/tests/games.test.tsx   # RED first, then GREEN
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `setInterval`-driven reveal sequencing is inherently timing-fragile in tests | High | Use real short timeouts (`await new Promise(r => setTimeout(r, N))` inside `act()`) as established in `pages.test.tsx`'s cooldown test, not `vi.useFakeTimers()` — a thrown assertion before `useRealTimers()` poisoned every later test in that file last session |
| `SpeechSynthesisUtterance` referenced without a guard anywhere outside `speech.ts` would break in jsdom | Medium | Both game pages import `speak` only, never touch `window.speechSynthesis` directly — enforced by code review, not tooling |
| `adjustDifficulty`'s in-memory-only streak counters mean a patient who does one round per day never accumulates a streak across days | Confirmed, not really a risk | Matches Gap #3's decision; flagging so it isn't mistaken for a bug later |
| Tailwind arbitrary-value classes built from data | Confirmed bug if not caught | Addressed by Gap #4 — inline `style` for data-driven color, not a class string |

## Acceptance
- [ ] All 9 tasks complete (0 through 8), tests written before implementation per file
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass
- [ ] No `bg-[${...}]` template-literal Tailwind classes anywhere in the new code
- [ ] `engine/telemetry.logEvent` is the only telemetry write path used by the two new games
- [ ] Onboarding → home → Object Hunt / Word Stream is reachable end-to-end with a real patient, not just in tests

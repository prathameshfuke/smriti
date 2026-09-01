# Plan: SMRITI Games 3 & 4 — Quick Tap (processing speed) & Path Match (executive function)

**Complexity**: Medium

## Summary
Implement two remaining cognitive game pages plus a shared `SessionComplete` component and a shared `PatientNav` retrofit across all four game pages. `PathCanvas.tsx` and `TapTarget.tsx`/`WordCard.tsx` currently exist as empty stubs (`return null`) from an earlier component-scaffold batch — `PathCanvas` gets filled in per spec; `TapTarget`/`WordCard` are not used by this spec and are left untouched.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Phase machine | `src/app/games/object-hunt/page.tsx:67-271` | `Phase` union type, `LEVELS: Record<number, Params>`, `queueMicrotask` wrapping synchronous `setState` inside effects that derive fresh round state (satisfies `react-hooks/set-state-in-effect`) |
| Difficulty persistence | `object-hunt/page.tsx:198-211` | `adjustDifficulty()` then `usePatientStore.getState().updateDifficulty(patientId, gameType, next.currentLevel)` on round-complete/finish |
| Telemetry | `src/lib/engine/telemetry.ts` `logEvent()` | Called with `sessionId, patientId, gameType, difficultyLevel, roundNumber, isCorrect, responseTimeMs, eventTimestamp, metadata` |
| Session lifecycle | `object-hunt/page.tsx:94-98,213-219` | `startSession(patientId)` on mount (once), `buildDailySummary()` + `endSession()` + `router.push('/')` on goHome |
| Nav | `src/components/layout/PatientNav.tsx` | `onBack={isSessionActive ? undefined : () => router.push('/')}` — already object-hunt's pattern; word-stream currently always passes onBack (bug to fix in this batch) |
| Objects/audio | `src/lib/engine/objects.ts` `pickObjects()`, `src/lib/audio/speech.ts` `speak()` | Reused as-is for Quick Tap's flashing items |
| i18n | `src/lib/i18n/locales/en.json:8-29` | `game.quickTap.name/instruction`, `game.pathMatch.name/instruction` already exist — no new keys needed |
| Tests | `src/tests/games.test.tsx` | Vitest + RTL, `fake-indexeddb/auto`, `vi.mock('next/navigation', ...)` with a **module-scope stable router object** (not a fresh literal per call — caused infinite-loop timeouts previously) |

## Files to Change
| File | Action | Why |
|---|---|---|
| `src/components/games/SessionComplete.tsx` | REWRITE (currently `return null` stub) | Shared end-of-session screen for all 4 games |
| `src/components/games/PathCanvas.tsx` | REWRITE (currently `return null` stub) | SVG path-tracing canvas for Path Match |
| `src/lib/engine/scoring.ts` | UPDATE | Add `computeDPrime`/`starsFromRate` helpers alongside existing `scoreRecall` |
| `src/app/games/quick-tap/page.tsx` | REWRITE (currently 3-line stub) | Full Quick Tap game |
| `src/app/games/path-match/page.tsx` | REWRITE (currently 3-line stub) | Full Path Match game |
| `src/app/games/object-hunt/page.tsx` | UPDATE | Swap `session_complete` inline JSX for shared `SessionComplete` |
| `src/app/games/word-stream/page.tsx` | UPDATE | Swap result screen for shared `SessionComplete`; fix `onBack` to respect `isSessionActive` |
| `src/tests/games.test.tsx` | UPDATE | Add new test cases (see Task 7) |

## Tasks

### Task 1: `src/lib/engine/scoring.ts` — scoring helpers
- **Action**: Add `computeDPrime(hits, totalTargets, falseAlarms, totalNonTargets): number` using the spec's simplified linear approximation (clamped hit/FA rates 0.01-0.99, `(rate-0.5)*5.55`), and `starsFromRate(rate: number): number` (`Math.max(1, Math.round(rate * 5))`).
- **Validate**: unit tests in Task 7.

### Task 2: `src/components/games/SessionComplete.tsx`
- **Action**: Props `{ gameType: GameType; stars: number; correctCount: number; totalCount: number; onGoHome: () => void }`. Star row (`⭐`/`☆`), count line, 5-tier encouragement message (banned-word list respected), `BigButton` "Back to Home" variant `success`. `useEffect` speaks the encouragement message once on mount.
- **Mirror**: `object-hunt/page.tsx:262-267` session_complete block.

### Task 3: `src/components/games/PathCanvas.tsx`
- **Action**: SVG `viewBox="0 0 400 600"`, circles r=28 with upcoming/current/completed fill states (CSS pulse on current), numbered labels, completed-path `<line>` segments, shake animation via a CSS class toggled by `wrongTap` prop. `onPointerDown` on `<svg>`: map client coords to viewBox space via `getBoundingClientRect()` + scale factor, nearest-circle-within-40px lookup calls `onPointTap(index)`.

### Task 4: `src/app/games/quick-tap/page.tsx`
- **Action**: Phase machine `instruction → playing → round_complete → session_complete`, mirroring object-hunt's structure. `LEVELS` record with displayDuration/itemsPerRound/targetPct per spec table. Sequence generator mixes target/non-target items matching level's target percentage via `pickObjects`. Tap-anywhere via one large div covering bottom 70%; hit/false-alarm/miss classified per item against a `setTimeout` matching `displayDuration`, with a per-item handled-flag to prevent a late timeout firing after a tap already resolved it. Each item logs one `logEvent` call. Round-complete computes hitRate/falseAlarmRate/dPrime via `computeDPrime`, stars via `starsFromRate`; session_complete phase renders shared `SessionComplete`.
- **Mirror**: object-hunt phase/effect structure; word-stream's `queueMicrotask` pattern.

### Task 5: `src/app/games/path-match/page.tsx`
- **Action**: Phase machine per spec. `generatePointLayout(numPoints, level)`: fixed, hand-verified coordinate sets per level (not runtime jitter) so ≥60px spacing holds by construction. `currentTarget` starts at 1, `PathCanvas` wired with `points`, `currentTarget - 1` as index, `completedPath` from consecutive completed pairs. Timer only for L3+, `text-danger` under 10s, 0 forces round_complete with partial score. `onPointTap` checks against `currentTarget - 1`; wrong tap sets `wrongTapShowing` 300ms (cleanup on unmount); "Good!" speech every 3rd correct tap. Round-complete computes `score`, stars, `adjustDifficulty` + `updateDifficulty`, logs `logEvent` with `completedConnections/totalConnections/timeUsedMs/wrongTaps`.
- **Mirror**: object-hunt's `keepGoing`/`finishSession`/`goHome` trio.

### Task 6: Retrofit existing pages
- **Action**:
  - `object-hunt/page.tsx`: keep `round_complete` block as-is; swap only `session_complete` JSX for `<SessionComplete gameType="object_hunt" stars={stars} correctCount={correctCount} totalCount={targetOrder.length} onGoHome={goHome} />`.
  - `word-stream/page.tsx`: swap `isRecall && result` block for `SessionComplete`; fix `PatientNav onBack` to `isSessionActive ? undefined : () => router.push('/')`.
- **Validate**: existing `pages.test.tsx`/`games.test.tsx` still pass.

### Task 7: Tests first (TDD) — `src/tests/games.test.tsx` additions
- `computeDPrime`: hits>FAs → positive; equal rates → ~0
- `starsFromRate`: 1.0→5, 0.0→1 (clamp), 0.5→3
- Quick Tap: tap during target item logs hit (`isCorrect: true`); tap during non-target logs false alarm (`isCorrect: false`)
- Path Match: `generatePointLayout` deterministic, pairwise distance ≥60px for a representative level
- PathCanvas: tap within 40px of a rendered circle fires `onPointTap` with correct index
- SessionComplete: correct star count + matching message per tier; no banned word (wrong/failed/bad/poor/incorrect/mistake/error) across all 5 tiers

## Validation
```bash
npm test
npm run build
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Quick Tap's per-item `setTimeout` racing with rapid taps/unmount | Medium | Per-item handled-flag; clear all timers on phase change/unmount |
| Fixed jitter table producing <60px spacing at some level | Low | Hand-pick coordinates per level, verified once rather than runtime-random |
| SVG pointer hit-testing coordinate mapping (viewBox vs. client px) | Medium | `getBoundingClientRect()` + viewBox scale factor in `onPointerDown` |

## Acceptance
- [ ] All tasks complete
- [ ] `npm test` — zero failures
- [ ] `npm run build` — zero errors
- [ ] Patterns mirrored (phase machine, queueMicrotask, telemetry, difficulty persistence), not reinvented

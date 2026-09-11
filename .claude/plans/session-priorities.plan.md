# Plan: Session Priorities — Offline Auth, Sync Gap, Dashboard Charts, Game UI Audit, Memory Bank UX

**Complexity**: Large (5 priorities, several independently large)

## Summary

Five queued items, ordered by priority. Priority 1 is a regression of the app's
core offline value proposition (device-trust bypass forcing sign-in offline) and
must be diagnosed with real evidence, not assumed fixed. Priority 2 is a second
data-loss-shaped bug in the sync/dashboard-visibility pipeline for short game
sessions. Priorities 3-5 are feature/UX work: dashboard charts, a UI consistency
audit across the later-added games, and a Memory Bank UX pass.

## Step 1 — Diagnose and fix: offline access still blocked by sign-in

**Intent**: Confirm whether the previously-reported device-trust fix is actually
in the current codebase and actually holds, by reading the real device-trust/
kiosk-session logic and reproducing with network hard-disabled on a device that
has already completed onboarding. Distinguish an expected first-time-online
requirement (scenario a — fix onboarding messaging, not code) from a real bug
where a valid local trust token is overridden anyway (scenario b — trace the
exact mechanism: a blocking network call inside the trust check itself, an
uncaught background sync/auth-refresh error bubbling up, or a race between the
trust check and a separate redirect/middleware layer). Fix the root cause if (b).

**Acceptance**:
- Exact failing component/check/redirect identified with evidence from a real hard-offline reproduction, not code review alone
- Scenario (a) vs (b) explicitly determined and stated
- If (b): fix re-verified with the same hard-offline reproduction, plus isolated + 8x full-suite + 3x shuffled-file suite runs (touches shared trust-check state)

## Step 2 — Diagnose and fix: short game sessions (1-2 rounds) not syncing/showing

**Intent**: Reproduce with exactly 1 round of one game and exactly 2 rounds of
another. Check, in order and by direct inspection (not assumption): does a
Dexie record get written at all; does sync attempt to push it, or does a
minimum-session-count/duration gate silently skip it; if it reaches Supabase,
does the dashboard query or a daily_summaries-style aggregation exclude it.
Also explicitly check the sync path itself for the same unawaited-write-races-
downstream-read shape just fixed across all 12 games' logEvent calls. If a
threshold gate exists, decide intentional (surface it to the caregiver,
"session too short to count") vs accidental (remove it, but still reflect a
partial/incomplete session somewhere).

**Acceptance**:
- Exact drop point identified (local write / sync push / dashboard query) via direct data inspection
- Threshold gate, if found, classified and handled (surfaced or removed) rather than left silent
- 1-round and 2-round sessions verified visible in the caregiver dashboard after sync, confirmed with isolated + 8x full-suite + 3x shuffled-file suite runs (touches the sync write path)

## Step 3 — Caregiver dashboard: charting library choice + cognitive trend line

**Intent**: Check package.json for an existing charting dependency; if none,
propose a lightweight well-maintained option (e.g. recharts) and confirm before
installing anything new. Build the single most important visualization first:
a cognitive trend line (accuracy or difficulty level over the last 7/30 days)
on the per-patient caregiver dashboard page, reusing the existing design-system
tokens (no new palette), sized for the existing accessible/elderly-friendly
touch-target and contrast standards, rendering entirely from locally-cached
Dexie data so it works offline after an earlier sync. Must handle the low-data
case explicitly (a patient with 2-3 total sessions should get a clear "not
enough data yet" state, not a broken-looking chart).

**Acceptance**:
- Charting library choice confirmed (existing dep or proposed+approved) before any install
- Trend line renders correctly and fully offline for 0 sessions, 1-2 sessions, and a full dataset, each state covered by a test

## Step 4 — Caregiver dashboard: remaining visualizations + sparse/offline test coverage

**Intent**: Using the charting approach and tokens established in Step 3, add:
a per-game breakdown (session count + average accuracy per game type, bar
chart or small multiples), a session-frequency view (calendar-heatmap or
day-by-day bar for the week/month), and a reminder-adherence chart
(acknowledgment rate per reminder type: medication/hydration/activity/
appointment) over the same time window. Same constraints as Step 3: existing
tokens only, accessible sizing, fully offline-renderable from cached Dexie
data, explicit low-data states.

**Acceptance**:
- All three visualizations implemented, matching Step 3's library/token choices, rendering offline from cache
- Empty-state, sparse-data (1-2 sessions), and full-dataset tests exist for every chart added across Steps 3 and 4, including an explicit offline-rendering-from-cache test

## Step 5 — UI consistency audit: later-added games (report only)

**Intent**: Audit the 9 games added after the original 4 — memory-match,
memory-blocks, memory-span, counting-boxes, double-decision, fish-trace,
frog-leap, larger-number, n-back — against the original 4 (object-hunt,
word-stream, quick-tap, path-match) for: touch-target sizing vs the app-wide
minimum, whether each actually follows the audio-first/icon-first instruction
pattern (not just the originals), visual styling matching the shared design
system rather than one-off choices from the later batch, and feedback-pattern
consistency (star-award floor, non-negative miss language) across all of them,
not just the games already touched by the logEvent-await fix. This step is
investigation and reporting only — no code changes.

**Acceptance**:
- Written inventory covering all 9 games across all 4 consistency dimensions, each finding with a concrete file reference
- No source changes made in this step

## Step 6 — UI consistency audit: fix highest-impact findings

**Intent**: From Step 5's inventory, fix the issues a patient would actually
notice (touch targets, instruction pattern, styling, feedback language) across
the 9 audited games. Do not unilaterally redesign a game whose core interaction
pattern differs meaningfully from the others — flag that for a decision instead
of forcing a rewrite.

**Acceptance**:
- Highest-impact findings from Step 5 fixed across the affected games
- Full test suite still passes after changes

**Out of scope**: Unilaterally redesigning a game's core interaction pattern — flag such cases for a decision instead.

## Step 7 — Memory Bank: improve the add-a-memory UX

**Intent**: Review the current caregiver-facing Memory Bank entry flow (person/
fact/schedule/medication) against the same elderly/caregiver-friendly standard
as the rest of the app. Likely gaps to address: clear visual category selection
(not just a dropdown), a simple photo-upload flow with visible preview for
person entries, an explicit save confirmation rather than a silent redirect,
an at-a-glance grouped view of existing entries with accessible edit/delete,
and guidance/validation against confusing duplicate entries (e.g. two "sons"
with no distinguishing detail).

**Acceptance**:
- The identified UX gaps addressed (category selection, photo preview, save confirmation, grouped view with edit/delete, duplicate guidance)
- Add → reload → still present, edit → persisted, delete → actually removed (not hidden) all verified directly against local storage

## Validation

```bash
npm run build
npm test
```

For Steps 1, 2, and any Memory Bank sync logic touched in Step 7: isolated run, 8x consecutive full-suite, 3x with `--sequence.shuffle.files` — report exact pass counts, not rounded.

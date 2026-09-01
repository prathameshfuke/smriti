# Plan: SMRITI Offline Sync Engine & API Routes

**Complexity**: Large

## Summary
Build the online/offline detection hook, the Dexie→Supabase sync engine (push unsynced records, pull LWW updates), the polling `useSync` hook driving `SyncIndicator`, and the five server-side API routes (`health`, `sync`, `patients`, `alerts` GET, `alerts/[id]` PATCH) that the sync engine and caregiver dashboard depend on. This is the layer that turns SMRITI from "plays games locally" into "caregiver sees data" — everything else in the app already assumes it exists (`SyncIndicator` currently hardcodes `status="synced"` on the home page; every `syncQueue` row written by earlier batches has had nothing to drain it).

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| API route auth | `src/app/caregiver/login/page.tsx`, `src/lib/supabase/client.ts` `createServerClient(cookieStore)` | Route handlers use `createServerClient` + `auth.getUser(token)` for Bearer-token auth (no cookie store available in a fetch-based API call, so pass a no-op cookie store — see Task 1) |
| 501 placeholder convention | `src/app/api/{health,sync,patients,alerts}/route.ts` | All 4 currently return `{ route, status: 'not-implemented' }` at 501 — replaced wholesale by real handlers |
| Local↔wire mapping | `src/lib/db/schema.ts` header comment | camelCase Dexie rows vs snake_case Supabase rows; `lib/db/sync.ts` is explicitly named as the mapping layer |
| Sync-queue-on-write | `src/lib/db/syncQueue.ts`, `src/stores/patientStore.ts` `addPatient` | Existing local writes already populate `syncQueue`; this plan's `syncToServer` is the first consumer that drains it |
| Effect + cleanup + debounce | `src/app/games/quick-tap/page.tsx` timer refs pattern | `useOfflineStatus`'s 2s debounce and `useSync`'s 3s-after-online delay both need timer refs cleared on unmount |
| Store read outside render | `src/hooks/useReminders.ts` `usePatientStore.getState()` | `useSync` reads `currentPatient`/`isSessionActive` the same way inside its interval callback |
| Tests | `src/tests/reminders.test.tsx` | Vitest + RTL, `fake-indexeddb/auto`, real `Date`/timers (fake timers previously caused Dexie-async timeouts — avoid) |

## Files to Change
| File | Action | Why |
|---|---|---|
| `src/hooks/useOfflineStatus.ts` | REWRITE (currently `export {}`) | online/offline events + health-check poll, debounced |
| `src/lib/db/sync.ts` | REWRITE (currently `export {}`) | `syncToServer`, `syncAllPatients` |
| `src/hooks/useSync.ts` | REWRITE (currently `export {}`) | Drives `SyncIndicator`; owns polling cadence |
| `src/app/page.tsx` | UPDATE | Replace hardcoded `<SyncIndicator status="synced" />` with `useSync()` |
| `src/app/api/health/route.ts` | REWRITE | Real health check, no auth |
| `src/app/api/sync/route.ts` | REWRITE | Auth, rate limit, upserts, alert check, response |
| `src/app/api/patients/route.ts` | REWRITE | Auth, patient list with `alertStatus` |
| `src/app/api/alerts/route.ts` | REWRITE | Auth, alert list |
| `src/app/api/alerts/[id]/route.ts` | CREATE | PATCH `is_read`/`is_resolved` |
| `src/lib/supabase/server-auth.ts` | CREATE | Shared Bearer-token → user helper (extracted so 3 routes don't duplicate it) |
| `src/lib/engine/alerts.ts` | CREATE | Pure cognitive-drop math, unit-testable without Supabase |
| `src/tests/sync.test.tsx` | CREATE | TDD tests (see Task 10) |

## Tasks

### Task 1: `src/lib/supabase/server-auth.ts`
- **Action**: `authenticateRequest(request: Request): Promise<{ userId: string } | null>`. Extracts `Authorization: Bearer <token>` (returns `null` if missing/malformed), builds a `createServerClient` with a no-op cookie store (`{ getAll: () => [], set: () => {} }` — API routes authenticate purely off the bearer token, no cookie session), calls `auth.getUser(token)`, returns `{ userId: data.user.id }` on success or `null` on any error. Every route below calls this first and returns `401` on `null`.
- **Mirror**: `src/lib/supabase/client.ts` `createServerClient`'s cookie-store shape.

### Task 2: `src/hooks/useOfflineStatus.ts`
- **Action**: `useOfflineStatus(): { isOnline: boolean }`. State initialized from `navigator.onLine`. `window.addEventListener('online'/'offline', ...)` updates a pending value; a `setTimeout(2000)` commits it to state (debounce — reset the timer on every new event so a flapping connection doesn't thrash the UI). Secondary check: `setInterval(30_000)` does `fetch('/api/health', { signal: AbortSignal.timeout(5000) })`; success sets online (through the same debounce path), failure sets offline. Both event listeners and the interval are cleaned up on unmount.
- **Mirror**: `quick-tap/page.tsx`'s `timersRef` cleanup-on-unmount pattern.

### Task 3: `src/lib/db/sync.ts`
- **Action**:
  - `syncToServer(patientId: string): Promise<{ success: boolean; error?: string }>` — steps exactly as specified: `navigator.onLine` guard, `createBrowserClient().auth.getSession()` guard, read unsynced rows from 4 tables filtered by `patientId`, early-return `{ success: true }` if all four are empty, `fetch('/api/sync', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify({...}), signal: AbortSignal.timeout(15000) })`. On `res.ok`: `db.transaction('rw', ...)` bulk-sets `synced: true` on every row just sent, applies incoming `updates.patients`/`updates.reminders` via last-write-wins (only overwrite a local row when the incoming `updatedAt` is strictly newer), returns `{ success: true }`. On any thrown error (network, timeout, non-2xx) — caught, never rethrown — returns `{ success: false, error: <message> }`.
  - `syncAllPatients(): Promise<void>` — `db.patients.toArray()`, calls `syncToServer` sequentially (not `Promise.all` — one slow/failing patient must not abort the rest, and sequential keeps the 30s server-side rate limit from being hit by parallel requests from the same device).
- **Mirror**: `src/lib/engine/telemetry.ts` for the Dexie read/filter shape.

### Task 4: `src/hooks/useSync.ts`
- **Action**: `useSync(): { syncStatus: 'synced'|'offline'|'syncing'|'pending'; lastSynced: string | null; pendingCount: number; syncNow: () => Promise<void> }`. Uses `useOfflineStatus()` internally. On mount, counts unsynced rows across all 4 tables for `usePatientStore.getState().currentPatient` and sets initial `pendingCount`/status (`offline` if `!isOnline`, else `pending` if count > 0, else `synced`). A `useEffect` watching `isOnline`: on the `false → true` transition, `setTimeout(3000)` then calls `syncAllPatients()` (skipped — timer never started — if `useGameStore.getState().isSessionActive`). A second `setInterval(5 * 60_000)` re-runs `syncAllPatients()` whenever `isOnline` and not mid-session. `syncNow()` is a manual trigger doing the same session-guarded call, setting `syncStatus: 'syncing'` for its duration. Recomputes `pendingCount` after every sync attempt.
- **Mirror**: `src/hooks/useReminders.ts`'s interval + `usePatientStore.getState()` + cleanup structure.

### Task 5: `src/app/page.tsx` integration
- **Action**: Replace `<SyncIndicator status="synced" />` with `const { syncStatus, lastSynced } = useSync();` and `<SyncIndicator status={syncStatus} lastSyncedAt={lastSynced} />`.

### Task 6: `src/app/api/health/route.ts`
- **Action**: `export async function GET() { return Response.json({ ok: true, timestamp: Date.now() }); }` — no auth, no DB call.

### Task 7: `src/app/api/sync/route.ts`
- **Action**: `authenticateRequest` (Task 1) → 401. Module-scope `const lastSyncByUser = new Map<string, number>();` (in-memory, resets on redeploy — documented MVP limitation): if `Date.now() - (lastSyncByUser.get(userId) ?? 0) < 30_000`, return 429; else record `Date.now()`. Parse body (`deviceId`, `lastSyncTimestamp`, `patients: [...]`) — malformed JSON or missing `patients` → 400. For each patient's payload: `supabase.from('game_sessions').upsert(sessions, { onConflict: 'id', ignoreDuplicates: true })`, `.from('telemetry_events').upsert(events, { onConflict: 'id', ignoreDuplicates: true })` (append-only — a retried duplicate becomes a no-op instead of a PK-collision 500), `.from('daily_summaries').upsert(dailySummaries, { onConflict: 'id' })` (full-field update — current-state table, not a log), `.from('reminder_acks').upsert(reminderAcks, { onConflict: 'id', ignoreDuplicates: true })`. After writes, run `checkCognitiveDropAlerts(supabase, patientId, gameType)` (Task 7a) for every distinct `(patientId, gameType)` pair touched by that patient's `dailySummaries`. Fetch `patients`/`reminder_schedules` updated since `lastSyncTimestamp` and unresolved `alerts`, to populate the response. Return `{ serverTimestamp, syncedEventCount, updates: { patients, reminders, alerts } }`.
- **Task 7a — cognitive drop check** (calls into `src/lib/engine/alerts.ts`): for a given `patientId`/`gameType`, `select accuracy_pct, summary_date` from `daily_summaries` `order by summary_date desc limit 8`. Passes the 8 `accuracy_pct` values to the pure `detectCognitiveDrop(history: number[])` helper (Task 7b). If it returns `true`, check for an existing unresolved `alerts` row with matching `patient_id`/`alert_type: 'cognitive_drop'`/today's date — skip if one exists, otherwise insert a new alert (`severity: 'red'`, a generated `title`/`description`).
- **Task 7b — `src/lib/engine/alerts.ts`**: `detectCognitiveDrop(history: number[]): boolean` — `history[0]` is today, `history[1..7]` the 7-day baseline (requires exactly 8 entries, else `false`); computes mean and population stddev of `history[1..7]`, returns `history[0] < mean - 2 * stddev`.
- **Mirror**: none in-repo (first server-side Supabase write path) — grounded directly in `types.ts`'s `Insertable`/`Updatable` helpers for payload shaping.

### Task 8: `src/app/api/patients/route.ts`
- **Action**: `authenticateRequest` → 401. `supabase.from('caregivers').select('id').eq('auth_id', userId).single()` → 404 if no caregiver row. `supabase.from('patients').select('*').eq('caregiver_id', caregiver.id)`. For each patient: latest `daily_summaries` row and unresolved-alert severities, reduce to `alertStatus`: `'red'` if any unresolved `severity: 'red'`, else `'yellow'` if any `'yellow'`, else `'green'`. Return the structured list.

### Task 9: `src/app/api/alerts/route.ts` + `src/app/api/alerts/[id]/route.ts`
- **Action**: `alerts/route.ts` GET: `authenticateRequest` → 401, resolve caregiver same as Task 8, `supabase.from('alerts').select('*').eq('caregiver_id', caregiver.id).order('created_at', { ascending: false })`, return the list. `alerts/[id]/route.ts` PATCH: `authenticateRequest` → 401, parse body for `is_read`/`is_resolved` (at least one required, 400 otherwise), `supabase.from('alerts').update({...}).eq('id', params.id).eq('caregiver_id', caregiver.id)` (caregiver-scoped), return the updated row.

### Task 10: Tests first (TDD) — `src/tests/sync.test.tsx`
- `useOfflineStatus`: initializes from `navigator.onLine`; an `offline` window event flips `isOnline` to `false` after the 2s debounce (real timers, not fake — established lesson in this codebase)
- `syncToServer`: returns `{ success: false, error: 'offline' }` immediately when `navigator.onLine` is `false`, without calling `fetch`
- `syncToServer`: returns `{ success: true }` with no `fetch` call when there is nothing unsynced
- `syncToServer`: on a mocked successful `fetch`, marks previously-unsynced `telemetryEvents` rows `synced: true`
- `syncToServer`: on a mocked `fetch` rejection, returns `{ success: false, error: ... }` and does not throw
- `GET /api/health`: returns `{ ok: true }` with a numeric `timestamp`, no auth required
- `POST /api/sync`: returns 401 with no `Authorization` header
- `GET /api/patients`: returns 401 with no `Authorization` header
- `detectCognitiveDrop`: flags a drop when today's value is more than 2 stddev below the 7-day baseline mean; does not flag a normal day; returns `false` with fewer than 8 data points

## Validation
```bash
npm test
npm run build
npm run lint
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| In-memory rate-limit `Map` doesn't survive serverless cold starts / multi-instance deploys | High (architectural, MVP-accepted) | Documented in the route's own comment as a known limitation, matching the spec's explicit "simple in-memory rate limit... for MVP" framing |
| `insert` on `telemetry_events` throwing on a retried duplicate PK (device re-sends after a dropped response) | Medium | Use `upsert(..., { ignoreDuplicates: true })` instead of plain `insert`, so a retry is a no-op rather than a 500 |
| LWW conflict resolution needs a reliable `updatedAt` on both sides | Medium | Only overwrite local rows when the incoming timestamp is strictly greater than the local one |
| `useSync`'s 5-minute interval and `isOnline`-transition timer both firing near-simultaneously, double-syncing | Low | Both funnel through the same `syncAllPatients()`, and `syncToServer`'s "nothing to sync" early return makes a redundant call cheap, not incorrect |
| Testing `fetch` timeouts (`AbortSignal.timeout`) in jsdom | Low | Mock `global.fetch` directly rather than exercising real timeout behavior |

## Acceptance
- [ ] All tasks complete
- [ ] `npm test` — zero failures
- [ ] `npm run build` — zero errors
- [ ] `npm run lint` — zero problems
- [ ] Patterns mirrored (syncQueue drain, camelCase/snake_case mapping boundary, cleanup-on-unmount), not reinvented

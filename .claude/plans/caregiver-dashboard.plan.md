# Plan: SMRITI Caregiver Dashboard — monitoring, triage, alerts

**Complexity**: Large

## Summary
Build the three caregiver-facing pages (`dashboard`, `patients` list, `patients/[id]` detail with Cognitive/Reminders/History tabs), two new read-only API routes those pages need (`timeline`, `adherence`), a soft-delete path on `patientStore`, and a bottom tab bar. `ScoreGraph` and `TrafficLight` already exist and are fully built (not stubs) — this batch wires them up rather than building them. `CaregiverNav` exists but is unused anywhere and doesn't match the spec (it's a top bar with no active-state highlighting; the spec wants a fixed bottom tab bar) — it gets rewritten in place rather than left as dead code.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Auth-scoped API route | `src/app/api/patients/route.ts`, `src/app/api/sync/route.ts` | `authenticateRequest` → 401, resolve caregiver via `auth_id`, scope every query by `caregiver_id` — **and, per the session's own just-fixed CRITICAL finding, verify the requested `patientId` in the URL actually belongs to that caregiver before querying anything else** |
| Client-side authed fetch | `src/app/caregiver/settings/page.tsx` `createBrowserClient().auth` | New small helper `src/lib/api/client.ts` `authedFetch(path)` — reads the session token once, attaches `Authorization: Bearer`, avoids repeating that boilerplate in 3 pages (the spec's own "no external cache library" intent doesn't forbid a 10-line auth helper, and the existing codebase already flagged triplicated logic as a maintainability problem in an earlier review) |
| Skeleton loading | `src/app/caregiver/layout.tsx` | `<Skeleton>` blocks while `checking`/loading, never a spinner |
| Soft delete | `src/app/reminders/page.tsx` `deleteReminder` (`isActive: false` + re-save) | Same pattern for patients: `isActive: false`, re-`put`, sync-queue entry |
| Tab state | `src/components/ui/ScoreGraph.tsx` internal range tabs | `aria-pressed` buttons, `useState` for active tab, no router-based tab state |
| Bottom-fixed nav w/ active state | *(none exists yet)* | New pattern: `usePathname()` compares against each tab's `href` for `text-primary` vs `text-ink-muted` |
| Tests | `src/tests/sync.test.ts` | Vitest + RTL, mocked `createServerClient`/`createBrowserClient`, real timers |

## Files to Change
| File | Action | Why |
|---|---|---|
| `src/app/api/patients/[id]/timeline/route.ts` | CREATE | Powers `ScoreGraph` on the Cognitive tab |
| `src/app/api/patients/[id]/adherence/route.ts` | CREATE | Powers the Reminders tab |
| `src/lib/api/client.ts` | CREATE | Shared `authedFetch` helper |
| `src/stores/patientStore.ts` | UPDATE | Add `deactivatePatient(patientId)` (soft delete) |
| `src/components/layout/CaregiverNav.tsx` | REWRITE | Top bar → fixed bottom 3-tab bar with active-state highlighting, per spec item 1 |
| `src/app/caregiver/layout.tsx` | UPDATE | Mount the (now bottom-fixed) nav for non-login routes |
| `src/app/caregiver/dashboard/page.tsx` | REWRITE (currently 3-line stub) | Full dashboard |
| `src/app/caregiver/patients/page.tsx` | REWRITE (currently 3-line stub) | Patient list + soft-delete |
| `src/app/caregiver/patients/[id]/page.tsx` | REWRITE (currently 3-line stub) | 3-tab detail page |
| `src/tests/caregiver-dashboard.test.tsx` | CREATE | TDD tests (see Tasks) |

## Tasks

### Task 1: `src/lib/api/client.ts`
- **Action**: `authedFetch<T>(path: string, init?: RequestInit): Promise<T>` — `createBrowserClient().auth.getSession()`, throws a typed error if no session (caller catches and shows the "Could not load data" state), attaches `Authorization: Bearer <token>`, `fetch(path, {...init, headers})`, throws on non-2xx, returns parsed JSON. No retry/cache logic — matches spec's explicit "cache in component state, no external library."

### Task 2: `src/app/api/patients/[id]/timeline/route.ts`
- **Action**: `GET(request, { params })`. `authenticateRequest` → 401. Resolve caregiver, verify `params.id` belongs to that caregiver (query `patients` by `id` + `caregiver_id`) → 404 if not owned (same ownership-check pattern as the just-fixed `/api/sync`, not the pre-fix trust-the-client version). Parse `?range=30d|90d|180d` (default `30d`) → day count. Query `daily_summaries` for that patient within the window, map each row to `{ date: summary_date, accuracy: accuracy_pct, gameType }`, translating `word_stream→word_recall` and `path_match→path_trace` to match `ScoreGraph`'s existing `GameType` union (its `object_hunt`/`quick_tap` already match). Return `{ points: ScorePoint[] }`.

### Task 3: `src/app/api/patients/[id]/adherence/route.ts`
- **Action**: Same auth/ownership pattern. `?range=7d` (default, only range the spec uses). Query `reminder_schedules` (active, for this patient) joined against `reminder_acks` in the window: for each scheduled reminder instance in range, determine acknowledged vs missed. Return `{ overallPct: number, byType: Record<ReminderType, {acked: number; total: number}>, missed: Array<{date, time, label}> }`.

### Task 4: `src/stores/patientStore.ts` — soft delete
- **Action**: `deactivatePatient(patientId: string): Promise<void>` — mirrors `updateDifficulty`'s read-then-transaction-write shape: `db.patients.get(patientId)`, set `isActive: false` + fresh `updatedAt`, `db.transaction('rw', db.patients, db.syncQueue, ...)` (`put` + `buildQueueItem('patients', id, 'update', {...})`), then refresh `allPatients` via `activePatientsFor` so the deactivated patient drops out of the caregiver's active list immediately.
- **Mirror**: `src/app/reminders/page.tsx` `deleteReminder`.

### Task 5: `src/components/layout/CaregiverNav.tsx` — bottom tab bar
- **Action**: Rewrite as a fixed bottom bar: `fixed bottom-0 inset-x-0 h-16 bg-surface-card border-t border-surface-muted`, 3 `Link`s (`LayoutDashboard`/`Users`/`Settings`, unchanged icon choices), each `flex flex-col items-center` with icon + `text-xs` label below, `usePathname()` drives `text-primary` (active, exact or prefix match on the tab's href) vs `text-ink-muted` (inactive), `style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}`.
- **Mount it**: `caregiver/layout.tsx` renders `<CaregiverNav />` after `children` for non-login routes, and pages add `pb-16` (or similar) to their scrollable content so the fixed bar never overlaps the last item — matching `PatientNav`'s sticky-top precedent but at the bottom.

### Task 6: `src/app/caregiver/dashboard/page.tsx`
- **Action**: `useSync()` for `syncStatus`/`lastSynced`/`syncNow`; inline (non-fixed) `SyncIndicator` usage — since `SyncIndicator` is already `fixed bottom-4 right-4`, wrap it in a `relative` container with `!static` override, or render its inner content pattern directly here matching the spec's literal ask ("inline version") — resolved as: a small local `<span>` reproducing the pill's text+icon inline, since `SyncIndicator` itself has no `inline` prop and adding one would be scope creep on a component with an accessibility-reviewed fixed-position contract. `authedFetch('/api/patients')` on mount into component state, `Skeleton` while loading, error state per spec ("Could not load data. Pull to refresh." + "Try Again" `BigButton`). Alert banner when any patient's `alertStatus === 'red'`. Patient list sorted red→yellow→green, each card per spec, tappable → `/caregiver/patients/{id}`. Empty state when the list is empty.

### Task 7: `src/app/caregiver/patients/page.tsx`
- **Action**: Same `authedFetch('/api/patients')` + loading/error pattern. Header with "Add Patient" `BigButton` → `/caregiver/onboarding`. Row list (`TrafficLight` + name + age + language). Trash icon button (48px target) opens a confirm dialog (simple `role="alertdialog"` overlay, no new dependency) → on confirm calls `patientStore.deactivatePatient(id)`, removes the row from local state.

### Task 8: `src/app/caregiver/patients/[id]/page.tsx`
- **Action**: Find the patient from `authedFetch('/api/patients')` (per spec — fetch the list, find by id; a dedicated single-patient endpoint isn't requested). `PatientNav` with name + inline `TrafficLight`. 3-tab bar (`aria-pressed` buttons, `border-b-2 border-primary text-primary` active state, matching `ScoreGraph`'s existing tab-button style for visual consistency).
  - **Cognitive tab**: unresolved alerts for this patient at top (`bg-danger/10`/`bg-warning/10` cards, `TrafficLight` + title + 2-line-clamped description, "Mark Resolved" button → `authedFetch('/api/alerts/{id}', { method: 'PATCH', body: {is_resolved:true} })`, removes it from local state on success). `ScoreGraph` fed by `authedFetch('/api/patients/{id}/timeline?range=...')`. Deviation from spec, documented: the spec asks for a page-level 30d/90d/180d range control, but `ScoreGraph` already has its own internal 7d/30d/90d tabs — this page adds its own outer 30d/90d/180d tabs that re-fetch and pass fresh `data` into `ScoreGraph` on change, and `ScoreGraph`'s own internal tabs remain as further client-side refinement within whatever window was fetched, rather than removing or duplicating logic in the already-tested component. Cognitive-velocity card computes last-7-days vs previous-7-days average accuracy client-side from the fetched timeline points. 2x2 per-game difficulty grid reads `currentPatient.currentDifficulty` + `MAX_LEVEL` from `difficulty.ts` (exported already) + last-played date derived from the timeline data's most recent point per game.
  - **Reminders tab**: `authedFetch('/api/patients/{id}/adherence?range=7d')`, renders overall %, 4 by-type rows with `bg-primary h-2 rounded-full` progress bars, missed-reminders list.
  - **History tab**: current-month 7-column CSS grid, day cells with a status dot sourced from that day's `daily_summaries` (reuses the already-fetched timeline data, filtered to the current month — no extra fetch). Tapping a day with data opens a bottom sheet (`fixed bottom-0 inset-x-0` panel, CSS `transition-transform` slide-in, closes on backdrop tap) showing that day's games/accuracy/reminder-ack count.

### Task 9: Tests first (TDD) — `src/tests/caregiver-dashboard.test.tsx`
- Exact test list to be supplied by the user in the approval step, per this session's established workflow (plan → approval → `tdd-workflow` with an explicit test list). Placeholder tasks pending that list:
  - `deactivatePatient` sets `isActive: false` and writes a sync-queue entry
  - `GET /api/patients/[id]/timeline` returns 404 for a patient not owned by the caller (ownership-check regression guard, mirroring the `/api/sync` fix)
  - `GET /api/patients/[id]/adherence` same ownership guard
  - Dashboard patient-list sort order (red → yellow → green)
  - CaregiverNav bottom bar marks the active tab via `usePathname`

## Validation
```bash
npm test
npm run build
npm run lint
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| `caregiver/layout.tsx`'s known-open bug (checking gate doesn't re-arm on client navigation between protected routes — flagged in an earlier code review, not yet fixed) becomes user-visible now that dashboard/patients pages have real content to flash | Medium | Out of scope for this plan (pre-existing, separately tracked finding); flagging here so it isn't mistaken for a new bug introduced by this batch |
| `ScoreGraph`'s `GameType` union doesn't match `daily_summaries.game_type` values 1:1 (`word_recall`≠`word_stream`, `path_trace`≠`path_match`) | Confirmed, not just a risk | Mapped explicitly in the timeline route (Task 2) rather than altering the existing, already-tested `ScoreGraph` component |
| Adherence calculation (which reminder "instances" in a 7-day window count as missed vs. simply not-yet-due) has real ambiguity — a reminder scheduled only on weekdays needs different expected-instance-counting than one every day | Medium | Compute expected instances from each schedule's own `daysOfWeek` within the window (not a flat count), documented inline in Task 3's implementation |
| No `patients/{id}` single-fetch endpoint exists — every detail-page load re-fetches the full list | Low (matches spec's explicit instruction) | Accepted as specified; not adding an endpoint the spec didn't ask for |

## Acceptance
- [ ] All tasks complete
- [ ] `npm test` — zero failures
- [ ] `npm run build` — zero errors
- [ ] `npm run lint` — zero problems
- [ ] Patterns mirrored (auth+ownership check, Skeleton-not-spinner, soft delete, authed-fetch helper), not reinvented

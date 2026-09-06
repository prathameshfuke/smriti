# Plan: Patient Home Screen, Caregiver Auth & Onboarding

**Source**: free-form spec (not a `.prd.md`)
**Complexity**: Large (6 pages/layouts + 4 assets + 1 new shared component + 1 schema change)

## Summary

Wires the real patient home screen, caregiver magic-link auth, an auth-guarded
caregiver section, a 3-step onboarding wizard, and a settings page — on top of
the component library and stores already shipped this session. Nothing here
touches the game screens themselves (`games/object-hunt` etc. stay stubs).

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Store shape | `src/stores/patientStore.ts` | zustand store, scoped Dexie query in a private helper, `set()` after every write |
| Dexie write + queue | `src/stores/gameStore.ts:88-104` | every local write happens inside `db.transaction(...)` alongside a `buildQueueItem` sync-queue row |
| Component API | `src/components/ui/BigButton.tsx`, `GameTile.tsx` | `'use client'`, typed props interface, inline `style` for touch-target px, Tailwind token classes only |
| Touch targets | `src/components/ui/touchTarget.ts` | named px constants, never a bare number |
| i18n | `src/lib/i18n/provider.tsx` | `useTranslation()` — **not used yet by any page**; this plan keeps pages in raw English strings, matching every existing page/component, and does not newly wire `t()` |
| Tests | `src/tests/components.test.tsx`, `src/tests/fixes.test.ts` | Vitest + RTL, `render`/`screen`/`fireEvent`, no router mocking present anywhere in the repo yet |

## Gaps / Decisions Before Coding

1. **No `LocalCaregiver` Dexie table exists.** Schema only has `patients`, `gameSessions`, `telemetryEvents`, `dailySummaries`, `reminderSchedules`, `reminderAcks`, `syncQueue`. Step 5 of the spec says "save caregiver to Dexie.db." Decision: add a minimal `caregivers` table (`id, authUserId, displayName, role, createdAt`, indexed on `id`) rather than skipping it — onboarding is the only place a caregiver record is ever created, and `patientStore`/`syncQueue` already assume a real `caregiverId` exists.
2. **`settingsStore.caregiverPin` doesn't exist** — the spec's PIN-dialog step names a field that isn't real. The actual store has `caregiverPinHash` + `verifyPin(pin): Promise<boolean>` (PBKDF2, already built this session). Plan uses `verifyPin`, not a raw stored PIN — never re-introduce a plaintext PIN field.
3. **No router-mocking precedent in the repo.** New page tests that call `useRouter()` need a `vi.mock('next/navigation', ...)` — first time this pattern appears in the codebase, so it goes per-test-file, not a global mock (keeps other tests unaffected).
4. **`onSubmit` for magic-link login needs `isSupabaseConfigured()` guard** — every existing Supabase call site checks this first (`client.ts` docstring: "games and reminders work offline without these"); login page must show a clear message rather than throwing when env vars are absent (e.g. local dev without `.env.local`).
5. **PIN dialog 3-attempt/30s lockout is local UI state**, not persisted — a killed tab resets the cooldown. Spec doesn't ask for persistence; not adding any.

## Files to Change

| File | Action | Why |
|---|---|---|
| `smriti/src/lib/db/schema.ts` | UPDATE | Add `LocalCaregiver` interface + `caregivers` table, version stays 1 (additive) |
| `smriti/src/stores/caregiverStore.ts` | CREATE | Holds `currentCaregiver`, `createCaregiver()` — mirrors `patientStore` shape |
| `smriti/src/components/ui/PinPad.tsx` | CREATE | Shared 0-9 keypad grid, 64px keys — used by both the home-screen PIN dialog and onboarding's PIN-creation step, so it's a component, not duplicated markup |
| `smriti/src/app/page.tsx` | REPLACE | Patient home screen (currently the default `create-next-app` boilerplate) |
| `smriti/public/images/game-object-hunt.svg` | CREATE | Placeholder tile art |
| `smriti/public/images/game-word-stream.svg` | CREATE | Placeholder tile art |
| `smriti/public/images/game-quick-tap.svg` | CREATE | Placeholder tile art |
| `smriti/public/images/game-path-match.svg` | CREATE | Placeholder tile art |
| `smriti/src/app/caregiver/login/page.tsx` | REPLACE | Currently a 3-line stub |
| `smriti/src/app/caregiver/layout.tsx` | REPLACE | Currently a pass-through with no auth check |
| `smriti/src/app/caregiver/onboarding/page.tsx` | REPLACE | Currently a 3-line stub |
| `smriti/src/app/caregiver/settings/page.tsx` | REPLACE | Currently a 3-line stub |
| `smriti/src/tests/pages.test.tsx` | CREATE | RED-first tests for all 6 surfaces |

## Tasks

### Task 1: `LocalCaregiver` schema + `caregiverStore`
- **Action**: Add `caregivers: 'id, authUserId'` table; `caregiverStore.createCaregiver()` writes caregiver + enqueues sync row in one transaction, same as `gameStore.endSession`.
- **Mirror**: `src/stores/gameStore.ts:88-104` (multi-table transaction + queue row)
- **Validate**: unit test — create a caregiver, assert row in `db.caregivers` and a matching `syncQueue` entry

### Task 2: `PinPad` shared component
- **Action**: `{ onDigit, onBackspace, disabled? }` props, 3×4 grid (0-9 + backspace), each key 64px via `TOUCH_TARGET_MIN_PX`.
- **Mirror**: `BigButton.tsx` press-scale + focus-ring pattern, `touchTarget.ts` constants
- **Validate**: renders 10 digit buttons + backspace; `onDigit('5')` fires on click; `disabled` blocks input

### Task 3: Patient home screen (`src/app/page.tsx`)
- **Action**: Client component. Reads `usePatientStore().currentPatient`, `useSettingsStore()`. Renders greeting/no-patient state, `LanguagePicker`, 2×2 `GameTile` grid wired to the 4 games with `difficultyLevel` from `currentPatient.currentDifficulty[gameType] ?? 1`, two secondary `BigButton`s, `SyncIndicator`. "My Progress" opens a `PinPad`-backed modal: 3 wrong attempts → 30s `setInterval` countdown, disables the pad, re-enables at 0. On success: `useRouter().push('/caregiver/dashboard')`.
- **Mirror**: `GameTile` API as already shipped; `useSyncExternalStore` pattern from `i18n/provider.tsx` is overkill here — plain zustand hooks suffice since this is a Client Component, not the root layout.
- **Validate**: tests — greeting renders with a patient, "No patient selected" + login button without one, 4 tiles present with correct hrefs, wrong PIN 3x triggers lockout copy, correct PIN calls `router.push`.

### Task 4: 4 placeholder SVGs
- **Action**: Static files, no build step. Each: rounded rect in the specified colour + a simple white glyph (door/box outline, list lines, concentric target circles, numbered dots + connecting line).
- **Validate**: files exist, are valid XML, referenced paths match `page.tsx` exactly.

### Task 5: Caregiver login (`caregiver/login/page.tsx`)
- **Action**: Client component. Email `useState`, `isSupabaseConfigured()` guard before calling `signInWithOtp`; three UI states (idle/success/error) per spec.
- **Mirror**: `client.ts` factory usage pattern; `BigButton` for the CTA.
- **Validate**: tests — submit without Supabase configured shows a config-missing message (mock `isSupabaseConfigured` to return false); submit with a mocked success client shows the success copy; a mocked rejected promise shows `error.message`.

### Task 6: Caregiver auth guard (`caregiver/layout.tsx`)
- **Action**: Client component wrapping `children`. On mount calls `createBrowserClient().auth.getSession()`; `Skeleton` full-page while pending; redirect to `/caregiver/login` via `useRouter()` when no session; render `children` when session exists. **Exempts `/caregiver/login` from the guard** (a login page that redirects to itself is a bug) — checked via `usePathname()`.
- **Mirror**: none in repo (first client-side auth guard) — closest precedent is the `isSupabaseConfigured` guard pattern in `client.ts`.
- **Validate**: tests with a mocked Supabase client — no session → `router.replace('/caregiver/login')` called; session present → children render; login pathname → guard bypassed, children render unconditionally.

### Task 7: Onboarding wizard (`caregiver/onboarding/page.tsx`)
- **Action**: 3-step client-side wizard, one `useState` step index + a form-data object carried across steps. Step 3's "Finish Setup" runs one sequence: `caregiverStore.createCaregiver()` then `patientStore.addPatient()` then `settingsStore.setPin()` then `db.reminderSchedules.bulkPut()` for any quick-add reminders selected, then `router.push('/')`.
- **Mirror**: Task 1's `caregiverStore`, existing `patientStore.addPatient`, `settingsStore.setPin` (already built).
- **Validate**: tests — step dots update on Continue; role/gender/duration BigButton groups are exclusive-select; PIN + confirm mismatch blocks Finish; happy path calls all four writes and navigates.

### Task 8: Settings page (`caregiver/settings/page.tsx`)
- **Action**: `LanguagePicker`, PIN-change flow (current PIN via `verifyPin` then new PIN + confirm then `setPin`), static About block, Log Out (`auth.signOut()` then `router.push('/caregiver/login')`).
- **Mirror**: same PIN pattern as Task 3/7.
- **Validate**: tests — wrong current PIN blocks the new-PIN step; correct current PIN + matching new PINs calls `setPin`; Log Out calls `signOut` and navigates.

## Validation

```bash
cd smriti
npx vitest run src/tests/pages.test.tsx   # RED first, then GREEN
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `caregiver/layout.tsx` auth check runs on every route change and could flash the login redirect before session restores from cookies | Medium | `getSession()` reads local storage synchronously-ish on the client SDK; keep the `Skeleton` loading state until the promise resolves, never render children speculatively |
| PIN-lockout countdown implemented with `setInterval` could leak a timer if the modal unmounts mid-cooldown | Medium | `useEffect` cleanup clears the interval; add a test that unmounts mid-countdown and asserts no leftover timer/act() warning |
| Adding a Dexie table (`caregivers`) is a schema change on an already-shipped `version(1)` | Low | Purely additive (new table key in the same `.stores()` call for version 1) — no installs exist outside this dev machine yet, so no migration path needed |
| Spec's `settingsStore.caregiverPin` doesn't exist | Confirmed, not a risk | Using `verifyPin()`/`caregiverPinHash` instead, as documented above |

## Acceptance
- [ ] All 8 tasks complete, tests written before implementation per file
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass
- [ ] Patterns mirrored (transactions, touch-target constants, BigButton/GameTile APIs) — no new one-off styling conventions
- [ ] No plaintext PIN anywhere; `verifyPin`/`setPin` are the only PIN entry points

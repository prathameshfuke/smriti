# Plan: SMRITI Reminder System — medication, hydration, activity, appointment

**Complexity**: Medium

## Summary
Build the reminder engine (schedule generation, due-now lookup, acknowledgement), the audio-fallback player, a due-reminder hook polled every 60s, the full-screen `ReminderCard` overlay, the `/reminders` management page, and wiring into the patient home screen. `LocalReminderSchedule`/`LocalReminderAck` already exist in `schema.ts`; `src/lib/audio/player.ts` and `src/hooks/useAudioPrompt.ts`/`useOfflineStatus.ts` are currently empty `export {}` stubs.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Engine module shape | `src/lib/engine/telemetry.ts` | Async functions operating on `db.<table>`, returning/upserting typed rows |
| Sync queue on write | `src/stores/patientStore.ts` `addPatient` | Every local write pairs with `buildQueueItem`/`enqueue` from `src/lib/db/syncQueue.ts` — reminder acks are clinical data and must sync too |
| Speech fallback | `src/lib/audio/speech.ts` | Guard `typeof window === 'undefined' \|\| !window.speechSynthesis` before touching the API; no throw |
| Phase/page structure | `src/app/games/quick-tap/page.tsx` | `PatientNav` with `onBack`, `BigButton` variants, `queueMicrotask`-wrapped effect-derived state |
| Auth-gated section | `src/app/caregiver/login/page.tsx` `isSupabaseConfigured()` + `createBrowserClient().auth.getSession()` | Reused here to gate the "Manage Reminders" section on `/reminders` (a patient-facing route, not under `/caregiver/`, so it needs its own inline session check rather than the layout guard) |
| i18n | `src/lib/i18n/locales/en.json:30-36` | `reminder.medication/hydration/activity/done/snooze` already exist; `reminder.appointment` is missing and needs adding |
| Tests | `src/tests/games2.test.tsx` | Vitest + RTL, `fake-indexeddb/auto`, module-scope stable `next/navigation` router mock |

## Files to Change
| File | Action | Why |
|---|---|---|
| `src/lib/audio/player.ts` | REWRITE (currently `export {}`) | HTML Audio with SpeechSynthesis fallback |
| `src/lib/engine/reminders.ts` | CREATE | Schedule generation, due-now query, acknowledgement |
| `src/hooks/useReminders.ts` | CREATE | 60s poll hook, Notification API integration |
| `src/components/ui/ReminderCard.tsx` | CREATE | Full-screen reminder overlay |
| `src/app/reminders/page.tsx` | REWRITE (currently 3-line stub) | Today list + manage/quick-setup (gated) |
| `src/app/page.tsx` | UPDATE | Mount `ReminderCard` via `useReminders` |
| `src/lib/i18n/locales/en.json` | UPDATE | Add `reminder.appointment` key |
| `src/tests/reminders.test.tsx` | CREATE | TDD tests (see Tasks) |

## Tasks

### Task 1: `src/lib/audio/player.ts`
- **Action**: `playAudio(src: string, fallbackText?: string, language?: string): void`. If `src` is non-empty, construct `new Audio(src)`, attach an `error` listener that falls through to speech, call `.play()` wrapped so a rejected promise (autoplay policy, 404) also falls through. If `src` is empty, go straight to speech. Speech path: guard `window.speechSynthesis` exists (log `console.warn` and return if not — never throw), build `SpeechSynthesisUtterance(fallbackText ?? '')`, map `language` via `{ as: 'as-IN', hi: 'hi-IN', en: 'en-IN' }` (default `en-IN`), `window.speechSynthesis.speak(...)`.
- **Mirror**: `src/lib/audio/speech.ts` guard style.

### Task 2: `src/lib/engine/reminders.ts`
- **Action**:
  - `generateDefaultHydrationSchedule(patientId: string): LocalReminderSchedule[]` — 8 rows at `07:00…21:00` (2h step), `reminderType: 'hydration'`, `label: 'Drink water'`, `daysOfWeek: [0,1,2,3,4,5,6]`, `isActive: true`, fresh `uuid()` per row, `updatedAt: new Date().toISOString()`.
  - `saveReminderSchedules(schedules: LocalReminderSchedule[]): Promise<void>` — `db.transaction('rw', db.reminderSchedules, db.syncQueue, ...)`: `bulkPut` the schedules, `bulkPut` a `syncQueue` row per schedule via `buildQueueItem('reminder_schedules', s.id, 'insert', {...s})` (mirrors `patientStore.addPatient`'s write-plus-queue transaction).
  - `getRemindersDueNow(patientId: string): Promise<LocalReminderSchedule[]>` — current `HH:MM` and `getDay()`; query `db.reminderSchedules.where('patientId').equals(patientId)`, filter `isActive`, `daysOfWeek.includes(today)`, and `timeOfDay` within a 2-minute window of now (parse both as minutes-since-midnight, `Math.abs(diff) <= 2`); then exclude any whose `id` has a `reminderAcks` row with `acknowledgedAt` on today's date (fetch `db.reminderAcks.where('patientId').equals(patientId).toArray()`, filter `ack.acknowledgedAt?.slice(0,10) === todayDate`, build a Set of `reminderId`s, filter them out).
  - `acknowledgeReminder(reminderId: string, patientId: string, method: AckMethod): Promise<void>` — build `LocalReminderAck` (`id: uuid()`, `scheduledAt`: today's date + the reminder's `timeOfDay` as an ISO string — look the schedule up via `db.reminderSchedules.get(reminderId)` for its `timeOfDay`, falling back to `new Date().toISOString()` if not found, `acknowledgedAt: new Date().toISOString()`, `ackMethod: method`, `synced: false`), write via `db.transaction('rw', db.reminderAcks, db.syncQueue, ...)` (`add` + `enqueue`).
- **Mirror**: `src/lib/engine/telemetry.ts` `buildDailySummary`'s date-prefix filtering; `src/lib/db/syncQueue.ts` `buildQueueItem`/`enqueue`.

### Task 3: `src/hooks/useReminders.ts`
- **Action**: `useReminders(): { pendingReminder: LocalReminderSchedule | null; clearPendingReminder: () => void }`. On mount: if `typeof Notification !== 'undefined'` and `Notification.permission === 'default'`, call `Notification.requestPermission()` (fire-and-forget, no blocking). `setInterval(tick, 60_000)` calling `tick` once immediately too; `tick` reads `usePatientStore.getState().currentPatient`, if present calls `getRemindersDueNow(patient.id)`, takes the first result, `setPendingReminder` (only if nothing already pending, so a later poll doesn't clobber a card the patient hasn't acted on yet), and if `Notification.permission === 'granted'` fires `new Notification('SMRITI', { body: reminder.label, icon: '/icons/icon-192.png' })`. Cleanup clears the interval on unmount.
- **Mirror**: `src/stores/patientStore.ts` `usePatientStore.getState()` for reading store state outside a component render.

### Task 4: `src/components/ui/ReminderCard.tsx`
- **Action**: Props `{ reminder: LocalReminderSchedule; onAcknowledge: () => void; onSnooze: () => void }`. Overlay `fixed inset-0 bg-black/40 flex items-center justify-center z-50`, card `bg-surface-card rounded-tile mx-4 p-8 shadow-2xl max-w-patient`. Icon map `{ medication: { emoji: '💊', bg: 'bg-primary/20' }, hydration: { emoji: '💧', bg: 'bg-blue-100' }, activity: { emoji: '🚶', bg: 'bg-green-100' }, appointment: { emoji: '📅', bg: 'bg-orange-100' } }`, 80px circle. "It is time for:" + `reminder.label`. `useEffect` on mount: `playAudio('', reminder.label, language)` (language from `useTranslation()`) and focuses the Done button via a `ref`. `BigButton` "Done ✓" variant `success`, full width, `style={{ minHeight: 80 }}`, `onClick={onAcknowledge}`. Below it a plain `<button>` styled as a text link ("Remind me in 15 minutes", `text-ink-muted underline`) that calls `onSnooze()`.
  - **Deviation from spec, documented rather than guessed around**: the spec asks snooze to both call `onSnooze` and arm an internal 15-minute re-trigger. Since `onSnooze` is expected to dismiss the card (unmounting it), an in-card `setTimeout` can't outlive that. No prop exists for a re-show callback. Chosen interpretation: snooze only dismisses; the reminder is not acknowledged, so `useReminders`' next 60s poll naturally picks it back up as still-due, which produces the same "reminded again later" outcome without inventing an unstated prop or a module-level timer that outlives the component.
- **Mirror**: `src/components/games/SessionComplete.tsx` mount-effect + `BigButton` usage.

### Task 5: `src/app/reminders/page.tsx`
- **Action**: `PatientNav title="Reminders"`. **Today** section: load `db.reminderSchedules.where('patientId').equals(currentPatient.id).toArray()` for `currentPatient`, sort by `timeOfDay`; for each, load today's `reminderAcks` (same query/filter as `getRemindersDueNow`'s exclusion set) to show ✓/○ and "Done at HH:MM AM/PM" (`toLocaleTimeString`). **Manage Reminders** section gated on `createBrowserClient().auth.getSession()` (mirrors `caregiver/layout.tsx`'s guard, checked once on mount into a `useState<boolean>`): type-selector `BigButton`s (single-select toggle), label text input, `<input type="time">`, 7 day-toggle buttons (default all selected), "Save Reminder" `BigButton` calling `saveReminderSchedules([...])` with one new `LocalReminderSchedule`. **Quick setup**: "Add morning medication reminder at 8:00 AM" (`saveReminderSchedules` with one row), "Add hourly hydration reminders" → `generateDefaultHydrationSchedule` + `saveReminderSchedules`. List of active reminders with pencil/trash icon buttons (`lucide-react` `Pencil`/`Trash2`, matching `PatientNav`'s `ChevronLeft` import) — trash sets `isActive: false` and re-saves that one row (soft delete, keeps sync/audit trail); pencil pre-fills the Add form for editing (same save path, existing `id`).
- **Mirror**: `src/app/caregiver/settings/page.tsx` form-field styling; `src/components/ui/touchTarget.ts` sizing constants for the day-toggle row.

### Task 6: `src/app/page.tsx` integration
- **Action**: `const { pendingReminder, clearPendingReminder } = useReminders();` near the top. Render `{pendingReminder ? <ReminderCard reminder={pendingReminder} onAcknowledge={...} onSnooze={clearPendingReminder} /> : null}` before the rest of the page content. `onAcknowledge` calls `await acknowledgeReminder(pendingReminder.id, currentPatient.id, 'touch')` then `clearPendingReminder()`.

### Task 7: i18n
- **Action**: Add `"appointment": "Time for your appointment"` to `reminder` in `en.json` alongside the existing 4 keys.

### Task 8: Tests first (TDD) — `src/tests/reminders.test.tsx`
- `generateDefaultHydrationSchedule`: returns 8 rows at the exact times, correct `reminderType`/`label`/`daysOfWeek`
- `getRemindersDueNow`: a reminder scheduled for "now" (mocked `Date`) on today's weekday is returned; one 10 minutes away is not; one already acknowledged today is excluded
- `acknowledgeReminder`: writes a `LocalReminderAck` row with `synced: false` and a matching `syncQueue` entry
- `playAudio`: with empty `src`, falls back to `speechSynthesis.speak` with an utterance whose `lang` matches the language map (mock `window.speechSynthesis`)
- `ReminderCard`: renders the correct emoji/label for each of the 4 `reminderType`s; clicking "Done ✓" calls `onAcknowledge`; clicking the snooze link calls `onSnooze`
- `useReminders`: (via a small test harness component) after advancing fake timers 60s with a due reminder in a mocked `getRemindersDueNow`, `pendingReminder` becomes non-null

## Validation
```bash
npm test
npm run build
npm run lint
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| `Notification` global undefined in jsdom/tests | High | Guard every access behind `typeof Notification !== 'undefined'`; tests stub it only where needed |
| Snooze "internal 15-minute re-trigger" spec is structurally ambiguous (component unmounts on dismiss) | Medium | Document the chosen interpretation (rely on the next poll cycle) in the TDD evidence report instead of guessing at an unstated prop |
| `HTMLMediaElement.play()` unimplemented in jsdom (throws "not implemented") | Medium | Wrap `.play()` in try/catch alongside the `error` event listener so both sync throws and async rejections fall through to speech |
| Reminders page's own auth-session check duplicating `caregiver/layout.tsx` logic | Low | Accept the duplication — this route is intentionally patient-facing and outside the caregiver auth guard, so it needs its own inline check |

## Acceptance
- [ ] All tasks complete
- [ ] `npm test` — zero failures
- [ ] `npm run build` — zero errors
- [ ] `npm run lint` — zero problems
- [ ] Patterns mirrored (syncQueue-on-write, speech guard, queueMicrotask effect convention), not reinvented

# SMRITI — Agent Development Prompts
## For Claude Code / Cursor / Superpowers / GSD

---

## How to Use This Document

Each section below is a **self-contained prompt** you paste into your AI coding agent (Claude Code, Cursor, Windsurf, etc.) to build one piece of SMRITI. Run them in order. Each prompt references the project structure and design system from the other docs.

**Before starting:** Feed the agent these docs as context:
1. `01_PRD.md` — What we're building
2. `02_ARCHITECTURE.md` — How it's structured
3. `03_DATABASE.md` — Data layer
4. `04_GAME_DESIGN.md` — Game mechanics
5. `05_DESIGN_SYSTEM.md` — Visual design rules

---

## Prompt 1: Project Scaffold

```
/gsd Create the SMRITI project from scratch.

1. Run: npx create-next-app@latest smriti --typescript --tailwind --app --src-dir --use-npm
2. cd smriti
3. Install these exact dependencies:
   npm install dexie dexie-react-hooks @supabase/supabase-js @supabase/ssr zustand recharts next-pwa lucide-react uuid
   npm install @types/uuid -D

4. Create the full directory structure as specified in 02_ARCHITECTURE.md section 2.

5. Configure tailwind.config.ts with the exact colour palette, font sizes, spacing, and
   border-radius values from 05_DESIGN_SYSTEM.md section 9.

6. Configure next.config.js with next-pwa as shown in 02_ARCHITECTURE.md section 4.

7. Create public/manifest.json as shown in 06_DEPLOYMENT.md section 3.4.

8. Create .env.local.example with placeholder Supabase variables.

9. Create src/lib/supabase/client.ts with browser and server Supabase client setup.

10. Create src/lib/db/schema.ts with the full Dexie.js IndexedDB schema from
    03_DATABASE.md section 2.

Do not add any UI yet — just the scaffold, config, and data layer.
Commit: "chore: initial project scaffold with PWA, Supabase, and Dexie setup"
```

---

## Prompt 2: Design System Components

```
/gsd Build SMRITI's core UI component library. These are NOT generic components — they are
specifically designed for elderly dementia patients. Follow 05_DESIGN_SYSTEM.md exactly.

Create these components in src/components/ui/:

1. BigButton.tsx
   - 72px minimum height, 22px bold text
   - Props: label (string), icon? (LucideIcon), onClick, variant ('primary'|'secondary'|'success')
   - Background: var(--color-primary) for primary
   - Active state: scale(0.97), NOT a colour change
   - Touch target: 64px minimum
   - Plays a subtle click sound on press (optional audio prop)

2. GameTile.tsx
   - 140x140px minimum, card surface background
   - Props: gameName, illustration (image path), difficultyDots (1-10), onClick
   - 2px border, 16px border-radius
   - Shows game name in selected language below illustration
   - Difficulty shown as small filled/empty dots at bottom

3. AudioPrompt.tsx
   - Invisible component that manages audio playback
   - Props: src (audio file path), autoplay?, onComplete?
   - Uses HTML5 Audio API
   - Handles: play, pause, replay
   - Shows a small speaker icon with pulsing animation while playing

4. ProgressRing.tsx
   - Circular progress indicator (SVG)
   - Props: percentage (0-100), size ('sm'|'md'|'lg'), colour
   - Used for session progress and accuracy display
   - Animated fill on mount (300ms ease-out)

5. TrafficLight.tsx
   - Simple filled circle
   - Props: status ('red'|'yellow'|'green'), size (default 24px)
   - Colours from design system: success/warning/danger

6. SyncIndicator.tsx
   - Small pill in bottom-right corner
   - Props: status ('synced'|'offline'|'syncing'|'pending'), pendingCount?
   - Uses useOfflineStatus hook internally
   - Shows: green dot "Synced" / grey "Offline" / spinning "Syncing..." / yellow "3 pending"

7. ScoreGraph.tsx
   - Recharts LineChart wrapper
   - Props: data (array of {date, accuracy, gameType}), timeRange ('30d'|'90d'|'180d')
   - One line per game type with design system colours
   - Responsive, min-height 200px
   - Dots at data points, highlighted red dots for sudden drops

Use Tailwind with the custom design tokens. No CSS modules, no styled-components.
No generic UI library (no shadcn, no MUI, no Chakra).
Every component must be accessible: proper aria labels, keyboard navigable.

Commit: "feat: core UI component library for elderly-friendly design"
```

---

## Prompt 3: Home Screen & Navigation

```
/gsd Build SMRITI's home screen and navigation. Two modes: Patient and Caregiver.

1. src/app/layout.tsx
   - Root layout with PWA meta tags, viewport settings
   - Load Noto Sans font family (system font stack fallback)
   - Wrap with language provider (src/lib/i18n/provider.tsx)
   - Wrap with Zustand store providers
   - Background: var(--color-bg) #FAF7F2
   - No global navigation bar for patient screens

2. src/app/page.tsx — Patient Home Screen
   - Top: "Namaste, [Patient Name]!" in large text (36px) with patient's photo placeholder
   - Middle: 2x2 grid of GameTile components for the 4 games
   - Bottom: Two BigButtons — "Reminders" and "My Progress" (for caregiver)
   - "My Progress" requires caregiver PIN (simple 4-digit stored locally)
   - SyncIndicator in bottom-right corner
   - Language picker: small flag/text toggle in top-right (AS | HI | EN)

3. src/app/caregiver/layout.tsx
   - Auth guard: check Supabase session, redirect to login if not authenticated
   - Simple top bar: "SMRITI" logo text + patient selector dropdown + logout button
   - Bottom navigation (mobile): Dashboard | Patients | Reminders | Settings

4. src/components/layout/PatientNav.tsx
   - Minimal: just a "Back to Home" button (large, top-left) on game/reminder screens
   - No hamburger menu, no tabs, no complex navigation

5. src/components/layout/LanguagePicker.tsx
   - Three large tap targets: "অসমীয়া" | "हिन्दी" | "English"
   - Saves selection to local storage and Zustand store
   - Changes all UI text and audio prompts immediately

6. src/lib/i18n/provider.tsx + src/lib/i18n/locales/
   - Simple key-value translation system (no i18next bloat)
   - Create locales/as.json, locales/hi.json, locales/en.json
   - Keys: home.greeting, home.startSession, game.correct, game.tryAgain, etc.
   - Provider: React context with useTranslation hook

Design rules from 05_DESIGN_SYSTEM.md:
- Patient screens: max-width 480px, centered
- No more than 6 tappable elements visible at once
- Every button has an audio label (plays on long-press or first-visit)
- Background: warm off-white #FAF7F2, NOT pure white

Commit: "feat: home screen with patient/caregiver modes and language switching"
```

---

## Prompt 4: Object Hunt Game (Core Game)

```
/gsd Build the "Kotha Khoj" (Object Hunt) game — SMRITI's core episodic memory game
based on CANTAB Paired Associates Learning.

Follow the exact specification from 04_GAME_DESIGN.md Game 1.

Create: src/app/games/object-hunt/page.tsx + src/components/games/ObjectGrid.tsx

Game flow:
1. INSTRUCTION PHASE (5 seconds):
   - Play audio instruction in selected language: "Watch carefully where each object hides!"
   - Show animated demo of one door opening/closing (teaches the mechanic without text)

2. REVEAL PHASE:
   - Grid of doors appears (size based on difficulty level table in 04_GAME_DESIGN.md)
   - Each door opens sequentially, reveals a NER cultural object image, then closes
   - Duration per door: based on difficulty level (3s to 1s)
   - Objects are randomly selected from the cultural asset pool

3. RECALL PHASE:
   - One target object appears large in the center with audio: "Where was the [object name]?"
   - Patient taps a door
   - Correct: door opens, object glows green, encouraging audio plays
   - Wrong: correct door briefly highlights (yellow pulse), gentle audio "Let's try the next one"
   - Repeat for each object that was shown (2-8 based on difficulty)

4. ROUND COMPLETE:
   - Show stars earned (1-5, minimum 1 always)
   - Show accuracy as big number: "4 out of 5!"
   - Audio: "Bhaal kaam!" (Good work!)

Technical requirements:
- All game logic runs locally (no API calls during gameplay)
- Use src/lib/engine/difficulty.ts for adaptive difficulty (from 04_GAME_DESIGN.md)
- Log every event to Dexie.js telemetry_events table via src/lib/engine/telemetry.ts
- Game images: use placeholder SVG illustrations initially (colourful, flat, 128x128)
  - Create 12 placeholder NER object illustrations as inline SVGs
- Audio: create placeholder audio files (can be empty MP3s — structure matters)

State management:
- useGameSession hook manages: currentRound, score, difficulty, events[]
- On session complete: save to Dexie.js, update daily_summary, run difficulty adjustment

Animation:
- Door open: translateY(-10px) + opacity transition (200ms)
- Correct: scale pulse (300ms)
- Wrong: subtle shake (200ms)
- No particle effects, no confetti

Commit: "feat: Object Hunt (Kotha Khoj) game — CANTAB PAL-based episodic memory"
```

---

## Prompt 5: Remaining Games

```
/gsd Build the remaining 3 SMRITI games. Follow 04_GAME_DESIGN.md exactly for each.

1. Word Stream (Xobdo Xuwori) — src/app/games/word-stream/page.tsx
   - Delayed recall mechanic: items shown at session start, recalled at session end
   - Uses a "session memory" stored in Zustand (not persisted between sessions)
   - Grid of items (real + distractors) for recall phase
   - Tap to select, tap again to deselect
   - Submit button when done
   - Scoring: hits, misses, false alarms

2. Quick Tap (Beg Beg) — src/app/games/quick-tap/page.tsx
   - Items flash one at a time in center of screen
   - Target shown in top-right corner as reference
   - Patient taps screen when target appears, ignores non-targets
   - Track hits, misses, false alarms, d-prime
   - Speed based on difficulty level

3. Path Match (Baat Milao) — src/app/games/path-match/page.tsx
   - Numbered circles on a canvas
   - Patient taps in sequence: 1 → 2 → 3 → ...
   - Lines draw between correctly tapped points
   - Wrong tap: circle flashes, no penalty, stays on current number
   - Timer at higher difficulty levels
   - Use HTML Canvas or SVG for the path drawing

All games must:
- Use the same telemetry logging pattern as Object Hunt
- Use the same difficulty adjustment engine
- Work completely offline
- Have audio instructions in all 3 languages
- Show encouraging feedback even on wrong answers
- Never display a "Game Over" or "You Lost" message
- End with stars (always at least 1) and positive audio

Commit: "feat: Word Stream, Quick Tap, and Path Match games"
```

---

## Prompt 6: Reminder System

```
/gsd Build SMRITI's reminder system (medication, hydration, activities, appointments).

1. src/app/reminders/page.tsx — Reminder configuration (caregiver)
   - List of active reminders with edit/delete
   - "Add Reminder" flow: type → label → time → days of week → save
   - Reminders stored in Dexie.js locally, synced to Supabase

2. Reminder notification engine:
   - Use the Notification API (request permission on first caregiver setup)
   - Schedule local notifications based on reminder_schedules
   - On notification tap: show reminder card with large "Done ✓" button
   - Patient acknowledges → save to reminder_acks with ack_method: 'touch'
   - If no ack within 15 minutes → repeat notification once

3. Reminder card UI:
   - Full-screen overlay on patient home screen
   - Large icon (pill, water glass, walking person, calendar)
   - Label in selected language: "Time for your red pill"
   - Audio plays automatically in selected language
   - Giant green "Done ✓" button (full-width, 80px height)
   - Smaller grey "Snooze 15 min" button below

4. Hydration auto-reminders:
   - Default: every 2 hours between 7 AM and 9 PM
   - Caregiver can adjust interval and waking hours
   - Pre-configured, no setup needed

5. All ack data stored locally and synced to Supabase for dashboard

Commit: "feat: reminder system with local notifications and adherence tracking"
```

---

## Prompt 7: Caregiver Dashboard

```
/gsd Build the caregiver dashboard. This is the monitoring interface for family members
and ASHA workers.

1. src/app/caregiver/dashboard/page.tsx — Overview
   - Patient list with TrafficLight indicators (RED/YELLOW/GREEN)
   - Sorted: RED first, then YELLOW, then GREEN
   - Each patient card shows: name, last session date, today's accuracy %, adherence %
   - Tap patient → drill into detail view

2. src/app/caregiver/patients/[id]/page.tsx — Patient Detail
   - Tabs: "Cognitive" | "Reminders" | "History"
   - Cognitive tab:
     - ScoreGraph component showing 30-day accuracy trends per game
     - Current difficulty levels per game
     - "Cognitive velocity" indicator: trending up ↑, stable →, declining ↓
   - Reminders tab:
     - This week's reminder adherence (% acknowledged)
     - Missed reminders list
     - Edit reminder schedules
   - History tab:
     - Calendar view: green/yellow/red dots per day
     - Tap day → see session details

3. Alert system (src/app/caregiver/dashboard):
   - Alert banner at top of dashboard when RED alerts exist
   - Alert details: what happened, what to check, when
   - "Mark as resolved" button
   - Rate-limited: max 1 RED alert per patient per 48 hours

4. Data flow:
   - Dashboard reads from Supabase (NOT local IndexedDB)
   - Requires online connectivity
   - Show clear "Last synced: X hours ago" timestamp
   - "Sync now" button forces a sync attempt

Design: Follow caregiver dashboard rules from 05_DESIGN_SYSTEM.md
- Professional, clean, information-dense but not cluttered
- Use the caregiver font size (18px base)
- Charts: simple, clear, no 3D effects
- Accessible colour choices (don't rely on colour alone for status)

Commit: "feat: caregiver dashboard with cognitive tracking and alert triage"
```

---

## Prompt 8: Sync Engine

```
/gsd Build SMRITI's offline-first sync engine. This is the most critical infrastructure
piece — it must be rock-solid.

Follow 02_ARCHITECTURE.md sections 3.1, 3.2, 3.3 exactly.

1. src/lib/db/sync.ts — Core sync logic
   - Function: syncToServer()
     - Read all records where synced === false from Dexie.js
     - Batch into chunks of 50
     - POST to /api/sync
     - On success: mark records as synced: true
     - On failure: increment retry count, retry after exponential backoff
     - Track last successful sync timestamp

   - Function: pullFromServer(lastSyncTimestamp)
     - GET updated patient profiles and reminder schedules from server
     - Apply LWW merge: if server updatedAt > local updatedAt, overwrite local
     - Never overwrite local telemetry (append-only)

2. src/hooks/useSync.ts
   - Hook that manages sync state
   - Returns: { syncStatus, lastSynced, pendingCount, syncNow }
   - Auto-syncs when online status changes (navigator.onLine)
   - Auto-syncs every 5 minutes when online
   - Never syncs during active game session (would cause jank)

3. src/hooks/useOfflineStatus.ts
   - Monitors navigator.onLine + periodic fetch probe to /api/health
   - Returns: { isOnline, isChecking }
   - Debounced to avoid flapping

4. src/app/api/sync/route.ts — Server-side sync endpoint
   - Validates Supabase JWT
   - Receives: { patientId, events[], dailySummaries[], reminderAcks[], lastSyncTimestamp }
   - Writes to Supabase tables (upsert for summaries, insert for events)
   - Runs check_cognitive_alerts() function for the patient
   - Returns: { serverTimestamp, updatedProfiles[], updatedReminders[], alerts[] }

5. src/app/api/health/route.ts — Simple health check
   - Returns { ok: true, timestamp: Date.now() }
   - Used by offline detection probe

6. Service Worker registration (handled by next-pwa, but verify):
   - Cache audio and image assets on install
   - Network-first for API calls
   - Cache-first for static assets

Error handling:
- Network timeout: 10 seconds, then mark as failed
- Max 3 retries per sync batch before giving up (retry on next cycle)
- Never lose local data on sync failure
- Log sync errors to a local sync_errors table for debugging

Commit: "feat: offline-first sync engine with LWW conflict resolution"
```

---

## Prompt 9: Auth & Patient Management

```
/gsd Build authentication and patient management flows.

1. src/app/caregiver/login/page.tsx
   - Simple email input + "Send Magic Link" button
   - Or: phone number + "Send OTP" (if Twilio configured)
   - Uses Supabase Auth
   - On success: redirect to /caregiver/dashboard
   - On first login: redirect to /caregiver/onboarding

2. src/app/caregiver/onboarding/page.tsx
   - Step 1: "What is your name?" + "What is your role?" (family/ASHA/nurse)
   - Step 2: "Add your first patient" — name, age, gender, education years, language
   - Step 3: "Set up reminders" — quick setup for medication and hydration
   - Step 4: "You're ready!" — show how to start a patient session

3. Patient profile management:
   - Add patient: caregiver creates profile with basic info
   - Edit patient: change name, language, session duration
   - Deactivate patient: soft delete (is_active = false)
   - Multiple patients per caregiver supported

4. Session start flow:
   - Caregiver selects patient from home screen
   - Enters 4-digit PIN (set during onboarding, stored locally only)
   - "Starting session for [Name]" → hands device to patient
   - Patient interacts until session ends or caregiver takes device back

5. PIN protection:
   - 4-digit numeric PIN, stored in localStorage (device-local only)
   - Required to: access caregiver dashboard, add/edit patients, change settings
   - NOT required to: play games, acknowledge reminders
   - 3 wrong attempts → 30 second cooldown

Commit: "feat: caregiver auth, onboarding, and patient management"
```

---

## Prompt 10: Polish, Testing & Final Build

```
/gsd Final polish pass for SMRITI. Focus on production readiness.

1. Loading states:
   - Skeleton screens (NOT spinners) for dashboard data loading
   - Game assets: show placeholder tiles until images cached
   - Sync: subtle SyncIndicator, no blocking modals

2. Error boundaries:
   - Wrap each game in an error boundary
   - On game crash: "Something went wrong. Let's go back home." + BigButton
   - Never show stack traces to patients

3. Accessibility audit:
   - Every interactive element has aria-label
   - Focus management: trap focus within modals/game screens
   - Reduced motion: respect prefers-reduced-motion (disable all animations)
   - Screen reader: test with VoiceOver/TalkBack on game screens

4. PWA checklist:
   - Lighthouse PWA score > 90
   - Offline mode: all 4 games playable, reminders fire, scores saved
   - Install prompt: custom "Add to Home Screen" banner on 3rd visit
   - App icon: create simple SMRITI logo (golden circle with brain/lotus motif)

5. Performance:
   - Bundle analysis: npx @next/bundle-analyzer
   - Target: <150KB JS gzipped
   - Lazy load: dashboard charts, game assets
   - Image optimization: next/image with WebP

6. Disclaimer footer on every screen:
   "SMRITI supports cognitive engagement. It does not diagnose or treat any condition."
   - Font: 12px, muted text colour
   - Always visible, never hidden behind scroll

7. README.md:
   - Project description
   - Tech stack
   - Setup instructions (link to 06_DEPLOYMENT.md)
   - Screenshots
   - License: MIT

Commit: "chore: production polish — accessibility, error handling, PWA compliance"
```

---

## Build Order Summary

| # | Prompt | Time Estimate | Depends On |
|---|--------|--------------|------------|
| 1 | Project Scaffold | 30 min | Nothing |
| 2 | Design System Components | 2 hours | #1 |
| 3 | Home Screen & Navigation | 2 hours | #1, #2 |
| 4 | Object Hunt Game | 3 hours | #1, #2, #3 |
| 5 | Remaining Games | 4 hours | #4 |
| 6 | Reminder System | 2 hours | #1, #2, #3 |
| 7 | Caregiver Dashboard | 3 hours | #1, #2, #3 |
| 8 | Sync Engine | 3 hours | #1 |
| 9 | Auth & Patient Management | 2 hours | #1, #8 |
| 10 | Polish & Testing | 2 hours | All |

**Total estimated build time with AI agent: 20-25 hours**

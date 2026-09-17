<a name="top"></a>
<p align="center">
  <img src="smriti/src/appicon.png" width="130" alt="SMRITI logo" />
</p>

<h1 align="center">SMRITI</h1>
<p align="center">
  <b>Smart Memory & Reminder Intervention for Therapeutic Independence</b>
</p>
<p align="center">
  Offline-first cognitive care for elderly dementia patients in India's North Eastern Region —
  <br />
  clinically-grounded games, daily reminders, and a live caregiver dashboard, in the patient's own language.
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-offline--first-B3452D?style=flat-square&logo=pwa&logoColor=white" />
  <img alt="Vitest" src="https://img.shields.io/badge/tested_with-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/license-Proprietary-C9A227?style=flat-square" />
</p>

<p align="center">
  Built for <b>SIH26003</b> (Smart India Hackathon) · Issued by <b>MDoNER</b> · Clinical guidance from <b>LGBRIMH Tezpur</b> + <b>ARDSI Guwahati</b>
</p>

<p align="center">
  <img alt="Dementia prevalence in Assam" src="https://img.shields.io/badge/Assam_dementia_prevalence-8.47%25-B3452D?style=for-the-badge" />
  <img alt="Screening tools in NER languages" src="https://img.shields.io/badge/cognitive_screening_tools_in_NER_languages-0-151312?style=for-the-badge" />
  <img alt="Rural specialist shortfall" src="https://img.shields.io/badge/rural_specialist_shortfall-79.5%25-B3452D?style=for-the-badge" />
  <img alt="Monthly infrastructure cost" src="https://img.shields.io/badge/monthly_infra_cost-%240-C9A227?style=for-the-badge" />
</p>

---

<p align="center">
  <img src="smriti/src/smritiweb.png" width="480" alt="SMRITI web banner" />
</p>

### Contents

[Overview](#overview) · [Why SMRITI](#why-smriti) · [Features](#features) · [Architecture](#architecture) · [Cognitive Game Suite](#cognitive-game-suite) · [Offline-First Sync](#offline-first-sync) · [Data Model](#data-model) · [Tech Stack](#tech-stack) · [Project Structure](#project-structure) · [Getting Started](#getting-started) · [Environment Variables](#environment-variables) · [Testing](#testing) · [Documentation](#documentation) · [Roadmap](#roadmap) · [Contributing](#contributing) · [Disclaimer](#disclaimer) · [License](#license) · [Acknowledgments](#acknowledgments)

---

## Overview

**SMRITI** is an offline-first Progressive Web App that turns a caregiver's phone into a cognitive-care kit for an elderly relative living with dementia or mild cognitive impairment (MCI). One device, two modes:

- **Patient Mode** — audio-first cognitive games, daily medication/hydration/activity reminders, and an AI companion, usable by someone who has never touched a smartphone.
- **Caregiver Mode** — a dashboard that turns gameplay into a traffic-light health signal, tracks reminder adherence, flags sudden cognitive decline, and keeps family notified — all without requiring the patient to be online, literate, or fluent in English.

Everything works with the screen off the internet. When connectivity returns, it syncs silently in the background.

## Why SMRITI

| | SMRITI | BrainHQ / Lumosity |
|---|---|---|
| Works fully offline | Yes | No — online-dependent |
| Assamese / Hindi audio-first UI | Yes | No — English-only |
| Designed for caregiver-mediated sessions | Yes | No — solo play |
| Games mapped to validated clinical assessments (CANTAB, MoCA, TMT) | Yes | Partial |
| Built for low-literacy, low-vision rural users | Yes | No — Western-normed UX |
| Monthly running cost | **$0** (free tiers) | Subscription |

> [!NOTE]
> Supervised, computerized cognitive training shows **Hedges' g = 0.57** on global cognition in MCI (2025 meta-analysis, 19 RCTs) — and **triples in effect** when caregiver-supervised rather than solo. SMRITI is built around that finding, not around solo play.

## Features

<table>
<tr>
<td valign="top" width="50%">

**Patient Mode** *(on caregiver's device)*
- 15 cognitive games spanning 4 clinical domains
- Adaptive, ML-assisted difficulty per patient
- Audio-first — no reading required
- 100% playable offline
- NER-cultural imagery (gamosa, one-horned rhino, bamboo baskets, dhol)
- "Ask Smriti" AI companion for conversation & reassurance
- Personalized reminiscence quizzes from real family photos

</td>
<td valign="top" width="50%">

**Caregiver Dashboard**
- Traffic-light triage (red/yellow/green) across all patients
- Longitudinal cognitive graphs (30/90/180 day)
- Reminder adherence tracking
- Sudden cognitive drop detection (>2 SD threshold)
- Family notes & shared updates
- AI-generated caregiver digests
- Google / magic-link authentication, Supabase RLS per caregiver

</td>
</tr>
</table>

## Architecture

```mermaid
flowchart TB
    subgraph Device["Patient Device — Offline-First PWA"]
        direction TB
        UI["Games · Reminders · Companion UI"]
        Store["Zustand State"]
        IDB[("IndexedDB via Dexie.js")]
        SW["Service Worker (Workbox)"]
        UI --> Store --> IDB
        IDB <--> SW
    end

    subgraph Edge["Vercel — Next.js API Routes"]
        direction TB
        Sync["sync"]
        Auth["auth"]
        Patients["patients"]
        Alerts["alerts"]
        AICompanion["ai"]
    end

    subgraph Cloud["Supabase"]
        direction TB
        PG[("PostgreSQL + Row Level Security")]
        SBAuth["Auth — Magic Link + Google"]
        RT["Realtime Channels"]
    end

    subgraph Models["LLM Providers"]
        direction TB
        Groq["Groq — llama-3.1-8b-instant"]
        OR["OpenRouter — fallback"]
    end

    Caregiver["Caregiver Dashboard"]

    SW -->|"sync when online"| Sync
    Sync --> PG
    Auth --> SBAuth
    Patients --> PG
    Alerts --> PG
    AICompanion --> Groq
    AICompanion -.->|"if rate-limited"| OR
    PG -.->|"push"| RT
    RT -.->|"live alerts"| Caregiver
    Caregiver --> Patients
    Caregiver --> Alerts
```

Patient-side state never depends on the network: every game write lands in IndexedDB first, and the UI reacts to that local write immediately. The service worker is the only thing that talks to the server.

## Cognitive Game Suite

Every game maps to a validated neuropsychological assessment — this isn't a generic brain-training app with a dementia label stapled on.

| Game | Clinical basis | What it measures |
|---|---|---|
| **Object Hunt** *(Kotha Khoj)* | CANTAB Paired Associates Learning | Episodic memory — 81% accuracy classifying normal/MCI/Alzheimer's |
| **Word Stream** *(Xobdo Xuwori)* | MoCA Delayed Recall | Verbal memory — 90% sensitivity for MCI detection |
| **Quick Tap** *(Beg Beg)* | CANTAB Rapid Visual Processing + BrainHQ Double Decision | Processing speed & inhibitory control |
| **Path Match** *(Baat Milao)* | Trail Making Test | Executive function & visual scanning |

Plus 11 more games extending the same four domains — Memory Match, Memory Span, Memory Blocks, N-Back, Routine Recall (memory & recall); Double Decision, Counting Boxes, Larger Number (speed & attention); Frog Leap, Fish Trace (executive function); Reminiscence Quiz (personal, photo-based recall).

```mermaid
flowchart LR
    subgraph Episodic["Episodic Memory"]
        G1["Object Hunt"]
        G2["Memory Match"]
        G3["Reminiscence Quiz"]
    end
    subgraph Recall["Verbal & Working Memory"]
        G4["Word Stream"]
        G5["Memory Span"]
        G6["Memory Blocks"]
        G7["N-Back"]
        G8["Routine Recall"]
    end
    subgraph Speed["Processing Speed & Attention"]
        G9["Quick Tap"]
        G10["Double Decision"]
        G11["Counting Boxes"]
        G12["Larger Number"]
    end
    subgraph Executive["Executive Function"]
        G13["Path Match"]
        G14["Frog Leap"]
        G15["Fish Trace"]
    end

    Episodic -.-> Engine["Adaptive Difficulty Engine"]
    Recall -.-> Engine
    Speed -.-> Engine
    Executive -.-> Engine
    Engine -.-> Dashboard["Caregiver Dashboard"]
```

### The games

<p align="center">
  <img src="smriti/public/images/game-object-hunt.png" width="72" title="Object Hunt" alt="Object Hunt" />&nbsp;&nbsp;
  <img src="smriti/public/images/game-word-stream.png" width="72" title="Word Stream" alt="Word Stream" />&nbsp;&nbsp;
  <img src="smriti/public/images/game-quick-tap.png" width="72" title="Quick Tap" alt="Quick Tap" />&nbsp;&nbsp;
  <img src="smriti/public/images/game-path-match.png" width="72" title="Path Match" alt="Path Match" />&nbsp;&nbsp;
  <img src="smriti/public/images/game-memory-match.png" width="72" title="Memory Match" alt="Memory Match" />&nbsp;&nbsp;
  <img src="smriti/public/images/game-memory-span.png" width="72" title="Memory Span" alt="Memory Span" />&nbsp;&nbsp;
  <img src="smriti/public/images/game-memory-blocks.png" width="72" title="Memory Blocks" alt="Memory Blocks" />
  <br /><br />
  <img src="smriti/public/images/game-n-back.png" width="72" title="N-Back" alt="N-Back" />&nbsp;&nbsp;
  <img src="smriti/public/images/game-double-decision.png" width="72" title="Double Decision" alt="Double Decision" />&nbsp;&nbsp;
  <img src="smriti/public/images/game-counting-boxes.png" width="72" title="Counting Boxes" alt="Counting Boxes" />&nbsp;&nbsp;
  <img src="smriti/public/images/game-larger-number.png" width="72" title="Larger Number" alt="Larger Number" />&nbsp;&nbsp;
  <img src="smriti/public/images/game-frog-leap.png" width="72" title="Frog Leap" alt="Frog Leap" />&nbsp;&nbsp;
  <img src="smriti/public/images/game-fish-trace.png" width="72" title="Fish Trace" alt="Fish Trace" />&nbsp;&nbsp;
  <img src="smriti/public/images/game-reminiscence-quiz.png" width="72" title="Family &amp; Life Quiz" alt="Family &amp; Life Quiz" />&nbsp;&nbsp;
  <img src="smriti/public/images/game-routine-recall.png" width="72" title="Routine Recall" alt="Routine Recall" />
</p>
<p align="center"><sub>Object Hunt · Word Stream · Quick Tap · Path Match · Memory Match · Memory Span · Memory Blocks · N-Back · Double Decision · Counting Boxes · Larger Number · Frog Leap · Fish Trace · Family &amp; Life Quiz · Routine Recall</sub></p>

### Reminder icons

<p align="center">
  <img src="smriti/public/images/reminders/medication.png" width="56" title="Medication" alt="Medication" />&nbsp;&nbsp;
  <img src="smriti/public/images/reminders/hydration.png" width="56" title="Hydration" alt="Hydration" />&nbsp;&nbsp;
  <img src="smriti/public/images/reminders/activity.png" width="56" title="Activity" alt="Activity" />&nbsp;&nbsp;
  <img src="smriti/public/images/reminders/appointment.png" width="56" title="Appointment" alt="Appointment" />
</p>
<p align="center"><sub>Medication · Hydration · Activity · Appointment</sub></p>

### Interface icons

<p align="center">
  <img src="smriti/public/images/ask-smriti.png" width="56" title="Ask Smriti" alt="Ask Smriti" />&nbsp;&nbsp;
  <img src="smriti/public/images/caregiver-access.png" width="56" title="Caregiver access" alt="Caregiver access" />&nbsp;&nbsp;
  <img src="smriti/public/images/family-message.png" width="56" title="Family message" alt="Family message" />&nbsp;&nbsp;
  <img src="smriti/public/images/done-acknowledged.png" width="56" title="Seen / done" alt="Seen / done" />&nbsp;&nbsp;
  <img src="smriti/public/images/error.png" width="56" title="Could not connect" alt="Could not connect" />
</p>
<p align="center"><sub>Ask Smriti · Caregiver access · Family message · Seen / done · Could not connect</sub></p>

## Offline-First Sync

```mermaid
sequenceDiagram
    actor Patient
    participant App as PWA (Next.js)
    participant DB as IndexedDB (Dexie.js)
    participant SW as Service Worker
    participant API as /api/sync
    participant Supabase

    Patient->>App: Plays a game
    App->>DB: Write telemetry event (synced: false)
    DB-->>App: Local write confirmed
    App-->>Patient: Instant UI update

    Note over SW: Device regains connectivity
    SW->>DB: Read unsynced records
    SW->>API: POST batch (events, summaries, acks)
    API->>Supabase: Insert / upsert rows
    Supabase-->>API: OK + server timestamp
    API-->>SW: Updated profiles & reminders
    SW->>DB: Mark records synced: true
    SW-->>App: Update sync indicator
```

| Data type | Conflict strategy | Why |
|---|---|---|
| Telemetry events | Append-only | Events are immutable facts — no conflicts possible |
| Daily summaries | Server recomputes from events | Single source of truth |
| Patient profiles | Last-write-wins by `updatedAt` | Caregiver edits win |
| Reminder schedules | Last-write-wins by `updatedAt` | Caregiver is the authority |
| Game difficulty level | Local device is authoritative | Device holds the latest performance data |

## Data Model

```mermaid
erDiagram
    CAREGIVERS ||--o{ PATIENTS : manages
    CAREGIVERS ||--o{ FAMILY_SHARES : invites
    PATIENTS ||--o{ GAME_SESSIONS : plays
    GAME_SESSIONS ||--o{ TELEMETRY_EVENTS : logs
    PATIENTS ||--o{ DAILY_SUMMARIES : summarized_in
    PATIENTS ||--o{ REMINDER_SCHEDULES : has
    REMINDER_SCHEDULES ||--o{ REMINDER_ACKS : acknowledged_by
    PATIENTS ||--o{ ALERTS : triggers
    PATIENTS ||--o{ MEMORY_BANK_ENTRIES : has
    PATIENTS ||--o{ AI_CONVERSATION_LOG : chats
    PATIENTS ||--o{ REMINISCENCE_QUIZZES : personalized_for
    PATIENTS ||--o{ CAREGIVER_DIGESTS : summarized_by
    FAMILY_SHARES ||--o{ FAMILY_NOTES : contains

    CAREGIVERS {
        uuid id PK
        text email
        text auth_provider
    }
    PATIENTS {
        uuid id PK
        uuid caregiver_id FK
        text name
        int education_years
    }
    TELEMETRY_EVENTS {
        uuid id PK
        uuid session_id FK
        text game_type
        boolean is_correct
        int response_time_ms
    }
    ALERTS {
        uuid id PK
        uuid patient_id FK
        text severity
        text reason
    }
```

Full schema, indexes, and Row Level Security policies live in [docs/03_DATABASE.md](smriti/docs/03_DATABASE.md).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Offline storage | Dexie.js (IndexedDB) |
| PWA / offline | `next-pwa` + Workbox service worker |
| Backend | Supabase — PostgreSQL, Auth, Realtime, Row Level Security |
| AI companion | Groq primary, OpenRouter fallback (model slugs change — see `src/lib/ai/llm-client.ts`) |
| Speech synthesis | Bhashini TTS (Assamese/Hindi/English), browser `speechSynthesis` fallback |
| Forms & validation | react-hook-form + zod |
| Charts | Recharts |
| Motion | Framer Motion |
| Audio | Howler.js |
| i18n | next-intl + locale JSON (English, Hindi, Assamese) |
| Testing | Vitest, Testing Library, fake-indexeddb |
| Accessibility typography | Atkinson Hyperlegible (low-vision optimized), Fraunces, Noto Sans Bengali/Devanagari |
| Deployment | Vercel + Supabase — **$0/month** on free tiers |

## Project Structure

<details>
<summary>Expand file tree</summary>

```text
smriti/
├── public/
│   ├── manifest.json         # PWA manifest
│   ├── icons/                # App icons (192, 512, apple-touch)
│   ├── images/                # Game icon set
│   └── audio/                 # Pre-recorded voice prompts (as/hi/en)
├── src/
│   ├── app/
│   │   ├── page.tsx            # Landing page
│   │   ├── app/                # Patient home / game selector
│   │   ├── games/               # 15 game routes
│   │   ├── reminders/           # Reminder flow
│   │   ├── companion/           # "Ask Smriti" AI companion
│   │   ├── login/                # Patient/device login
│   │   ├── caregiver/
│   │   │   ├── dashboard/         # Traffic-light triage
│   │   │   ├── patients/[id]/     # Patient detail + adherence
│   │   │   ├── memory-bank/       # Reminiscence content manager
│   │   │   ├── onboarding/        # New patient setup
│   │   │   └── login/             # Magic link + Google OAuth
│   │   └── api/
│   │       ├── sync/               # Offline → cloud sync
│   │       ├── patients/            # Patient CRUD + timeline
│   │       ├── alerts/               # Cognitive-drop detection
│   │       ├── family-share/          # Family invite + notes
│   │       ├── device-trust/           # Kiosk device trust tokens
│   │       └── ai/                      # Companion, digests, transcription
│   ├── components/
│   │   ├── ui/                 # Design-system primitives
│   │   ├── games/                # Per-game components
│   │   ├── patient/                # Patient-mode chrome
│   │   └── layout/                  # Nav, language picker
│   ├── lib/
│   │   ├── db/                # Dexie schema + sync engine
│   │   ├── engine/               # Difficulty, scoring, alerts
│   │   ├── ai/                     # LLM client (Groq/OpenRouter)
│   │   ├── audio/                    # Playback manager
│   │   ├── i18n/                       # Locales + provider
│   │   └── supabase/                    # Client factories, RLS-aware
│   ├── hooks/                  # useOfflineStatus, useSync, ...
│   └── stores/                  # Zustand stores
└── docs/                          # PRD, architecture, DB, game design, deployment
```

</details>

## Getting Started

> [!TIP]
> The app lives inside the `smriti/` subdirectory of this repo — don't forget the `cd`.

```bash
git clone https://github.com/prathameshfuke/smriti-backup.git
cd smriti-backup/smriti
npm install
cp .env.local.example .env.local
# fill in the keys below, then:
npm run dev
# open http://localhost:3000
```

Install as a PWA on mobile: **Add to Home Screen** (Android Chrome or iOS Safari).

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:ui` | Vitest browser UI |

## Environment Variables

| Variable | Required for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sync, caregiver dashboard | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sync, caregiver dashboard | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side kiosk/device-trust routes | **Never expose to the browser or commit it** |
| `GROQ_API_KEY` | AI companion (primary) | Free at [console.groq.com/keys](https://console.groq.com/keys) |
| `OPENROUTER_API_KEY` | AI companion (fallback) | Used if Groq is rate-limited/unavailable — free at [openrouter.ai/keys](https://openrouter.ai/keys) |
| `BHASHINI_USER_ID` / `BHASHINI_ULCA_API_KEY` | Assamese/Hindi speech-to-text and Assamese/Hindi/English text-to-speech (primary path) | ULCA credential pair from [Bhashini](https://bhashini.gov.in) — used for the config call in `src/lib/ai/bhashini-auth.ts`, which resolves the real service and mints the dynamic key the compute call sends |
| `BHASHINI_INFERENCE_API_KEY` | Legacy fallback for the case above | Kept alongside the pair above: live-probed, this ULCA account's discovery has no registered ASR service for Assamese at all, while this older static key is confirmed still working for it — `bhashini-asr-client.ts`/`bhashini-client.ts` fall back to it only when the primary discovery call fails |
| Google OAuth credentials | Caregiver "Sign in with Google" | See `src/app/api/auth/google/route.ts` |

> [!NOTE]
> Games and reminders work fully offline without any of these — only sync and the caregiver dashboard need them. All AI calls are routed through `src/lib/ai/llm-client.ts`; never call Groq/OpenRouter directly from a feature file.

## Testing

```bash
npm test
```

Vitest + Testing Library, with `fake-indexeddb` standing in for Dexie's IndexedDB backend so offline-storage logic is covered without a browser.

## Documentation

| Doc | Covers |
|---|---|
| [01_PRD.md](smriti/docs/01_PRD.md) | Product vision, features, success metrics |
| [02_ARCHITECTURE.md](smriti/docs/02_ARCHITECTURE.md) | System design, offline data flow |
| [03_DATABASE.md](smriti/docs/03_DATABASE.md) | Full schema, RLS policies, migrations |
| [04_GAME_DESIGN.md](smriti/docs/04_GAME_DESIGN.md) | Clinical specs, difficulty algorithms |
| [06_DEPLOYMENT.md](smriti/docs/06_DEPLOYMENT.md) | Deploying to Vercel + Supabase |
| [07_AGENT_PROMPTS.md](smriti/docs/07_AGENT_PROMPTS.md) | Build guide for AI pair-programming |
| [08_API_SPEC.md](smriti/docs/08_API_SPEC.md) | API route reference |
| [09_PITCH_GUIDE.md](smriti/docs/09_PITCH_GUIDE.md) | Hackathon presentation guide |

## Roadmap

- [x] **Phase 1 — Hackathon MVP:** core games, rule-based difficulty, Assamese/Hindi/English audio, reminders, caregiver dashboard, offline + sync, installable PWA
- [x] Shipped beyond original MVP scope: 15 games (vs. 4 planned), ML-assisted difficulty model, AI companion, family notes, caregiver digests, Google OAuth
- [x] Traffic-light triage dashboard
- [x] Bhashini TTS integration — companion answers + reminder narration, cached locally, browser-TTS fallback
- [ ] Bhashini ASR integration (needs browser recording switched from webm/Opus to wav/flac — Bhashini's ASR only documents those formats)
- [ ] Manipuri + Bodo language support
- [ ] Per-domain Elo rating with dynamic K-value
- [ ] ABHA health-record linkage exploration
- [ ] Pilot deployment with LGBRIMH Tezpur + ARDSI Guwahati (50 patients, IRB-approved protocol)
- [ ] Tele-MANAS referral pathway integration

## Contributing

Contributions are by invitation only. This repo is set up to be worked on alongside an AI coding agent — see [AGENTS.md](smriti/AGENTS.md) for the Next.js version notes agents should read before touching code, and [docs/07_AGENT_PROMPTS.md](smriti/docs/07_AGENT_PROMPTS.md) for the original build-prompt sequence.

## Disclaimer

> [!IMPORTANT]
> SMRITI supports cognitive **engagement**. It does not diagnose or treat any condition, and does not claim to prevent cognitive decline. Consult a healthcare professional for medical concerns.
>
> It does **not**: diagnose dementia · require internet connectivity · require digital literacy from patients · store PII or sensitive health data in the cloud.

## License

Proprietary. Copyright © 2026 SMRITI. All rights reserved.

No part of this software, its source code, or its documentation may be copied, modified, distributed, or used without prior written permission from the copyright holder.

## Acknowledgments

Built with clinical guidance from **LGBRIMH Tezpur** (nodal tertiary geriatric mental health center, NER) and community partnership with **ARDSI Guwahati** (Alzheimer's and Related Disorders Society of India).

Designed using evidence from **CANTAB**, **MoCA**, and 25+ peer-reviewed studies on computerized cognitive training in MCI. Language infrastructure via **Bhashini** (MeitY) and **Project ISHAAN** (AI4Bharat).

---

<p align="center">
  <img src="smriti/src/app/icon.png" width="28" alt="SMRITI web icon" />
  <br />
  <sub>Built for caregivers and ASHA workers, not wealthy urban users.</sub>
  <br />
  <a href="#top">back to top</a>
</p>

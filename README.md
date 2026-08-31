# SMRITI — Smart Memory & Reminder Intervention for Therapeutic Independence

**AI-powered cognitive gaming and caregiver monitoring for elderly dementia 
patients in India's North Eastern Region.**

An offline-first Progressive Web App that delivers clinically-grounded cognitive 
games, daily medication/hydration reminders, and real-time caregiver dashboards — 
designed for low-literacy users, intermittent connectivity, and rural healthcare 
infrastructure.

Built for **SIH26003** (Smart India Hackathon) | Issued by **MDoNER** | 
Designed with **LGBRIMH Tezpur** + **ARDSI Guwahati**

## Why SMRITI?

- **8.47% dementia prevalence in Assam** (above national 7.4%) — underserved
- **Zero cognitive screening tools in NER languages** (Assamese, Manipuri, Bodo, 
  Khasi, Mizo)
- **79.5% specialist shortfall** at rural health centres
- **Existing apps** (BrainHQ, Lumosity) are English-only, online-dependent, 
  Western-normed

SMRITI fills this gap with a **clinically-grounded, culturally-resonant, 
offline-capable** platform built for **caregivers and ASHA workers**, not wealthy 
urban users.

## How It Works

**Patient Mode (on caregiver's device):**
- 4 cognitive games based on **CANTAB-PAL** and **MoCA** screening criteria
- Daily medication + hydration + activity reminders
- Audio-first interface (no reading required)
- 100% offline playable
- NER-cultural imagery (gamosa, one-horned rhino, bamboo baskets, dhol)

**Caregiver Dashboard:**
- Traffic-light triage of patients (RED/YELLOW/GREEN alerts)
- Longitudinal cognitive tracking (30/90/180 day graphs)
- Reminder adherence monitoring
- Sudden cognitive drop detection (>2 SD threshold)
- Sync-when-online design (works offline, syncs silently)

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + PWA
- **Offline:** Dexie.js (IndexedDB) + Workbox caching
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + RLS)
- **Deployment:** Vercel (free tier) + Supabase (free tier) — **$0/month**
- **Languages:** Assamese + Hindi + English (ready for Manipuri, Bodo via Bhashini)

## Clinical Foundation

Every game maps to a **validated neuropsychological assessment:**

- **Object Hunt** — CANTAB Paired Associates Learning (episodic memory)
  - Correctly classifies 81% of normal/MCI/Alzheimer's cases
  
- **Word Stream** — MoCA Delayed Recall protocol
  - 90% sensitivity for MCI detection
  
- **Quick Tap** — CANTAB Rapid Visual Processing + BrainHQ Double Decision
  - Processing speed & inhibitory control
  
- **Path Match** — Trail Making Test
  - Executive function & visual scanning

**Evidence:** Computerized cognitive training shows **Hedges' g = 0.57** effect on 
global cognition in MCI (2025 meta-analysis, 19 RCTs). **Supervised training 
triples effect** vs. unsupervised — SMRITI is designed for **caregiver-mediated 
sessions**, not solo play.

## What SMRITI Does NOT Do

- ❌ Diagnose or treat dementia (engagement tool only)
- ❌ Claim to prevent cognitive decline (Lumosity FTC lesson)
- ❌ Require internet connectivity
- ❌ Require digital literacy from patients
- ❌ Store PII or sensitive health data in the cloud

## Quick Start

```bash
git clone https://github.com/[your-username]/smriti.git
cd smriti
npm install
cp .env.local.example .env.local
# Add Supabase credentials to .env.local (see docs/06_DEPLOYMENT.md)
npm run dev
# Open http://localhost:3000
```

Install PWA on mobile: tap "Add to Home Screen" (Android Chrome) or "Add to Home 
Screen" (iOS Safari).

## Documentation

- **[01_PRD.md](docs/01_PRD.md)** — Product vision, features, success metrics
- **[02_ARCHITECTURE.md](docs/02_ARCHITECTURE.md)** — System design, offline flow
- **[03_DATABASE.md](docs/03_DATABASE.md)** — Schema, RLS policies, migrations
- **[04_GAME_DESIGN.md](docs/04_GAME_DESIGN.md)** — Clinical specs, difficulty algorithms
- **[05_DESIGN_SYSTEM.md](docs/05_DESIGN_SYSTEM.md)** — UI rules, anti-slop guidelines
- **[06_DEPLOYMENT.md](docs/06_DEPLOYMENT.md)** — Deploy to Vercel + Supabase
- **[07_AGENT_PROMPTS.md](docs/07_AGENT_PROMPTS.md)** — 10-prompt build guide (ECC + Claude Code)
- **[09_PITCH_GUIDE.md](docs/09_PITCH_GUIDE.md)** — 6-min hackathon presentation

## Disclaimer

**SMRITI supports cognitive engagement. It does not diagnose or treat any 
condition. Consult a healthcare professional for medical concerns.**

## License

MIT — free for personal, research, and non-profit use.

## Acknowledgments

Built with clinical guidance from **LGBRIMH Tezpur** (nodal tertiary geriatric 
mental health center, NER) and community partnership with **ARDSI Guwahati** 
(Alzheimer's and Related Disorders Society of India).

Designed using evidence from **CANTAB**, **MoCA**, and 25+ peer-reviewed studies 
on computerized cognitive training in MCI.

Language infrastructure via **Bhashini** (MeitY) and **Project ISHAAN** (AI4Bharat).

---

## Shortest (for LinkedIn/social):

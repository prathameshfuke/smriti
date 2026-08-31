# SMRITI — Product Requirements Document (PRD)
## Smart Memory & Reminder Intervention for Therapeutic Independence
### SIH26003 | MDoNER | AI-Based Cognitive Gaming & Memory Assistance for Elderly Dementia Patients in NER

---

## 1. Product Vision

SMRITI is a cross-platform Progressive Web App (PWA) that delivers clinically-grounded cognitive games, daily reminders, and caregiver monitoring for elderly dementia patients in India's North Eastern Region — designed to work offline-first, in regional languages, with zero digital literacy assumed.

**One-liner:** "Clinically validated memory games + medication reminders + caregiver dashboard, built offline-first for low-literacy elderly users in Northeast India's regional languages."

---

## 2. Problem Statement (SIH26003)

- Dementia prevalence in Assam: **8.47%** (above national avg of 7.4%)
- **79.5% specialist shortfall** at rural Community Health Centres
- **Zero** cognitive screening tools validated in NER languages (Assamese, Bodo, Manipuri, Khasi, Mizo)
- Existing apps (BrainHQ, Lumosity, MindMate) are English-first, online-dependent, subscription-based, Western-normed
- Tele-MANAS provides synchronous telecounselling but no asynchronous cognitive training
- Rural NER has intermittent 2G/3G connectivity, hilly terrain, frequent monsoon disruptions

---

## 3. Target Users

### Primary: Elderly Patients (60+)
- Mild Cognitive Impairment (MCI) or early-to-moderate dementia
- Low-to-zero digital literacy
- Speak Assamese, Manipuri, Bodo, Khasi, Mizo, Hindi, or English
- Use a caregiver's or ASHA worker's shared smartphone/tablet

### Secondary: Caregivers
- Family members (often adult children, frequently non-co-resident)
- ASHA workers managing multiple patients across a village
- Nursing staff at primary health centres

### Tertiary: Clinicians
- Geriatric psychiatrists at LGBRIMH Tezpur
- District mental health officers under NMHP

---

## 4. Usage Model

**Caregiver-mediated:** The younger relative or ASHA worker's device is temporarily handed to the patient for a 10-15 minute daily session. The caregiver sets up the profile, selects the language, and initiates the session. The patient interacts via large touch targets and audio prompts. All telemetry syncs to the caregiver dashboard when connectivity returns.

---

## 5. Core Features (MVP — Hackathon Deliverable)

### F1: Cognitive Game Suite (4 games)
Each game maps to a validated clinical construct:

| Game | Clinical Basis | Domain | Mechanic |
|------|---------------|--------|----------|
| **Kotha Khoj** (Object Hunt) | CANTAB-PAL | Episodic Memory | Objects hide under tiles; recall locations. NER-cultural imagery (gamosa motifs, bamboo baskets, one-horned rhino) |
| **Xobdo Xuwori** (Word Stream) | MoCA Delayed Recall | Verbal Memory | 5 local items shown at session start; recall them before session ends ("Market List" game) |
| **Beg Beg** (Quick Quick) | BrainHQ Double Decision / CANTAB-RVP | Processing Speed & Attention | Target appears among distractors; tap it. Speed and accuracy tracked |
| **Baat Milao** (Path Match) | Trail Making Test | Executive Function | Connect numbered checkpoints in order on a simplified village-map layout |

**Design rules:**
- Maximum 3 taps to start a game from home screen
- All instructions via audio + animation, never text-only
- Touch targets minimum 64x64dp
- Session length: 10-15 minutes (configurable by caregiver)
- MoCA-style +1 scoring adjustment for low education built into scoring engine

### F2: Adaptive Difficulty Engine
- **MVP:** Rule-based targeting ~80-85% correct (BrainHQ pattern)
  - Score >80% for 3 consecutive rounds → difficulty +1
  - Score <50% → difficulty -1
  - Prevents frustration-induced agitation (clinically documented risk)
- **Post-MVP:** Per-domain Elo rating with dynamic K-value
- **Never:** Black-box ML for core difficulty — must be explainable to clinicians

### F3: Daily Reminders (ADL Support)
- Medication reminders (caregiver-configured: time, label, colour of pill)
- Hydration reminders (every 2 hours during waking hours)
- Activity reminders (walk, prayer, meals — caregiver-customizable)
- Medical appointment alerts
- Delivered via local notification + pre-cached audio prompt in selected language
- Patient must acknowledge via touch or voice ("haan" / "hobo" / constrained vocabulary)
- Acknowledgment status visible on caregiver dashboard

### F4: Caregiver Dashboard
**Metrics tracked:**
- Cognitive Velocity: longitudinal Elo/ability score plotted over days/weeks/months
- Engagement: % of prescribed sessions completed this week
- ADL Adherence: medication/hydration/activity reminder acknowledgment rate
- Reaction Time Trend: average response latency per game domain

**Alert system (rate-limited to prevent fatigue):**
- RED: Sudden cognitive score drop (>2 SD below 7-day rolling average) — may indicate UTI, TIA, medication non-adherence, or delirium
- YELLOW: Missed 3+ consecutive sessions or <50% reminder adherence for 2 days
- GREEN: Stable or improving scores, high adherence

**UX pattern:** Traffic-light triage list — ASHA workers managing 10+ patients see a sorted list (RED first) with one-tap drill-down

### F5: Multilingual Voice Interface
- **MVP languages:** Assamese + Hindi + English (Assamese has best Bhashini/AI4Bharat support among NER languages)
- **Phase 2:** Manipuri (Meitei script), Bodo
- **Implementation:** Pre-recorded human voice assets for all game instructions and reminders; Bhashini TTS as optional enhancement where mature; constrained-vocabulary ASR for answer validation (listening for finite expected answers only, not open conversation)
- **Fallback:** If ASR fails or is unavailable, patient taps the correct answer icon instead of speaking

### F6: Offline-First Architecture
- All game logic, assets, audio prompts, and patient profiles stored locally (IndexedDB via Dexie.js)
- Games playable with zero connectivity
- Reminders fire from local scheduled notifications
- Telemetry stored as append-only event log locally
- Sync to Supabase when connectivity detected (background sync via Service Worker)
- Conflict resolution: Last-Write-Wins on caregiver-editable fields (reminder schedule, profile); append-only merge on telemetry
- Sync status indicator always visible to caregiver

### F7: Simple Elderly-Friendly UI
- High-contrast colour palette (WCAG AAA)
- Minimum 18sp body text, 24sp headings
- No hamburger menus, no swipe gestures, no abstract icons
- Large illustrated buttons with audio labels
- Home screen: 4 game tiles + "Reminders" + "My Progress" (for caregiver)
- No login required for patient; caregiver authenticates once and adds patient profiles

---

## 6. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Offline capability | 100% game + reminder functionality without network |
| First Contentful Paint | <2s on 3G |
| PWA Lighthouse score | >90 |
| Accessibility | WCAG 2.1 AA minimum |
| Data privacy | All patient data encrypted at rest (Supabase RLS); no PII in analytics |
| Bundle size | <5MB initial load (excluding cached audio assets) |
| Device support | Android 8+, iOS 14+, any modern browser; primary target: low-end Android phones (2GB RAM) |
| Free-tier compatible | Vercel Hobby, Supabase Free, Render Free |

---

## 7. What SMRITI Does NOT Do (Scope Boundaries)

- Does NOT diagnose dementia (it's a screening/engagement tool, not a diagnostic)
- Does NOT replace clinical consultation (escalates to Tele-MANAS / LGBRIMH)
- Does NOT claim to "prevent" or "cure" dementia (Lumosity FTC lesson)
- Does NOT use open-ended conversational AI with patients
- Does NOT require the patient to own a device (caregiver-mediated model)
- Does NOT store biometric data, Aadhaar, or financial information

---

## 8. Success Metrics

| Metric | Target (6-month pilot) |
|--------|----------------------|
| Daily active sessions per patient | ≥5 per week |
| Medication reminder acknowledgment rate | >70% (baseline from literature: 71%) |
| Caregiver dashboard weekly check-in rate | >60% |
| RED alert → caregiver action within 48h | >80% |
| Patient-reported frustration/anxiety during gameplay | <10% of sessions |
| System uptime (including offline) | 99.9% |

---

## 9. Regulatory & Ethical Considerations

- Frame as "cognitive engagement and monitoring platform," not "medical device" or "therapeutic"
- Include clear disclaimer on every screen: "SMRITI supports cognitive engagement. It does not diagnose or treat any condition. Consult a healthcare professional for medical concerns."
- Informed consent flow for caregiver before creating patient profile
- Data deletion capability (GDPR-style right to erasure)
- No data sold or shared with third parties
- Pilot approval from institutional ethics committee (LGBRIMH or equivalent) before any clinical evaluation claims

---

## 10. Technology Stack Summary

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR + PWA + Vercel free tier |
| PWA/Offline | next-pwa + Workbox + Dexie.js (IndexedDB) | Offline-first with structured local DB |
| Styling | Tailwind CSS + custom design tokens | No UI library bloat; full control over elderly-friendly design |
| Backend/API | Next.js API Routes (serverless) | Zero additional infra; Vercel free tier |
| Database | Supabase (PostgreSQL + Auth + Realtime + RLS) | Free tier generous; real-time sync; row-level security |
| Audio/Voice | Pre-recorded assets + Web Speech API fallback | No dependency on cloud ASR for MVP |
| Hosting | Vercel (frontend) + Supabase (data) | Both have generous free tiers |
| Monitoring | Vercel Analytics (free) + Supabase Dashboard | No additional cost |

---

## 11. Phased Roadmap

### Phase 1: Hackathon MVP (2-3 weeks)
- 4 cognitive games with rule-based difficulty
- Assamese + Hindi + English audio
- Medication/hydration reminders
- Basic caregiver dashboard (score graph + adherence %)
- Offline gameplay + sync
- PWA installable on Android/iOS

### Phase 2: Post-Hackathon Hardening (2-3 months)
- Per-domain Elo rating with dynamic K-value
- Bhashini ASR/TTS integration where mature
- Manipuri + Bodo language support
- Traffic-light triage dashboard for ASHA workers
- Caregiver audio push notes
- ABHA record linkage exploration

### Phase 3: Pilot Deployment (6 months)
- Partner with LGBRIMH Tezpur + ARDSI Guwahati
- 50-patient pilot in 2-3 Assam villages
- IRB-approved evaluation protocol
- Tele-MANAS referral pathway integration
- Frontline worker dementia-education module

---

## 12. Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Overclaiming clinical benefit | Legal review of all copy; "engagement + monitoring" framing only |
| NER language ASR too immature | Human-recorded audio MVP; ASR as progressive enhancement |
| Alert fatigue in caregivers | Rate-limited alerts; RED only for >2SD sudden drops |
| Device fragmentation | PWA targets web standards; test on 3 lowest-cost Android devices |
| Supabase free tier limits (500MB, 50K monthly active users) | Telemetry aggregation before sync; delta-only uploads |
| Patient anxiety from difficult games | Strict floor on difficulty; never <50% success rate |

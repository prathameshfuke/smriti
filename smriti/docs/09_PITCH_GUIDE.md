# SMRITI — Hackathon Pitch Guide
## SIH26003 | 6-Minute Presentation Structure

---

## Slide 1: Title (15 seconds)

**SMRITI** — Smart Memory & Reminder Intervention for Therapeutic Independence

*AI-powered cognitive gaming and memory assistance for elderly dementia patients in India's North Eastern Region*

SIH26003 | Team [Name] | MDoNER

---

## Slide 2: The Problem (60 seconds)

**What to say:**

"India has 8.8 million people over 60 with dementia. In Assam alone, the prevalence is 8.47% — higher than the national average. But here's the critical gap: there is not a single cognitive screening tool validated in any NER language — not Assamese, not Bodo, not Manipuri, not Khasi, not Mizo. Zero.

The apps that exist globally — BrainHQ, Lumosity, MindMate — are English-first, require constant internet, and use culturally alien content like Western breakfast items. They were never designed for a 72-year-old woman in rural Meghalaya who speaks only Khasi and has never used a smartphone.

Meanwhile, rural Community Health Centres have a 79.5% shortfall of specialists. Tele-MANAS provides excellent telecounselling, but no asynchronous cognitive training that works offline."

**Data to show:**
- 8.8M elderly with dementia nationally (LASI-DAD, Lee et al. 2023)
- 8.47% Assam prevalence (same source)
- 0 cognitive tools in NER languages (Status of Cognitive Testing in India, PMC5682734)
- 79.5% specialist shortfall (Rural Health Statistics 2021-22)

---

## Slide 3: Our Solution (60 seconds)

**What to say:**

"SMRITI is a Progressive Web App — works on any phone, Android or iOS, installable like a native app — that delivers four clinically-grounded cognitive games, daily medication and hydration reminders, and a caregiver monitoring dashboard.

It works 100% offline. Games, reminders, and scoring all function without internet. Data syncs silently in the background when connectivity returns — using the same capture-and-sync architecture as Gujarat's TeCHO+ platform, which serves 60 million people.

We didn't invent random brain games. We reverse-engineered the globally validated CANTAB Paired Associates Learning assessment and MoCA criteria, and embedded them with NER-specific cultural content — gamosa patterns, bamboo baskets, one-horned rhinos — to create a clinically sound, culturally resonant therapeutic experience."

**Show:** App screenshots / live demo

---

## Slide 4: Clinical Foundation (45 seconds)

**What to say:**

"Our game design is grounded in three validated frameworks:

First, CANTAB PAL — a 30-year-validated visuospatial memory test that alone classifies 81% of normal, MCI, and Alzheimer's cases correctly. Our Object Hunt game directly replicates this mechanic.

Second, MoCA — the gold standard brief screening tool, which we use for our delayed recall and executive function games. Importantly, MoCA adds a point for people with low education — we built the same adjustment into our scoring engine for NER's low-literacy population.

Third, recent meta-analyses show computerized cognitive training has a moderate, significant effect on global cognition in MCI — Hedges g of 0.57. But critically, supervised training triples the effect size versus unsupervised. That's why SMRITI is designed for caregiver-mediated use, not solo play.

We do NOT claim SMRITI prevents or cures dementia. We claim evidence-backed cognitive engagement, near-transfer skill improvement, and continuous monitoring."

---

## Slide 5: Architecture (45 seconds)

**What to say:**

"SMRITI is a Next.js PWA deployed on Vercel, with Supabase as the backend — entirely on free tiers. All game logic and patient data lives locally in IndexedDB. When the device finds a connection — maybe once a week in rural Meghalaya — our sync engine pushes telemetry deltas and pulls updated reminder schedules using last-write-wins conflict resolution.

Difficulty adapts using a simple, explainable rule-based engine targeting 80-85% accuracy — the same approach used by BrainHQ, the most clinically validated app globally. We avoid black-box ML for the core therapeutic logic because clinicians need to trust and audit how difficulty decisions are made.

For language support, we start with pre-recorded human voice assets in Assamese and Hindi, with an abstraction layer ready to plug in Bhashini TTS and Project ISHAAN translations as they mature for NER languages."

**Show:** Architecture diagram

---

## Slide 6: Caregiver Dashboard (45 seconds)

**What to say:**

"The dashboard isn't just for distant family members — it's a force multiplier for the NER's limited healthcare infrastructure.

ASHA workers managing 10 patients across a village see a traffic-light triage list. Green means stable. Yellow means missed sessions. Red means a sudden cognitive score drop — more than 2 standard deviations below the 7-day average. This is clinically significant because sudden drops in elderly cognitive function are rarely just Alzheimer's progression. They often indicate a treatable secondary condition — a UTI, dehydration, medication non-adherence, or a mini-stroke.

We rate-limit alerts to prevent fatigue — research shows 38% of caregiver alert feedback is negative when alerts fire too often. One RED alert per patient per 48 hours, maximum."

**Show:** Dashboard screenshots with traffic-light list

---

## Slide 7: Demo (90 seconds)

**Live demo flow:**
1. Open SMRITI on phone (show PWA install)
2. Switch language to Assamese — all UI changes instantly
3. Start session as patient
4. Play Object Hunt: show culturally familiar NER objects
5. Complete a round — show encouraging feedback + stars
6. Toggle airplane mode — show game still works offline
7. Switch to caregiver dashboard — show score graph + traffic light
8. Show a RED alert with actionable guidance

---

## Slide 8: Ecosystem & Partnerships (30 seconds)

**What to say:**

"SMRITI integrates into the existing NER health ecosystem:
- LGBRIMH Tezpur as clinical validation partner
- ARDSI Guwahati for community outreach and pilot recruitment
- Tele-MANAS as the escalation pathway for flagged patients
- Bhashini / Project ISHAAN for language infrastructure as it matures
- TeCHO+ architecture pattern for proven offline-first reliability"

---

## Slide 9: Roadmap (30 seconds)

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| MVP | Now | 4 games, 3 languages, offline-first, caregiver dashboard |
| Hardening | 3 months | Elo adaptivity, Bhashini integration, Manipuri + Bodo |
| Pilot | 6 months | 50-patient trial with LGBRIMH, IRB-approved evaluation |
| Scale | 12 months | All 8 NE states, ASHA worker training module |

---

## Slide 10: Team (15 seconds)

[Your team names, roles, and relevant experience]

---

## Key Phrases to Land

- "We didn't invent random brain games — we reverse-engineered CANTAB PAL and MoCA"
- "Supervised training triples the effect size — that's why we designed for caregiver-mediated use"
- "Works at 100% capacity offline, syncs silently when connectivity appears"
- "Sudden cognitive drops are medical red flags, not just declining scores"
- "We will never claim to prevent or cure dementia — we provide engagement, monitoring, and early warning"

---

## Anticipated Judge Questions & Answers

**Q: How is this different from Lumosity?**
A: Lumosity was fined $2M by the FTC for overclaiming. We make no clinical claims beyond engagement. More importantly, Lumosity requires English, internet, and digital literacy. SMRITI works offline in Assamese with zero text required.

**Q: Does brain training actually work?**
A: Near-transfer effects are well-supported (Hedges g=0.57, Chan et al. 2024 meta-analysis of 35 RCTs). Far-transfer to daily life is scientifically contested (Simons et al. 2016). We claim near-transfer and monitoring value only.

**Q: Why not use ChatGPT/LLM for the games?**
A: Three reasons. (1) LLMs can't run offline. (2) They're non-deterministic — the same prompt gives different outputs, making clinical measurement impossible. (3) Bodo and Khasi are classified "extremely low-resource" — no LLM performs above 41.5% accuracy on them (IndicParam 2025). Constrained-vocabulary, rule-based game logic is more reliable.

**Q: What about data privacy?**
A: No PII in telemetry — only UUIDs and scores. Supabase Row Level Security ensures caregivers see only their patients. All data encrypted at rest. No data sold or shared. Patient data deletion supported.

**Q: How do you know the difficulty adjustment is working?**
A: We target 80-85% session accuracy using a rule-based heuristic (same as BrainHQ). If a patient is consistently above 80%, difficulty increases. Below 50%, it decreases. The system is fully transparent and auditable — no black-box ML. We can show the clinician exactly why difficulty changed and when.

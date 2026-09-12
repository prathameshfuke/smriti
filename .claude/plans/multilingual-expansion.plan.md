# Plan: Multilingual Expansion — Game Audio Coverage + Language Selector Redesign

**Source**: inline requirements (no PRD file), from the `/ecc:plan-orchestrate` invocation with Parts 1–4
**Complexity**: Large (multi-phase; Phase 0 must complete and be reported back before Phases 2–4 can be scoped precisely)

## Summary

Two stated problems: (1) game-instruction audio is unreliable across languages/games, (2) the language
selector caps out at 3 languages and can't scale. Investigation surfaced a third, more fundamental
finding: the stated problem (1) is caused by something narrower and more fixable than "add more TTS
languages" — see Finding A below. The full 10-state language expansion, live Bhashini capability
audit, and selector redesign are real work, but they should not block fixing Finding A, which fixes
audio reliability for the two languages already live today.

## Decisions already made (this conversation)

- **Nagaland**: deprioritized, not in this pass (no single dominant language; revisit on specific need).
- **Arunachal Pradesh**: deprioritized, not in this pass (same reasoning).
- **Sikkim**: in scope — Nepali, Bhutia, Lepcha.

## Confirmed target language list (Part 1)

| State | Language(s) | ISO/Bhashini-style code (proposed) | Status |
|---|---|---|---|
| Assam | Assamese | `as` | already live |
| Assam | Bodo | `brx` | new — **already anticipated in `PatientLanguage` type**, never wired to `UILanguage` |
| Manipur | Manipuri (Meitei) | `mni` | new — same as above |
| Meghalaya | Khasi | `kha` | new — anticipated in `PatientLanguage`, not `UILanguage` |
| Meghalaya | Garo | `grt` | new — no existing groundwork |
| Mizoram | Mizo (Lushai) | `lus` | new — anticipated in `PatientLanguage`, not `UILanguage` |
| Tripura | Kokborok | `trp` | new — no existing groundwork |
| Tripura | Bengali | `bn` | new — no existing groundwork |
| Sikkim | Nepali | `ne` | new — no existing groundwork |
| Sikkim | Bhutia | `sip` | new — no existing groundwork |
| Sikkim | Lepcha | `lep` | new — no existing groundwork |
| (existing) | Hindi | `hi` | already live |
| (existing) | English | `en` | already live |

13 languages total (10 new + 3 already-live: Assamese, Hindi, English), across 6 states.

## Finding A — the actual cause of unreliable game audio (Part 3, quick win, decoupled from the rest)

Grepped every one of the 14 games: **all instruction/prompt audio calls `speak()` directly — the raw
browser `SpeechSynthesis` API — never `narrate()`**, the 3-tier (cache → Bhashini TTS → browser)
pipeline already built and proven for the companion and reminders
([narrate.ts](smriti/src/lib/audio/narrate.ts)). `narrate.ts`'s own comment states browser
`speechSynthesis` is "silent for Assamese on most devices."

This means: **today, for the two languages that already have full Bhashini TTS coverage (Hindi,
Assamese), game audio is still unreliable** — not because Bhashini can't do it, but because games
never call the code path that would ask Bhashini. This is fixable independently of everything else in
this plan (no new languages, no capability matrix needed) and should ship as its own step:

- Replace every `speak(...)` call carrying instructional/prompt text in the 14 game pages with
  `narrate(...)`, matching the existing companion/reminder call shape (needs `isOnline` — already
  available via `useOfflineStatus()` in every affected page, confirmed pattern from
  [companion/page.tsx](smriti/src/app/companion/page.tsx)).
- Short reactive feedback strings ("Good!", "Good match") are lower priority for the Bhashini round
  trip (latency-sensitive, said immediately after a tap) — proposing these stay on `speak()` for now,
  flagged for your confirmation rather than changed silently.

## Part 2 — live Bhashini capability audit: blocked on a credential-state question

The static service tables in the prompt (ASR covers Assamese/Bodo/Manipuri, not Khasi/Mizo; TTS covers
Manipuri/Bodo, not Khasi/Mizo; NMT covers all four) are a real starting point, but the task asks for
**live-verified** results, not just the docs. I can do this the same way this codebase already
empirically proved English-unsupported-by-ASR — send a minimal real request per language and check for
a clean success vs. a "not supported" failure (documented precedent:
[bhashini-asr-client.ts:19-22](smriti/src/lib/ai/bhashini-asr-client.ts#L19-L22)).

**Blocker**: this depends on which Bhashini credential path is actually live right now, which was left
unresolved earlier this session — you confirmed you have a `userID`/`ulcaApiKey` pair (the real
two-step ULCA flow), but I have not yet implemened that flow, and I don't know whether the currently
configured `BHASHINI_INFERENCE_API_KEY` still authenticates under the old direct-call scheme. A live
probe run against the wrong auth scheme would produce false "unsupported" results for every language
(indistinguishable from a real 401/403), which would corrupt the whole capability matrix this plan is
supposed to be built on.

**Proposed order of operations**: finish the two-step ULCA auth flow (already scoped and pending your
sign-off from earlier this session) *before* running the live capability probe, so the probe's results
are trustworthy. If you'd rather probe with the current static key first (accepting the result may be
partly invalid) and redo it after the auth flow lands, say so and I'll do it in that order instead.

## Part 2 results — the real, live-verified capability matrix

Queried the actual Bhashini discovery endpoint (`getModelsPipeline`) live for every Part 1 language
across ASR/TTS/NMT (translation), using the same account this app now authenticates with. Every static
doc claim below was checked against a real API response, not assumed.

| Language | Code | ASR | TTS | NMT (translation) |
|---|---|---|---|---|
| Assamese | `as` | **Legacy-fallback only** (discovery: no registered service) | Yes | Yes |
| Hindi | `hi` | Yes | Yes | Yes |
| Bengali | `bn` | Yes | Yes | Yes |
| Bodo | `brx` | **No** (discovery: no registered service; no known legacy alt) | Yes | Yes |
| Manipuri (Meitei) | `mni` | **No** (same as Bodo) | Yes | Yes |
| Nepali | `ne` | No | No | Yes |
| Khasi | `kha` | No | No | No |
| Garo | `grt` | No | No | No |
| Mizo (Lushai) | `lus` | No | No | No |
| Kokborok | `trp` | No — language code itself not recognized by Bhashini | No | No |
| Bhutia | `sip` | No — language code itself not recognized | No | No |
| Lepcha | `lep` | No — language code itself not recognized | No | No |

**This corrects the static docs the original task cited**, which claimed NMT covers Bodo/Khasi/Mizo/
Manipuri — live-verified, Khasi and Mizo have **zero** working Bhashini capability of any kind today
(ASR, TTS, and NMT all return "No supported tasks found"), not just missing ASR/TTS as the docs implied.
Kokborok/Bhutia/Lepcha aren't even recognized as valid language codes by the live system — a stronger
gap than "unsupported," these codes error at the language-validation step itself.

**Net result**: of the 10 new candidate languages, only 4 have any real, live-confirmed Bhashini
capability today — Bodo and Manipuri (TTS + text translation, no speech recognition), Bengali (full:
ASR + TTS + translation), and Nepali (translation only). The other 6 — Khasi, Garo, Mizo, Kokborok,
Bhutia, Lepcha — have no working tier at all right now.

## Part 3 — per-game audio coverage matrix and content-recording scope

Cannot be enumerated honestly until Part 2's real matrix exists — the whole point of this step is
listing exactly which (language × game) pairs have no working audio tier, and "no working audio tier"
is only knowable once Part 2 says which languages have real TTS. Once Part 2 completes, this becomes
a mechanical cross-reference (13 languages × 14 games) plus one exception check (does a browser
`SpeechSynthesis` voice exist for that language on real target devices? — the existing `speak.ts`
likely already has to make this same voice-availability check; I'll confirm and reuse rather than add
a second detection path).

Also folding in a UI requirement from the prompt regardless of matrix outcome: a game with no audio
tier for the selected language must show a caregiver-visible "audio not yet available in
[language]" indicator rather than silently play nothing — this is a small, well-scoped UI addition
once the matrix exists.

## Part 4 — selector redesign

**Correction to the prompt's assumption**: `LanguagePicker` is currently used in **three** places, not
just caregiver onboarding/settings — [app/app/page.tsx](smriti/src/app/app/page.tsx) (the **patient**
home screen) also renders it directly, and it writes to one single global
`useSettingsStore().language`, not a per-patient field (onboarding then copies that global value onto
the new patient's `primaryLanguage` at creation time — so a caregiver onboarding a second patient with
a different language would overwrite the first patient's session language on that device). This needs
a decision before redesigning:

- Does the patient-facing instance on the home screen keep a simple 3-button-style picker (its own,
  separate, flat list — maybe still capped low, since patients don't need 13 options with capability
  labels), while only the **caregiver-facing** onboarding/settings instance gets the new region-grouped,
  capability-labeled selector this plan is about? This matches the prompt's stated intent ("caregiver
  chooses at onboarding") without changing patient-facing UX.
- The single-global-language-per-device design (not per-patient) is a pre-existing constraint, out of
  scope for this plan unless you want it addressed here too.

**Confirmed**: redesign both instances — the patient home screen and the caregiver onboarding/settings
flow both get the new region-grouped, capability-labeled selector (not caregiver-only as first
proposed). The single-global-language-per-device design stays as-is (out of scope for this plan).

Proposed mechanism: a two-level component — a state/region
accordion or grouped list ("Assam: অসমীয়া, Bodo", "Meghalaya: Khasi, Garo", …), each language option
showing a capability badge derived from Part 2's matrix (Full audio / Partial — some games text-only /
Text only). Underlying `UILanguage` type widens from `['as','hi','en']` to the 13-code list in Part 1;
`isUILanguage`, `DEFAULT_LANGUAGE`, and every consumer (`i18n/provider.tsx` catalogs,
`bhashini-asr-client.ts`'s `BhashiniAsrLanguage` subset, `narrate.ts`, `transcribe/route.ts`'s language
gate) needs updating to the wider set — mechanical, following the existing `as`/`hi` pattern exactly,
no new architecture.

## Phased execution order (proposed)

1. **Finding A fix** (games → `narrate()`) — **done.** All 14 games' instruction audio now routes
   through `narrate()`; verified isolated/8x/3x-shuffled + build.
2. **Finish the Bhashini two-step ULCA auth flow** — **done, with a real correction along the way.**
   New `src/lib/ai/bhashini-auth.ts` (`fetchInferenceAuth`) implements the real config-call → dynamic
   auth flow. Live-probed against the actual API before calling this finished (never just trusted mocks):
   - The config call is a *discovery* call — it returns which serviceId to use, you don't send one.
     Sending a guessed `serviceId` (my first attempt) broke even known-good combinations with a bare 500.
   - Critical finding: this ULCA account's discovery has **no registered ASR service for Assamese at
     all** (confirmed live: a clean 400), while the legacy static key (`BHASHINI_INFERENCE_API_KEY`)
     is confirmed still live-working for it (real 200, real audio, tested directly). Blindly cutting
     over would have silently downgraded Assamese ASR — this app's actual differentiator — to Groq
     Whisper with no error or warning.
   - Fixed per your direction: `bhashini-asr-client.ts`/`bhashini-client.ts` now try the new ULCA
     discovery first, and fall back to the legacy static-key scheme (same proven serviceIds as before)
     on any failure — discovery miss, auth failure, or missing ULCA credentials alike.
   Timeouts rebudgeted to 5s config + 15s compute (same 20s total, same 35s/40s Bhashini+Groq/
   client-ceiling contract). Env vars: `BHASHINI_USER_ID` + `BHASHINI_ULCA_API_KEY` (primary),
   `BHASHINI_INFERENCE_API_KEY` (legacy fallback, still needed) — README updated. Verified
   isolated/8x/3x-shuffled + build.
3. **Live capability probe** (Part 2) — **done.** Real matrix below, verified live against the actual
   API (never trusted the static docs alone — several turned out wrong).
4. **Widen `UILanguage` + locale catalogs** — **done.** Added `brx`/`mni`/`bn`/`ne` (the 4 languages
   with real Part 2 capability) to `UILanguage`. Real, confident translations for Bengali and Nepali;
   Bodo and Manipuri are best-effort drafts — **flagged for mandatory native-speaker review before any
   patient sees them**, confidence dropped once actually attempting full sentences, not just vocabulary.
   Manipuri written in Bengali script (this app has no Meitei Mayek font loaded). Object names
   (`objects.ts`, 66 items) and each next-intl game's own message catalog (9 games) were NOT
   individually translated into the new languages — both now fall back to English for a
   missing-language entry, same pattern, rather than fabricating hundreds more low-confidence lines;
   the shared `game.*` UI catalog (instructions, feedback, session-end messages) IS fully translated.
   `supabase/types.ts` `Language`/`PatientLanguage` widened to match; the actual Postgres CHECK
   constraint still needs a real migration (documented in docs/03_DATABASE.md, not run — Supabase writes
   for bn/ne caregivers fail safely and keep local Dexie as source of truth until it is).
   Verified: full suite + build clean.
5. **Selector redesign** (Part 4) — caregiver-only, region-grouped, capability-labeled — built on the
   real matrix from step 3.
6. **Per-game coverage matrix + gap indicator UI** (Part 3) — built on the real matrix from step 3.
7. **Content-recording scope report** — the honest list of (language × game) needing human recording,
   handed to you as a resourcing decision, not something this plan closes out in code.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Live probe run before auth flow is fixed produces a corrupted matrix | High if order is skipped | Enforce phase order above; don't probe until auth flow confirmed working |
| Widening `UILanguage` touches many call sites (provider, narrate, transcribe route, ASR client's language subset) | Certain, but mechanical | Follow the exact existing `as`/`hi` pattern per site; full test suite + build after |
| Some target languages may have zero real Bhashini/browser coverage | Medium (Khasi/Garo/Kokborok/Bhutia/Lepcha are the likely candidates per static docs) | Surface as "not supported yet" rather than silently degrading; your call on whether to list them as text-only or omit entirely |
| Human-recording scope could be large (up to 13 × 14 = 182 clips minus whatever Bhashini covers) | High | Report exact count once Part 2 lands; this is a resourcing conversation, not a coding task |

## Acceptance for this plan document

- [ ] You confirm the phase order (Finding A first, ULCA auth before probing, etc.) or tell me to
      reorder it
- [ ] You confirm the patient-vs-caregiver LanguagePicker split proposed in Part 4
- [ ] You confirm whether to probe live with the current key now (accepting possible invalidity) or
      wait for the ULCA auth flow first

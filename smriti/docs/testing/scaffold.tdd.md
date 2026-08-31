# TDD Evidence: SMRITI Scaffold

**Source plan:** inline `/ecc:plan` output (gap-closure plan), this session.
**Scope:** scaffold and configuration only. No features.
**Runner:** vitest 4.1.11 + jsdom. `npm test` is watch mode; the gate command is `npx vitest run`.

## User Journeys

1. As a developer cloning SMRITI, I want the Supabase env template present, so that I know which variables to set without reading the source.
2. As a developer, I want the design tokens to hold their clinical values, so that a refactor cannot silently change patient-facing contrast or touch-target sizes.
3. As a patient's caregiver, I want the app to install to the home screen with SMRITI branding, so that the patient recognises and can launch it unaided.
4. As a developer, I want the asset directories to exist in a fresh clone, so that the service worker cache rules for `/audio/*` and `/images/*` target real paths.

## Task Report

### Task 1 — `src/lib/supabase/types.ts`
Added a placeholder module for later `supabase gen types` output.
- **Command:** `npx vitest run`
- **RED:** `FAIL ... > has module src/lib/supabase/types.ts` — `expected false to be true`
- **GREEN:** passes.
- **Guarantees:** the module path the Supabase client will import exists.

### Task 2 — `public/images/` and `.gitkeep` across asset dirs
Git does not track empty directories. Without `.gitkeep`, `next.config.js` CacheFirst rules for `/audio/*` and `/images/*` referenced paths absent from a fresh clone.
- **RED:** `FAIL ... > has public asset directory public/images`; `FAIL ... > keeps empty asset directories alive in git via .gitkeep`
- **GREEN:** both pass.
- **Clean-clone check:** `git clone` into a scratch dir → `public/images` PRESENT, `public/audio/as` PRESENT.

### Task 3 — `.env.local.example` tracking *(real defect, not a spec gap)*
The Next.js default `.gitignore` carries a broad `.env*` rule at line 34 that silently excluded the committed env template. Confirmed with `git check-ignore -v .env.local.example` → `smriti/.gitignore:34:.env*`. Fixed with a `!.env.local.example` negation.
- **RED:** `FAIL ... > tracks .env.local.example in git rather than ignoring it` — `.env.local.example is excluded by .gitignore: expected true to be false`
- **GREEN:** passes.
- **Clean-clone check:** env template PRESENT.

### Tasks 4 — commits
Four commits on `main`: `c3afd9b` docs, `6214878` scaffold, `8d716c3` tests (RED), `1d858d3` fixes (GREEN).

## Test Specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | Primary brand gold is `#8B6914`, with `#C4A445` / `#5C4510` ramp | `src/tests/config/tailwind-tokens.test.ts` | unit | PASS |
| 2 | Surface palette and traffic-light alert colours hold their values | `src/tests/config/tailwind-tokens.test.ts` | unit | PASS |
| 3 | Patient body text is 22px, headings 36px, touch targets 64px/48px | `src/tests/config/tailwind-tokens.test.ts` | unit | PASS |
| 4 | Manifest `theme_color` is `#8B6914` and `display` is `standalone` | `src/tests/config/manifest.test.ts` | unit | PASS |
| 5 | Manifest declares portrait, SMRITI naming, `#FAF7F2` background | `src/tests/config/manifest.test.ts` | unit | PASS |
| 6 | Manifest icons are 192/512, exist on disk, 512 is maskable | `src/tests/config/manifest.test.ts` | integration | PASS |
| 7 | All 26 source directories and 5 public asset dirs exist | `src/tests/config/structure.test.ts` | unit | PASS |
| 8 | All 20 lib/hook/store modules and 3 locale files exist | `src/tests/config/structure.test.ts` | unit | PASS |
| 9 | Asset dirs carry `.gitkeep` so they survive a clone | `src/tests/config/structure.test.ts` | unit | PASS |
| 10 | `.env.local.example` is not excluded by `.gitignore` | `src/tests/config/structure.test.ts` | integration | PASS |
| 11 | A placeholder page renders | `src/tests/smoke.test.tsx` | unit | PASS |

`npx vitest run` → **72 passed (4 files)**.

## Coverage and Known Gaps

- **Coverage not measured.** `@vitest/coverage-v8` is not installed, and the 80% target is not meaningful here: every `src/lib`, `src/hooks`, and `src/stores` module is an `export {}` placeholder with no behavior. Coverage becomes a real gate once the difficulty, scoring, and sync engines carry logic.
- **TDD caveat, stated plainly.** Only tests 7–10 were driven by a genuine RED. Tests 1–6 passed on first run because they characterize configuration delivered earlier in this session; they are regression pins, not test-first artifacts.
- **`test:ui` script is non-functional** until `@vitest/ui` is installed; it was not in the specified dependency list.
- **Not covered:** service worker runtime caching behavior, offline behavior, and Lighthouse PWA score. These need a browser harness (Playwright) and belong with the first real feature.

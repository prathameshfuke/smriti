---
name: SMRITI Design System
version: 1.0.0
status: formalized from shipped code (tailwind.config.ts is the source of truth; see Discrepancies)
colors:
  navy:        { value: "#151312", role: "primary text, active nav/tab state" }
  ink:
    DEFAULT:   { value: "#151312", role: "primary text" }
    muted:     { value: "#4B4541", role: "secondary/supporting text" }
    inverse:   { value: "#F8F7F3", role: "text on filled/colored surfaces" }
  primary:
    DEFAULT:   { value: "#B3452D", role: "primary action color (terracotta)" }
    light:     { value: "#E7B2A2", role: "soft highlight surfaces" }
    dark:      { value: "#933A27", role: "hover/pressed states" }
  accent:      { value: "#B3452D", role: "defined, alias of primary — see Discrepancies (unused as a class in code today)" }
  teal:        { value: "#B3452D", role: "LEGACY NAME for primary — see Discrepancies; renamed out of app/caregiver UI in this pass, kept in config for back-compat" }
  surface:
    DEFAULT:   { value: "#F8F7F3", role: "page background" }
    card:      { value: "#FFFFFF", role: "card/panel fill" }
    muted:     { value: "#F0EEE9", role: "subtle section fill, inactive chip fill" }
  canvas:      { value: "#F8F7F3", role: "alias of surface.DEFAULT, used as page bg class" }
  success:     { value: "#39A85A", role: "positive status, on-track state" }
  warning:     { value: "#D97706", role: "needs-attention status" }
  danger:      { value: "#DC2626", role: "urgent/error status" }
  game:
    bg:        { value: "#F9FAFB", role: "game canvas background" }
    tile:      { value: "#F3F4F6", role: "game tile fill" }
    active:    { value: "#D1D5DB", role: "game tile active/pressed fill" }
  gamosa:      { value: "#BE3A34", role: "cultural accent — red alert strip on dashboard patient cards" }
  muga:
    DEFAULT:   { value: "#C9A227", role: "cultural accent (gold) — active tab underline, stat card top-strip" }
    dark:      { value: "#8B6914", role: "muga text on light backgrounds (muga itself fails AA)" }
  line200:     { value: "#D8D2CB", role: "border/divider token — now the standard border/secondary-gray replacement across app+caregiver UI (see Implementation Log)" }
typography:
  display: { family: "Fraunces (var(--font-smriti-serif))", role: "all headings" }
  body:    { family: "Atkinson Hyperlegible (var(--font-smriti-sans))", role: "body text, UI chrome — chosen for low-vision legibility" }
  scale:
    patient-heading:    { size: "2.25rem (36px)", lineHeight: "1.3" }
    caregiver-heading:  { size: "1.75rem (28px)", lineHeight: "1.3" }
    patient-body:       { size: "1.375rem (22px)", lineHeight: "1.6" }
    caregiver-body:     { size: "1.125rem (18px)", lineHeight: "1.6" }
    patient-sm:         { size: "1rem (16px)", lineHeight: "1.6" }
radius:
  card:    "1.25rem (20px)"
  panel:   "2rem (32px)"
  tile:    "16px"
  control: "0.65rem (10.4px)"
spacing:
  touch:      "64px — primary patient-facing tap targets (BigButton)"
  touch-min:  "48px — accessibility floor for any interactive element"
  touch-gap:  "12px — gap between adjacent touch targets"
breakpoints: "unmodified Tailwind defaults — sm 640px / md 768px / lg 1024px / xl 1280px"
---

# SMRITI Design System

## Overview

SMRITI is a warm, editorial, high-contrast interface for two very different audiences on the same device: a cognitively-impaired patient using large, forgiving controls, and a caregiver running a denser review dashboard. The palette is narrow and light — warm off-white surfaces (`#F8F7F3`), near-black text (`#151312`), a single terracotta action color — never a dark canvas. Fraunces (an editorial serif) carries every heading; Atkinson Hyperlegible, a typeface designed for low-vision readers, carries body text and UI chrome. Two cultural accents — `gamosa` (red) and `muga` (gold), named for Assamese textile and silk traditions — mark status and active state on top of that neutral base, giving the app a regional identity the underlying Amigo-inspired system didn't originally have.

Structurally the product is two apps in one: patient screens (`max-w-patient`, 480px, `patient-*` type scale, 64px touch targets) and caregiver screens (`max-w-dashboard`, 1200px, `caregiver-*` type scale, denser cards). Both draw from the same token set below.

## Colors

See the frontmatter table for every token and its real usage. In practice:
- `primary` (`#B3452D`) is the one action color — filled buttons, active tab underlines, focus rings, links.
- `muga` (gold) marks the active state on the patient-detail sub-tab bar and tops stat cards; `muga-dark` is used for its text because `muga` itself fails WCAG AA.
- `gamosa` (red) marks the "needs review" strip on caregiver dashboard patient cards, alongside `danger` for hard errors — `gamosa` reads as a status-severity accent, `danger` as a system error.
- `ink-muted` is the standard secondary-text color and `line200` the standard border color — as of this pass, every bare `text-gray-*`/`border-gray-*` in app/caregiver UI has been replaced with these (see Implementation Log). New code should always reach for the semantic token, never a raw Tailwind gray.

## Typography

Every heading uses `font-serif-display` (Fraunces) at one of the sizes in the frontmatter scale. Body copy and controls use the default sans (Atkinson Hyperlegible) — never pair a heading-scale size without `font-serif-display`, and never use `font-serif-display` on body copy. The smallest body size anywhere in the app is 16px (`patient-sm`); nothing goes smaller except numeric micro-labels inside game canvases, which aren't reading text.

## Layout

- Patient screens: `mx-auto max-w-patient` (480px), page padding `px-4 py-6`–`py-10`.
- Caregiver screens: `mx-auto max-w-dashboard` (1200px), `px-4 py-6 md:px-8 md:py-10`.
- No custom spacing scale beyond Tailwind's default 4px rhythm, plus the three touch tokens above. `gap-2`/`gap-3`/`gap-4` (8/12/16px) are the common inter-element gaps; `gap-6` (24px) separates major sections on the family/sharing tab.

## Elevation & Depth

The app does **not** use a hairline-border-only, no-shadow system. Every card in production pairs a `border` (now `border-line200`) **with** `shadow-sm` — that pairing, not either alone, is what "card" means in this codebase. Modals/dialogs step up to `shadow-lg`/`shadow-xl`/`shadow-2xl`. Buttons use `shadow-sm` at rest and `shadow-md` on hover (see `BigButton.tsx`). Treat `border + shadow-sm` as the default card treatment; reserve heavier shadows for anything that floats above the page (modals, the family-message dialog).

## Shapes

| Use | Token | Value |
|---|---|---|
| Cards, panels | `rounded-card` | 1.25rem |
| Large dialogs/sheets | `rounded-panel` | 2rem |
| Tiles, list items, chips | `rounded-tile` | 16px |
| Inputs, small buttons | `rounded-control` | 0.65rem |

## Components

- **BigButton** — the one primary-action control on patient screens. `primary`/`secondary`/`success` variants, `shadow-sm` at rest, `shadow-md` on hover, minimum 64px tall (`touch` token), same string drives the visible label and the spoken audio prompt.
- **Cards** — `rounded-card border border-line200 bg-white shadow-sm`, frequently with a 1.5px colored top strip (`h-1.5 bg-{status}`) to carry status without relying on color alone in text.
- **Inputs** — `h-11`–`h-14`, `rounded-control`, `border border-line200`, `focus:ring-2 focus:ring-primary/20`.
- **Tab bars / button rows** — two distinct, deliberate patterns (see Responsive Behavior): navigational tabs scroll horizontally and never wrap; choice/selection chip groups (language picker, gender/duration pickers) wrap onto a new line.

## Responsive Behavior

Breakpoints are unmodified Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.

**Multi-item tab/pill rows** — one rule, two named cases:
- *Navigational tabs* (a row whose selection changes which content panel is shown below it, e.g. the patient-detail Cognitive/Reminders/History/Companion/Family bar): **horizontal scroll, never wrap.** Buttons are `shrink-0 whitespace-nowrap`, the row is `overflow-x-auto`, and the active indicator (`border-b-2`) lives on the individual button so it never has to be repositioned for scroll or viewport changes. Wrapping a tab bar is prohibited — it pushes page content down unpredictably as tabs are added or the viewport narrows.
- *Choice/selection chip groups* (a row of equal-weight options with no content panel beneath it, e.g. `LanguagePicker`, the onboarding gender/duration pickers): `flex flex-wrap`, so extra items simply start a second row. Never let a choice group overflow the viewport unwrapped.

**Multi-column form rows**: any row placing two or more `<input>`/`<select>` side by side (e.g. name + relation) must be `flex flex-col gap-2 sm:flex-row`, with each field `sm:flex-1` — full-width stacked below 640px, side-by-side at 640px and up. A fixed side-by-side row with no stacking breakpoint is never acceptable.

**Minimum touch targets**: 48px (`touch-min`) is the accessibility floor for *any* interactive element at *any* breakpoint — it does not relax on mobile. Primary patient-facing controls (BigButton) stay at the full 64px (`touch`) target at every width.

## Do's and Don'ts

- **Don't** let a tab/pill row overflow the viewport with no wrap and no scroll — every button-row component must declare one of the two Responsive Behavior patterns above.
- **Don't** use a fixed side-by-side multi-column form row without a `sm:flex-row` (or equivalent) stacking rule for below-640px.
- **Don't** drop below 48px on any tappable control, at any breakpoint.
- **Do** pair `border` with `shadow-sm` on cards — one without the other is inconsistent with every existing card in the app.
- **Do** pair every heading-scale font size with `font-serif-display`.
- **Don't** reach for a bare Tailwind gray (`text-gray-500`, `bg-gray-100`, etc.) for anything with a semantic equivalent (`ink-muted`, `surface-muted`, `line200`) — as of this pass, app/caregiver UI no longer does.
- **Don't** introduce a color outside the palette listed in the frontmatter above.

## Iteration Guide

When a new screen needs a pattern not covered here: match the nearest existing component (card, BigButton, input) rather than inventing a new shadow/radius/spacing combination. If a genuinely new pattern is needed, add it to this document in the same pass as the code that introduces it — don't let DESIGN.md drift from what's shipped.

## Implementation Log (this pass)

- `teal` → `primary` renamed across every app/caregiver UI usage (18 files) — mechanical, same hex value, fixes the misleading legacy name.
- **Real bug found and fixed in the process**: `frog-leap/GameComponent.tsx`'s pond-water background wash used `bg-teal/10`, which had silently become terracotta (red) when `teal` was repointed to the brand color — the pond was rendering with a warm red tint instead of water-blue. Fixed to a literal `#219EBC` (matching the cerulean already used in the fish-trace game) since this usage was never the brand color to begin with.
- `border-gray-100/200/300` → `border-line200` and `text-gray-500/600/700` → `text-ink-muted`, `text-gray-800` → `text-ink`, `bg-gray-100/200` → `bg-surface-muted`, across every app/caregiver page and shared UI primitive (`card`, `dialog`, `checkbox`, `form`, `progress`, `GameTile`, `CaregiverTopNav`, plus `login`, `login/callback`, `onboarding`, `reminders`, `memory-bank`, `dashboard`, `patients/[id]`, `patients`, `settings`, `companion`, `app`, `reminiscence-quiz`).
- Left untouched, deliberately: `double-decision/PeripheralSpeedGame.tsx`'s `slate-*` palette (its own established dark-canvas game aesthetic, distinct from app chrome) and the n-back share-card generator's dark theme (a separate exported-graphic surface, not in-app UI).

## Discrepancies (doc vs. code, found while formalizing this document)

1. **The original prose doc is a landing-page spec, not a product spec.** `docs/Design System_ Amigo-Inspired Clinical AI Platform.md` was written for a marketing homepage (hero, carousel, cookie banner, footer sitemap) that doesn't exist in this app. `tailwind.config.ts` took its §3.1 color values but the two were never reconciled beyond that: the config adds `success`/`warning`/`danger`, `ink-inverse`, `game.*`, and the entire `gamosa`/`muga` cultural-accent pair, none of which appear in the prose doc at all. This DESIGN.md is the reconciled version — `tailwind.config.ts` was treated as ground truth wherever the two disagreed.
2. **`teal` was a misleading legacy name**, now cleaned up in app/caregiver UI (see Implementation Log). The `tailwind.config.ts` token itself is left defined for back-compat, still pointing at `#B3452D`.
3. **`accent` (`#B3452D`) is defined but effectively dead.** No component uses `bg-accent`/`text-accent`/`border-accent`. The only `accent-*` classes in the codebase are Tailwind's unrelated native-input `accent-primary` utility (checkbox/radio/slider tint) in three UI primitives.
4. **The prose doc specifies no shadows on cards**; shipped code universally pairs `border` + `shadow-sm`. This DESIGN.md documents the shipped behavior.
5. **Bare Tailwind grays have been replaced with semantic tokens across app/caregiver UI** in this pass (see Implementation Log). Remaining exceptions: game-internal canvases with their own established palettes (`double-decision`, `n-back` share-card) were deliberately left alone.
6. **One legitimate off-palette exception**: `components/games/n-back/GameComponent.tsx`'s share-card generator uses a self-contained dark theme (`#0c3a4b`, `#5de3c1`, etc.) for a social-share image, not in-app UI.

## ⚠️ Working-tree stability note

This document and a batch of code changes were silently wiped from disk (via an apparent `git clean`/reset outside this conversation) partway through this work and had to be reapplied from scratch. If you're reading this after another gap in the session, verify `git status` shows the expected modified/new files before trusting that prior work is intact — and commit early and often, since uncommitted work in this worktree has now been lost twice in one session.

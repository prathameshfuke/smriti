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
    patient-heading:    { size: "2.25rem (36px)", lineHeight: "1.3", note: "not tightened — see Typography section, this token is shared with dynamic/wrapping content" }
    caregiver-heading:  { size: "1.75rem (28px)", lineHeight: "1.05", letterSpacing: "-0.015em" }
    patient-body:       { size: "1.375rem (22px)", lineHeight: "1.6" }
    caregiver-body:     { size: "1.125rem (18px)", lineHeight: "1.6" }
    patient-sm:         { size: "1rem (16px)", lineHeight: "1.6" }
radius:
  card:    "1rem (16px)"
  panel:   "1.5rem (24px)"
  tile:    "0.75rem (12px)"
  control: "0.5rem (8px)"
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

`caregiver-heading` runs tight: line-height ~1.05 with slight negative letter-spacing, a display-block treatment. Every usage of this token is a short, static, single-line page/section title ("Overview", "Settings", "Today") that never wraps — confirmed by auditing every call site before tightening it.

`patient-heading` is **not** tightened at the token level, deliberately, despite being the same visual role — it's shared with a large amount of dynamic, possibly-wrapping content across game components (quiz questions, object names, reminder labels, result text), and a tight line-height there cramps multi-line text instead of reading as a considered display face. An earlier version of this pass tightened it globally and shipped a real readability bug (`reminiscence-quiz` questions rendered cramped). Where a `patient-heading` element genuinely is a short static title (`companion/page.tsx`'s "Ask Smriti", `app/page.tsx`'s "A message for you"), the tight treatment is applied as an inline `leading-[1.05] tracking-[-0.02em]` override on that element only — never by changing the shared token. Before adding another such override, confirm the specific element's content is fixed-length and can't wrap; if it can, leave it at the token's relaxed 1.3 line-height.

Body sizes keep the full 1.6 line-height the elderly/low-vision legibility requirement calls for; that distinction must never blur.

## Layout

- Patient screens: `mx-auto max-w-patient` (480px), page padding `px-4 py-6`–`py-10`.
- Caregiver screens: `mx-auto max-w-dashboard` (1200px), `px-4 py-6 md:px-8 md:py-10`.
- No custom spacing scale beyond Tailwind's default 4px rhythm, plus the three touch tokens above. `gap-2`/`gap-3`/`gap-4` (8/12/16px) are the common inter-element gaps; `gap-6` (24px) separates major sections on the family/sharing tab.

## Elevation & Depth

The app now uses a **hairline-border, no-shadow** system for resting elevation: every card, tile, input, and button dropped its resting `shadow-sm`, and `border border-line200` alone carries the depth signal. `hover:shadow-md` is kept everywhere it existed, but it's interaction feedback (a press/hover lift), not static elevation — a different concern the "no shadow" rule doesn't touch. Modals/dialogs keep their heavier `shadow-lg`/`shadow-xl`/`shadow-2xl` (they float above the page, not on it) — that's the one place this codebase still uses shadow as elevation, deliberately out of scope for the hairline rule.

This reverses this document's earlier position (previously: "border + shadow-sm together, that pairing is what card means here") — the earlier statement was accurate for the code at the time; it no longer is. If a component still has a resting `shadow-sm`, that's drift to fix, not a variant to preserve.

## Shapes

| Use | Token | Value |
|---|---|---|
| Cards, panels | `rounded-card` | 1rem (16px) |
| Large dialogs/sheets | `rounded-panel` | 1.5rem (24px) |
| Tiles, list items, chips | `rounded-tile` | 0.75rem (12px) |
| Inputs, small buttons | `rounded-control` | 0.5rem (8px) |

Tightened from the original 20/32/16/10.4px scale to a stricter, more architectural set — same card > tile > control size hierarchy, less generously rounded throughout.

## Components

- **BigButton** — the one primary-action control on patient screens. `primary`/`secondary`/`success` variants, flat at rest (no shadow), `hover:shadow-md` as a lift/press cue, minimum 64px tall (`touch` token), same string drives the visible label and the spoken audio prompt.
- **Cards** — `rounded-card border border-line200 bg-white`, no resting shadow, frequently with a 1.5px colored top strip (`h-1.5 bg-{status}`) to carry status without relying on color alone in text.
- **Inputs** — `h-11`–`h-14`, `rounded-control`, `border border-line200`, `focus:ring-2 focus:ring-primary/20`.
- **Tab bars / button rows** — two distinct, deliberate patterns (see Responsive Behavior): navigational tabs scroll horizontally and never wrap; choice/selection chip groups (language picker, gender/duration pickers) wrap onto a new line.

## Responsive Behavior

Breakpoints are unmodified Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.

**Multi-item tab/pill rows** — one rule, three named cases:
- *Navigational tabs* (a row whose selection changes which content panel is shown below it, e.g. the patient-detail Cognitive/Reminders/History/Companion/Family bar): **horizontal scroll, never wrap.** Buttons are `shrink-0 whitespace-nowrap`, the row is `overflow-x-auto`, and the active indicator (`border-b-2`) lives on the individual button so it never has to be repositioned for scroll or viewport changes. Wrapping a tab bar is prohibited — it pushes page content down unpredictably as tabs are added or the viewport narrows.
- *Choice/selection chip groups* (a row of equal-weight options with no content panel beneath it, e.g. `LanguagePicker`, the onboarding gender/duration pickers): `flex flex-wrap`, so extra items simply start a second row. Never let a choice group overflow the viewport unwrapped.
- *Persistent global bottom nav* (`CaregiverNav` — a fixed, always-visible set of app-level destinations, not in-page content tabs): **all items always visible, no scroll, no wrap.** Scrolling would hide destinations off-screen with no visible affordance that more exist (unacceptable for a nav whose whole job is one-tap reachability, e.g. "Patient View" — the only way back to patient mode); wrapping would double the bar's height and break the fixed-height thumb-reach contract. Equal-width `flex-1` columns, but the container needs `gap-1 px-2` (or equivalent) — without it, items sit with zero space between their text and zero margin from the screen edges, reading as visually cramped/touching even when nothing is actually truncating (confirmed via computed-style measurement: labels fit their columns with room to spare; the missing gap/padding was the entire defect). Before adding a new item to a bar already at this pattern's item count, measure total natural label width at 375px — if it no longer fits even with minimal gap/padding, an icon-only-until-active expanding-label treatment is a reasonable exception to reach for next, but re-verify the fit problem is real (computed widths, not assumption) before adding that complexity.

**Multi-column form rows**: any row placing two or more `<input>`/`<select>` side by side (e.g. name + relation) must be `flex flex-col gap-2 sm:flex-row`, with each field `sm:flex-1` — full-width stacked below 640px, side-by-side at 640px and up. A fixed side-by-side row with no stacking breakpoint is never acceptable.

**Minimum touch targets**: 48px (`touch-min`) is the accessibility floor for *any* interactive element at *any* breakpoint — it does not relax on mobile. Primary patient-facing controls (BigButton) stay at the full 64px (`touch`) target at every width.

## Do's and Don'ts

- **Don't** let a tab/pill row overflow the viewport with no wrap and no scroll — every button-row component must declare one of the three Responsive Behavior patterns above.
- **Don't** use a fixed side-by-side multi-column form row without a `sm:flex-row` (or equivalent) stacking rule for below-640px.
- **Don't** drop below 48px on any tappable control, at any breakpoint.
- **Do** give every card a `border border-line200` — that border is now the only depth signal, since resting shadows were removed app-wide; a card with neither is invisible against the page.
- **Don't** add a resting `shadow-sm`/`shadow-md` to a new card or button — `hover:shadow-md` for interaction feedback is fine, a static shadow is not.
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

## Implementation Log (Resend-structure pass)

- Palette untouched throughout — this pass changed structure only.
- Every resting `shadow-sm` removed app-wide (cards, tiles, inputs, buttons); `border-line200` alone now carries elevation. `hover:shadow-md` kept as interaction feedback where it existed.
- `patient-heading`/`caregiver-heading` tightened to line-height ~1.05 with negative letter-spacing; body sizes left untouched (elderly-legibility requirement).
- Radius scale tightened: card 20px→16px, panel 32px→24px, tile 16px→12px, control 10.4px→8px.
- Em dashes removed from all user-facing copy app-wide, across `.tsx` UI strings *and* `.ts` message catalogs (game instruction/narration text in `messages.ts` files, in all three locales — a first pass covered `.tsx` only and missed these). Rewritten to plain punctuation (periods, colons, commas) per clause, matching the app's existing register in each language rather than a literal dash-to-period find/replace.
- Button labels standardized to sentence case app-wide, including plain `<button>`/`<Link>` text (not just the `BigButton` `label` prop, which a first pass covered but a plain-text scan didn't) — `Get Started`→`Get started`, `Verify Code`→`Verify code`, `Send Login Code`→`Send login code`, `Caregiver Login`→`Caregiver login` (button use) alongside the earlier `Try Again`→`Try again` and friends.
- `FamilyMessageBoard.tsx` had lost its shadow with no border to replace it (a card with neither, invisible against the page) — added `border border-line200` to match every other card.

## Implementation Log (bottom-nav crowding fix)

- A prior pass (`a3a73ff`) shortened "Memory Bank" → "Memory" and added `min-w-0 truncate` to `CaregiverNav`, but a real-viewport screenshot at 375px still showed the 5 items visually cramped. Measured computed styles before touching code: no label was actually being truncated (`scrollWidth === clientWidth` for all 5) and the 5 natural label widths summed to 250px against a 375px viewport — the fit was never the problem. The container had zero `gap`/`px` between its `flex-1` columns and zero edge padding, so labels sat directly adjacent to each other and to the physical screen edges ("Patient View" ended exactly flush with the right edge). Fixed with `gap-1 px-2` on the nav container — no font/label/architecture change needed.
- Documented as a third named case in Responsive Behavior above: this component is neither a content-switching tab bar (scroll would hide "Patient View", the only way back to patient mode) nor a wrapping choice group (would double the bar's fixed height) — it's a persistent global bottom nav, which must keep all items visible with adequate gap/padding.
- Evaluated and rejected an icon-only/expanding-active-label pattern (offered as a reference example) for this fix: the measured data showed a spacing defect, not a fit-capacity one, so adopting a new interaction pattern (label appears only on the active tab) would have added complexity and an extra layer of relabeling-on-tap for elderly-adjacent caregiver users without solving a real constraint. Left as a documented fallback option in Responsive Behavior above if a future item addition genuinely doesn't fit.

## Discrepancies (doc vs. code, found while formalizing this document)

1. **The original prose doc is a landing-page spec, not a product spec.** `docs/Design System_ Amigo-Inspired Clinical AI Platform.md` was written for a marketing homepage (hero, carousel, cookie banner, footer sitemap) that doesn't exist in this app. `tailwind.config.ts` took its §3.1 color values but the two were never reconciled beyond that: the config adds `success`/`warning`/`danger`, `ink-inverse`, `game.*`, and the entire `gamosa`/`muga` cultural-accent pair, none of which appear in the prose doc at all. This DESIGN.md is the reconciled version — `tailwind.config.ts` was treated as ground truth wherever the two disagreed.
2. **`teal` was a misleading legacy name**, now cleaned up in app/caregiver UI (see Implementation Log). The `tailwind.config.ts` token itself is left defined for back-compat, still pointing at `#B3452D`.
3. **`accent` (`#B3452D`) is defined but effectively dead.** No component uses `bg-accent`/`text-accent`/`border-accent`. The only `accent-*` classes in the codebase are Tailwind's unrelated native-input `accent-primary` utility (checkbox/radio/slider tint) in three UI primitives.
4. **The prose doc specifies no shadows on cards.** Shipped code briefly diverged from that (pairing `border` + `shadow-sm`, which this document once documented as correct), then was brought back in line with the prose doc's original no-shadow direction in the Resend-structure pass — see Implementation Log above. `shadow-sm` at rest is now the drift to watch for, not the standard.
5. **Bare Tailwind grays have been replaced with semantic tokens across app/caregiver UI** in this pass (see Implementation Log). Remaining exceptions: game-internal canvases with their own established palettes (`double-decision`, `n-back` share-card) were deliberately left alone.
6. **One legitimate off-palette exception**: `components/games/n-back/GameComponent.tsx`'s share-card generator uses a self-contained dark theme (`#0c3a4b`, `#5de3c1`, etc.) for a social-share image, not in-app UI.

## ⚠️ Working-tree stability note

This document and a batch of code changes were silently wiped from disk (via an apparent `git clean`/reset outside this conversation) partway through this work and had to be reapplied from scratch. If you're reading this after another gap in the session, verify `git status` shows the expected modified/new files before trusting that prior work is intact — and commit early and often, since uncommitted work in this worktree has now been lost twice in one session.

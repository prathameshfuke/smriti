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
  gamosa:      { value: "#BE3A34", role: "cultural accent — red alert marker (traffic-light dot, patient-status text)" }
  muga:
    DEFAULT:   { value: "#C9A227", role: "cultural accent (gold) — active tab underline, per-game accuracy figure" }
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
- `gamosa` (red) marks patient status-severity (traffic-light dot, status text), alongside `danger` for hard errors — `gamosa` reads as a status-severity accent, `danger` as a system error.
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

Three levels, formalized here as the enforceable standard (no new values — these are the tokens already defined in the frontmatter):

| Level | Treatment | Use |
|---|---|---|
| **Level 0 — Flat** | `surface` (`#F8F7F3`) background, no border, no shadow | Page canvas |
| **Level 1 — Card** | `surface-card`/`bg-white` on `surface`, 1px `border-line200`, **no resting shadow** | Every card, tile, input, and button at rest — `border-line200` alone carries the depth signal |
| **Level 2 — Muted/inset** | `surface-muted` (`#F0EEE9`) | Secondary/nested surfaces — a card-within-a-card, an inactive chip fill |

`hover:shadow-md` is kept wherever it existed, but it's interaction feedback (a press/hover lift), not static elevation — a different concern the no-shadow rule at Level 1 doesn't touch. Modals, dialogs, and floating overlays (bottom sheets, full-screen backdrop-blur results screens) keep their heavier `shadow-lg`/`shadow-xl`/`shadow-2xl` — they float above the page rather than sitting on it, which is a fourth, deliberately-separate category from the three resting levels above, not a Level 1 card with an exception bolted on.

Status/semantic signal is never a full-edge stripe or border treatment at any level — use `StatusBadge` (small pill, dot + label, semantic tone) or the existing `TrafficLight`/`SyncIndicator` components, layered on top of whatever level the card itself sits at.

This reverses this document's earlier position (previously: "border + shadow-sm together, that pairing is what card means here") — the earlier statement was accurate for the code at the time; it no longer is. If a component still has a resting `shadow-sm` at Level 1, that's drift to fix, not a variant to preserve. Confirmed clean app-wide as of the two Implementation Log entries below (card top-strip removal, app-wide resting-shadow sweep) — every remaining resting shadow in the codebase is a Level-4 (floating/modal) case, not a missed Level 1 card.

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
- **Cards** — `rounded-card border border-line200 bg-white`, no resting shadow, no color stripe. A card's own content (a number, a heading) is the primary signal; where a card genuinely needs a separate status signal, use `StatusBadge` (small pill, icon-equivalent dot + label, semantic tone) or the existing `TrafficLight`/`SyncIndicator` components — never a full-edge color bar. (Earlier passes used a `h-1.5 bg-{status}` top strip on every card; removed in this pass — audited call by call, most were fixed-color decoration duplicating a signal already carried by the card's own text or an adjacent status component, not a real per-card status.)
- **Inputs** — `h-11`–`h-14`, `rounded-control`, `border border-line200`, `focus:ring-2 focus:ring-primary/20`.
- **Tab bars / button rows** — two distinct, deliberate patterns (see Responsive Behavior): navigational tabs scroll horizontally and never wrap; choice/selection chip groups (language picker, gender/duration pickers) wrap onto a new line.

## Responsive Behavior

Breakpoints are unmodified Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.

**Multi-item tab/pill rows** — one rule, three named cases:
- *Navigational tabs* (a row whose selection changes which content panel is shown below it, e.g. the patient-detail Cognitive/Reminders/History/Companion/Family bar): **horizontal scroll, never wrap.** Buttons are `shrink-0 whitespace-nowrap`, the row is `overflow-x-auto`, and the active indicator (`border-b-2`) lives on the individual button so it never has to be repositioned for scroll or viewport changes. Wrapping a tab bar is prohibited — it pushes page content down unpredictably as tabs are added or the viewport narrows.
- *Choice/selection chip groups* (a row of equal-weight options with no content panel beneath it, e.g. `LanguagePicker`, the onboarding gender/duration pickers): `flex flex-wrap`, so extra items simply start a second row. Never let a choice group overflow the viewport unwrapped.
- *Persistent global bottom nav* (`CaregiverNav` — a fixed, always-visible set of app-level destinations, not in-page content tabs): **all items always visible, no scroll, never truncated.** Scrolling would hide destinations off-screen with no visible affordance that more exist (unacceptable for a nav whose whole job is one-tap reachability, e.g. "Patient View" — the only way back to patient mode). **320px is the binding width**, not 375px: five edge-to-edge `flex-1 basis-0` tabs (no container `gap`/`px` — that space came straight out of each tab), 12px labels with `px-2` that *wrap between words* (a two-word label may take two lines inside the fixed 64px bar; a single word never breaks), icon 20px top-aligned so one- and two-line labels share a baseline for the icons. Acceptance bar, measured on rendered DOM at 320/360/375/390/393/414/430: no label overflows its tab, ≥8px clear on each side of every label, ≥16px between adjacent labels, every tab ≥48px wide. The bar's 64px *excludes* `env(safe-area-inset-bottom)` (`h-[calc(4rem+env(safe-area-inset-bottom))]`) — padding inside a fixed 64px border-box used to leave 29px of tap height on a 34px-inset iPhone. Before adding a sixth item or a longer label, re-measure the widest single word at 320px; if it can't keep 8px per side, switch to icon-only with a label on the active tab rather than shrinking text further.

**Multi-column form rows**: any row placing two or more `<input>`/`<select>` side by side (e.g. name + relation) must be `flex flex-col gap-2 sm:flex-row`, with each field `sm:flex-1` — full-width stacked below 640px, side-by-side at 640px and up. A fixed side-by-side row with no stacking breakpoint is never acceptable.

**Minimum touch targets**: 48px (`touch-min`) is the accessibility floor for *any* interactive element at *any* breakpoint — it does not relax on mobile. Primary patient-facing controls (BigButton) stay at the full 64px (`touch`) target at every width.

## Do's and Don'ts

- **Don't** let a tab/pill row overflow the viewport with no wrap and no scroll — every button-row component must declare one of the three Responsive Behavior patterns above.
- **Don't** use a fixed side-by-side multi-column form row without a `sm:flex-row` (or equivalent) stacking rule for below-640px.
- **Don't** drop below 48px on any tappable control, at any breakpoint.
- **Don't** verify a layout fix at one viewport width. Phones in use span 320px–430px; measure at the narrowest (320px) as the binding case and at least 375px and 430px.
- **Don't** use a colored edge stripe (`w-1.5`/`h-1.5 bg-{color}`, `border-l-*`/`border-t-*` accents) on a card. Status goes in `TrafficLight` or `StatusBadge`; decoration is dropped.
- **Do** give every card a `border border-line200` — that border is now the only depth signal, since resting shadows were removed app-wide; a card with neither is invisible against the page.
- **Don't** add a resting `shadow-sm`/`shadow-md` to a new card or button — `hover:shadow-md` for interaction feedback is fine, a static shadow is not.
- **Do** pair every heading-scale font size with `font-serif-display`.
- **Don't** reach for a bare Tailwind gray (`text-gray-500`, `bg-gray-100`, etc.) for anything with a semantic equivalent (`ink-muted`, `surface-muted`, `line200`) — as of this pass, app/caregiver UI no longer does.
- **Don't** introduce a color outside the palette listed in the frontmatter above.

- **AnimatedSwitch** — the app's first `role="switch"` control ([components/ui/AnimatedSwitch.tsx](src/components/ui/AnimatedSwitch.tsx)): a spring-driven thumb slide (`framer-motion`, already a dependency via the game components), `useReducedMotion`-gated to an instant flip. Caregiver-only; `min-h-touch-min min-w-touch-min` (48px) sizes the tap target per the Responsive Behavior touch-target floor even though the visible track is smaller. First real use: the Family tab's per-share "review notes first" toggle (`review_required`), previously a typed field with no UI (see the card top-strip removal log below) — now wired to a real `PATCH /api/family-share/[id]`.
- **AccountAccessCard** — [components/caregiver/AccountAccessCard.tsx](src/components/caregiver/AccountAccessCard.tsx): formalizes the Family tab's per-share row (label, `StatusBadge`, the `AnimatedSwitch` above, revoke) into a named Level-1 card, `hover:shadow-md` interaction feedback per the standard card recipe.
- **FaqTabsCard** — [components/ui/FaqTabsCard.tsx](src/components/ui/FaqTabsCard.tsx): a Level-1 card whose body is a navigational tab bar (horizontal scroll, never wrap, active indicator on the button — the same pattern as the patient-detail sub-tab bar) switching between FAQ answers, cross-fading via `framer-motion` (`useReducedMotion`-gated). First use: caregiver Settings' "Help & FAQ" section.
- **CognitiveTrendChart** ([components/caregiver/CognitiveTrendChart.tsx](src/components/caregiver/CognitiveTrendChart.tsx)) draws its line in once — the first time real trend data appears, not on every range switch or background refresh. This is deliberately narrower than "swap in an animated chart library," which an earlier pass evaluated and rejected (see the card top-strip removal log): the 4-state handling, drop-detection callout, and `sr-only` data table stay exactly as they were; only the first successful draw of the `<Line>` animates, latched via a ref so it never re-triggers, and skipped entirely under `prefers-reduced-motion`.

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

## Implementation Log (card top-strip removal)

- Removed the `h-1.5 bg-{color}` card top-strip (and one `w-1.5` left-edge variant on dashboard patient cards) from every site: [dashboard/page.tsx](src/app/caregiver/dashboard/page.tsx) (3 sites), [settings/page.tsx](src/app/caregiver/settings/page.tsx) (4), [patients/[id]/page.tsx](src/app/caregiver/patients/[id]/page.tsx) (6). Audited each: 12 of 13 were fixed-color decoration applied regardless of the card's actual data (e.g. "Daily streak" and "This week" always got a strip color with no relation to streak/digest content); the dashboard left-edge strip on patient cards duplicated a signal the same card already carries via `TrafficLight` + colored status text.
- Added `StatusBadge` ([components/ui/StatusBadge.tsx](src/components/ui/StatusBadge.tsx)) for the one site with a genuine per-render status (dashboard "Needs review" card, tone flips success/danger with `attentionCount`). Settings' Danger Zone kept its `border-danger/40` + danger-colored heading, which already carried that signal without the strip — no badge added there, to avoid restating the same thing twice.
- Not done in this pass, and why: a broader radius unification was considered and rejected — the app's existing 4-tier `card`/`tile`/`control`/`panel` scale is deliberate and was already tightened in an earlier pass (see Implementation Log above); grepping every `rounded-*` usage found zero real inconsistencies outside two already-documented game-canvas exceptions. Collapsing to a single radius would have undone that intentional work without fixing a real defect.
- Restyled the family "Active shares" row (`patients/[id]/page.tsx`) to use `StatusBadge` for revoked/expired/active state instead of a plain muted-text line — the one other real per-item status the app has.
- Evaluated swapping `CognitiveTrendChart` for an animated chart library and rejected it: the current component already handles 4 distinct states (loading/empty/low-data/full trend), a drop-detection callout, and a `sr-only` accessible data table alongside the visual SVG — a generic animated-chart component would need all of that re-built around it to match, for no functional gain, and `isAnimationActive={false}` on the line is a deliberate choice (avoids a jarring re-animate on every data refresh) that a default-animated component would need overriding to preserve.
- Did not touch the per-patient sub-tab bar (Cognitive/Reminders/History/Companion/Family): it was already fixed twice for overflow and is now a documented, deliberate pattern (see Responsive Behavior above, "navigational tabs... horizontal scroll, never wrap"). A generic tabs component wasn't evaluated against it in this pass since there was no concrete alternative implementation to compare against — the existing pattern already meets its documented constraints.
- **Correction (see "320px bottom-nav and leftover stripe" log below):** "every site" was not true. The same `w-1.5 ${stripColor}` left-edge stripe remained on the caregiver Patients list ([patients/page.tsx](src/app/caregiver/patients/page.tsx)), a file this pass never opened.
- No new toggle/switch component added: grepped the whole app for `role="switch"` and found none — there is no existing toggle UI in caregiver Settings to re-skin. `review_required` on family shares is a typed field with no checkbox/toggle UI today; adding one would be a new feature, not a design-system pass, so it's out of scope here.

## Implementation Log (app-wide resting-shadow sweep)

- Extended the no-resting-shadow rule (see Elevation & Depth) past the caregiver dashboard/settings/patient pages into every game component: found and removed resting `shadow-sm`/`shadow-md` from opaque `bg-surface-card`/`bg-game-tile` cards and tiles in `ObjectGrid.tsx`, `RoutineRecall.tsx`, `DualNBackClearLeaderboard.tsx` (3 sites), `MemoryTestGame.tsx` (6 sites), `larger-number/GameComponent.tsx`, and one tile in `double-decision/PeripheralSpeedGame.tsx`. `hover:shadow-md` interaction feedback kept everywhere it existed, per the existing rule.
- Added the missing `border-line200` to 3 of those (`ObjectGrid.tsx`'s target card, `RoutineRecall.tsx`'s result card, the double-decision vehicle-choice tile) — same "a card with neither border nor shadow is invisible" rule already documented above, just not yet applied to these game-result/game-choice cards.
- Also fixed `ObjectGrid.tsx`'s target card from an ad hoc `border-black/5` to the standard `border-line200` token.
- Deliberately left alone: `app/page.tsx`'s family-note dialog, `ReminderCard.tsx`, `SessionCalendar.tsx`'s bottom sheet, and `PatternRecallGame.tsx`'s game-over overlay — all are floating dialog/bottom-sheet/full-screen-overlay treatments, which this doc's Elevation section already exempts from the no-shadow rule (same category as any other modal). `counting-boxes/GameComponent.tsx`'s HUD chips and `double-decision`'s own two floating overlay controls use translucent (`/80`–`/95`) backdrop-blur backgrounds — a floating-over-content HUD, not a resting card — also left as-is. No color values were changed anywhere in this pass; only elevation (shadow/border) treatment.

## Implementation Log (full DESIGN.md compliance pass)

- Re-audited every Do/Don't in this document against the live codebase (not just the files touched by earlier passes): every card has `border-line200` ✓, zero bare Tailwind grays ✓, zero remaining `h-1.5 bg-` stripes ✓, radius scale consistent app-wide ✓ (all confirmed by earlier passes, re-verified here).
- Found and fixed 2 real gaps against "give every card a `border-line200`": `frog-leap/GameComponent.tsx` and `fish-trace/GameComponent.tsx`'s full-bleed game-board containers (`bg-surface-card rounded-card`, no border) — added `border border-line200`, same treatment already applied elsewhere this session (`ObjectGrid.tsx`, the double-decision vehicle-choice tile).
- Found and fixed 3 real gaps against "pair every heading-scale font size with `font-serif-display`": `ReminderCard.tsx`'s reminder label, `SessionComplete.tsx`'s result line, `reminiscence-quiz/GameComponent.tsx`'s question text — all used `text-patient-heading` without the serif font. Added `font-serif-display` to each; this only changes the typeface, not the token's line-height/tracking, so it doesn't reintroduce the cramped-wrapping bug the Typography section warns about.
- Deliberately left alone: `caregiver/login/page.tsx`'s OTP code input (`text-caregiver-heading` on an `<input>`, not a heading) — it's a 6-digit code-entry field, not a title; forcing the display serif onto numeral entry would work against the app's own low-vision-legibility rationale for keeping digits in Atkinson Hyperlegible. Judgment call, not an oversight.
- Off-palette colors: `ReminderCard.tsx`'s per-reminder-type icon backgrounds (`bg-blue-100`, `bg-green-100`, `bg-orange-100`) are pre-existing and outside the frontmatter palette, but left untouched per explicit instruction this session not to change existing colors — flagged here as a known, deliberate exception rather than silently ignored.

## Implementation Log (design-audit and patient-safety pass)

- **Audited this document's own compliance claims against live code rather than trusting the prior pass's "confirmed clean app-wide."** Found real, narrow drift: `MemoryGrid.tsx` and `RoutineRecall.tsx` still carried a resting `shadow-sm` on their tile/card elements (both already had `border-2` and `hover:shadow-md` — the shadow was purely additive drift, not load-bearing). Also found the same pattern on 5 in-flow game buttons that DESIGN.md's "app-wide resting-shadow sweep" pass had missed because it audited `bg-surface-card`/`bg-game-tile` cards and tiles, not these games' shadcn-style `<Button>` call sites: `frog-leap/GameComponent.tsx` (Start, Restart) and `fish-trace/GameComponent.tsx` (Start, Confirm selection, Try again). All 7 fixed by removing the resting `shadow-sm`; `hover:shadow-md`/`hover:scale-105` interaction feedback kept where present.
- **Deliberately left alone**: `frog-leap`/`fish-trace`'s small floating settings-gear icon buttons (`shadow-sm rounded-full`, absolutely positioned over the game canvas, opens a `Dialog`) and `counting-boxes/GameComponent.tsx`'s HUD timer chips (`bg-surface-card/85 backdrop-blur-sm`) and game-over overlay (`bg-surface-card/95 backdrop-blur-sm`, `absolute inset-0 z-20`) — all floating-over-content treatments the Elevation section already exempts, not resting cards. `n-back/GameDemo.tsx`'s tutorial-highlight cell (`scale-110 shadow-sm`, applied only to the one cell being demonstrated) is a momentary attention cue conditioned on render state, the same category as `hover:shadow-md` interaction feedback, not a static resting elevation — also left alone.
- **The 5 "animated" components referenced going into this pass (animated-switch, animated-SVG-chart, account-access-card, faq-tabs-card, status-badge) did not exist in the codebase** except `StatusBadge`, which was already real and in use. Built three real ones with concrete, previously-missing use cases rather than building anything decorative: `AnimatedSwitch` (Family tab's `review_required` toggle — see Components above), `AccountAccessCard` (formalizes the Family tab's share row), and `FaqTabsCard` (Settings' new Help & FAQ section). Extended `CognitiveTrendChart` with a first-draw-only line animation instead of building a separate "animated SVG chart" component, since a from-scratch replacement was already evaluated and rejected once (see the card top-strip removal log) for good, still-valid reasons.
- **Patient-facing language selector removed as a safety fix, not a design change.** `LanguagePicker` was rendered directly on the patient home screen (`app/page.tsx`) with no caregiver gate — a patient could switch the app into a language they don't read with no way back. Removed from that screen entirely (not just given a confirmation step, per the app's existing "patient never faces a complex setting" principle already established for login/PIN). It remains exactly where it already was for `caregiver/settings` and `caregiver/onboarding`, both already behind the caregiver layout's session gate. `LanguagePicker` itself now also refuses to render outside `/caregiver/*` routes, so a future accidental import onto a patient screen is inert rather than a silent regression.
- **`reminders.tsx`'s add/edit/delete gate used the wrong signal.** It checked for a live Supabase session (`hasSession`), which stays true in the background as long as a token keeps auto-refreshing — unrelated to whether a caregiver is actually holding the device right now, unlike every other caregiver-gated surface in the app, which checks the PIN-freshness signal (`isCaregiverSessionFresh`). Since this page is reached from the patient home screen with no PIN prompt of its own, a stale-but-still-refreshing session could have left medication/hydration reminder edit and delete exposed to the patient. Switched the gate to `isCaregiverSessionFresh()`, matching `/app`'s own PIN dialog.

## Implementation Log (320px bottom-nav and leftover stripe)

- **Why the two earlier nav fixes didn't hold.** `a3a73ff` renamed "Memory Bank" to "Memory" and added `truncate`; `9dbece9` added `gap-1 px-2`. Both were verified at 375px only. Measured in Atkinson Hyperlegible at 12px: "Dashboard" is 56.8px and "Patient View" 65.3px. With the gap and padding, each tab was (W−32)/5: 57.6px at 320px, so "Patient View" was clipped and "Dashboard" had 0.4px per side, leaving 11.8px of visible space between the "Dashboard" and "Patients" labels. The `gap-1 px-2` fix took 32px out of the tabs, and `truncate` hid the overflow rather than making room. The "Memory" rename is what later read as a truncated label on a device.
- **Fix.** Edge-to-edge tabs (W/5 = 64px at 320px), labels wrap between words, `truncate` removed, full labels restored. "Dashboard" became "Overview", matching `CaregiverTopNav` and the page's own heading: at 320px no single-line "Dashboard" at ≥11px can keep 8px clear on each side (3.6px per side at 12px). Icon 22→20px. Measured on rendered DOM, minimum clearance per side / minimum space between adjacent labels: 320px 8.1/18.7, 360px 12.1/26.7, 375px 13.6/29.7, 390px 15.1/32.7, 393px 15.4/33.3, 414px 8.8/28.4, 430px 10.4/31.6. No overflow and no horizontal page scroll at any width. Tabs are 64–86px wide × 63px tall.
- **Safe area.** The nav had `height: 64` with `paddingBottom: env(safe-area-inset-bottom)` inside it (border-box). With a 34px inset that left 29px of tap height, below the 48px floor; now 63px. Separately, `<Disclaimer>` renders after each route in the root layout, so the caregiver shell's bottom padding never cleared it and its last lines always sat under the nav. Where `:has()` is supported, the clearance now lives on `<body>` ([globals.css](src/app/globals.css)); otherwise the shell keeps its own padding.
- **Stripe.** Removed the remaining `w-1.5 ${stripColor}` left-edge stripe from the Patients list rows. `TrafficLight` (color, glyph, `aria-label`) already carries status there, the same reasoning as the dashboard card, so no `StatusBadge` was added. Also removed the landing hero paragraph's decorative `border-l-2 border-terra600`. After this change, a grep of `src/` for thin colored bars and `border-l-*`/`border-t-*` accents returns no card stripes. The remaining thin elements are progress tracks, `StatusBadge`'s own dot, a loading spinner, and a game-scene background band.

## Discrepancies (doc vs. code, found while formalizing this document)

1. **The original prose doc is a landing-page spec, not a product spec.** `docs/Design System_ Amigo-Inspired Clinical AI Platform.md` was written for a marketing homepage (hero, carousel, cookie banner, footer sitemap) that doesn't exist in this app. `tailwind.config.ts` took its §3.1 color values but the two were never reconciled beyond that: the config adds `success`/`warning`/`danger`, `ink-inverse`, `game.*`, and the entire `gamosa`/`muga` cultural-accent pair, none of which appear in the prose doc at all. This DESIGN.md is the reconciled version — `tailwind.config.ts` was treated as ground truth wherever the two disagreed.
2. **`teal` was a misleading legacy name**, now cleaned up in app/caregiver UI (see Implementation Log). The `tailwind.config.ts` token itself is left defined for back-compat, still pointing at `#B3452D`.
3. **`accent` (`#B3452D`) is defined but effectively dead.** No component uses `bg-accent`/`text-accent`/`border-accent`. The only `accent-*` classes in the codebase are Tailwind's unrelated native-input `accent-primary` utility (checkbox/radio/slider tint) in three UI primitives.
4. **The prose doc specifies no shadows on cards.** Shipped code briefly diverged from that (pairing `border` + `shadow-sm`, which this document once documented as correct), then was brought back in line with the prose doc's original no-shadow direction in the Resend-structure pass — see Implementation Log above. `shadow-sm` at rest is now the drift to watch for, not the standard.
5. **Bare Tailwind grays have been replaced with semantic tokens across app/caregiver UI** in this pass (see Implementation Log). Remaining exceptions: game-internal canvases with their own established palettes (`double-decision`, `n-back` share-card) were deliberately left alone.
6. **One legitimate off-palette exception**: `components/games/n-back/GameComponent.tsx`'s share-card generator uses a self-contained dark theme (`#0c3a4b`, `#5de3c1`, etc.) for a social-share image, not in-app UI.

## ⚠️ Working-tree stability note

This document and a batch of code changes were silently wiped from disk (via an apparent `git clean`/reset outside this conversation) partway through this work and had to be reapplied from scratch. If you're reading this after another gap in the session, verify `git status` shows the expected modified/new files before trusting that prior work is intact — and commit early and often, since uncommitted work in this worktree has now been lost twice in one session.

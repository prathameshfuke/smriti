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
  success:     { value: "#39A85A", role: "positive status marker (dot, fill). Never text: 3:1 on white" }
  warning:     { value: "#D97706", role: "needs-attention status marker (dot, fill). Never text: 3.2:1 on white" }
  danger:      { value: "#DC2626", role: "urgent/error status" }
  game:
    bg:        { value: "#F9FAFB", role: "game canvas background" }
    tile:      { value: "#F3F4F6", role: "game tile fill" }
    active:    { value: "#D1D5DB", role: "game tile active/pressed fill" }
  gamosa:      { value: "#BE3A34", role: "cultural accent — red alert marker (traffic-light dot, patient-status text)" }
  muga:
    DEFAULT:   { value: "#C9A227", role: "cultural accent (gold) — session-result stars only" }
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

**Status colours are markers, never text.** `success` (3:1) and `warning` (3.2:1) are too faint on white for anything a reader relies on. Status always renders as a coloured dot or fill plus a label in `ink` (`StatusBadge`, `TrafficLight`, the dashboard summary strip). Tinted surfaces use `/5` of the status colour with a `/40`–`/50` border, and the text on them stays `ink`.

**Component boundaries clear 3:1** (WCAG 1.4.11). Secondary buttons and choice chips use a solid `ink-muted` outline; text fields use `ink-muted/60`. `line200` is for dividers and resting panel borders only, never the edge of something you tap or type into.

See the frontmatter table for every token and its real usage. In practice:
- `primary` (`#B3452D`) is the one action color — filled buttons, active tab underlines, focus rings, links.
- `muga` (gold) marks the active state on the patient-detail sub-tab bar and tops stat cards; `muga-dark` is used for its text because `muga` itself fails WCAG AA.
- `gamosa` (red) marks patient status-severity (traffic-light dot, status text), alongside `danger` for hard errors — `gamosa` reads as a status-severity accent, `danger` as a system error.
- `ink-muted` is the standard secondary-text color and `line200` the standard border color — as of this pass, every bare `text-gray-*`/`border-gray-*` in app/caregiver UI has been replaced with these (see Implementation Log). New code should always reach for the semantic token, never a raw Tailwind gray.

## Typography

Every heading uses `font-serif-display` (Fraunces) at weight 500, sized with the page scale below. No italics, no single accented word in a headline, no all-caps eyebrow labels above headings: all three are harder to read for this cohort and read as template chrome.

| Role | Size |
|---|---|
| Caregiver page title (`PageHeader`) | 32px, 40px from `md` |
| Patient greeting | 40px |
| Panel / section title (`Panel`) | 22px |
| Patient section title ("Choose a game") | 28px | Body copy and controls use the default sans (Atkinson Hyperlegible) — never pair a heading-scale size without `font-serif-display`, and never use `font-serif-display` on body copy. The smallest body size anywhere in the app is 16px (`patient-sm`); nothing goes smaller except numeric micro-labels inside game canvases, which aren't reading text.

`caregiver-heading` runs tight: line-height ~1.05 with slight negative letter-spacing, a display-block treatment. Every usage of this token is a short, static, single-line page/section title ("Overview", "Settings", "Today") that never wraps — confirmed by auditing every call site before tightening it.

`patient-heading` is **not** tightened at the token level, deliberately, despite being the same visual role — it's shared with a large amount of dynamic, possibly-wrapping content across game components (quiz questions, object names, reminder labels, result text), and a tight line-height there cramps multi-line text instead of reading as a considered display face. An earlier version of this pass tightened it globally and shipped a real readability bug (`reminiscence-quiz` questions rendered cramped). Where a `patient-heading` element genuinely is a short static title (`companion/page.tsx`'s "Ask Smriti", `app/page.tsx`'s "A message for you"), the tight treatment is applied as an inline `leading-[1.05] tracking-[-0.02em]` override on that element only — never by changing the shared token. Before adding another such override, confirm the specific element's content is fixed-length and can't wrap; if it can, leave it at the token's relaxed 1.3 line-height.

Body sizes keep the full 1.6 line-height the elderly/low-vision legibility requirement calls for; that distinction must never blur.

## Layout

- Patient screens: `mx-auto max-w-patient` (480px), `px-5`. Single column, left-aligned, one visible way back (`PatientNav`, "Back" in words).
- Caregiver screens: `mx-auto max-w-dashboard` (1200px), `px-5 py-8 md:px-10 md:py-12`, always opening with `PageHeader`.
- Caregiver shell: `CaregiverRail` (persistent left navigation, sync state, Patient View) from `md` up; `CaregiverNav` (bottom tabs) below `md`. No hamburger drawer at any width: every destination stays a visible word.
- Repeated items (patients, alerts, reminders, memory entries, shares) are rows in one divided panel (`divide-y divide-line200`), not a grid of separate cards.
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

- **BigButton** — the one primary-action control on patient screens. `primary` (terracotta, white label), `secondary` (white, solid `ink-muted` outline), `success` (green fill, **ink** label: white on this green is 3:1). Flat, `rounded-control`, 72px tall, same string drives the visible label and the spoken audio prompt.
- **GameTile** — a full-width row: 56px illustration, name at 22px, difficulty dots on the right. Rows replace the old two-column tile grid.
- **PageHeader** ([components/ui/PageHeader.tsx](src/components/ui/PageHeader.tsx)) — title, one sentence of orientation, at most one action.
- **Panel** ([components/ui/Panel.tsx](src/components/ui/Panel.tsx)) — the white working surface, plus the shared `fieldClass`, `labelClass`, `textActionClass` and compact `buttonClass` for dense caregiver panels. Every field has a visible label; placeholders are examples, not labels.
- **PinDots** — PIN entry progress, shared by the home PIN dialog, login, onboarding and settings.
- **Icon** ([components/Icon.tsx](src/components/Icon.tsx)) — the only way to render a Lucide icon; defaults to `strokeWidth` 2.5 and `aria-hidden`. Icons appear only beside a visible text label (bottom nav, Back, keypad backspace, companion mic). No emoji in app chrome.
- **Cards / panels** — `rounded-card border border-line200 bg-white`, no resting shadow, no color stripe. A card's own content (a number, a heading) is the primary signal; where a card genuinely needs a separate status signal, use `StatusBadge` (small pill, icon-equivalent dot + label, semantic tone) or the existing `TrafficLight`/`SyncIndicator` components — never a full-edge color bar. (Earlier passes used a `h-1.5 bg-{status}` top strip on every card; removed in this pass — audited call by call, most were fixed-color decoration duplicating a signal already carried by the card's own text or an adjacent status component, not a real per-card status.)
- **Inputs** — `h-11`–`h-14`, `rounded-control`, `border border-line200`, `focus:ring-2 focus:ring-primary/20`.
- **Tab bars / button rows** — two distinct, deliberate patterns (see Responsive Behavior): navigational tabs scroll horizontally and never wrap; choice/selection chip groups (language picker, gender/duration pickers) wrap onto a new line.

## Responsive Behavior

Breakpoints are unmodified Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.

**Multi-item tab/pill rows** — one rule, three named cases:
- *Section buttons* (a row whose selection changes which content panel is shown below it, e.g. the patient page's Cognitive/Reminders/Companion/Family): **never scroll.** A fixed grid of filled/outlined buttons placed directly under the page title (`grid-cols-2`, `sm:grid-cols-4`), every section always visible. Switching sections scrolls back to the top. No component anywhere in the app may introduce an inner horizontal or vertical scroll area; a bottom sheet that must scroll hides its track with `.scrollbar-none`. Buttons are `shrink-0 whitespace-nowrap`, the row is `overflow-x-auto`, and the active indicator (`border-b-[3px] border-primary` plus bold text) lives on the individual button so it never has to be repositioned for scroll or viewport changes. Wrapping a tab bar is prohibited — it pushes page content down unpredictably as tabs are added or the viewport narrows.
- *Choice/selection chip groups* (a row of equal-weight options with no content panel beneath it, e.g. `LanguagePicker`, the onboarding gender/duration pickers): `flex flex-wrap`, so extra items simply start a second row. Never let a choice group overflow the viewport unwrapped.
- *Persistent global bottom nav* (`CaregiverNav` — a fixed, always-visible set of app-level destinations, not in-page content tabs): **all items always visible, no scroll, never truncated.** Scrolling would hide destinations off-screen with no visible affordance that more exist (unacceptable for a nav whose whole job is one-tap reachability, e.g. "Patient View" — the only way back to patient mode). **320px is the binding width**, not 375px: five edge-to-edge `flex-1 basis-0` tabs (no container `gap`/`px` — that space came straight out of each tab), 12px labels with `px-2` that *wrap between words* (a two-word label may take two lines, `leading-[1.1]`; a single word never breaks), icon 20px top-aligned so one- and two-line labels share a baseline for the icons. Acceptance bar, measured on rendered DOM at 320/360/375/390/393/414/430: no label overflows its tab, ≥8px clear on each side of every label, ≥16px between adjacent labels, every tab ≥48px wide and tall. Height comes from `--caregiver-nav-h` / `--caregiver-nav-pad` in globals.css: a 56px bar that fits a two-line tab, plus bottom padding of `max(env(safe-area-inset-bottom) - 14px, 4px)`. Never pad the inset *inside* a fixed height (that left 29px of tap height on a 34px-inset iPhone), and never stack the *full* inset under the labels (that read as a tall blank strip at the bottom of the screen). The 14px overlap still keeps labels above the iPhone home indicator, which sits 8–13px above the screen edge. Before adding a sixth item or a longer label, re-measure the widest single word at 320px; if it can't keep 8px per side, switch to icon-only with a label on the active tab rather than shrinking text further.

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
- **Don't** colour text with `success` or `warning`; use a marker plus an `ink` label.
- **Don't** ship an icon-only button. "Edit", "Delete", "Remove", "Back", "Caregiver" are words.
- **Don't** add scroll-triggered reveal animations. The landing hero's single load-in is the only non-interactive motion.
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

## Implementation Log (bottom-nav blank strip)

- On a real phone after #10, the nav showed a tall blank strip below the labels. #10 put the whole safe-area inset under a 64px bar whose one-line tabs already had ~18px of empty space. On a 34px iPhone inset that was 37px of blank below two-line labels and 52px below one-line labels.
- Bar reduced to 56px (label `leading-[1.1]`, top padding 8→6px), and the inset now overlaps the bar by 14px (`max(inset − 14px, 4px)`). Measured blank space under two-line / one-line labels, before → after: 34px inset 37/52 → 19.8/33; 24px inset (Android gesture bar) 27/42 → 9.8/23; no inset 3/18 → 3.8/17. Tabs are 55px tall (≥48). Horizontal spacing is unchanged at every width (320px: 8.1px min clearance, 18.7px min gap). The body/shell clearance reads the same variables, so the disclaimer still clears the nav.

## Implementation Log (accessibility-first redesign)

- **Brief.** Redesign the whole presentation layer so it reads as designed rather than generated, following WCAG 2.2 and dementia/older-adult guidance, while keeping every colour value and both typefaces. A pasted reference spec proposed a `#DC2626` primary, a single sans family and a mobile hamburger drawer; the first two contradicted the explicit keep-colours/keep-fonts instruction and the third contradicts the spec's own "avoid hidden interaction patterns", so none were adopted. No token value in `tailwind.config.ts` changed.
- **Shell.** `CaregiverTopNav` (desktop top bar with a gold underline) replaced by `CaregiverRail`; the bottom nav keeps every measured constraint above (8.1px minimum clearance at 320px re-measured after the change) and gains a 3px terracotta bar on the active tab so place never depends on colour. Skip link added to the caregiver shell.
- **Patient home.** Greeting (localised) plus today's date in the patient's language as an orientation cue, Ask Smriti and Reminders directly under it, then games as single-column rows. The icon-only person glyph became a labelled "Caregiver" button. Streak and family-note emoji removed. Routine Recall gained a proper illustration (`public/images/game-routine-recall.svg`, primary-dark) instead of four reminder emoji.
- **Patient flows.** Reminder overlay: no emoji, "Remind me in 15 minutes" is a full button rather than underlined text. Session result: drawn gold stars with a "N of 5 stars" text alternative replace emoji stars. Companion gained a Back button (it had no way out), a visible "Tap and speak" label, and a fix for a server/client `typeof window` branch that threw a hydration error on every load.
- **Caregiver pages.** Dashboard's three equal stat cards became one summary sentence ("1 patient needs a check-in") above a patient table with fixed numeric columns. Patient detail uses `PageHeader`, lists alerts first, and places chart and summaries in a two-column grid on large screens. Memory Bank dropped per-category icons and accent colours for words and a one-line hint per category. Settings, login and onboarding use visible labels on every field and `PinDots` for PIN progress. Session calendar gained a month title and a colour legend.
- **Landing.** Removed the fake journal section (links went nowhere), the drifting gamosa texture, scroll reveals, italic accent words, all-caps eyebrows, `01/02/03` numbering on non-sequential content, abstract line-art illustrations and dead footer links (`/docs`, `#privacy`, `#clinical-basis`). The hero now shows a faithful miniature of the patient home screen.
- **Global.** One `:focus-visible` ring (3px `#933A27`) for anything without its own; reduced-motion also stops iteration counts and smooth scroll.
- **Known, deliberately left.** The 14 game illustrations use off-palette tile colours (violet, sky, pink, teal). They are recognition aids and existing assets, left untouched under the keep-colours instruction; recolouring them to the warm palette is the obvious next step if wanted. Game-internal screens (canvases, in-game emoji objects) were not restyled.

## Implementation Log (patient page, cognitive score, no inner scrolling)

- **Cognitive score.** [lib/dashboard/cognitiveScore.ts](src/lib/dashboard/cognitiveScore.ts): 0-100 over the last 14 days, 60% rounds-weighted accuracy, 25% level reached (per game, against `MAX_LEVEL`), 15% regular play (10 of 14 days = full). Bands Strong / Steady / Needs support / Needs close support; change against the previous fortnight; under 3 days is labelled an early estimate. Shared by `/api/patients` (now returns `cognitiveScore` and a 7-day `week`) and the patient page (Dexie). Always shown with "not a diagnosis".
- **Patient page.** Section buttons moved to the top, directly under the name; History merged into Cognitive (calendar at the bottom), so four sections. Cognitive order: alerts, score card (`CognitiveScoreCard`, ring plus the three parts as bars), at-a-glance strip (streak, days played, reminders taken), last 7 days bar chart (`WeekActivity`), weekly digest, accuracy over time, per-game breakdown, calendar. Quiz refresh and Memory Bank moved into the Companion section. The accuracy chart's axis reads "2 Sep", not ISO dates.
- **Dashboard.** Each patient is a card with a `ScoreRing`, band, today's accuracy and a 7-day sparkline.
- **Sync.** `SyncStatus` replaces the underlined "Sync now" text: a real button whose arrows spin while syncing and which confirms "Synced" with a check for 2.5s, or explains a failure. `useSync().syncNow` now resolves to whether the sync succeeded.
- **Streak.** `StreakFlame`: a drawn two-layer flame (amber outer, gold inner) with a small flicker from its base, off under reduced motion; grey outline at zero. Used on the patient home and the patient page.
- **Scroll audit.** Removed every inner scroll area: FAQ question strip (now a button grid), the fixed-width calendar (overflowed a 320px phone), the Memory Span results list and N-Back leaderboard caps. Measured at 320px on `/`, `/app`, `/reminders`, `/companion`, `/login`, `/caregiver/dashboard`, `/caregiver/patients`, `/caregiver/settings`, `/caregiver/memory-bank` and the patient page: no page-level horizontal scroll, no element wider than the viewport, no inner scroll container.

## Implementation Log (several patients, one account)

- **Decisions.** Add patient asks where the person plays. "Own phone or tablet" is the default path: the patient is saved to the account only, and their phone signs in with the same email and chooses them on "Who uses this phone?". "This phone, shared" is for a household (two to four people); larger rosters such as an ASHA worker's village tablet are out of scope. Choosing yourself needs no PIN; a photo, the name, a 30-minute idle re-ask and "Not {name}?" guard against playing under the wrong name, with no extra "Are you…?" step. Photos are optional, stored on the phone only, never synced. Taking someone off a phone is done in the caregiver area, which is already PIN-gated.
- **Model.** One signed trust token per patient (`deviceTrust` rows `patient:<id>`; the original single row is still read). `getDevicePatients()` = linked patients among this caregiver's active local patients; a lone unlinked patient still counts, several unlinked count as nobody. `settingsStore.activePatientId` and `lastActivityAt` (set by `ActivityTracker`) drive who is playing and the idle re-ask. Selecting a patient switches the app language to theirs; changing language in Settings saves it on the selected patient.
- **Screens.** `/caregiver/add-patient`, `/caregiver/device` ("People on this phone", with per-person switch and photo), `WhoIsPlaying` on the patient home, and a "Choose who uses this phone" prompt when nobody is linked. The caregiver layout sends an unlinked phone on a multi-patient account to `/caregiver/device?setup=1` first.
- **Reminders** check every patient on the phone and name the person on the card; "Done" is recorded for the reminder's own patient. The family note is not fetched until the right person is chosen.
- **Robustness pass.** Signing in selects this phone's patient, never the account's first (it used to select Maya on Hari's new phone); the patient home corrects any mismatch on open. "Caregiver" on a phone with no PIN goes to email sign-in instead of a PIN dialog that could never succeed. Add patient (both paths) and first-time setup now wait for the account save before linking the phone, since the link is checked against the account and a phone-only patient would never sync. The caregiver layout checks for an unlinked multi-patient phone after a server pull too, not only with a local profile. Downloading patients on "People on this phone" first links an implicitly-owned single patient, so that phone's home never flips to "choose who uses this phone". Family messages use the message's patient's own token. The Memory Bank title names whose Memory Bank it is.
- **Not done.** Setting up a patient's phone with a code instead of the caregiver's email login needs sync to accept a device token first; the Memory Bank still edits only the selected patient.

## Implementation Log (code review: file split, purity fix, test coverage)

- **Split the 925-line patient detail page** into a thin shell (`patients/[id]/page.tsx`, ~215 lines: header, section nav, patient/alert fetch, the shared error banner) and four section components — `CognitiveTab`, `RemindersTab`, `CompanionTab`, `FamilyTab` (`components/caregiver/`). Each owns only its own data fetch and actions; the alert list and its resolve action stayed on the shell since the header depends on them too. `add-patient/page.tsx`'s 102-line `save()` was split the same way: the account-save step it shares with both paths stays inline, the shared-phone-only steps moved to a standalone `addToSharedPhone` helper.
- **Fixed a real purity bug**, present before this session: `FamilyTab`'s expiry check called `Date.now()` on every render inside a `.map()`, which the React Compiler's purity rule flags (`react-hooks/purity`) and which can produce different "expired" verdicts within the same paint if two shares straddle the instant `Date.now()` is called. Replaced with a `now` ISO timestamp read once via a lazy `useState` initializer and a plain string comparison (ISO 8601 UTC sorts lexicographically the same as chronologically).
- **Added `Notice`** (`components/ui/Notice.tsx`): the tone-coloured-marker-plus-ink-text result banner, previously a local function repeated at the bottom of the old single-file page, now shared by Cognitive/Companion/Family.
- **Added unit tests** for the presentational primitives introduced without their own coverage: `ScoreRing`, `StreakFlame`, `WeekActivity`, `PinDots` (`tests/new-ui-primitives.test.tsx`, 11 tests) — matching the project's existing pattern of testing `BigButton`/`TrafficLight`/`ProgressRing`/`GameTile` directly rather than only through the pages that render them.
- **Checked and found clean**: no hardcoded credentials/secrets in the reviewed files, no raw SQL (every Supabase call goes through the query builder), no unsanitized HTML injection, no direct array/object mutation, no stray `console.log`/`TODO`, every new interactive element has a visible label. Lint's error count dropped from 57 to 56 (the purity fix); every remaining error predates this session.

## Implementation Log (last open bug: sync during an active game)

- **Fixed the one bug left open from the last review.** Tapping Sync now while a game was in progress showed "Could not reach your account" — indistinguishable from a real network/auth failure — because `syncNow` silently declines mid-session (it must not upload a session's rows while they're still being written). `SyncStatus` now checks `useGameStore.getState().isSessionActive` itself before calling `syncNow`, and shows "A game is in progress. Finish it, then sync." instead. Added `tests/sync-status.test.tsx` (3 tests) — the first direct test for this component.
- **Audited the rest of the codebase for other open items**: no TODO/FIXME markers, no other place a generic error message masks a specific, actionable cause. The one documented "intentionally not fixed" note (`useCognitiveTrend.ts`'s cross-device limitation) is a scoped design decision, not a bug.

## Implementation Log (all lint warnings fixed, two real copy bugs found)

- **All 29 lint warnings fixed, 0 remain.** Removed a genuinely-unused import and a genuinely-unused destructured prop; removed one dead `eslint-disable` comment; replaced a hard `window.location.href` internal navigation in n-back's GameComponent with `router.push`; replaced three `form.watch()` calls-during-render in n-back's GameSettings with one `useWatch()` (react-hook-form's compiler-compatible subscription hook — `form.watch()` read inside JSX doesn't reliably re-render and was the one "incompatible library" compiler bailout in the whole codebase). The remaining ~20 warnings were all `_name`-prefixed parameters in documented inert stubs (this app's accessibility spec forbids leaderboards/confetti/social-sharing; these stubs exist only so copied reference-game components compile unchanged) and test-mock factories whose parameter's *type* keeps other `.mockImplementation()` calls in the same file type-checking — both kept their exact signatures and got a scoped `eslint-disable-next-line` instead of losing that documentation.
- **Found and fixed two real, visible copy bugs while auditing every game title** (prompted by a report of "Quick Quick" on Quick Tap's screen):
  1. `game.quickTap.name` was the literal string **"Quick Quick"** in English only. Every other language's title is a legitimate South-Asian-language reduplication idiom ("जल्दी जल्दी", "তাড়াতাড়ি তাড়াতাড়ি", "চাঁডো চাঁডো" — doubling a word for emphasis, meaning "hastily") — those were correct and left untouched; only the literal word-for-word carry into English was wrong. Fixed to "Quick Tap".
  2. `game.reminiscenceQuiz.name` **had no key in any locale at all** — the Family & Life quiz's own nav bar showed the raw string `game.reminiscenceQuiz.name`. The page's own `t(...) || 'Memory Match'` fallback never caught this: `t()`'s documented contract is to fall back to the key itself, never to an empty/falsy value, so the `||` never ran. Added the key to all 7 locales (English: "Family & Life Quiz" — not "Memory Match", which would have collided with the actual Memory Match pairs game) and removed the dead fallback.
- Added regression coverage in `tests/data-layer/i18n.test.tsx`, rendered through the real `I18nProvider` (not the identity-function `t` mock most game tests use, which can't catch a missing-catalog-entry bug): both titles resolve correctly, plus a sweep asserting no game name in any of the 7 locales is empty or resolves to its own dot-path key.
- **Verified live in the browser**: `/games/quick-tap` now shows "Quick Tap"; `/games/reminiscence-quiz` now shows "Family & Life Quiz".
- **Ran a full production build** (`npm run build`, not just `tsc --noEmit`) for the first time this session with all these changes in — 0 errors, all 51 routes generated.

## Implementation Log (misaligned/broken text sweep)

- **Found and fixed a second "raw translation key shown on screen" bug**, same species as the reminiscence-quiz one: N-Back's idle screen (both the visible heading and the narrated audio) called `t('challenge')` with no arguments, but the message template requires `{level}` ("...matches from {level} step(s) back."). next-intl has no fallback for a missing required interpolation param — it renders the literal key string. Fixed both call sites in `GameComponent.tsx` to pass `{ level: settings.selectedNBack }`; verified live (was `games.dualNBack.gameUI.challenge`, now real instructions with the correct level number).
- **Found the same root cause in two more keys**, `totalClears` and `averagePassTime` in `DualNBackClearLeaderboard.tsx` — both message templates carried `{count}`/`{value}` placeholders left over from a different original layout, but this component's actual layout already renders the number in a separate sibling `<span>` and only needs a plain caption underneath it. Simplified both to plain labels ("Completions", "Average time") across all 3 locales rather than threading a redundant param through. Confirmed this component is not currently imported/rendered anywhere in the app (dead code, gated behind `isDualNBackClearLeaderboardEligible`, which always returns `false`) — fixed for correctness and the next time it's wired up, but no user is seeing it today.
- **Swept every game's messages.ts against every real call site** (9 files, all `next-intl`-based games) for this exact bug class — any interpolated key called without its required params. Confirmed clean everywhere else: larger-number, memory-span, double-decision, frog-leap, fish-trace, counting-boxes and memory-blocks all pass their params correctly.
- **Fixed a naming inconsistency** for the reminiscence quiz across the three places it's named: the landing page said "Family & Life quiz" (lowercase q) while the patient home tile said "Memory Match: Family & Life" (colliding in name with the actual, different Memory Match pairs game) and the in-game title said "Family & Life Quiz". Unified all three to "Family & Life Quiz".
- **Visual sweep**: screenshotted every reachable screen at 375px and the landing page + patient home at desktop width — landing hero/features/game grid/footer, patient home, reminders, companion, settings, memory bank, add-patient, device, caregiver/patient login screens, and several in-game start screens (quick-tap, memory-blocks, n-back, routine-recall). No layout misalignment found; the two bugs above were the only "misaligned text" — both were actually a wrong-string bug, not a CSS/layout one.
- Added a regression test asserting N-Back's idle screen never shows a raw `games.dualNBack.*` key and does show the real instruction text.

## Implementation Log (new icon assets wired in)

- **Source**: `appassests/` (24 PNGs, 512×512, user-supplied). Inspected every one, matched by filename to its slot, and wired each in. The source folder was later removed: every file is an exact copy of the one in `public/images/`.
- **15 game illustrations** (`game-*.png`) exactly matched every existing `game-*.svg` slot by name. Copied into `public/images/`, removed the old SVGs, and updated every reference (`app/app/page.tsx`'s `GAMES` array, the landing page's game grid and its patient-home preview) from `.svg` to `.png`. `GameTile`/`illustrationSrc` already took a plain path string, so no component change was needed.
- **4 reminder-type icons** (`activity`, `appointment`, `hydration`, `medication.png`) replaced the emoji in `REMINDER_ICON` (`components/ui/ReminderCard.tsx`), used only by Routine Recall's picture cards (the reminder overlay itself stayed emoji-free per the earlier redesign pass). Copied to `public/images/reminders/`.
- **5 single-purpose icons**, matched to the one place each name unambiguously describes:
  - `ask-smriti.png` → the big mic button on `/companion` (idle/recording state; the Square "stop" icon is unchanged for the recording state, since no stop-specific asset was supplied).
  - `caregiver-access.png` → the "Caregiver" button on the patient home header (`data-testid="caregiver-access-icon"`, `aria-label="Caregiver access"` — an exact name match), added as a small leading icon; the word stays, so it's never icon-only.
  - `family-message.png` → `FamilyMessageBoard`'s "Messages from family" heading.
  - `done-acknowledged.png` → the family message board's "Seen" status line, replacing a bare `✓` character.
  - `error.png` → the caregiver layout's "Could not reach your account" offline screen.
- Every icon is `alt=""` (decorative) next to text that already carries the meaning, matching the app's existing rule that an icon is never the only status signal. Verified live: no broken images, no console errors, 621 tests still pass, lint unchanged (56 pre-existing errors, 0 warnings).
- **Flagged, not changed**: these are a different visual language from the rest of the app — thick black outline, glossy shading, white rounded-card backing — versus the flat single-color tiles/plain-stroke Lucide icons everywhere else (the explicit "no weird icons / no AI slop" rule from the redesign brief). Wired in as instructed since they're the user's own supplied assets; flagged here in case a closer visual match is wanted later.

## Implementation Log (sync, Overview numbers, Reminders tab, audio)

- **Sync never worked for games or reminders.** The phone posted Dexie rows as stored (camelCase, plus a local `synced` flag) and `/api/sync` upserted them straight into snake_case tables, so Supabase rejected every session, event, summary and ack. Nothing was marked synced, which is why "80 changes waiting" never went down and signing in again changed nothing. [lib/db/wire.ts](src/lib/db/wire.ts) now converts rows on the server (so phones on an older build start syncing once this is deployed), rounds values for INTEGER columns, clamps `difficulty_level` to its CHECK range, pins every row to the patient whose ownership was verified (a row could previously name a different patient than the one checked), upserts summaries on their `(patient_id, summary_date, game_type)` key, and drops rows whose ids are not UUIDs so one bad row cannot block a batch. Verified against the real Supabase project with a phone-shaped payload in `tests/integration/game-sync.integration.test.ts`.
- **Reminder schedules added on the Reminders page never reached the server.** They were written to `syncQueue`, which nothing sends. Sync now includes queued schedules (saved before acks, which reference them) and clears the queue once saved.
- **Sync errors say what happened.** 401 reads "You are signed out on this device"; a 429 from tapping Sync now right after an automatic sync is waited out once (server rate limit 30s → 10s, with `retryAfterMs`); a patient the account does not have is reported instead of its rows being marked synced and lost.
- **Overview card.** Games played on this phone are merged with the server's rows (`mergeScoreRows`, keeping the fuller copy of each game-day), so a caregiver sees a score after a few games instead of "Not yet". The score ring only appears when there is a score. The Score column shows the number with its band or "Early estimate". Today shows "Not played" instead of 0% when nothing was played. The patient page header and Cognitive tab use the same merge.
- **Per-game breakdown** is a plain list of labelled bars instead of a Recharts chart that printed values like `66.66666666666667`, clipped names and drew nothing for a 0% game. The quiz is "Family & Life Quiz" there too. The low-data session list reads "Mon 14 Sep: 59% correct".
- **Reminders tab.** Adherence no longer counts days before a reminder existed as missed (new optional `createdAt`, falling back to `updatedAt` for older rows). The top is one line ("0 of 51 marked done"), with rows only for reminder types that were due. Missed reminders are grouped by name with a count and "Last on Mon 14 Sep, 4 pm", five at a time. When nothing was marked done, a note explains that a reminder can only appear while SMRITI is open.
- **Audio overlap.** [lib/audio/channel.ts](src/lib/audio/channel.ts) gives the app one channel. Every clip, TTS line and browser-voice line claims it, which stops whatever is playing. `narrate()` drops a line that was overtaken while its audio was still loading. N-Back letters and `BigButton` go through it, and changing screens silences everything (`AudioRouteReset`).
- **Review pass fixes.** Reminder times are the patient's wall-clock times, but adherence compared them with the UTC clock, so in India a 10 am reminder only counted as due from 3:30 pm. Adherence, "done today" and the ack's scheduled date now use the device's local calendar (`localDateString`/`localTimeString` in lib/engine/adherence.ts). The missed-days alert fired for a patient added that day and for someone who had played today, and neither it nor the low-adherence alert ever cleared, which is what kept a patient who was playing on "Needs attention". Both now resolve themselves when the condition clears; low adherence is not raised when no reminder was due yet. Also: the synced-event count excludes dropped rows, and queued schedules that no longer exist are removed from the queue.
- **Left as is.** Day strings are still UTC calendar days on both phone and server, so they match each other; a game played in India before 5:30 am counts toward the previous day.

## Implementation Log (language follows everywhere)

- **The patient screens were mostly English whatever the language.** The redesign wrote buttons, headings and game names as plain English on the home screen, Ask Smriti, Reminders, the family message board, the back button, session results, Quick Tap, Path Match, Memory Match, Object Hunt, Routine Recall and the quiz, although translations for many of them already existed. They now come from the catalogs. 81 new keys in English, Hindi, Assamese, Bengali and Nepali, plus 4 older gaps (streak text in Bengali and Nepali, "Start Playing" in Hindi and Assamese). A test fails if any of those four languages is missing a key or drops a `{placeholder}`. Bodo and Manipuri still fall back to English for 88 keys; they need a native speaker rather than a guess.
- `t(key, vars)` fills `{name}` placeholders. `useTranslation` outside the provider returns English instead of throwing. `<html lang>` follows the language, so screen readers use the right voice.
- **Headings.** `font-serif-display` lists Noto Bengali and Noto Devanagari after Fraunces. Before, an Assamese or Hindi heading used whatever serif the phone had.
- **Voice.** Ask Smriti speaks and listens in the app language, the same source the games and reminders already used.
- **The chosen language was lost on sign-in.** Settings saved it on the phone and queued it in `syncQueue`, which nothing sent, and signing in overwrote local patients with the server's rows. That brought back the old language and also reset every game's level (`currentDifficulty` exists only on the phone). Patient edits are now sent with sync (`toWirePatientProfile`: editable columns only, never `caregiver_id` or `is_active`, and only over an older server row), and the sign-in pull keeps the newer copy and always keeps local game levels.
- Quick Tap no longer shows its internal "d′" signal-detection number to the patient.
- **Still English by design:** the caregiver area, and the caregiver-only add/edit form on the Reminders page.

## Discrepancies (doc vs. code, found while formalizing this document)

1. **The original prose doc is a landing-page spec, not a product spec.** `docs/Design System_ Amigo-Inspired Clinical AI Platform.md` was written for a marketing homepage (hero, carousel, cookie banner, footer sitemap) that doesn't exist in this app. `tailwind.config.ts` took its §3.1 color values but the two were never reconciled beyond that: the config adds `success`/`warning`/`danger`, `ink-inverse`, `game.*`, and the entire `gamosa`/`muga` cultural-accent pair, none of which appear in the prose doc at all. This DESIGN.md is the reconciled version — `tailwind.config.ts` was treated as ground truth wherever the two disagreed.
2. **`teal` was a misleading legacy name**, now cleaned up in app/caregiver UI (see Implementation Log). The `tailwind.config.ts` token itself is left defined for back-compat, still pointing at `#B3452D`.
3. **`accent` (`#B3452D`) is defined but effectively dead.** No component uses `bg-accent`/`text-accent`/`border-accent`. The only `accent-*` classes in the codebase are Tailwind's unrelated native-input `accent-primary` utility (checkbox/radio/slider tint) in three UI primitives.
4. **The prose doc specifies no shadows on cards.** Shipped code briefly diverged from that (pairing `border` + `shadow-sm`, which this document once documented as correct), then was brought back in line with the prose doc's original no-shadow direction in the Resend-structure pass — see Implementation Log above. `shadow-sm` at rest is now the drift to watch for, not the standard.
5. **Bare Tailwind grays have been replaced with semantic tokens across app/caregiver UI** in this pass (see Implementation Log). Remaining exceptions: game-internal canvases with their own established palettes (`double-decision`, `n-back` share-card) were deliberately left alone.
6. **One legitimate off-palette exception**: `components/games/n-back/GameComponent.tsx`'s share-card generator uses a self-contained dark theme (`#0c3a4b`, `#5de3c1`, etc.) for a social-share image, not in-app UI.

## ⚠️ Working-tree stability note

This document and a batch of code changes were silently wiped from disk (via an apparent `git clean`/reset outside this conversation) partway through this work and had to be reapplied from scratch. If you're reading this after another gap in the session, verify `git status` shows the expected modified/new files before trusting that prior work is intact — and commit early and often, since uncommitted work in this worktree has now been lost twice in one session.

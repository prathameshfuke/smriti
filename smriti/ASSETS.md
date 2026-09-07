# SMRITI — Image Asset Generation List

Every image asset the app needs, with a ready-to-use prompt for each. Two groups: **game icons** (14 games, currently plain placeholder SVGs) and **UI icons** (currently emoji or hand-drawn inline SVG in the non-game chrome).

## Shared style guide (use for every prompt below)

Prepend or keep in mind for all generations, so the full set reads as one consistent system:

> Flat vector illustration, thick clean outlines, high contrast, warm earthy color palette (terracotta `#B3452D`, warm paper white `#F8F7F3`, near-black ink `#151312`, soft rose `#E7B2A2`, gold `#C9A227`). NOT photorealistic — think children's-book illustration meets Northeast Indian folk art. Simple, bold shapes only — no fine detail, no small text, no gradients, no drop shadows, no clutter. Designed to be instantly readable at small size by elderly users with low vision. Square canvas, centered composition, transparent or `#F8F7F3` background. **No text or letters anywhere in the image.**

Export as SVG or PNG with transparent background, square (1:1), minimum 512×512px.

---

## Part 1 — Game icons

One illustration per game, replacing `public/images/game-*.svg`. Where the game already has an established Northeast-India cultural theme (from `docs/04_GAME_DESIGN.md`), the prompt uses it; where a game has no cultural anchor, the prompt uses a universal, unambiguous symbol for the mechanic instead.

### 1. Object Hunt (`game-object-hunt.svg`)
*Mechanic: find which of several closed "doors" hid a shown object (episodic memory).*

> A row of three simple wooden doors, one door open revealing a golden bell-metal xorai plate inside, the other two doors closed. Flat folk-art illustration style, warm terracotta and gold palette, thick black outlines, no text.

### 2. Word Stream (`game-word-stream.svg`)
*Mechanic: remember a short list of items shown earlier, recall them later.*

> A simple speech bubble containing three small flat icons in a row: a cup of tea, a banana, and a fish. Flat folk-art illustration style, warm terracotta and gold palette, thick black outlines, no text.

### 3. Quick Tap (`game-quick-tap.svg`)
*Mechanic: tap the screen the instant a target appears (reaction speed).*

> A single large hand with an index finger extended, mid-tap, with three small motion lines radiating outward showing quick movement. Flat folk-art illustration style, terracotta and warm white palette, thick black outlines, no text.

### 4. Path Match (`game-path-match.svg`)
*Mechanic: connect numbered circles in order (Trail Making Test).*

> Four simple circles of the same size scattered on the canvas, connected in sequence by a single curved dotted line from one to the next. Flat folk-art illustration style, terracotta line on warm white background, thick black outlines on the circles, no text or numbers in the circles.

### 5. Memory Match (`game-memory-match.svg`)
*Mechanic: classic card-flip pairs matching.*

> Two square playing cards side by side, both face-up, showing a matching pair of identical simple flower icons, with a small sparkle between them to show they matched. Flat folk-art illustration style, terracotta and gold palette, thick black outlines, no text.

### 6. Memory Blocks (`game-memory-blocks.svg`)
*Mechanic: watch and repeat a sequence of highlighted blocks (Simon-says style).*

> A 2x2 grid of four square blocks, one block glowing brighter with a soft gold highlight to show it is "lit up" in a sequence. Flat folk-art illustration style, terracotta and gold palette, thick black outlines, no text.

### 7. Frog Leap (`game-frog-leap.svg`)
*Mechanic: a frog hops across lily pads following a remembered sequence.*

> A friendly cartoon frog mid-jump above a lily pad on calm water, one ripple ring around the pad it just left. Flat folk-art illustration style, warm terracotta and soft green palette, thick black outlines, no text.

### 8. Counting Boxes (`game-counting-boxes.svg`)
*Mechanic: count how many boxes/objects flash briefly on screen.*

> Five simple identical square boxes arranged in a loose cluster, one box in front with a bold "?" replaced by three small dots to suggest counting (no digits or letters). Flat folk-art illustration style, terracotta and warm white palette, thick black outlines, no text.

### 9. Larger Number (`game-larger-number.svg`)
*Mechanic: pick which of two groups/quantities is bigger.*

> Two simple stacks of round bamboo baskets side by side, the stack on the right visibly taller than the one on the left, with a small upward arrow above the taller stack. Flat folk-art illustration style, terracotta and gold palette, thick black outlines, no text or numerals.

### 10. Memory Span (`game-memory-span.svg`)
*Mechanic: watch a growing sequence of taps/positions and repeat it back.*

> A single hand with an index finger tapping a row of three round buttons in a line, a soft motion trail showing the finger moving left to right across them. Flat folk-art illustration style, terracotta and warm white palette, thick black outlines, no text.

### 11. Fish Trace (`game-fish-trace.svg`)
*Mechanic: trace/follow a moving path with your finger, fish-themed.*

> A single friendly sunfish swimming, leaving a gentle curved wake line behind it like a trail to follow. Flat folk-art illustration style, terracotta and soft teal-water palette, thick black outlines, no text.

### 12. Double Decision (`game-double-decision.svg`)
*Mechanic: identify a shape in the center while also spotting a target in peripheral vision (divided attention).*

> A single simple eye icon in the center of the canvas, with two small target rings positioned out at the edges of the canvas (upper-left and lower-right) connected to the eye by faint dotted lines, showing central and peripheral attention at once. Flat folk-art illustration style, terracotta and warm white palette, thick black outlines, no text.

### 13. N-Back (`game-n-back.svg`)
*Mechanic: recall whether the current item matches one shown N steps earlier.*

> Three identical simple square tiles in a horizontal row with a curved arrow looping backward from the third tile to the first, showing "looking back" in a sequence. Flat folk-art illustration style, terracotta and gold palette, thick black outlines, no text.

### 14. Memory Match: Family & Life / Reminiscence Quiz (`game-reminiscence-quiz.svg`)
*Mechanic: quiz about the patient's own life facts and family, using their real photos.*

> A simple framed photograph on a stand, with a small heart in the corner, resting on a warm textile pattern suggesting a family keepsake. Flat folk-art illustration style, terracotta and rose palette, thick black outlines, no text, no visible faces (this represents a photo frame generically, not any real person).

### 15. Routine Recall (`game-routine-recall.svg` — currently has none, would newly add)
*Mechanic: recall the order of the day's routine/reminder tasks (medication, hydration, activity, appointment).*

> A simple sun rising over a row of four small icons in a line — a pill, a water drop, a footprint, a calendar page — showing the order of a daily routine. Flat folk-art illustration style, terracotta and gold palette, thick black outlines, no text.

---

## Part 2 — UI icons (not games)

These currently render as emoji or a hand-drawn inline `<svg>`. Same style guide applies, but these are simpler single-symbol icons, not scene illustrations — keep them very plain and legible at 24–40px.

### Reminder types (used in 3 places: `ReminderCard.tsx`, `reminders/page.tsx`, `caregiver/patients/[id]/page.tsx`) — do this set first, biggest reuse

**16. Medication** (replaces 💊)
> A single simple pill capsule icon, two-tone (one half filled, one half outline), centered. Flat vector icon, thick black outline, terracotta accent, no text.

**17. Hydration** (replaces 💧)
> A single simple water droplet icon, centered. Flat vector icon, thick black outline, soft teal or terracotta accent, no text.

**18. Activity** (replaces 🚶)
> A single simple walking-figure silhouette icon, mid-stride, centered. Flat vector icon, thick black outline, terracotta accent, no text.

**19. Appointment** (replaces 📅)
> A single simple calendar-page icon with one date square highlighted, centered. Flat vector icon, thick black outline, terracotta accent, no text.

### Other UI icons

**20. Family message** (replaces 💌, used in `FamilyMessageBoard.tsx` and `app/page.tsx`)
> A single simple envelope icon with a small heart sealing it shut, centered. Flat vector icon, thick black outline, rose and terracotta accent, no text.

**21. Done / acknowledged checkmark** (replaces ✓, used in `ReminderCard.tsx`, `reminders/page.tsx`, `FamilyMessageBoard.tsx`, `TrafficLight.tsx`)
> A single bold checkmark inside a soft rounded circle, centered. Flat vector icon, thick black outline, success-green fill, no text.

**22. Error / something went wrong** (replaces 😔 in `ErrorBoundary.tsx`)
> A single simple flower with one drooping petal, gentle and not sad or scary, centered. Flat vector icon, thick black outline, warm muted palette, no text. (Avoid a sad human/animal face — this screen should feel calm, not alarming, for an elderly viewer.)

**23. Caregiver access** (replaces the hand-drawn person-in-circle SVG in `app/app/page.tsx`, top-right button on the patient home screen)
> A single simple adult figure silhouette inside a soft circle badge, centered. Flat vector icon, thick black outline, terracotta accent, no text.

**24. Ask Smriti / microphone** (replaces the hand-drawn mic SVG in `app/companion/page.tsx`)
> A single simple microphone icon with two small curved sound-wave lines beside it, centered. Flat vector icon, thick black outline, terracotta accent, no text.

---

## Optional — not broken, but could be regenerated for consistency

These already exist and work; only revisit if you want everything sharing the exact same illustration style:

- `appicon.png` / `smritiweb.png` — app logo, currently a separate design
- `icon-192.png` / `icon-512.png` / `apple-touch-icon.png` — PWA icons, likely just a crop of the logo
- Social-share preview image (og:image) — doesn't exist yet, not required unless you start sharing links publicly

## Cleanup (unrelated to generation, but noticed while auditing)

`public/file.svg`, `public/vercel.svg`, `public/next.svg`, `public/globe.svg`, `public/window.svg` are unused `create-next-app` boilerplate — safe to delete once you're doing an asset pass anyway.

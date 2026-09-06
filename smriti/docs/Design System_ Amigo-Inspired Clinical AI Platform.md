# Design System: Amigo-Inspired Clinical AI Platform

**Status:** Reference-driven design specification  
**Author:** Manus AI  
**Reference:** [Amigo.ai homepage][1]  
**Purpose:** Provide a practical visual and interaction system for a healthcare technology website that feels trustworthy, editorial, calm, and operationally rigorous without reproducing the source site verbatim.

## 1. Design direction

The experience should communicate **clinical confidence without clinical coldness**. Its visual character is built from a restrained editorial composition: warm white space, near-black typography, a measured terracotta accent, soft tonal surfaces, and documentary-style imagery. The page should feel closer to a premium healthcare journal or architecture publication than to a typical software landing page.

The central narrative is that AI is **infrastructure for care teams**, not a replacement for clinicians. Copy should therefore emphasize reliability, safety, workflow coverage, integration, and measurable time-to-value. The source site uses a similar positioning, describing a unified data foundation, clinical agent training, safety metrics, and EHR integration.[1]

> **Design principle:** Make complex healthcare infrastructure feel understandable through spacious layouts, clear sequencing, and evidence-led storytelling.

## 2. Experience principles

| Principle | Application | Avoid |
|---|---|---|
| Editorial clarity | Use strong headlines, short paragraphs, visible hierarchy, and deliberate pacing between sections. | Dense dashboards, long uninterrupted copy, or generic SaaS feature grids. |
| Warm authority | Pair clinical proof points with warm surfaces, human imagery, and generous whitespace. | Overly sterile blue palettes or exaggerated “AI magic” language. |
| Progressive disclosure | Introduce the platform through staged steps such as define, train, deploy, and optimize. | Presenting every capability at once. |
| Evidence over hype | Use metrics, customer proof, compliance language, and named workflows to support claims. | Unqualified superlatives or unsupported performance claims. |
| Human-in-the-loop trust | Reassure users that escalation, supervision, and clinician standards remain central. | Framing automation as unsupervised replacement for care teams. |

## 3. Brand foundations

### 3.1 Color system

The palette should remain narrow and high contrast. Terracotta is the primary action color and the main expressive surface; it should appear confidently but not become decorative noise. Warm white is the default canvas, while near-black anchors text, navigation, and footer content.

| Token | Suggested value | Role |
|---|---:|---|
| `ink-950` | `#151312` | Primary text, footer, dark media overlays |
| `ink-700` | `#4B4541` | Supporting copy and secondary navigation |
| `paper-50` | `#F8F7F3` | Main page background |
| `paper-100` | `#F0EEE9` | Subtle section alternation and card interiors |
| `terra-600` | `#B3452D` | Primary CTA, accent panels, active states |
| `terra-700` | `#933A27` | Hover and pressed CTA states |
| `rose-100` | `#E7B2A2` | Testimonial surfaces, soft highlight blocks |
| `line-200` | `#D8D2CB` | Rules, dividers, card borders |
| `signal-green` | `#39A85A` | Announcement/status indicator only |

Use `ink-950` on `paper-50` for the primary reading experience. For terracotta sections, use a softened warm-white text color rather than pure white to preserve the editorial tone. Confirm all final combinations against WCAG AA before production.

### 3.2 Typography

The typographic system depends on contrast between an expressive serif display face and a neutral sans-serif interface face. The serif should have a refined, high-contrast editorial silhouette with open counters and graceful italics. The sans-serif should be highly legible at small sizes and remain quiet enough to let the display face lead.

| Role | Style | Suggested scale | Notes |
|---|---|---:|---|
| Display hero | Editorial serif, regular weight | `clamp(3rem, 6.5vw, 7.5rem)` | Tight line-height around `0.92–1.0`; use a maximum measure of 8–10 words per line. |
| Section heading | Editorial serif, regular weight | `clamp(2.25rem, 4.5vw, 5rem)` | Keep line lengths short and let the whitespace carry emphasis. |
| Testimonial quote | Editorial serif, regular or italic | `clamp(1.75rem, 3vw, 3.25rem)` | Comfortable line-height around `1.05–1.15`. |
| Body | Neutral sans-serif, regular | `1rem–1.2rem` | Use `1.45–1.6` line-height and a maximum measure of 38–48rem. |
| Navigation | Neutral sans-serif, medium | `0.95rem–1rem` | Use sentence case for primary navigation. |
| Eyebrow / metadata | Neutral sans-serif, semibold uppercase | `0.65rem–0.78rem` | Add letter spacing of `0.08–0.14em`. |
| Metric | Editorial serif, regular | `clamp(3.5rem, 8vw, 8rem)` | Treat numbers as visual objects, not ordinary body text. |

Recommended implementation is to load one licensed editorial serif and one accessible sans-serif, with a system fallback stack for performance. Do not imitate a proprietary typeface unless the project has a valid license.

### 3.3 Shape, border, and depth

Corners should feel soft but architectural. Use a default radius of `1.25rem` for media panels and feature cards, with `0.5rem` for compact controls. Avoid floating-card excess: most sections should sit directly on the page canvas, separated by whitespace and occasional hairline rules.

| Component | Radius | Border | Shadow |
|---|---:|---|---|
| Hero media | `1.5rem–2rem` | None or `1px` tonal edge | None |
| Large testimonial card | `1.25rem–1.5rem` | None | None |
| Specialty card | `1rem–1.25rem` | None | None; use image contrast instead |
| Button | `0.5rem–0.65rem` | None | None |
| Dropdown / popover | `0.75rem` | `1px solid line-200` | `0 12px 32px rgba(21,19,18,.12)` |

## 4. Layout system

Use a 12-column desktop grid with generous outer margins. The reference composition frequently balances a text block against a large visual panel rather than centering everything into identical cards. Establish a maximum content width of approximately `90rem`, with page padding that scales from `1.25rem` on mobile to `3rem–5rem` on large screens.

| Breakpoint | Page padding | Grid behavior | Primary layout change |
|---|---:|---|---|
| Mobile `< 640px` | `1.25rem` | Single column | Collapse navigation, stack hero text above media, convert carousels to swipeable lists. |
| Tablet `640–1023px` | `2rem` | 6-column or adaptive | Preserve editorial split layouts where space permits. |
| Desktop `1024–1439px` | `3rem` | 12-column | Use asymmetrical two-column compositions and horizontal card tracks. |
| Wide `≥ 1440px` | `4rem–5rem` | 12-column, max width | Increase media scale and whitespace rather than line length. |

The vertical rhythm should alternate between expansive narrative sections and denser proof sections. A practical baseline is `clamp(5rem, 12vw, 12rem)` between major sections, `2rem–4rem` between related blocks, and `1rem–1.5rem` within controls and metadata groups.

## 5. Page architecture

### 5.1 Announcement bar

Place a short, low-height strip above the main header. Use a small green status dot, a compact “New” label, and one linked update. The strip should be informative rather than promotional, with a subtle bottom rule and enough contrast for keyboard focus.

### 5.2 Header and navigation

The header should remain light and quiet. Place the wordmark at left, primary navigation in the center or immediately after the logo, and a single terracotta “Book a Demo” action at right. Dropdown items should open on click or keyboard activation, not only hover. On mobile, replace the navigation with a menu button and keep the demo action visible when possible.

### 5.3 Hero

The hero is the primary statement and should appear immediately after the header. Use an asymmetric grid: a narrow text column on the left and a wide rounded visual panel on the right. The headline should be short, declarative, and operational. Supporting copy belongs beneath the headline, separated by a slim vertical rule or accent bar. The primary CTA should repeat the header action without introducing a competing label.

The visual panel should use product footage, an interface montage, or a softly blurred clinical environment. Blur and low-frequency motion are useful here because they create atmosphere while reserving detailed product explanation for later sections. Always provide a poster image, descriptive alternative text, and reduced-motion behavior.

### 5.4 Trust and proof

Follow the hero with proof rather than another feature list. Use a terracotta block containing two or three oversized metrics. Pair it with a large testimonial card in a lighter warm tint. The testimonial should include a recognizable organization mark only when permission exists, followed by the speaker’s name, role, and institutional context.

The source homepage uses proof points such as patients reached, return on investment, safety record, response time, clinical safety pass rate, and non-escalated interactions.[1] Treat these as content examples, not reusable claims; every metric in a new implementation must be substantiated.

### 5.5 Specialty carousel

Introduce the breadth of the platform with a centered statement such as “Workflows designed for your specialty.” Below it, use an edge-to-edge horizontal track of image-led cards. Each card should have a clear specialty label over the lower portion of the image, with a low-opacity tonal overlay to preserve readability.

The carousel should support drag, swipe, left/right controls, keyboard focus, and reduced-motion preferences. It should not trap focus or auto-advance rapidly. On mobile, show a partial next card to communicate horizontal affordance.

### 5.6 Platform narrative

Explain the product as a sequence of controlled stages. The first sequence can describe how clinical agents are trained: virtual patients, simulated conversations, and supervised evaluations. The second can describe deployment: define, train, deploy, and optimize. Each stage should have a numbered label, a short title, one concise paragraph, and one visual state.

Use tabs or segmented controls when the content changes in place. Keep the active state unmistakable through terracotta, an underline, or a high-contrast rule. Avoid making the user infer that a label is interactive.

### 5.7 Security and integration

Use a calm, high-trust section to explain compliance and interoperability. The message should be specific but not overloaded with certification badges. A short statement can mention HIPAA, SOC 2, GDPR, EHR integration, and clinical systems when those claims are true for the product.[1] Support the statement with a restrained diagram, system map, or interface animation.

### 5.8 Outcomes and partnership

After the platform explanation, return to outcomes. Use a compact uppercase eyebrow, three metrics, and a paragraph describing the partnership model and expected time-to-value. Keep the copy grounded in process: discovery, workflow design, launch, measurement, and post-deployment optimization.

### 5.9 Insights and footer

Close the content with three editorial insight cards. Each card should have a title, a one- or two-sentence summary, and a quiet text link. The footer should then make one final brand statement before exposing the sitemap. Organize links into clear columns such as Platform, Solutions, Specialties, Insights, Company, Connect, and Legal.

## 6. Component specifications

| Component | Anatomy | Behavior |
|---|---|---|
| Primary button | Filled terracotta surface, short label, optional arrow | Darken slightly on hover; show a visible focus ring; minimum target size `44px`. |
| Text link | Sentence-case text, optional directional arrow | Underline or color shift on hover; preserve a clear focus state. |
| Eyebrow | Uppercase sans-serif label, tracked lettering | Use for section context, not for essential meaning. |
| Metric block | Large numeral plus compact descriptor | Align numerals on a common baseline or vertical rule. |
| Testimonial card | Quote, attribution, optional institution mark | Keep quotation readable at all widths; do not truncate. |
| Image card | Full-bleed image, gradient overlay, label | Use `object-fit: cover`; define a focal point for each image. |
| Step control | Number, title, active indicator | Keyboard-operable; active panel updates without disorienting motion. |
| Cookie banner | Fixed dark surface, privacy link, manage, accept | Never obscure essential content or keyboard focus; persist consent choice. |

## 7. Motion and interaction

Motion should feel like **measured instrumentation** rather than entertainment. Use slow fades, soft reveals, and restrained horizontal movement. Suggested defaults are `180–240ms` for control transitions and `500–800ms` for section reveals with ease-out timing. Avoid parallax that compromises readability or causes motion sickness.

All animation must respect `prefers-reduced-motion: reduce`. In that mode, remove autoplay, blur transitions, and large positional movement; preserve only instant state changes and essential feedback. Media should pause when it leaves the viewport, and decorative video should never be the only source of meaning.

## 8. Content and accessibility rules

Write in a confident, plainspoken tone. Lead with the operational benefit, then explain the mechanism, then provide proof. Prefer “support clinicians with…” over “replace clinicians with…”. Keep headlines declarative and specific, and use sentence case except for compact technical eyebrows.

Every image requires meaningful alternative text unless it is genuinely decorative. Every carousel and tab set requires keyboard support, visible focus, a current-state announcement where appropriate, and a non-interactive fallback. Maintain visible text contrast, do not encode information in color alone, and ensure the mobile navigation can be operated without hover.

## 9. Implementation checklist

| Area | Acceptance criteria |
|---|---|
| Visual identity | Warm white canvas, near-black type, terracotta action color, editorial serif display treatment, and soft rounded media panels are consistent across the page. |
| Layout | The hero is asymmetric on desktop, stacked on mobile, and all major sections use a predictable content width and vertical rhythm. |
| Trust | Proof points are visually prominent but are backed by verifiable product or customer evidence. |
| Interaction | Carousels, steps, dropdowns, cookie controls, and mobile navigation work by mouse, keyboard, and touch. |
| Performance | Hero media has a poster image, lazy-loaded secondary media, responsive image sizes, and a reduced-motion path. |
| Accessibility | Focus states, semantic headings, alt text, contrast, target sizes, and keyboard behavior are verified before launch. |
| Content | Copy positions AI as reliable infrastructure for care teams and avoids unsupported medical or performance claims. |

## References

[1]: https://www.amigo.ai/ "Amigo — The Trusted Platform for Building, Training, and Deploying Clinical Agents"

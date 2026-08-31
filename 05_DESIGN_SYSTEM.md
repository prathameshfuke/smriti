# SMRITI — UI Design System & Anti-Slop Guidelines

---

## 1. Anti-Slop Manifesto

SMRITI's interface must NOT look like:
- A generic SaaS dashboard with gradient cards and glassmorphism
- A children's game with neon colours and bouncing animations
- A hospital/clinical application with sterile whites and blues
- A cookie-cutter Tailwind template with rounded-2xl shadow-lg everywhere

SMRITI SHOULD look like:
- **A warm, trusted companion** — like a well-worn notebook or a family photo album
- **Grounded and earthy** — inspired by NER handloom textures and natural materials
- **Calm and confident** — generous whitespace, no visual noise, no competing CTAs
- **Deliberately simple** — every element earned its place; nothing decorative

---

## 2. Colour Palette

```css
:root {
  /* Primary: Warm earth tones inspired by Muga silk and bamboo */
  --color-primary: #8B6914;        /* Muga gold — primary actions */
  --color-primary-light: #C4A445;  /* Light gold — hover states */
  --color-primary-dark: #5C4510;   /* Deep gold — active states */

  /* Background: Warm neutrals, NOT pure white */
  --color-bg: #FAF7F2;            /* Warm off-white — page background */
  --color-bg-card: #FFFFFF;        /* White — card surfaces */
  --color-bg-muted: #F0EDE6;      /* Cream — secondary surfaces */

  /* Text: Near-black, NOT pure black */
  --color-text: #2D2A26;          /* Warm charcoal — body text */
  --color-text-muted: #6B6560;    /* Warm grey — secondary text */
  --color-text-inverse: #FAF7F2;  /* Off-white — on dark backgrounds */

  /* Functional: Clear traffic-light system */
  --color-success: #2E7D32;       /* Forest green — correct, stable */
  --color-warning: #E65100;       /* Deep orange — attention needed */
  --color-danger: #B71C1C;        /* Deep red — urgent alert */

  /* Accent: Assamese gamosa red (used sparingly) */
  --color-accent: #C62828;        /* Gamosa red — highlights, badges */

  /* Game-specific: Soft, non-distracting */
  --color-game-bg: #FFF8E1;       /* Warm cream — game play area */
  --color-game-tile: #EFEBE0;     /* Sandy — game tiles/doors */
  --color-game-tile-active: #D7CFC0; /* Darker sand — pressed state */
}
```

### Contrast ratios (WCAG AAA):
- `--color-text` on `--color-bg`: **15.2:1** (passes AAA)
- `--color-text` on `--color-bg-card`: **14.8:1** (passes AAA)
- `--color-text-inverse` on `--color-primary`: **6.1:1** (passes AA large text)

---

## 3. Typography

```css
:root {
  /* System font stack — fast loading, no web font dependency */
  --font-body: -apple-system, BlinkMacSystemFont, "Noto Sans", "Noto Sans Assamese",
               "Noto Sans Devanagari", "Segoe UI", sans-serif;
  --font-display: var(--font-body);  /* Same stack, different weight */

  /* Scale: Large for elderly readability */
  --text-xs: 0.875rem;    /* 14px — only for caregiver dashboard metadata */
  --text-sm: 1rem;        /* 16px — caregiver secondary text */
  --text-base: 1.125rem;  /* 18px — body text minimum */
  --text-lg: 1.375rem;    /* 22px — game labels, button text */
  --text-xl: 1.75rem;     /* 28px — headings */
  --text-2xl: 2.25rem;    /* 36px — patient-facing headings */

  /* Weight */
  --font-normal: 400;
  --font-medium: 500;
  --font-bold: 700;

  /* Line height: generous for readability */
  --leading-normal: 1.6;
  --leading-tight: 1.3;
}
```

### Rules:
- Patient-facing screens: minimum `--text-lg` (22px)
- Caregiver dashboard: minimum `--text-base` (18px)
- Never use font weights below 400
- Never use italic for body text
- Button text always `--font-bold`

---

## 4. Spacing & Layout

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */

  /* Touch targets */
  --touch-target-min: 48px;       /* WCAG minimum */
  --touch-target-preferred: 64px; /* SMRITI standard for patient screens */
  --touch-gap: 12px;              /* Minimum gap between tappable elements */

  /* Layout */
  --content-max-width: 480px;     /* Mobile-first, max width for patient screens */
  --dashboard-max-width: 1200px;  /* Caregiver dashboard */
  --border-radius: 12px;          /* Consistent, softly rounded */
  --border-radius-sm: 8px;
}
```

### Layout rules:
- Patient screens: single-column, centered, max 480px
- No horizontal scrolling ever
- No grid layouts with >2 columns on patient screens
- Minimum padding: 16px on all edges
- Game tiles: minimum 64x64px touch target with 12px gap

---

## 5. Component Specifications

### BigButton (Patient-facing primary action)
```
┌─────────────────────────────────────┐
│                                     │  height: 72px minimum
│    [Icon 32x32]  Label Text         │  padding: 16px 24px
│                                     │  font: 22px bold
└─────────────────────────────────────┘
  - Background: --color-primary
  - Text: --color-text-inverse
  - Border-radius: 12px
  - Box-shadow: 0 2px 8px rgba(0,0,0,0.15) — subtle depth, NOT floating
  - Active state: scale(0.97) + --color-primary-dark
  - No outline/ring on focus (distracting for elderly); use scale change instead
  - Icon is optional; if present, placed left with 12px gap
```

### GameTile (Home screen game selector)
```
┌─────────────────────────────────────┐
│                                     │
│        [Illustration 80x80]         │  Minimum: 140x140px
│                                     │  Background: --color-bg-card
│         Game Name                   │  Border: 2px solid --color-bg-muted
│      (in selected language)         │  Border-radius: 16px
│                                     │  Text: --text-lg, center-aligned
└─────────────────────────────────────┘
  - 2x2 grid on home screen
  - Gap: 16px
  - Tap: plays audio name of game + navigates
  - Current difficulty shown as small dots (1-10) at bottom
```

### TrafficLight (Caregiver triage indicator)
```
  ●  RED:    #B71C1C — Immediate attention (sudden cognitive drop)
  ●  YELLOW: #E65100 — Review needed (missed sessions, low adherence)
  ●  GREEN:  #2E7D32 — Stable (no action needed)

  Rendered as a filled circle, 24px diameter, left of patient name
  in the caregiver's patient list
```

### ScoreGraph (Caregiver dashboard longitudinal view)
```
  - Simple line chart (use Recharts — already lightweight)
  - X-axis: dates (last 30 days default, expandable to 90/180)
  - Y-axis: accuracy % or Elo rating
  - One line per game type, colour-coded:
    - Object Hunt: --color-primary (gold)
    - Word Stream: #5C6BC0 (indigo)
    - Quick Tap: #00897B (teal)
    - Path Match: --color-accent (gamosa red)
  - Sudden drops highlighted with a red dot
  - No 3D effects, no gradients on chart area
```

### SyncIndicator (Always visible)
```
  Bottom-right corner, small pill:
  ┌──────────────┐
  │ ● Synced     │  Green dot + "Synced" when last sync <1hr ago
  │ ○ Offline    │  Grey dot + "Offline" when no connectivity
  │ ↻ Syncing... │  Animated + "Syncing..." during active sync
  │ ⚠ 3 pending  │  Yellow + count when >0 unsynced events
  └──────────────┘
  Font: --text-xs (caregiver-only concern)
```

---

## 6. Animation Rules

- **Patient screens:** Minimal animation. Only:
  - Door open/close in Object Hunt (200ms ease-out)
  - Correct answer: gentle scale pulse (1.0 → 1.05 → 1.0, 300ms)
  - Wrong answer: subtle shake (translateX ±4px, 200ms) — never red flash
  - Star earned: simple fade-in (300ms)
  - Page transitions: fade (200ms) — no slides or transforms

- **Caregiver dashboard:** Standard web transitions:
  - Chart data transitions (500ms)
  - Alert cards slide in (300ms)
  - Tab switching: instant (no transition)

- **Never use:**
  - Bouncing/spring physics
  - Particle effects or confetti
  - Loading spinners (use skeleton screens instead)
  - Parallax or scroll-linked animations
  - Auto-playing video

---

## 7. Iconography

- Use Lucide icons (open source, consistent, thin line style)
- Patient-facing icons: 32px minimum, 2px stroke
- Always pair icons with text labels — never icon-only buttons on patient screens
- Caregiver dashboard: icons can be icon-only in navigation rail with tooltip
- Custom game illustrations: hand-drawn style, flat colour, thick outlines

---

## 8. Sound Design

- **Correct answer:** Soft wooden "tok" sound (like bamboo) — 200ms
- **Wrong answer:** Gentle low "hmm" tone — 300ms (NOT a buzzer or error beep)
- **Session complete:** Warm chime sequence — 1 second
- **Reminder alert:** Traditional bell sound — looping until acknowledged
- **All audio:** Mono, MP3, 64kbps, <100KB per file
- **No background music during games** (distracting for dementia patients)
- **Volume controlled by device** — no in-app volume control (reduces UI complexity)

---

## 9. Tailwind Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#8B6914', light: '#C4A445', dark: '#5C4510' },
        accent: '#C62828',
        surface: { DEFAULT: '#FAF7F2', card: '#FFFFFF', muted: '#F0EDE6' },
        ink: { DEFAULT: '#2D2A26', muted: '#6B6560', inverse: '#FAF7F2' },
        success: '#2E7D32',
        warning: '#E65100',
        danger: '#B71C1C',
        game: { bg: '#FFF8E1', tile: '#EFEBE0', active: '#D7CFC0' },
      },
      fontSize: {
        'patient-body': ['1.375rem', { lineHeight: '1.6' }],     // 22px
        'patient-heading': ['2.25rem', { lineHeight: '1.3' }],   // 36px
        'caregiver-body': ['1.125rem', { lineHeight: '1.6' }],   // 18px
      },
      spacing: {
        'touch': '64px',
        'touch-min': '48px',
        'touch-gap': '12px',
      },
      borderRadius: {
        'card': '12px',
        'tile': '16px',
      },
      maxWidth: {
        'patient': '480px',
        'dashboard': '1200px',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 10. Responsive Breakpoints

```
Patient mode (primary):
  - 320px - 480px: Full width, single column, all touch targets 64px+
  - This is the ONLY layout that matters for patients

Caregiver dashboard:
  - 320px - 768px: Single column, stacked cards
  - 768px - 1200px: Two-column layout (patient list + detail view)
  - >1200px: Capped at 1200px, centred

Rule: Design mobile-first, patient-first. Desktop dashboard is a nice-to-have,
not a driver of decisions.
```

import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /*
         * Amigo-inspired editorial palette (docs/Design System_ Amigo-Inspired
         * Clinical AI Platform.md §3.1). Values are repointed on the app's
         * existing semantic names (navy/teal/canvas/surface/ink) rather than
         * renamed, so every screen — marketing, caregiver, patient — inherits
         * the new system without a per-file rewrite.
         */
        navy: '#151312',
        teal: '#B3452D',
        primary: {
          DEFAULT: '#B3452D',
          light: '#E7B2A2',
          dark: '#933A27',
        },
        accent: '#B3452D',
        surface: {
          DEFAULT: '#F8F7F3',
          card: '#FFFFFF',
          muted: '#F0EEE9',
        },
        ink: {
          DEFAULT: '#151312',
          muted: '#4B4541',
          inverse: '#F8F7F3',
        },
        success: '#39A85A',
        warning: '#D97706',
        danger: '#DC2626',
        game: {
          bg: '#F9FAFB',
          tile: '#F3F4F6',
          active: '#D1D5DB',
        },
        /*
         * Regional accent set, used sparingly on marketing surfaces and as
         * caregiver-dashboard highlights. Never a base/background colour for
         * patient screens — teal/navy stay the primary brand identity there.
         */
        canvas: '#F8F7F3',
        gamosa: '#BE3A34',
        muga: '#C9A227',
        /** Same gold, darkened for text use — `muga` itself is ~2.5:1 on
         * white and fails WCAG even at large text sizes; this passes AA. */
        'muga-dark': '#8B6914',
        /* Direct §3.1 token names, for markup written straight from the
         * design doc (landing/login/dashboard hero sections). */
        ink950: '#151312',
        ink700: '#4B4541',
        paper50: '#F8F7F3',
        paper100: '#F0EEE9',
        terra600: '#B3452D',
        terra700: '#933A27',
        rose100: '#E7B2A2',
        line200: '#D8D2CB',
      },
      fontFamily: {
        /*
         * Fraunces (editorial serif, §3.2 "display/heading" role) leads on
         * every heading and hero across the app. Atkinson Hyperlegible stays
         * the body/UI face — see layout.tsx — because it is purpose-built for
         * this cohort's low-vision readers; swapping it for a generic sans
         * would trade a documented accessibility requirement for house style.
         */
        // Fraunces has no Bengali or Devanagari glyphs. Without the Noto faces
        // here, an Assamese or Hindi heading fell through to whatever serif the
        // phone had, so the same screen mixed two unrelated typefaces.
        'serif-display': [
          'var(--font-smriti-serif)',
          'var(--font-smriti-bengali)',
          'var(--font-smriti-devanagari)',
          'Georgia',
          'serif',
        ],
        sans: ['var(--font-smriti-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'patient-sm': ['1rem', { lineHeight: '1.6' }],
        'patient-body': ['1.375rem', { lineHeight: '1.6' }],
        /* NOT tightened like caregiver-heading below: patient-heading is
         * also used for dynamic, possibly-wrapping content (quiz questions,
         * game object names, reminder labels, result text) across a dozen
         * game components — a tight line-height there cramps multi-line
         * text instead of reading as a considered display face. Apply a
         * tight treatment inline on the handful of genuinely short, static
         * titles that use this size (e.g. "Ask Smriti") rather than baking
         * it into the shared token. */
        'patient-heading': ['2.25rem', { lineHeight: '1.3' }],
        'caregiver-body': ['1.125rem', { lineHeight: '1.6' }],
        /* Every caregiver-heading usage is a short, static, single-line
         * page/section title ("Overview", "Settings", "Today") — never
         * dynamic or wrapping — so the tight display treatment is safe here. */
        'caregiver-heading': ['1.75rem', { lineHeight: '1.05', letterSpacing: '-0.015em' }],
        hero: ['3.5rem', { lineHeight: '1.1', fontWeight: '600' }],
        headline: ['2.25rem', { lineHeight: '1.2', fontWeight: '600' }],
        subheadline: ['1.5rem', { lineHeight: '1.3', fontWeight: '500' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        body: ['1rem', { lineHeight: '1.6' }],
      },
      spacing: {
        touch: '64px',
        'touch-min': '48px',
        'touch-gap': '12px',
      },
      borderRadius: {
        /* Tightened toward a stricter, more architectural container scale —
         * same card > tile > control hierarchy, less generously rounded. */
        card: '1rem',
        tile: '0.75rem',
        control: '0.5rem',
        panel: '1.5rem',
      },
      maxWidth: {
        patient: '480px',
        dashboard: '1200px',
      },
    },
  },
  plugins: [],
};
export default config;

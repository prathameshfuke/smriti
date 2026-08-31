import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#8B6914',
          light: '#C4A445',
          dark: '#5C4510',
        },
        accent: '#C62828',
        surface: {
          DEFAULT: '#FAF7F2',
          card: '#FFFFFF',
          muted: '#F0EDE6',
        },
        ink: {
          DEFAULT: '#2D2A26',
          muted: '#6B6560',
          inverse: '#FAF7F2',
        },
        success: '#2E7D32',
        warning: '#E65100',
        danger: '#B71C1C',
        game: {
          bg: '#FFF8E1',
          tile: '#EFEBE0',
          active: '#D7CFC0',
        },
      },
      fontSize: {
        'patient-sm': ['1rem', { lineHeight: '1.6' }],
        'patient-body': ['1.375rem', { lineHeight: '1.6' }],
        'patient-heading': ['2.25rem', { lineHeight: '1.3' }],
        'caregiver-body': ['1.125rem', { lineHeight: '1.6' }],
        'caregiver-heading': ['1.75rem', { lineHeight: '1.3' }],
      },
      spacing: {
        touch: '64px',
        'touch-min': '48px',
        'touch-gap': '12px',
      },
      borderRadius: {
        card: '12px',
        tile: '16px',
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

// PlayBall v2 redesign — Tailwind palette is token-driven.
//
// Goal: existing `bg-slate-*`, `text-slate-*`, `bg-blue-*`, etc. across the
// codebase keep working but render against the new design tokens defined in
// src/index.css. Each remapped color uses `rgb(var(--token-rgb) / <alpha-value>)`
// so opacity modifiers (e.g. `bg-slate-800/50`) still resolve correctly.
//
// Mapping rationale (see design_handoff_playball_web_redesign/README.md):
//   slate-950  → recessed surfaces (--bg-sunken)
//   slate-900  → page bg            (--bg)
//   slate-800  → cards, elevated    (--bg-elev)
//   slate-700  → hover/divider      (--line-2)
//   slate-600  → emphasis borders   (--ink-3, only for borders)
//   slate-500  → muted text         (--ink-3)
//   slate-400  → secondary text     (--ink-2)
//   slate-300  → secondary+         (--ink-2)
//   slate-200  → primary text       (--ink)
//   slate-100  → primary text       (--ink)
//   blue-500/600/700 → accent surfaces
//   blue-300/400     → accent text on dark backgrounds
const token = (rgb) => `rgb(var(${rgb}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Helvetica Neue', 'Helvetica', 'Arial Nova', 'Arial', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      colors: {
        // Token-backed semantic helpers
        bg:        token('--bg-rgb'),
        surface:   token('--bg-elev-rgb'),
        sunken:    token('--bg-sunken-rgb'),
        ink:       token('--ink-rgb'),
        'ink-2':   token('--ink-2-rgb'),
        'ink-3':   token('--ink-3-rgb'),
        line:      token('--line-rgb'),
        'line-2':  token('--line-2-rgb'),
        accent:    token('--accent-rgb'),
        'accent-ink':  token('--accent-ink-rgb'),
        'accent-soft': token('--accent-soft-rgb'),
        good:      token('--good-rgb'),
        warn:      token('--warn-rgb'),
        danger:    token('--danger-rgb'),

        // Legacy classes remapped to tokens so existing JSX flows through.
        slate: {
          50:  token('--ink-rgb'),
          100: token('--ink-rgb'),
          200: token('--ink-rgb'),
          300: token('--ink-2-rgb'),
          400: token('--ink-2-rgb'),
          500: token('--ink-3-rgb'),
          600: token('--ink-3-rgb'),
          700: token('--line-2-rgb'),
          800: token('--bg-elev-rgb'),
          900: token('--bg-rgb'),
          950: token('--bg-sunken-rgb'),
        },
        blue: {
          50:  token('--accent-soft-rgb'),
          100: token('--accent-soft-rgb'),
          200: token('--accent-soft-rgb'),
          300: token('--accent-rgb'),
          400: token('--accent-rgb'),
          500: token('--accent-rgb'),
          600: token('--accent-rgb'),
          700: token('--accent-rgb'),
          800: token('--accent-rgb'),
          900: token('--accent-rgb'),
        },
        // Keep "field" + named accent shells for diagram/canvas backgrounds.
        field: {
          light: '#8BC34A',
          DEFAULT: '#4CAF50',
          dark: '#2E7D32',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '22px',
      },
      boxShadow: {
        sm:  'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md:  'var(--shadow-md)',
        lg:  'var(--shadow-lg)',
        xl:  'var(--shadow-lg)',
        '2xl': 'var(--shadow-lg)',
      },
      ringColor: {
        DEFAULT: token('--accent-rgb'),
      },
    },
  },
  plugins: [],
  darkMode: 'class',
};

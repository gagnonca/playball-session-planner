// Theme + accent application. Sets CSS custom properties on documentElement
// so the whole tree reskins atomically. Tokens are declared in two forms:
//   --bg, --ink, --accent — hex, for direct CSS use
//   --bg-rgb, --ink-rgb, --accent-rgb — "r g b" triplets, for Tailwind's
//     `rgb(var(--bg-rgb) / <alpha-value>)` color mapping (enables /50 etc).

const THEMES = {
  light: {
    label: 'Light',
    mode: 'light',
    vars: {
      '--bg':         '#faf7f2',  '--bg-rgb':         '250 247 242',
      '--bg-elev':    '#ffffff',  '--bg-elev-rgb':    '255 255 255',
      '--bg-sunken':  '#f1ece3',  '--bg-sunken-rgb':  '241 236 227',
      '--ink':        '#1a1814',  '--ink-rgb':        '26 24 20',
      '--ink-2':      '#4a4640',  '--ink-2-rgb':      '74 70 64',
      '--ink-3':      '#8a8378',  '--ink-3-rgb':      '138 131 120',
      '--line':       '#e8e1d3',  '--line-rgb':       '232 225 211',
      '--line-2':     '#d8cfbb',  '--line-2-rgb':     '216 207 187',
      '--good':       '#4a7c59',  '--good-rgb':       '74 124 89',
      '--warn':       '#c8853d',  '--warn-rgb':       '200 133 61',
      '--danger':     '#b14b3d',  '--danger-rgb':     '177 75 61',
      '--shadow-sm':  '0 1px 2px rgba(26, 24, 20, 0.04)',
      '--shadow-md':  '0 4px 12px rgba(26, 24, 20, 0.06), 0 1px 2px rgba(26, 24, 20, 0.04)',
      '--shadow-lg':  '0 20px 50px rgba(26, 24, 20, 0.12), 0 4px 10px rgba(26, 24, 20, 0.04)',
    },
  },
  dark: {
    label: 'Dark',
    mode: 'dark',
    vars: {
      '--bg':         '#0e0f12',  '--bg-rgb':         '14 15 18',
      '--bg-elev':    '#16181d',  '--bg-elev-rgb':    '22 24 29',
      '--bg-sunken':  '#0a0b0d',  '--bg-sunken-rgb':  '10 11 13',
      '--ink':        '#ebe9e4',  '--ink-rgb':        '235 233 228',
      '--ink-2':      '#a8a59f',  '--ink-2-rgb':      '168 165 159',
      '--ink-3':      '#6a6862',  '--ink-3-rgb':      '106 104 98',
      '--line':       '#23262d',  '--line-rgb':       '35 38 45',
      '--line-2':     '#2e323a',  '--line-2-rgb':     '46 50 58',
      '--good':       '#7ab98a',  '--good-rgb':       '122 185 138',
      '--warn':       '#e0a070',  '--warn-rgb':       '224 160 112',
      '--danger':     '#e07a64',  '--danger-rgb':     '224 122 100',
      '--shadow-sm':  '0 1px 2px rgba(0, 0, 0, 0.30)',
      '--shadow-md':  '0 4px 12px rgba(0, 0, 0, 0.40), 0 1px 2px rgba(0, 0, 0, 0.30)',
      '--shadow-lg':  '0 20px 50px rgba(0, 0, 0, 0.50), 0 4px 10px rgba(0, 0, 0, 0.30)',
    },
  },
};

const ACCENTS = {
  terracotta: {
    label: 'Terracotta',
    swatch: '#c8553d',
    light: {
      '--accent':      '#c8553d',  '--accent-rgb':      '200 85 61',
      '--accent-ink':  '#ffffff',  '--accent-ink-rgb':  '255 255 255',
      '--accent-soft': '#f4ddd5',  '--accent-soft-rgb': '244 221 213',
    },
    dark: {
      '--accent':      '#e07a64',  '--accent-rgb':      '224 122 100',
      '--accent-ink':  '#1a0e0a',  '--accent-ink-rgb':  '26 14 10',
      '--accent-soft': '#2a1814',  '--accent-soft-rgb': '42 24 20',
    },
  },
  pitch: {
    label: 'Pitch green',
    swatch: '#3d7a4a',
    light: {
      '--accent':      '#3d7a4a',  '--accent-rgb':      '61 122 74',
      '--accent-ink':  '#ffffff',  '--accent-ink-rgb':  '255 255 255',
      '--accent-soft': '#dde9df',  '--accent-soft-rgb': '221 233 223',
    },
    dark: {
      '--accent':      '#7ab98a',  '--accent-rgb':      '122 185 138',
      '--accent-ink':  '#0c1a10',  '--accent-ink-rgb':  '12 26 16',
      '--accent-soft': '#142119',  '--accent-soft-rgb': '20 33 25',
    },
  },
  ocean: {
    label: 'Ocean',
    swatch: '#3d5a8a',
    light: {
      '--accent':      '#3d5a8a',  '--accent-rgb':      '61 90 138',
      '--accent-ink':  '#ffffff',  '--accent-ink-rgb':  '255 255 255',
      '--accent-soft': '#dde3ed',  '--accent-soft-rgb': '221 227 237',
    },
    dark: {
      '--accent':      '#7b9cd6',  '--accent-rgb':      '123 156 214',
      '--accent-ink':  '#0a1020',  '--accent-ink-rgb':  '10 16 32',
      '--accent-soft': '#141a28',  '--accent-soft-rgb': '20 26 40',
    },
  },
  ink: {
    label: 'Ink',
    swatch: '#1a1814',
    light: {
      '--accent':      '#1a1814',  '--accent-rgb':      '26 24 20',
      '--accent-ink':  '#faf7f2',  '--accent-ink-rgb':  '250 247 242',
      '--accent-soft': '#e8e1d3',  '--accent-soft-rgb': '232 225 211',
    },
    dark: {
      '--accent':      '#ebe9e4',  '--accent-rgb':      '235 233 228',
      '--accent-ink':  '#0e0f12',  '--accent-ink-rgb':  '14 15 18',
      '--accent-soft': '#23262d',  '--accent-soft-rgb': '35 38 45',
    },
  },
};

const THEME_KEY = 'ppp_theme_v1';
const ACCENT_KEY = 'ppp_accent_v1';
const DEFAULT_THEME = 'light';
const DEFAULT_ACCENT = 'terracotta';

function applyTheme(themeKey, accentKey) {
  const theme = THEMES[themeKey] || THEMES[DEFAULT_THEME];
  const accent = ACCENTS[accentKey] || ACCENTS[DEFAULT_ACCENT];
  const root = document.documentElement;
  root.setAttribute('data-theme', theme.mode);
  root.style.colorScheme = theme.mode;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  Object.entries(accent[theme.mode]).forEach(([k, v]) => root.style.setProperty(k, v));
}

function loadThemePrefs() {
  let theme = DEFAULT_THEME;
  let accent = DEFAULT_ACCENT;
  try {
    const t = localStorage.getItem(THEME_KEY);
    const a = localStorage.getItem(ACCENT_KEY);
    if (t && THEMES[t]) theme = t;
    if (a && ACCENTS[a]) accent = a;
  } catch (e) {
    // localStorage may be unavailable (private mode); fall through to defaults.
  }
  return { theme, accent };
}

function saveThemePrefs(theme, accent) {
  try {
    if (theme) localStorage.setItem(THEME_KEY, theme);
    if (accent) localStorage.setItem(ACCENT_KEY, accent);
  } catch (e) {
    // ignore
  }
}

function bootTheme() {
  const { theme, accent } = loadThemePrefs();
  applyTheme(theme, accent);
  return { theme, accent };
}

export {
  THEMES,
  ACCENTS,
  DEFAULT_THEME,
  DEFAULT_ACCENT,
  applyTheme,
  loadThemePrefs,
  saveThemePrefs,
  bootTheme,
};

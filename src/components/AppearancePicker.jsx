import React, { useState, useEffect } from 'react';
import { THEMES, ACCENTS, applyTheme, loadThemePrefs, saveThemePrefs } from '../utils/theme';

// Light/Dark theme cards + accent chips. Lives inside AboutModal for now
// (the redesign's full Settings surface comes in a later phase). Selecting
// either control persists to localStorage and reskins the document tree
// atomically via applyTheme.
export default function AppearancePicker() {
  const [theme, setTheme] = useState('light');
  const [accent, setAccent] = useState('terracotta');

  useEffect(() => {
    const prefs = loadThemePrefs();
    setTheme(prefs.theme);
    setAccent(prefs.accent);
  }, []);

  const pick = (nextTheme, nextAccent) => {
    setTheme(nextTheme);
    setAccent(nextAccent);
    applyTheme(nextTheme, nextAccent);
    saveThemePrefs(nextTheme, nextAccent);
  };

  return (
    <section>
      <div className="text-[11px] font-mono uppercase mb-2" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
        APPEARANCE
      </div>
      <h3 className="text-[17px] font-semibold mb-3" style={{ letterSpacing: '-0.015em' }}>Theme</h3>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {Object.entries(THEMES).map(([key, t]) => {
          const active = theme === key;
          const isDark = t.mode === 'dark';
          const preview = isDark
            ? { bg: '#0e0f12', card: '#16181d', line: '#23262d', ink: '#ebe9e4', accent: ACCENTS[accent].dark['--accent'] }
            : { bg: '#faf7f2', card: '#ffffff', line: '#e8e1d3', ink: '#1a1814', accent: ACCENTS[accent].light['--accent'] };
          return (
            <button
              key={key}
              onClick={() => pick(key, accent)}
              className="text-left rounded-[12px] p-3 transition-all"
              style={{
                background: 'var(--bg-elev)',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                boxShadow: active ? '0 0 0 3px rgb(var(--accent-rgb) / 0.15)' : 'var(--shadow-sm)',
              }}
            >
              <div
                className="h-16 rounded-[8px] mb-3 flex items-center px-3 gap-2"
                style={{ background: preview.bg, border: `1px solid ${preview.line}` }}
              >
                <div className="w-7 h-7 rounded-md" style={{ background: preview.accent }} />
                <div className="flex-1">
                  <div className="h-2 rounded-full mb-1" style={{ background: preview.ink, opacity: 0.85, width: '60%' }} />
                  <div className="h-1.5 rounded-full" style={{ background: preview.ink, opacity: 0.35, width: '85%' }} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-medium" style={{ color: 'var(--ink)' }}>{t.label}</span>
                {active && (
                  <span className="text-[11px] font-mono uppercase" style={{ color: 'var(--accent)', letterSpacing: '0.08em' }}>
                    Active
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <h3 className="text-[17px] font-semibold mb-3" style={{ letterSpacing: '-0.015em' }}>Accent</h3>
      <div className="flex flex-wrap gap-2">
        {Object.entries(ACCENTS).map(([key, a]) => {
          const active = accent === key;
          return (
            <button
              key={key}
              onClick={() => pick(theme, key)}
              className="inline-flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 transition-all"
              style={{
                background: active ? 'var(--bg-sunken)' : 'transparent',
                border: `1px solid ${active ? 'var(--line-2)' : 'var(--line)'}`,
              }}
              aria-pressed={active}
            >
              <span
                className="w-5 h-5 rounded-full"
                style={{
                  background: a.swatch,
                  boxShadow: active ? '0 0 0 2px var(--bg-elev), 0 0 0 4px var(--accent)' : 'none',
                }}
              />
              <span className="text-[12.5px]" style={{ color: active ? 'var(--ink)' : 'var(--ink-2)' }}>
                {a.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

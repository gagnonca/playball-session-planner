import React from 'react';

// Inline single-select chip group. Click an active chip to deselect (back to
// the implicit "all"); click another to switch. Shared between the Library
// tabs and the Diagram library so the filter UX matches across them.
export default function FilterChipGroup({ label, value, options, onChange }) {
  if (!options || options.length === 0) return null;
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className="font-mono uppercase"
        style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em', marginRight: 2 }}
      >
        {label}
      </span>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? '' : opt)}
            className="rounded-full transition-colors"
            style={{
              padding: '3px 10px',
              fontSize: 12,
              background: active ? 'var(--ink)' : 'var(--bg-elev)',
              color: active ? 'var(--bg)' : 'var(--ink-2)',
              border: '1px solid',
              borderColor: active ? 'var(--ink)' : 'var(--line)',
              fontWeight: active ? 500 : 400,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

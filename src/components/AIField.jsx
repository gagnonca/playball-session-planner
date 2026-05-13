import React, { useState, useRef, useEffect } from 'react';

// AIField — reusable wrapper that adds the design's footer bar under any
// text input. Hidden entirely when AI isn't configured, so coaches who don't
// hook up an API key never see the affordance.
//
//   ┌────────────────────────────────────────────┐
//   │ <textarea or rich editor — provided child> │
//   ├────────────────────────────────────────────┤
//   │ ✨ Suggest from context         + Add prompt│   ← bg-sunken footer
//   └────────────────────────────────────────────┘
//
//   When "Add prompt" is expanded:
//
//   ├────────────────────────────────────────────┤
//   │ ✨ [Tell the Coach what to aim for…][Send] │
//   └────────────────────────────────────────────┘
export default function AIField({
  children,
  label,
  hint,
  isAIConfigured,
  isGenerating,
  onSuggest,
  onSuggestWithPrompt,
  contextSummary, // string explaining what the AI sees (shown in tooltip)
}) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (promptOpen) inputRef.current?.focus();
  }, [promptOpen]);

  const submitPrompt = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    onSuggestWithPrompt?.(trimmed);
    setPrompt('');
    setPromptOpen(false);
  };

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="label-text" style={{ marginBottom: 0 }}>{label}</label>
          {hint && <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>{hint}</span>}
        </div>
      )}

      <div
        className="ai-field-shell rounded-[12px] overflow-hidden"
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--line)',
          transition: 'border-color 160ms ease, box-shadow 160ms ease',
        }}
      >
        {children}

        {isAIConfigured && (
          <div
            className="flex flex-col"
            style={{ background: 'var(--bg-sunken)', borderTop: '1px solid var(--line)' }}
          >
            <div className="flex items-center justify-between px-3 py-1.5 gap-2">
              <button
                type="button"
                onClick={onSuggest}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 rounded-[7px] px-2 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: isGenerating ? 'wait' : 'pointer',
                }}
                title={contextSummary || 'Generate using moment, age group, and what you have typed so far'}
                onMouseEnter={(e) => { if (!isGenerating) e.currentTarget.style.background = 'rgb(var(--accent-rgb) / 0.10)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span aria-hidden style={{ display: 'inline-flex' }}>
                  {isGenerating ? (
                    <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z" />
                    </svg>
                  )}
                </span>
                {isGenerating ? 'Thinking…' : 'Suggest from context'}
              </button>

              <button
                type="button"
                onClick={() => setPromptOpen(o => !o)}
                disabled={isGenerating}
                className="inline-flex items-center gap-1 rounded-[7px] px-2 py-1 transition-colors disabled:opacity-50"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ink-2)',
                  fontSize: 12,
                  cursor: isGenerating ? 'wait' : 'pointer',
                }}
                title="Steer the AI with a one-line prompt"
                onMouseEnter={(e) => { if (!isGenerating) e.currentTarget.style.color = 'var(--ink)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-2)'; }}
              >
                <span aria-hidden style={{ marginRight: 1 }}>{promptOpen ? '−' : '+'}</span>
                Add prompt
              </button>
            </div>

            {promptOpen && (
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ borderTop: '1px solid var(--line)' }}
              >
                <span aria-hidden style={{ color: 'var(--accent)', display: 'inline-flex' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z" />
                  </svg>
                </span>
                <input
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); submitPrompt(); }
                    if (e.key === 'Escape') { setPromptOpen(false); setPrompt(''); }
                  }}
                  placeholder="Tell the Coach what to aim for…"
                  className="flex-1 bg-transparent outline-none"
                  style={{ color: 'var(--ink)', fontSize: 12.5 }}
                />
                <button
                  type="button"
                  onClick={submitPrompt}
                  disabled={!prompt.trim() || isGenerating}
                  className="inline-flex items-center justify-center rounded-[7px]"
                  style={{
                    width: 26,
                    height: 26,
                    background: prompt.trim() ? 'var(--accent)' : 'var(--bg-sunken)',
                    color: prompt.trim() ? 'var(--accent-ink)' : 'var(--ink-3)',
                    border: prompt.trim() ? 'none' : '1px solid var(--line)',
                    cursor: prompt.trim() && !isGenerating ? 'pointer' : 'not-allowed',
                  }}
                  title="Generate (Enter)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from 'react';

// 320px share-scope popover anchored to the SessionBuilder topbar.
// Three states, gated by what the user has actually turned on:
//
//   Private    | Co-coaches                       | Public
//   ---------- | -------------------------------- | -------------------
//   always ok  | needs sync (pairing identity)    | needs an account
//
// The current backend models share scope per-team, not per-session — so
// flipping to "Co-coaches" actually shares the parent team and everything
// in it. The cascading explainer is honest about that. Per-item scope is
// listed in the open-questions section of the design handoff.

function ShareOption({ icon, label, body, selected, disabled, lockHint, onClick }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      aria-pressed={selected}
      disabled={disabled}
      className="w-full text-left transition-colors"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 11px',
        borderRadius: 10,
        border: '1.5px solid',
        borderColor: selected ? 'var(--accent)' : 'var(--line)',
        background: selected ? 'var(--accent-soft)' : 'var(--bg-elev)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
      onMouseEnter={(e) => { if (!disabled && !selected) e.currentTarget.style.borderColor = 'var(--line-2)'; }}
      onMouseLeave={(e) => { if (!disabled && !selected) e.currentTarget.style.borderColor = 'var(--line)'; }}
    >
      <span
        className="flex-shrink-0 inline-flex items-center justify-center rounded-[8px]"
        style={{
          width: 30, height: 30,
          background: selected ? 'rgb(var(--accent-rgb) / 0.18)' : 'var(--bg-sunken)',
          color: selected ? 'var(--accent)' : 'var(--ink-2)',
        }}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-[14px] font-semibold" style={{ letterSpacing: '-0.015em', color: 'var(--ink)' }}>
            {label}
          </span>
          {selected && (
            <span className="font-mono uppercase" style={{ fontSize: 9.5, color: 'var(--accent)', letterSpacing: '0.08em' }}>
              · Current
            </span>
          )}
        </span>
        <span className="block text-[12px] mt-0.5" style={{ color: 'var(--ink-2)' }}>{body}</span>
        {disabled && lockHint && (
          <span className="block text-[11px] mt-1 inline-flex items-center gap-1" style={{ color: 'var(--ink-3)' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 018 0v4" />
            </svg>
            {lockHint}
          </span>
        )}
      </span>
    </button>
  );
}

export default function SharePopover({
  open,
  anchorRef,
  onClose,
  current,             // 'private' | 'coaches' | 'public'
  syncEnabled,
  hasAccount,
  exerciseCount = 0,
  diagramCount = 0,
  onMakePrivate,       // revoke team sharing
  onMakeCoCoaches,     // open ShareModal to generate link
  onTurnOnSync,        // open LinkDeviceModal
}) {
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const showCascading = current === 'coaches' || current === 'public';

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Share scope"
      className="absolute z-30 animate-fade-in"
      style={{
        top: 'calc(100% + 6px)',
        right: 0,
        width: 320,
        padding: 12,
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div className="eyebrow mb-2.5" style={{ fontSize: 10.5 }}>SHARE SCOPE</div>

      {!syncEnabled && (
        <div
          className="rounded-[10px] p-2.5 mb-2.5 flex items-start gap-2"
          style={{ background: 'rgb(var(--warn-rgb) / 0.12)', border: '1px solid rgb(var(--warn-rgb) / 0.4)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }}>
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="flex-1 text-[12px]" style={{ color: 'var(--ink)' }}>
            Sharing needs cloud sync turned on first.{' '}
            <button onClick={onTurnOnSync} className="underline" style={{ color: 'var(--accent)' }}>
              Turn on sync
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <ShareOption
          selected={current === 'private'}
          onClick={onMakePrivate}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 018 0v4" />
            </svg>
          }
          label="Private"
          body="Only you can see this session."
        />
        <ShareOption
          selected={current === 'coaches'}
          disabled={!syncEnabled}
          lockHint={!syncEnabled ? 'Needs cloud sync' : undefined}
          onClick={onMakeCoCoaches}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-3-3.87M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          }
          label="Co-coaches"
          body="Anyone you share the team link with."
        />
        <ShareOption
          selected={current === 'public'}
          disabled={!hasAccount}
          lockHint={!hasAccount ? 'Needs a free account' : undefined}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a13 13 0 010 18M12 3a13 13 0 000 18" />
            </svg>
          }
          label="Public"
          body="Listed in the Community for any coach to find."
        />
      </div>

      {showCascading && (
        <div
          className="rounded-[10px] mt-2.5 p-2.5"
          style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}
        >
          <div className="text-[12px]" style={{ color: 'var(--ink)' }}>
            <strong style={{ fontWeight: 600 }}>Also shares</strong> the{' '}
            <strong style={{ fontWeight: 600 }}>{exerciseCount}</strong> exercise{exerciseCount === 1 ? '' : 's'} and{' '}
            <strong style={{ fontWeight: 600 }}>{diagramCount}</strong> diagram{diagramCount === 1 ? '' : 's'} used here.
          </div>
          <div className="text-[11.5px] mt-1.5" style={{ color: 'var(--ink-3)' }}>
            Sharing scope is currently per team — every session inside the team becomes visible to co-coaches with the link. Per-item scope is coming.
          </div>
        </div>
      )}
    </div>
  );
}

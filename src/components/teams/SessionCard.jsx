import React from 'react';
import DiagramPreview from './DiagramPreview';

const MOMENT_META = {
  attacking:                { label: 'Attacking',  emoji: '⚡' },
  defending:                { label: 'Defending',  emoji: '🛡' },
  'building up':            { label: 'Building up', emoji: '🏗' },
  'transition to attack':   { label: 'Transition → attack', emoji: '🔄' },
  'transition to defense':  { label: 'Transition → defense', emoji: '↩' },
};

function getMomentMeta(moment) {
  if (!moment) return null;
  return MOMENT_META[moment.toLowerCase()] || { label: moment, emoji: '' };
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export default function SessionCard({ session, onSelect, onDuplicate, onDelete, onSaveToLibrary }) {
  const { summary } = session;
  const isScheduled = summary.date && summary.date.length > 0;
  const exerciseCount = session.sections?.length || 0;
  const moment = getMomentMeta(summary.moment);

  // Status maps to: SCHEDULED (date in future), TEMPLATE (no date), REVIEWED (date in past)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let statusKey = 'template';
  if (isScheduled) {
    statusKey = new Date(summary.date) >= today ? 'scheduled' : 'reviewed';
  }
  const statusMeta = {
    scheduled: { label: 'SCHEDULED', fg: 'var(--good)', bg: 'rgb(74 124 89 / 0.13)' },
    template:  { label: 'TEMPLATE',  fg: 'var(--warn)', bg: 'rgb(200 133 61 / 0.14)' },
    reviewed:  { label: 'REVIEWED',  fg: 'var(--ink-3)', bg: 'transparent', border: '1px solid var(--line)' },
  }[statusKey];

  return (
    <article
      onClick={() => onSelect(session.id)}
      role="button"
      style={{
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.borderColor = 'var(--line-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.borderColor = 'var(--line)';
      }}
    >
      <DiagramPreview session={session} height={108} />

      <div style={{ padding: '0 4px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 9.5,
              fontWeight: 700,
              padding: '3px 7px',
              borderRadius: 3,
              color: statusMeta.fg,
              background: statusMeta.bg,
              border: statusMeta.border || 'none',
              letterSpacing: '0.08em',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {statusMeta.label}
          </span>
          <span
            className="mono"
            style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 'auto' }}
          >
            {summary.duration ? `${summary.duration}${/\d/.test(summary.duration) ? 'm' : ''} · ` : ''}
            {exerciseCount}b
          </span>
        </div>

        <h4
          style={{
            margin: 0,
            fontSize: 14.5,
            fontWeight: 600,
            lineHeight: 1.25,
            letterSpacing: '-0.005em',
            color: 'var(--ink)',
          }}
        >
          {summary.title || 'Untitled session'}
        </h4>

        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {isScheduled
            ? <span>{formatDate(summary.date)}</span>
            : <span style={{ color: 'var(--ink-3)' }}>Draft · no date</span>}
          {moment && (
            <>
              <span style={{ color: 'var(--line-2)' }}>·</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 7px',
                  borderRadius: 999,
                  fontSize: 10.5,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  fontWeight: 500,
                }}
              >
                {moment.emoji && <span aria-hidden>{moment.emoji}</span>}
                {moment.label}
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
          {onSaveToLibrary && (
            <button
              onClick={(e) => { e.stopPropagation(); onSaveToLibrary(session.id); }}
              className="btn btn-ghost"
              style={{ padding: '4px 8px', fontSize: 11.5 }}
              title="Save to playbook"
            >
              Save
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(session.id); }}
            className="btn btn-ghost"
            style={{ padding: '4px 8px', fontSize: 11.5 }}
            title="Duplicate"
          >
            Copy
          </button>
          <span style={{ flex: 1 }} />
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
            className="btn btn-ghost"
            style={{ padding: '4px 6px', color: 'var(--danger)' }}
            title="Delete"
            aria-label="Delete session"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}

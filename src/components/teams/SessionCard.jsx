import React from 'react';

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

  return (
    <div
      className="card card-hover p-4 cursor-pointer"
      onClick={() => onSelect(session.id)}
      role="button"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-[17px] font-semibold leading-tight truncate" style={{ letterSpacing: '-0.015em' }}>
            {summary.title || 'Untitled session'}
          </h4>
          {moment && (
            <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              {moment.emoji && <span aria-hidden>{moment.emoji}</span>}
              <span>{moment.label}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 -mr-1 -mt-1">
          {onSaveToLibrary && (
            <button
              onClick={(e) => { e.stopPropagation(); onSaveToLibrary(session.id); }}
              className="btn btn-ghost"
              style={{ padding: '4px 8px', fontSize: 12 }}
              title="Save to library"
            >
              Save
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(session.id); }}
            className="btn btn-ghost"
            style={{ padding: '4px 8px', fontSize: 12 }}
            title="Duplicate"
          >
            Copy
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
            className="btn btn-ghost"
            style={{ padding: '4px 6px', color: 'var(--danger)' }}
            title="Delete"
            aria-label="Delete session"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
        {isScheduled ? (
          <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--good)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span style={{ fontWeight: 500 }}>{formatDate(summary.date)}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--ink-3)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span>Template</span>
          </span>
        )}
        {summary.duration && (
          <>
            <span style={{ color: 'var(--line-2)' }}>·</span>
            <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.06em' }}>
              {summary.duration}{/\d/.test(summary.duration) ? ' MIN' : ''}
            </span>
          </>
        )}
        <span style={{ color: 'var(--line-2)' }}>·</span>
        <span>{exerciseCount} section{exerciseCount === 1 ? '' : 's'}</span>
      </div>

      {(summary.playerActions?.length > 0 || summary.keyQualities?.length > 0) && (
        <div className="mt-3 pt-3 hairline">
          <div className="flex flex-wrap gap-1.5">
            {summary.playerActions?.slice(0, 3).map((action, i) => (
              <span
                key={i}
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: 'var(--bg-sunken)', color: 'var(--ink-2)' }}
              >
                {action}
              </span>
            ))}
            {summary.playerActions?.length > 3 && (
              <span className="text-[11px] px-1.5 py-0.5" style={{ color: 'var(--ink-3)' }}>
                +{summary.playerActions.length - 3}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

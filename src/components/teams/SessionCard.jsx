import React from 'react';

export default function SessionCard({ session, onSelect, onDuplicate, onDelete }) {
  const { summary } = session;
  const isScheduled = summary.date && summary.date.length > 0;
  const exerciseCount = session.sections?.length || 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getMomentEmoji = (moment) => {
    // Handle both old lowercase and new capitalized values
    const m = (moment || '').toLowerCase();
    switch (m) {
      case 'attacking':
        return '⚡';
      case 'defending':
        return '🛡️';
      case 'transition to attack':
        return '🔄';
      case 'transition to defense':
        return '↩️';
      default:
        return '';
    }
  };

  return (
    <div
      className="card p-4 cursor-pointer hover:border-blue-500 transition-all"
      onClick={() => onSelect(session.id)}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {summary.moment && (
              <span className="text-lg">{getMomentEmoji(summary.moment)}</span>
            )}
            <h4 className="text-lg font-semibold text-slate-100">
              {summary.title || 'Untitled Session'}
            </h4>
          </div>
          {summary.moment && (
            <p className="text-xs text-slate-400 capitalize">{summary.moment}</p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(session.id);
            }}
            className="btn btn-subtle text-xs px-2 py-1"
            title="Duplicate"
          >
            Copy
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(session.id);
            }}
            className="btn btn-danger text-xs px-2 py-1"
            title="Delete"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {isScheduled && (
          <div className="flex items-center gap-2 text-green-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="font-medium">{formatDate(summary.date)}</span>
          </div>
        )}

        {!isScheduled && (
          <div className="flex items-center gap-2 text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
            <span>Template</span>
          </div>
        )}

        {summary.duration && (
          <div className="flex items-center gap-2 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{summary.duration}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>{exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {(summary.playerActions?.length > 0 || summary.keyQualities?.length > 0) && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="flex flex-wrap gap-1">
            {summary.playerActions?.slice(0, 3).map((action, i) => (
              <span
                key={i}
                className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded"
              >
                {action}
              </span>
            ))}
            {summary.playerActions?.length > 3 && (
              <span className="text-xs text-slate-500 px-2 py-1">
                +{summary.playerActions.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

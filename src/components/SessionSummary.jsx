import React, { useEffect, useState, useCallback } from 'react';
import TagSelector from './TagSelector';
import ContextualHelp, { resetHelpPreferences } from './ContextualHelp';
import { SUMMARY_COLLAPSED_KEY } from '../constants/storage';
import {
  MOMENT_ACTIONS,
  MOMENT_QUALITIES,
  ALL_PLAYER_ACTIONS,
  ALL_KEY_QUALITIES,
} from '../constants/coaching';
import { toast } from '../utils/helpers';

// Auto-grow textarea handler
const useAutoGrow = () => {
  return useCallback((e) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.max(target.scrollHeight, 72) + 'px';
  }, []);
};

// Moment options
const MOMENT_OPTIONS = [
  { value: 'Attacking', label: 'Attacking', emoji: '⚡' },
  { value: 'Defending', label: 'Defending', emoji: '🛡️' },
  { value: 'Transition to Attack', label: 'Trans→Atk', emoji: '🔄' },
  { value: 'Transition to Defense', label: 'Trans→Def', emoji: '↩️' },
];

export default function SessionSummary({ summary, onUpdate }) {
  const [titleOverride, setTitleOverride] = useState(false);
  const [showMomentsHelp, setShowMomentsHelp] = useState(false);
  const handleAutoGrow = useAutoGrow();
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(SUMMARY_COLLAPSED_KEY);
      return saved !== 'true'; // Default to expanded if not set
    } catch {
      return true;
    }
  });

  // Persist collapse state
  useEffect(() => {
    try {
      localStorage.setItem(SUMMARY_COLLAPSED_KEY, (!isExpanded).toString());
    } catch {
      // Ignore localStorage errors
    }
  }, [isExpanded]);

  // Convert legacy string format to array format if needed
  const playerActions = Array.isArray(summary.playerActions)
    ? summary.playerActions
    : summary.playerActions ? [summary.playerActions] : [];

  const keyQualities = Array.isArray(summary.keyQualities)
    ? summary.keyQualities
    : summary.keyQualities ? [summary.keyQualities] : [];

  const moment = summary.moment || '';

  // Auto-generate title based on selections
  useEffect(() => {
    if (!titleOverride && moment) {
      const momentText = moment.charAt(0).toUpperCase() + moment.slice(1);
      const actionsText = playerActions.length > 0
        ? ` — ${playerActions.slice(0, 2).join(', ')}`
        : '';
      const autoTitle = `${momentText}${actionsText}`;

      if (summary.title !== autoTitle) {
        onUpdate({ ...summary, title: autoTitle });
      }
    }
  }, [moment, playerActions, titleOverride]);

  const handleChange = (field, value) => {
    onUpdate({ ...summary, [field]: value });
  };

  const handleTitleChange = (value) => {
    setTitleOverride(true);
    handleChange('title', value);
  };

  const handleResetTitle = () => {
    setTitleOverride(false);
  };

  // Build compact info summary for collapsed state
  const getCompactInfo = () => {
    const parts = [];
    if (summary.duration) parts.push(summary.duration);
    if (summary.ageGroup) parts.push(summary.ageGroup);
    if (playerActions.length > 0) parts.push(`${playerActions.length} actions`);
    if (keyQualities.length > 0) parts.push(`${keyQualities.length} qualities`);
    return parts.join(' · ');
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="overline mb-1">SESSION SUMMARY</div>
          <h1 className="text-[22px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>
            {summary.title || 'Untitled session'}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              resetHelpPreferences();
              toast('Tips reset — they will show again');
            }}
            className="btn btn-ghost"
            style={{ padding: '4px 8px', fontSize: 12 }}
            title="Reset all dismissed tips"
          >
            Show tips
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn btn-ghost"
            style={{ padding: '4px 8px', fontSize: 12.5 }}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
            <svg
              className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Session Title - Always Visible */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label-text">Title</label>
            {titleOverride && (
              <button
                type="button"
                onClick={handleResetTitle}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Reset
              </button>
            )}
          </div>
          <input
            type="text"
            value={summary.title || ''}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Auto-generated..."
            className="input-field"
          />
        </div>

        {/* Moment Selection - Always Visible (Compact Pills) */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label className="label-text">Moment</label>
            <button
              type="button"
              onClick={() => setShowMomentsHelp(true)}
              className="w-5 h-5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center transition-colors"
              title="What are moments?"
            >
              ?
            </button>
          </div>

          {/* Moments Help */}
          {showMomentsHelp && (
            <ContextualHelp
              type="moments"
              forceShow={true}
              onDismiss={() => setShowMomentsHelp(false)}
            />
          )}

          <div className="flex flex-wrap gap-2">
            {MOMENT_OPTIONS.map(option => {
              const active = moment === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange('moment', option.value)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-all"
                  style={{
                    border: '1.5px solid',
                    borderColor: active ? 'var(--accent)' : 'var(--line)',
                    background: active ? 'var(--accent-soft)' : 'var(--bg-elev)',
                    color: active ? 'var(--accent)' : 'var(--ink-2)',
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    letterSpacing: '-0.005em',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--line-2)'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--line)'; }}
                  aria-pressed={active}
                >
                  <span aria-hidden>{option.emoji}</span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date - Always Visible */}
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-xs">
            <label className="label-text">Date</label>
            <input
              type="date"
              value={summary.date || ''}
              onChange={(e) => handleChange('date', e.target.value)}
              className="input-field"
            />
          </div>
          {/* Show compact info when collapsed */}
          {!isExpanded && getCompactInfo() && (
            <div className="text-sm text-slate-400 mt-5">
              {getCompactInfo()}
            </div>
          )}
        </div>

        {/* Expandable Content */}
        {isExpanded && (
          <>
            {/* Duration, Age Group */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label-text">Duration (minutes)</label>
                <input
                  type="text"
                  value={summary.duration || ''}
                  onChange={(e) => handleChange('duration', e.target.value)}
                  placeholder="60 min"
                  className="input-field"
                />
              </div>

              <div>
                <label className="label-text">Age Group</label>
                <input
                  type="text"
                  value={summary.ageGroup || ''}
                  onChange={(e) => handleChange('ageGroup', e.target.value)}
                  placeholder="U8"
                  className="input-field"
                />
              </div>
            </div>

            {/* Player Actions */}
            <TagSelector
              label="Player Actions"
              suggestions={ALL_PLAYER_ACTIONS}
              selectedTags={playerActions}
              onChange={(tags) => handleChange('playerActions', tags)}
              placeholder="Add custom..."
              primaryTags={moment ? MOMENT_ACTIONS[moment]?.primary : null}
              secondaryTags={moment ? MOMENT_ACTIONS[moment]?.secondary : null}
            />

            {/* Key Qualities */}
            <TagSelector
              label="Key Qualities"
              suggestions={ALL_KEY_QUALITIES}
              selectedTags={keyQualities}
              onChange={(tags) => handleChange('keyQualities', tags)}
              placeholder="Add custom..."
              primaryTags={moment ? MOMENT_QUALITIES[moment]?.primary : null}
              secondaryTags={moment ? MOMENT_QUALITIES[moment]?.secondary : null}
            />

            {/* Session Notes */}
            <div>
              <label className="label-text">Session notes</label>
              <textarea
                value={summary.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                onInput={handleAutoGrow}
                rows="3"
                placeholder="High-level notes about this session…"
                className="input-field resize-none overflow-hidden"
              />
            </div>

            {/* Post-Session Reflection */}
            <div className="mt-6 pt-6 hairline">
              <div className="overline mb-2">POST-SESSION REFLECTION</div>
              <p className="text-[12.5px] mb-3" style={{ color: 'var(--ink-3)' }}>
                Fill in after practice. Helps you (and the Coach) learn what works for this team.
              </p>
              <textarea
                value={summary.reflectionNotes || ''}
                onChange={(e) => handleChange('reflectionNotes', e.target.value)}
                onInput={handleAutoGrow}
                rows="4"
                placeholder={`• How did you do in achieving the goals of the training session?\n• What did you do well?\n• What could you do better?`}
                className="input-field resize-none overflow-hidden"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

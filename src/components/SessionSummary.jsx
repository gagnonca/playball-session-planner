import React, { useEffect, useState, useCallback } from 'react';
import TagSelector from './TagSelector';
import { SUMMARY_COLLAPSED_KEY } from '../constants/storage';

// Auto-grow textarea handler
const useAutoGrow = () => {
  return useCallback((e) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.max(target.scrollHeight, 72) + 'px';
  }, []);
};

// Suggestions for player actions
const PLAYER_ACTION_SUGGESTIONS = [
  'Pass',
  'Dribble',
  'Shoot',
  'Receive',
  'Support',
  'Press',
  'Defend',
  'Tackle',
  'Intercept',
  'Clear',
  'Create space',
  'Scan',
  'Communicate',
];

// Suggestions for key qualities
const KEY_QUALITY_SUGGESTIONS = [
  'Read & decide',
  'Focus',
  'Technical execution',
  'Awareness',
  'Quick thinking',
  'Composure',
  'Vision',
  'Timing',
  'First touch',
  'Ball control',
  'Communication',
  'Teamwork',
];

// Moment options
const MOMENT_OPTIONS = [
  { value: 'Attacking', label: 'Attacking', emoji: '⚡' },
  { value: 'Defending', label: 'Defending', emoji: '🛡️' },
  { value: 'Transition to Attack', label: 'Trans→Atk', emoji: '🔄' },
  { value: 'Transition to Defense', label: 'Trans→Def', emoji: '↩️' },
];

export default function SessionSummary({ summary, onUpdate }) {
  const [titleOverride, setTitleOverride] = useState(false);
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
    <div className="card p-4">
      {/* Header - Always Visible */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Session Summary</h1>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-slate-700/50"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
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
          <label className="label-text mb-1.5">Moment</label>
          <div className="flex flex-wrap gap-2">
            {MOMENT_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleChange('moment', option.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  moment === option.value
                    ? 'bg-blue-600 text-white border-2 border-blue-500'
                    : 'bg-slate-700 text-slate-300 border-2 border-slate-600 hover:border-slate-500'
                }`}
              >
                <span>{option.emoji}</span>
                <span>{option.label}</span>
              </button>
            ))}
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
              suggestions={PLAYER_ACTION_SUGGESTIONS}
              selectedTags={playerActions}
              onChange={(tags) => handleChange('playerActions', tags)}
              placeholder="Add custom..."
            />

            {/* Key Qualities */}
            <TagSelector
              label="Key Qualities"
              suggestions={KEY_QUALITY_SUGGESTIONS}
              selectedTags={keyQualities}
              onChange={(tags) => handleChange('keyQualities', tags)}
              placeholder="Add custom..."
            />

            {/* Session Notes */}
            <div>
              <label className="label-text">Session Notes</label>
              <textarea
                value={summary.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                onInput={handleAutoGrow}
                rows="3"
                placeholder="High-level notes about this session..."
                className="input-field resize-none overflow-hidden"
              />
            </div>

            {/* Keywords */}
            <div>
              <label className="label-text">Keywords</label>
              <textarea
                value={summary.keywords || ''}
                onChange={(e) => handleChange('keywords', e.target.value)}
                onInput={handleAutoGrow}
                rows="2"
                placeholder="e.g., look up, pass, dribble"
                className="input-field resize-none overflow-hidden"
              />
            </div>

            {/* Post-Session Reflection */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <h3 className="text-lg font-semibold mb-2 text-blue-400">Post-Session Reflection</h3>
              <p className="text-xs text-slate-500 mb-3">Complete after training to reflect on the session</p>
              <textarea
                value={summary.reflectionNotes || ''}
                onChange={(e) => handleChange('reflectionNotes', e.target.value)}
                onInput={handleAutoGrow}
                rows="4"
                placeholder={`Questions to guide your reflection:\n• How did you do in achieving the goals of the training session?\n• What did you do well?\n• What could you do better?`}
                className="input-field resize-none overflow-hidden"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

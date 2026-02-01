import React, { useEffect, useState } from 'react';
import TagSelector from './TagSelector';

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

export default function SessionSummary({ summary, onUpdate }) {
  const [titleOverride, setTitleOverride] = useState(false);

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

  return (
    <div className="card p-4">
      <div className="mb-3">
        <h1 className="text-xl font-bold">Session Summary</h1>
      </div>

      <div className="space-y-3">
        {/* Session Title */}
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

        {/* Moment Selection */}
        <div>
          <label className="label-text mb-1">Moment</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { value: 'attacking', label: 'Attacking', emoji: '⚡' },
              { value: 'defending', label: 'Defending', emoji: '🛡️' },
              { value: 'transition to attack', label: 'Transition to Attack', emoji: '🔄' },
              { value: 'transition to defense', label: 'Transition to Defense', emoji: '↩️' },
            ].map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleChange('moment', option.value)}
                className={`p-3 rounded-lg text-sm font-medium transition-all ${moment === option.value
                  ? 'bg-blue-600 text-white border-2 border-blue-500'
                  : 'bg-slate-700 text-slate-300 border-2 border-slate-600 hover:border-slate-500'
                  }`}
              >
                <div className="text-lg mb-1">{option.emoji}</div>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date, Duration, Age Group */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label-text">Date</label>
            <input
              type="date"
              value={summary.date || ''}
              onChange={(e) => handleChange('date', e.target.value)}
              className="input-field"
            />
          </div>

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
            rows="3"
            placeholder="High-level notes about this session..."
            className="input-field resize-y"
          />
        </div>

        {/* Keywords */}
        <div>
          <label className="label-text">Keywords</label>
          <textarea
            value={summary.keywords || ''}
            onChange={(e) => handleChange('keywords', e.target.value)}
            rows="2"
            placeholder="e.g., look up, pass, dribble"
            className="input-field resize-y"
          />
        </div>
      </div>
    </div>
  );
}

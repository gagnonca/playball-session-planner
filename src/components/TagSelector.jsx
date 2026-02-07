import React, { useState } from 'react';

/**
 * TagSelector with optional moment-based filtering.
 *
 * Props:
 * - label: Label text
 * - suggestions: Array of all available tags
 * - selectedTags: Currently selected tags
 * - onChange: Callback when tags change
 * - placeholder: Placeholder for custom input
 * - primaryTags: Array of primary/highlighted tags (optional)
 * - secondaryTags: Array of secondary tags (optional)
 *
 * When primaryTags/secondaryTags are provided:
 * - Primary tags shown first with highlighted style
 * - Secondary tags shown with "+ Show more" toggle
 * - Other tags shown muted after expanding
 */
export default function TagSelector({
  label,
  suggestions = [],
  selectedTags = [],
  onChange,
  placeholder = "Add custom...",
  primaryTags = null,
  secondaryTags = null,
}) {
  const [customInput, setCustomInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const handleToggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const handleAddCustom = () => {
    if (customInput.trim()) {
      onChange([...selectedTags, customInput.trim()]);
      setCustomInput('');
      setShowInput(false);
    }
  };

  const handleRemoveTag = (tag) => {
    onChange(selectedTags.filter(t => t !== tag));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  // Determine if we're using filtered mode
  const isFiltered = primaryTags !== null;

  // Categorize suggestions when filtered
  const categorizedSuggestions = isFiltered ? (() => {
    const primary = primaryTags || [];
    const secondary = secondaryTags || [];
    const others = suggestions.filter(s => !primary.includes(s) && !secondary.includes(s));
    return { primary, secondary, others };
  })() : null;

  // Get tag style based on category
  const getTagStyle = (tag, category) => {
    const isSelected = selectedTags.includes(tag);

    if (isSelected) {
      return 'bg-blue-600 text-white ring-2 ring-blue-400';
    }

    if (!isFiltered) {
      return 'bg-slate-700 text-slate-300 hover:bg-slate-600';
    }

    switch (category) {
      case 'primary':
        return 'bg-blue-600/30 text-blue-200 border border-blue-500/50 hover:bg-blue-600/50';
      case 'secondary':
        return 'bg-slate-700 text-slate-300 hover:bg-slate-600';
      case 'other':
      default:
        return 'bg-slate-800/50 text-slate-500 hover:bg-slate-700/50';
    }
  };

  // Render a tag button
  const renderTag = (tag, category = null) => (
    <button
      key={tag}
      type="button"
      onClick={() => handleToggleTag(tag)}
      className={`px-2 py-1 rounded text-xs font-medium transition-all ${getTagStyle(tag, category)}`}
    >
      {selectedTags.includes(tag) && <span className="mr-1">✓</span>}
      {tag}
    </button>
  );

  return (
    <div>
      {label && <label className="label-text mb-1.5">{label}</label>}

      {/* Suggestions */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {isFiltered ? (
          <>
            {/* Primary tags - always shown, highlighted */}
            {categorizedSuggestions.primary.map(tag => renderTag(tag, 'primary'))}

            {/* Show more toggle */}
            {(categorizedSuggestions.secondary.length > 0 || categorizedSuggestions.others.length > 0) && (
              <>
                {!showMore ? (
                  <button
                    type="button"
                    onClick={() => setShowMore(true)}
                    className="px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-slate-300 bg-slate-800/30 hover:bg-slate-700/50 transition-all"
                  >
                    + {categorizedSuggestions.secondary.length + categorizedSuggestions.others.length} more
                  </button>
                ) : (
                  <>
                    {/* Secondary tags */}
                    {categorizedSuggestions.secondary.map(tag => renderTag(tag, 'secondary'))}

                    {/* Other tags - muted */}
                    {categorizedSuggestions.others.map(tag => renderTag(tag, 'other'))}

                    {/* Collapse button */}
                    <button
                      type="button"
                      onClick={() => setShowMore(false)}
                      className="px-2 py-1 rounded text-xs font-medium text-slate-500 hover:text-slate-400 transition-all"
                    >
                      Show less
                    </button>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          // Non-filtered mode - show all suggestions
          suggestions.map(suggestion => renderTag(suggestion))
        )}

        {/* Custom button */}
        {!showInput && (
          <button
            type="button"
            onClick={() => setShowInput(true)}
            className="px-2 py-1 rounded text-xs font-medium bg-slate-700/50 text-slate-400 border border-dashed border-slate-600 hover:border-slate-500 transition-all"
          >
            + Custom
          </button>
        )}
      </div>

      {/* Custom input */}
      {showInput && (
        <div className="flex gap-1.5 mb-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="input-field flex-1 text-sm"
            autoFocus
          />
          <button
            type="button"
            onClick={handleAddCustom}
            className="btn btn-primary text-sm px-3 py-1"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setShowInput(false);
              setCustomInput('');
            }}
            className="btn btn-secondary text-sm px-3 py-1"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Selected tags display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900/30 rounded border border-slate-700">
          {selectedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600/20 text-blue-300 rounded text-xs font-medium border border-blue-500/30"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-blue-100 transition-colors text-sm"
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

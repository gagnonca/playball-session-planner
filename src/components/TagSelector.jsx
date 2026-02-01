import React, { useState } from 'react';

export default function TagSelector({
  label,
  suggestions = [],
  selectedTags = [],
  onChange,
  placeholder = "Add custom..."
}) {
  const [customInput, setCustomInput] = useState('');
  const [showInput, setShowInput] = useState(false);

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

  return (
    <div>
      {label && <label className="label-text mb-1.5">{label}</label>}

      {/* Suggestions */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {suggestions.map(suggestion => (
          <button
            key={suggestion}
            type="button"
            onClick={() => handleToggleTag(suggestion)}
            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
              selectedTags.includes(suggestion)
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {suggestion}
          </button>
        ))}

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

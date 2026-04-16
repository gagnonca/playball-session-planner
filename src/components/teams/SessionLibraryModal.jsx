import React, { useState, useMemo } from 'react';
import { ALL_PLAYER_ACTIONS } from '../../constants/coaching';

const MOMENT_OPTIONS = [
  { value: 'Attacking', label: 'Attacking', emoji: '⚡' },
  { value: 'Defending', label: 'Defending', emoji: '🛡️' },
  { value: 'Transition to Attack', label: 'Trans→Atk', emoji: '🔄' },
  { value: 'Transition to Defense', label: 'Trans→Def', emoji: '↩️' },
];

function getMomentEmoji(moment) {
  const opt = MOMENT_OPTIONS.find(o => o.value === moment);
  return opt ? opt.emoji : '';
}

export default function SessionLibraryModal({
  isOpen,
  onClose,
  library,
  onInsert,
  onDelete,
  onExport,
  onImport,
  onClear,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMoment, setFilterMoment] = useState(null);
  const [filterAgeGroup, setFilterAgeGroup] = useState(null);
  const [filterActions, setFilterActions] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);

  // Unique age groups from library items
  const ageGroups = useMemo(() => {
    const set = new Set();
    (library.items || []).forEach(item => {
      if (item.ageGroup) set.add(item.ageGroup);
    });
    return Array.from(set).sort();
  }, [library.items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return (library.items || [])
      .filter(item => {
        // Moment filter
        if (filterMoment && item.moment !== filterMoment) return false;
        // Age group filter
        if (filterAgeGroup && item.ageGroup !== filterAgeGroup) return false;
        // Player actions filter (must have ALL selected)
        if (filterActions.length > 0) {
          const itemActions = item.playerActions || [];
          if (!filterActions.every(a => itemActions.includes(a))) return false;
        }
        // Text search
        const query = searchQuery.trim().toLowerCase();
        if (query) {
          const fields = [
            item.name,
            item.moment,
            item.ageGroup,
            ...(item.playerActions || []),
            ...(item.keyQualities || []),
            item.payload?.summary?.notes,
          ];
          // Also search section names and objectives
          (item.payload?.sections || []).forEach(sec => {
            fields.push(sec.name, sec.objective);
          });
          if (!fields.some(f => (f || '').toLowerCase().includes(query))) return false;
        }
        return true;
      })
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [library.items, filterMoment, filterAgeGroup, filterActions, searchQuery]);

  if (!isOpen) return null;

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  const toggleAction = (action) => {
    setFilterActions(prev =>
      prev.includes(action)
        ? prev.filter(a => a !== action)
        : [...prev, action]
    );
  };

  const hasActiveFilters = filterMoment || filterAgeGroup || filterActions.length > 0 || searchQuery.trim();

  const clearFilters = () => {
    setFilterMoment(null);
    setFilterAgeGroup(null);
    setFilterActions([]);
    setSearchQuery('');
  };

  // --- Preview View ---
  if (previewItem) {
    const p = previewItem.payload || {};
    const summary = p.summary || {};
    const sections = p.sections || [];

    return (
      <>
        <div className="modal-backdrop" onClick={onClose} />
        <div className="fixed top-4 left-4 right-4 bottom-4 md:top-6 md:left-[5%] md:right-[5%] md:bottom-6 overflow-auto bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-6">
          {/* Back button */}
          <button
            onClick={() => setPreviewItem(null)}
            className="text-blue-400 hover:text-blue-300 mb-4 flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to library
          </button>

          {/* Session header */}
          <div className="mb-4 pb-4 border-b border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              {previewItem.moment && (
                <span className="text-2xl">{getMomentEmoji(previewItem.moment)}</span>
              )}
              <h2 className="text-2xl font-bold">{previewItem.name || 'Untitled Session'}</h2>
              {previewItem.ageGroup && (
                <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded-full">
                  {previewItem.ageGroup}
                </span>
              )}
            </div>
            {previewItem.moment && (
              <p className="text-sm text-slate-400 capitalize">{previewItem.moment}</p>
            )}
          </div>

          {/* Summary details */}
          <div className="mb-4 space-y-3">
            {summary.duration && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{summary.duration} min</span>
              </div>
            )}

            {(summary.playerActions?.length > 0 || summary.keyQualities?.length > 0) && (
              <div className="flex flex-wrap gap-1">
                {summary.playerActions?.map((action, i) => (
                  <span key={`a-${i}`} className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded">
                    {action}
                  </span>
                ))}
                {summary.keyQualities?.map((q, i) => (
                  <span key={`q-${i}`} className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded">
                    {q}
                  </span>
                ))}
              </div>
            )}

            {summary.notes && (
              <p className="text-sm text-slate-400">{summary.notes}</p>
            )}
          </div>

          {/* Sections list */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">
              Exercises ({sections.length})
            </h3>
            <div className="space-y-3">
              {sections.map((sec, i) => (
                <div key={i} className="p-3 bg-slate-900/30 border border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-sm">{sec.name || `Exercise ${i + 1}`}</div>
                    <div className="flex items-center gap-2">
                      {sec.time && (
                        <span className="text-xs text-slate-500">{sec.time}</span>
                      )}
                      <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs rounded-full">
                        {sec.type || 'Other'}
                      </span>
                    </div>
                  </div>
                  {sec.objective && (
                    <p className="text-xs text-slate-400 mb-1"><span className="text-slate-500">Objective:</span> {sec.objective}</p>
                  )}
                  {sec.organization && (
                    <p className="text-xs text-slate-400 mb-1"><span className="text-slate-500">Organization:</span> {sec.organization}</p>
                  )}
                  {(() => {
                    const imgSrc = (sec.imageDataUrl && sec.imageDataUrl.trim()) || sec.diagramData?.dataUrl;
                    return imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={sec.name || 'Diagram'}
                        className="mt-2 rounded border border-slate-600 max-h-48 w-auto"
                      />
                    ) : null;
                  })()}
                  {sec.variations?.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {sec.variations.length} variation{sec.variations.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              ))}
              {sections.length === 0 && (
                <p className="text-sm text-slate-500 py-2">No exercises in this session.</p>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex gap-2 pt-4 border-t border-slate-700">
            <button
              onClick={() => {
                onInsert(previewItem.id);
                setPreviewItem(null);
              }}
              className="btn btn-primary"
            >
              Add to Team
            </button>
            <button
              onClick={() => setPreviewItem(null)}
              className="btn btn-subtle"
            >
              Cancel
            </button>
          </div>
        </div>
      </>
    );
  }

  // --- List View ---
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />

      <div className="modal-content">
        {/* Header */}
        <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-700">
          <div>
            <div className="inline-block px-3 py-1 bg-green-600/20 text-green-400 text-xs font-semibold rounded-full mb-2">
              SAVED SESSIONS
            </div>
            <h2 className="text-2xl font-bold">Session Library</h2>
            <p className="text-sm text-slate-400 mt-1">
              Reuse full sessions across teams.
            </p>
          </div>
          <button onClick={onClose} className="btn btn-subtle">
            Close
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-4 pb-4 border-b border-slate-700">
          {/* Moment filter */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Moment</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterMoment(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  !filterMoment
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                All
              </button>
              {MOMENT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterMoment(filterMoment === opt.value ? null : opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filterMoment === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Age group filter */}
          {ageGroups.length > 0 && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Age Group</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterAgeGroup(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    !filterAgeGroup
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  All
                </button>
                {ageGroups.map(ag => (
                  <button
                    key={ag}
                    onClick={() => setFilterAgeGroup(filterAgeGroup === ag ? null : ag)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filterAgeGroup === ag
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {ag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Player action tags */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Player Actions</label>
            <div className="flex flex-wrap gap-1">
              {ALL_PLAYER_ACTIONS.map(action => (
                <button
                  key={action}
                  onClick={() => toggleAction(action)}
                  className={`px-2 py-1 rounded text-xs transition-all ${
                    filterActions.includes(action)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          {/* Text search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, notes, exercises..."
            className="input-field"
          />

          {/* Clear filters */}
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-blue-400 hover:text-blue-300">
              Clear all filters
            </button>
          )}
        </div>

        {/* Session List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 max-h-72 overflow-y-auto scrollbar-thin">
          {filteredItems.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-slate-400">
              {hasActiveFilters
                ? 'No matching sessions found.'
                : 'No saved sessions yet. Use "Save" on any session card.'}
            </div>
          ) : (
            filteredItems.map(item => (
              <div
                key={item.id}
                className="p-4 bg-slate-900/30 border border-slate-700 rounded-lg cursor-pointer hover:border-blue-500 transition-all"
                onClick={() => setPreviewItem(item)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {item.moment && (
                      <span className="text-lg">{getMomentEmoji(item.moment)}</span>
                    )}
                    <div className="font-bold text-sm">{item.name || 'Untitled Session'}</div>
                  </div>
                  {item.ageGroup && (
                    <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs font-semibold rounded-full">
                      {item.ageGroup}
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-400 mb-2">
                  {item.sectionCount} exercise{item.sectionCount !== 1 ? 's' : ''}
                  {' · '}
                  {new Date(item.updatedAt || Date.now()).toLocaleDateString()}
                </div>

                {item.playerActions?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.playerActions.slice(0, 3).map((action, i) => (
                      <span
                        key={i}
                        className="text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded"
                      >
                        {action}
                      </span>
                    ))}
                    {item.playerActions.length > 3 && (
                      <span className="text-xs text-slate-500">
                        +{item.playerActions.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-xs text-blue-400">Click to preview</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${item.name || 'Untitled Session'}" from your library?`)) {
                        onDelete(item.id);
                      }
                    }}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap gap-2 justify-end pt-4 border-t border-slate-700">
          <button onClick={onExport} className="btn btn-subtle text-sm">
            Export JSON
          </button>
          <label className="btn btn-subtle text-sm cursor-pointer">
            Import JSON
            <input
              type="file"
              accept="application/json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button onClick={onClear} className="btn btn-danger text-sm">
            Clear library
          </button>
        </div>
      </div>
    </>
  );
}

import React, { useState, useMemo } from 'react';

export default function LibraryModal({
  isOpen,
  onClose,
  library,
  selectedSectionId,
  insertMode,
  onInsert,
  onOverwrite,
  onDelete,
  onSetInsertMode,
  onExportLibrary,
  onImportLibrary,
  onClearLibrary,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter and sort library items
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return library.items
      .filter(item => {
        if (!query) return true;
        const nameMatch = (item.name || '').toLowerCase().includes(query);
        const typeMatch = (item.type || '').toLowerCase().includes(query);
        return nameMatch || typeMatch;
      })
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [library.items, searchQuery]);

  if (!isOpen) return null;

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportLibrary(file);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose} />

      {/* Modal Content */}
      <div className="modal-content">
        {/* Header */}
        <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-700">
          <div>
            <div className="inline-block px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-semibold rounded-full mb-2">
              LIBRARY
            </div>
            <h2 className="text-2xl font-bold">Saved sections</h2>
            <p className="text-sm text-slate-400 mt-1">
              Insert reusable blocks like "Free Play" and "The Game".
            </p>
          </div>
          <button onClick={onClose} className="btn btn-subtle">
            Close
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 items-end mb-4 pb-4 border-b border-slate-700">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved sections..."
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">Insert as</label>
            <select
              value={insertMode}
              onChange={(e) => onSetInsertMode(e.target.value)}
              className="input-field w-auto"
            >
              <option value="append">Append to end</option>
              <option value="after-selected">After selected section</option>
            </select>
          </div>
        </div>

        {/* Library List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 max-h-96 overflow-y-auto scrollbar-thin">
          {filteredItems.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-slate-400">
              {searchQuery ? 'No matching sections found.' : 'No saved sections yet. Use "Save to Library" on any section.'}
            </div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="p-4 bg-slate-900/30 border border-slate-700 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold">{item.name || 'Untitled'}</div>
                  <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded-full">
                    {(item.type || 'Other').toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mb-3">
                  Updated: {new Date(item.updatedAt || Date.now()).toLocaleString()}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onInsert(item.id)}
                    className="btn btn-primary text-sm"
                  >
                    Insert
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedSectionId) {
                        alert('Select a section first (radio button).');
                        return;
                      }
                      const ok = confirm(`Overwrite "${item.name}" with the selected section?`);
                      if (ok) onOverwrite(item.id);
                    }}
                    className="btn btn-subtle text-sm"
                    title="Re-save this library item using the currently selected section"
                  >
                    Overwrite
                  </button>
                  <button
                    onClick={() => {
                      const ok = confirm(`Delete "${item.name}" from your library?`);
                      if (ok) onDelete(item.id);
                    }}
                    className="btn btn-danger text-sm"
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
          <button onClick={onExportLibrary} className="btn btn-subtle text-sm">
            Export Library JSON
          </button>
          <label className="btn btn-subtle text-sm cursor-pointer">
            Import Library JSON
            <input
              type="file"
              accept="application/json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button onClick={onClearLibrary} className="btn btn-danger text-sm">
            Clear library
          </button>
        </div>
      </div>
    </>
  );
}

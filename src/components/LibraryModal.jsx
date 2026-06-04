import React, { useState, useMemo } from 'react';
import { diagramThumbFromPayload } from '../utils/helpers';

// Library popup for the Session Builder. Lets the coach pick a saved or
// auto-tracked section to Insert / Replace into the current session, or Delete
// (hide auto items, hard-delete manual ones). Callers pass an already-merged
// `items` list (manual + auto) and receive the full item object back so they
// don't have to look it up by id.

export default function LibraryModal({
  isOpen,
  onClose,
  items = [],
  openedFromSectionId,
  insertMode,
  onInsert,
  onReplace,
  onDelete,
  onSetInsertMode,
  onExportLibrary,
  onImportLibrary,
  onClearLibrary,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const uniqueTypes = useMemo(() => {
    const set = new Set();
    for (const item of items) {
      const t = item.type || item.tags?.type;
      if (t) set.add(t);
    }
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items
      .filter(item => {
        if (typeFilter && (item.type || item.tags?.type) !== typeFilter) return false;
        if (!q) return true;
        const name = (item.name || '').toLowerCase();
        const type = (item.type || '').toLowerCase();
        const ageGroup = (item.tags?.ageGroup || '').toLowerCase();
        const moment = (item.tags?.moment || '').toLowerCase();
        return name.includes(q) || type.includes(q) || ageGroup.includes(q) || moment.includes(q);
      })
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [items, searchQuery, typeFilter]);

  if (!isOpen) return null;

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportLibrary(file);
      e.target.value = '';
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="eyebrow mb-1">LIBRARY</div>
            <h2 className="text-[20px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>
              {openedFromSectionId ? 'Replace or insert from library' : 'Insert from library'}
            </h2>
            <p className="text-[12.5px] mt-1" style={{ color: 'var(--ink-2)' }}>
              {openedFromSectionId
                ? 'Replace this section with a saved one, or insert another below.'
                : 'Pick a saved or auto-tracked section to add to this session.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '6px 8px' }}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="hairline mb-4" />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, type, age, moment…"
            className="flex-1 min-w-[200px] rounded-[10px] py-2 px-3 text-[13px] focus:outline-none"
            style={{
              background: 'var(--bg-sunken)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
            }}
          />
          {uniqueTypes.length > 0 && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-[10px] py-2 px-3 text-[13px] focus:outline-none"
              style={{
                background: 'var(--bg-sunken)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
              }}
            >
              <option value="">All types</option>
              {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>Insert</span>
            <select
              value={insertMode}
              onChange={(e) => onSetInsertMode(e.target.value)}
              className="rounded-[10px] py-2 px-3 text-[13px] focus:outline-none"
              style={{
                background: 'var(--bg-sunken)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
              }}
            >
              <option value="append">at the end</option>
              <option value="after-selected">after selected</option>
            </select>
          </div>
        </div>

        {/* List */}
        <div
          className="overflow-y-auto -mx-1 px-1"
          style={{ maxHeight: '50vh' }}
        >
          {filteredItems.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--ink-2)' }}>
              {searchQuery || typeFilter
                ? 'No matching items.'
                : 'No library items yet. Save a section, or it will auto-track once your sessions have content.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredItems.map(item => {
                const isAuto = item.source === 'auto';
                const ageGroup = item.tags?.ageGroup;
                const moment = item.tags?.moment;
                const thumb = diagramThumbFromPayload(item.payload);
                return (
                  <div
                    key={item.id}
                    className="card p-3 flex flex-col gap-2"
                  >
                    {thumb ? (
                      <div
                        className="overflow-hidden rounded-[8px]"
                        style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)', aspectRatio: '16 / 9' }}
                      >
                        <img src={thumb} alt="" className="w-full h-full" style={{ objectFit: 'contain', display: 'block' }} />
                      </div>
                    ) : (
                      <div
                        className="flex items-center justify-center rounded-[8px] text-[10.5px]"
                        style={{ background: 'var(--bg-sunken)', border: '1px dashed var(--line)', aspectRatio: '16 / 9', color: 'var(--ink-3)' }}
                      >
                        No diagram
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold truncate" style={{ letterSpacing: '-0.01em', color: 'var(--ink)' }}>
                          {item.name || 'Untitled'}
                        </div>
                        <div className="text-[11.5px] mt-0.5 flex flex-wrap items-center gap-1" style={{ color: 'var(--ink-3)' }}>
                          {(item.type || item.tags?.type) && (
                            <span
                              className="font-mono uppercase px-1.5 py-0.5 rounded-full"
                              style={{ background: 'var(--bg-sunken)', color: 'var(--ink-2)', fontSize: 10, letterSpacing: '0.06em' }}
                            >
                              {item.type || item.tags?.type}
                            </span>
                          )}
                          {ageGroup && <span>· {ageGroup}</span>}
                          {moment && <span>· {moment}</span>}
                        </div>
                      </div>
                      <span
                        className="font-mono uppercase px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          background: isAuto ? 'var(--bg-sunken)' : 'var(--accent-soft)',
                          color: isAuto ? 'var(--ink-3)' : 'var(--accent)',
                          fontSize: 9.5,
                          letterSpacing: '0.08em',
                        }}
                      >
                        {isAuto ? 'Auto' : 'Saved'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      <button
                        onClick={() => onInsert(item)}
                        className="btn btn-primary"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        Insert
                      </button>
                      {openedFromSectionId && (
                        <button
                          onClick={() => onReplace(item)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          title="Replace the current section with this item"
                        >
                          Replace
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const label = item.name || 'this item';
                          const msg = isAuto
                            ? `Hide "${label}" from the library? It stays in its session.`
                            : `Delete the saved "${label}" from your library?`;
                          if (window.confirm(msg)) onDelete(item);
                        }}
                        className="btn btn-ghost ml-auto"
                        style={{ padding: '4px 8px', fontSize: 12, color: 'var(--danger)' }}
                        title={isAuto ? 'Hide from library' : 'Delete saved entry'}
                      >
                        {isAuto ? 'Hide' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="hairline mt-4 mb-3" />
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button onClick={onExportLibrary} className="btn btn-ghost" style={{ fontSize: 12 }}>
            Export JSON
          </button>
          <label className="btn btn-ghost cursor-pointer" style={{ fontSize: 12 }}>
            Import JSON
            <input
              type="file"
              accept="application/json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          {onClearLibrary && (
            <button onClick={onClearLibrary} className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--danger)' }}>
              Clear saved
            </button>
          )}
        </div>
      </div>
    </>
  );
}

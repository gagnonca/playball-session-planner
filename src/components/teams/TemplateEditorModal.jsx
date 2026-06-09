import React, { useMemo, useState } from 'react';

// Build / edit a session template. A template is just a name + an ordered
// list of library-exercise ids. Picks are preserved in click-order so the
// coach can build "warm-up → rondo → SSG" sequences naturally.
export default function TemplateEditorModal({ template, libraryExercises, onSave, onClose }) {
  const [name, setName] = useState(template?.name || '');
  const [picked, setPicked] = useState(() => Array.from(template?.exerciseIds || []));
  const [filter, setFilter] = useState('');

  const exercisesById = useMemo(() => {
    const m = {};
    for (const ex of libraryExercises || []) m[ex.id] = ex;
    return m;
  }, [libraryExercises]);

  const filteredExercises = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return libraryExercises || [];
    return (libraryExercises || []).filter(ex => {
      const hay = `${ex.name || ''} ${ex.type || ''} ${ex.tags?.moment || ''} ${ex.tags?.ageGroup || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [libraryExercises, filter]);

  const togglePick = (id) => {
    setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const movePick = (idx, delta) => {
    setPicked(prev => {
      const next = [...prev];
      const j = idx + delta;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      window.alert('Give the template a name first.');
      return;
    }
    if (picked.length === 0) {
      if (!window.confirm('Save an empty template? You can add exercises later.')) return;
    }
    onSave({
      id: template?.id,
      name: trimmed,
      exerciseIds: picked,
    });
  };

  const hasLibrary = (libraryExercises || []).length > 0;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="card animate-fade-in w-full max-w-[720px]" style={{ boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}>
          <div className="p-6 pb-4">
            <div className="eyebrow mb-2">{template?.id ? 'EDIT TEMPLATE' : 'NEW TEMPLATE'}</div>
            <h2 className="text-[22px] font-bold leading-tight" style={{ letterSpacing: '-0.02em' }}>
              {template?.id ? 'Edit session template' : 'Build a session template'}
            </h2>
            <p className="text-[13px] mt-1.5" style={{ color: 'var(--ink-2)' }}>
              Pick library exercises in the order you want them. When you create a session from this template,
              each exercise becomes a section pulled fresh from your library.
            </p>
          </div>

          <div className="px-6 pb-3">
            <label className="label-text">Template name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. U10 Tuesday flow"
              className="input-field"
              autoFocus
            />
          </div>

          <div className="px-6 pb-2 flex items-end justify-between gap-3 flex-shrink-0">
            <div>
              <div className="eyebrow" style={{ fontSize: 10.5 }}>SECTIONS</div>
              <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                {picked.length === 0 ? 'No sections picked yet' : `${picked.length} section${picked.length === 1 ? '' : 's'} · in this order`}
              </div>
            </div>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search library…"
              className="input-field"
              style={{ width: 200 }}
            />
          </div>

          <div className="px-6 pb-6 grid grid-cols-2 gap-3 min-h-0" style={{ flex: 1 }}>
            {/* Picked column — ordered list with up/down */}
            <div
              className="rounded-[12px] flex flex-col min-h-0"
              style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}
            >
              <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                <div className="eyebrow" style={{ fontSize: 10 }}>IN TEMPLATE</div>
                {picked.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPicked([])}
                    className="text-[11px]"
                    style={{ background: 'transparent', border: 0, color: 'var(--ink-3)', cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="overflow-y-auto px-2 pb-2" style={{ flex: 1 }}>
                {picked.length === 0 ? (
                  <div className="text-[12.5px] m-2" style={{ color: 'var(--ink-3)' }}>
                    Tap an exercise on the right to add it here.
                  </div>
                ) : (
                  picked.map((id, idx) => {
                    const ex = exercisesById[id];
                    return (
                      <div
                        key={id}
                        className="rounded-[10px] p-2 mb-1.5 flex items-center gap-2"
                        style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}
                      >
                        <div
                          className="font-mono text-[10.5px] flex-shrink-0"
                          style={{ color: 'var(--ink-3)', minWidth: 18, textAlign: 'right' }}
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-semibold truncate" style={{ letterSpacing: '-0.005em' }}>
                            {ex?.name || 'Missing exercise'}
                          </div>
                          <div className="text-[10.5px] truncate" style={{ color: 'var(--ink-3)' }}>
                            {ex ? (ex.type || 'Section') : 'No longer in library'}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => movePick(idx, -1)}
                            disabled={idx === 0}
                            className="btn btn-ghost"
                            style={{ padding: '2px 5px', fontSize: 11 }}
                            title="Move up"
                          >↑</button>
                          <button
                            type="button"
                            onClick={() => movePick(idx, 1)}
                            disabled={idx === picked.length - 1}
                            className="btn btn-ghost"
                            style={{ padding: '2px 5px', fontSize: 11 }}
                            title="Move down"
                          >↓</button>
                          <button
                            type="button"
                            onClick={() => togglePick(id)}
                            className="btn btn-ghost"
                            style={{ padding: '2px 5px', fontSize: 11, color: 'var(--danger)' }}
                            title="Remove"
                          >×</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Library column — checklist */}
            <div
              className="rounded-[12px] flex flex-col min-h-0"
              style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}
            >
              <div className="px-3 pt-3 pb-2 eyebrow" style={{ fontSize: 10 }}>YOUR LIBRARY</div>
              <div className="overflow-y-auto px-2 pb-2" style={{ flex: 1 }}>
                {!hasLibrary ? (
                  <div className="text-[12.5px] m-2" style={{ color: 'var(--ink-3)' }}>
                    No library exercises yet. Save sections to your playbook first.
                  </div>
                ) : filteredExercises.length === 0 ? (
                  <div className="text-[12.5px] m-2" style={{ color: 'var(--ink-3)' }}>
                    No exercises match your search.
                  </div>
                ) : (
                  filteredExercises.map(ex => {
                    const isPicked = picked.includes(ex.id);
                    return (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => togglePick(ex.id)}
                        className="w-full text-left rounded-[10px] p-2 mb-1.5 flex items-center gap-2"
                        style={{
                          background: isPicked ? 'var(--accent-soft)' : 'var(--bg-elev)',
                          border: isPicked ? '1px solid rgb(var(--accent-rgb) / 0.35)' : '1px solid var(--line)',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <span
                          style={{
                            width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: isPicked ? 'var(--accent)' : 'transparent',
                            border: isPicked ? '1px solid var(--accent)' : '1px solid var(--line-2)',
                            color: '#fff',
                          }}
                        >
                          {isPicked && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-semibold truncate" style={{ letterSpacing: '-0.005em' }}>
                            {ex.name || 'Untitled exercise'}
                          </div>
                          <div className="text-[10.5px] truncate" style={{ color: 'var(--ink-3)' }}>
                            {ex.type || 'Section'}
                            {ex.tags?.moment ? ` · ${ex.tags.moment}` : ''}
                            {ex.tags?.ageGroup ? ` · ${ex.tags.ageGroup}` : ''}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-3 flex items-center justify-end gap-2 flex-shrink-0" style={{ background: 'var(--bg-sunken)', borderTop: '1px solid var(--line)', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
            <button onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button onClick={handleSave} className="btn btn-primary">
              {template?.id ? 'Save changes' : 'Create template'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

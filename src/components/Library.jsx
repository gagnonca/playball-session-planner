import React, { useState, useMemo } from 'react';
import {
  libraryPayloadToSection,
  libraryPayloadToSession,
  sectionToLibraryPayload,
  sessionToLibraryPayload,
} from '../utils/helpers';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { LIBRARY_HIDDEN_KEY } from '../constants/storage';
import DiagramLibrary from './DiagramLibrary';

const TABS = ['Sessions', 'Exercises', 'Diagrams'];

export default function Library({ teamsContext, libraryHook, diagramLibrary }) {
  const {
    teamsData,
    selectedTeamId,
    selectedSessionId,
    libraryTab,
    navigateToTeams,
    navigateToSessionBuilder,
    navigateToLibrary,
    createSession,
    updateSession,
    getSession,
    getTeam,
  } = teamsContext;

  const {
    exercises,
    sessions,
    deleteExercise,
    clearExercises,
    deleteSession,
    clearSessions,
    exportLibrary,
    importLibrary,
    setExercisesRaw,
    setSessionsRaw,
  } = libraryHook;

  const teams = teamsData?.teams || [];

  // Insert mode: came from session builder
  const isInsertMode = Boolean(selectedTeamId && selectedSessionId);

  // Active tab — controlled by libraryTab from teamsContext
  const activeTab = libraryTab || 'exercises';

  // Exercise filters
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseTypeFilter, setExerciseTypeFilter] = useState('');
  const [exerciseAgeFilter, setExerciseAgeFilter] = useState('');
  const [exerciseMomentFilter, setExerciseMomentFilter] = useState('');

  // Session filters
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionAgeFilter, setSessionAgeFilter] = useState('');
  const [sessionMomentFilter, setSessionMomentFilter] = useState('');

  // Use-session picker
  const [useSessionItem, setUseSessionItem] = useState(null);
  const [selectedUseTeamId, setSelectedUseTeamId] = useState(teams[0]?.id || '');

  // --- Derived filter options ---

  const manualExerciseItems = exercises?.items || [];
  const manualSessionItems = sessions?.items || [];

  // Ids the coach has hidden from library (auto items only — manuals get hard-deleted).
  const [hiddenIds, setHiddenIds] = useLocalStorage(LIBRARY_HIDDEN_KEY, { exercises: [], sessions: [] });
  const hiddenExerciseSet = useMemo(() => new Set(hiddenIds.exercises || []), [hiddenIds.exercises]);
  const hiddenSessionSet = useMemo(() => new Set(hiddenIds.sessions || []), [hiddenIds.sessions]);
  const hideExerciseId = (id) => setHiddenIds(prev => ({ ...prev, exercises: Array.from(new Set([...(prev.exercises || []), id])) }));
  const hideSessionId = (id) => setHiddenIds(prev => ({ ...prev, sessions: Array.from(new Set([...(prev.sessions || []), id])) }));
  const unhideAllExercises = () => setHiddenIds(prev => ({ ...prev, exercises: [] }));
  const unhideAllSessions = () => setHiddenIds(prev => ({ ...prev, sessions: [] }));

  // Auto-populate: every section across every team's sessions becomes a library item.
  // Keyed by section id. Source-tagged so UI can distinguish from manual saves.
  const autoExerciseItems = useMemo(() => {
    const items = [];
    for (const team of teams) {
      for (const session of (team.sessions || [])) {
        for (const section of (session.sections || [])) {
          items.push({
            id: section.id,
            name: section.name || 'Untitled exercise',
            type: section.type || 'Other',
            tags: {
              type: section.type || '',
              ageGroup: session.summary?.ageGroup || '',
              moment: session.summary?.moment || '',
            },
            payload: sectionToLibraryPayload(section),
            updatedAt: session.updatedAt || team.updatedAt || '',
            source: 'auto',
            origin: { teamId: team.id, sessionId: session.id, sessionTitle: session.summary?.title || '' },
          });
        }
      }
    }
    return items;
  }, [teams]);

  const autoSessionItems = useMemo(() => {
    const items = [];
    for (const team of teams) {
      for (const session of (team.sessions || [])) {
        items.push({
          id: session.id,
          name: session.summary?.title || 'Untitled session',
          tags: {
            ageGroup: session.summary?.ageGroup || '',
            moment: session.summary?.moment || '',
            duration: session.summary?.duration || '',
          },
          payload: sessionToLibraryPayload(session),
          updatedAt: session.updatedAt || '',
          source: 'auto',
          origin: { teamId: team.id, teamName: team.name, sessionId: session.id },
        });
      }
    }
    return items;
  }, [teams]);

  // Merge manual + auto, preferring manual (explicit user save) when ids collide.
  // Hidden ids are filtered out — their underlying section/session still lives on the team.
  const exerciseItems = useMemo(() => {
    const byId = new Map();
    for (const item of autoExerciseItems) byId.set(item.id, item);
    for (const item of manualExerciseItems) byId.set(item.id, { ...item, source: 'manual' });
    return Array.from(byId.values()).filter(i => !hiddenExerciseSet.has(i.id));
  }, [manualExerciseItems, autoExerciseItems, hiddenExerciseSet]);

  const sessionItems = useMemo(() => {
    const byId = new Map();
    for (const item of autoSessionItems) byId.set(item.id, item);
    for (const item of manualSessionItems) byId.set(item.id, { ...item, source: 'manual' });
    return Array.from(byId.values()).filter(i => !hiddenSessionSet.has(i.id));
  }, [manualSessionItems, autoSessionItems, hiddenSessionSet]);

  const uniqueExerciseAgeGroups = useMemo(() =>
    [...new Set(exerciseItems.map(x => x.tags?.ageGroup).filter(Boolean))],
    [exerciseItems]
  );
  const uniqueExerciseMoments = useMemo(() =>
    [...new Set(exerciseItems.map(x => x.tags?.moment).filter(Boolean))],
    [exerciseItems]
  );
  const uniqueExerciseTypes = useMemo(() =>
    [...new Set(exerciseItems.map(x => x.type || x.tags?.type).filter(Boolean))],
    [exerciseItems]
  );

  const uniqueSessionAgeGroups = useMemo(() =>
    [...new Set(sessionItems.map(x => x.tags?.ageGroup).filter(Boolean))],
    [sessionItems]
  );
  const uniqueSessionMoments = useMemo(() =>
    [...new Set(sessionItems.map(x => x.tags?.moment).filter(Boolean))],
    [sessionItems]
  );

  // --- Filtered lists ---

  // Group items by lowercased name into versions[]. Items without a real name
  // are filtered out — untitled/scratch work stays private.
  const groupByName = (items) => {
    const groups = new Map();
    for (const item of items) {
      const name = (item.name || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!groups.has(key)) groups.set(key, { key, name, versions: [] });
      groups.get(key).versions.push(item);
    }
    // Sort versions newest first and pick a representative for the card
    const result = [];
    for (const g of groups.values()) {
      g.versions.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      const rep = g.versions[0];
      result.push({
        ...g,
        rep,
        latestUpdatedAt: rep.updatedAt || '',
      });
    }
    return result;
  };

  const filteredExerciseGroups = useMemo(() => {
    const q = exerciseSearch.toLowerCase();
    return groupByName(exerciseItems)
      .filter(g => {
        const matchSearch = !q || g.name.toLowerCase().includes(q);
        // Group matches a tag filter if ANY version matches (so expanded preview shows why)
        const matchType = !exerciseTypeFilter || g.versions.some(v => (v.type || '') === exerciseTypeFilter);
        const matchAge = !exerciseAgeFilter || g.versions.some(v => (v.tags?.ageGroup || '') === exerciseAgeFilter);
        const matchMoment = !exerciseMomentFilter || g.versions.some(v => (v.tags?.moment || '') === exerciseMomentFilter);
        return matchSearch && matchType && matchAge && matchMoment;
      })
      .sort((a, b) => (b.latestUpdatedAt || '').localeCompare(a.latestUpdatedAt || ''));
  }, [exerciseItems, exerciseSearch, exerciseTypeFilter, exerciseAgeFilter, exerciseMomentFilter]);

  const filteredSessionGroups = useMemo(() => {
    const q = sessionSearch.toLowerCase();
    return groupByName(sessionItems)
      .filter(g => {
        const matchSearch = !q || g.name.toLowerCase().includes(q);
        const matchAge = !sessionAgeFilter || g.versions.some(v => (v.tags?.ageGroup || '') === sessionAgeFilter);
        const matchMoment = !sessionMomentFilter || g.versions.some(v => (v.tags?.moment || '') === sessionMomentFilter);
        return matchSearch && matchAge && matchMoment;
      })
      .sort((a, b) => (b.latestUpdatedAt || '').localeCompare(a.latestUpdatedAt || ''));
  }, [sessionItems, sessionSearch, sessionAgeFilter, sessionMomentFilter]);

  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const toggleGroup = (key) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const getDiagramThumb = (payload) => {
    if (!payload) return '';
    if (payload.imageDataUrl) return payload.imageDataUrl;
    if (payload.diagramData?.dataUrl) return payload.diagramData.dataUrl;
    return '';
  };

  const getTeamName = (teamId) => teams.find(t => t.id === teamId)?.name || '';

  // Remove a version from the library view.
  // - manual: hard-delete the saved library entry
  // - auto: hide from library only; source section/session stays on the team
  const removeExerciseVersion = (v, groupName) => {
    const label = groupName || v.name || 'this version';
    if (v.source === 'manual') {
      if (!confirm(`Delete this saved version of "${label}"?`)) return;
      deleteExercise(v.id);
      return;
    }
    if (!confirm(`Hide "${label}" from your library? It will stay in its session — this just removes it from the library view.`)) return;
    hideExerciseId(v.id);
  };

  const removeSessionVersion = (v, groupName) => {
    const label = groupName || v.name || 'this version';
    if (v.source === 'manual') {
      if (!confirm(`Delete this saved version of "${label}"?`)) return;
      deleteSession(v.id);
      return;
    }
    if (!confirm(`Hide "${label}" from your library? The session itself stays on its team — this just removes it from the library view.`)) return;
    hideSessionId(v.id);
  };

  // --- Cleanup: dedupe manual items by name, drop manuals redundant with auto items ---

  const dedupeManualItems = (manualItems, autoItems) => {
    const autoNames = new Set(autoItems.map(i => (i.name || '').trim().toLowerCase()));
    // First: collapse same-name manual items, keeping newest updatedAt
    const bestByName = new Map();
    for (const item of manualItems) {
      const key = (item.name || '').trim().toLowerCase();
      const prev = bestByName.get(key);
      if (!prev || (item.updatedAt || '') > (prev.updatedAt || '')) bestByName.set(key, item);
    }
    // Then: drop any manual whose name matches an auto item (auto is the live version)
    return Array.from(bestByName.entries())
      .filter(([key]) => !autoNames.has(key))
      .map(([, item]) => item);
  };

  const handleCleanupExercises = () => {
    const cleaned = dedupeManualItems(manualExerciseItems, autoExerciseItems);
    const removed = manualExerciseItems.length - cleaned.length;
    if (removed === 0) {
      alert('No duplicates found.');
      return;
    }
    if (!confirm(`Remove ${removed} duplicate exercise${removed === 1 ? '' : 's'} from your saved library?`)) return;
    setExercisesRaw(prev => ({ ...prev, items: cleaned }));
  };

  const handleCleanupSessions = () => {
    const cleaned = dedupeManualItems(manualSessionItems, autoSessionItems);
    const removed = manualSessionItems.length - cleaned.length;
    if (removed === 0) {
      alert('No duplicates found.');
      return;
    }
    if (!confirm(`Remove ${removed} duplicate session${removed === 1 ? '' : 's'} from your saved library?`)) return;
    setSessionsRaw(prev => ({ ...prev, items: cleaned }));
  };

  // --- Handlers ---

  const handleTabChange = (tab) => {
    navigateToLibrary(tab.toLowerCase());
  };

  const handleBack = () => {
    if (isInsertMode) {
      navigateToSessionBuilder(selectedTeamId, selectedSessionId);
    } else {
      navigateToTeams();
    }
  };

  const handleInsertExercise = (item) => {
    if (!isInsertMode) return;
    const session = getSession(selectedTeamId, selectedSessionId);
    if (!session) return;
    const newSection = libraryPayloadToSection(item.payload, item.id);
    updateSession(selectedTeamId, selectedSessionId, {
      sections: [...session.sections, newSection],
    });
    navigateToSessionBuilder(selectedTeamId, selectedSessionId);
  };

  const handleUseSession = (item) => {
    setUseSessionItem(item);
    setSelectedUseTeamId(teams[0]?.id || '');
  };

  const handleConfirmUseSession = () => {
    if (!useSessionItem || !selectedUseTeamId) return;
    const team = getTeam(selectedUseTeamId);
    const teamDefaults = team ? { ageGroup: team.ageGroup, defaultDuration: team.defaultDuration } : null;
    // Sessions mint a new id when instantiated on a team — a team can hold multiple
    // copies of a library session template, and per-team session ids must be unique.
    // Sections inside preserve their library exercise ids via libraryPayloadToSession.
    const newSession = libraryPayloadToSession(useSessionItem.payload, teamDefaults);
    createSession(selectedUseTeamId, newSession);
    setUseSessionItem(null);
    navigateToSessionBuilder(selectedUseTeamId, newSession.id);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importLibrary(file)
      .then(() => alert('Library imported successfully.'))
      .catch(() => alert('Could not read library file.'));
    e.target.value = '';
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Map tab key → display label
  const activeTabLabel = activeTab === 'sessions' ? 'Sessions'
    : activeTab === 'diagrams' ? 'Diagrams'
    : 'Exercises';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="text-slate-400 hover:text-slate-200 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold">Library</h1>
              {isInsertMode && (
                <p className="text-sm text-slate-400">Select an item to insert</p>
              )}
            </div>
          </div>

          {/* Export / Import */}
          <div className="flex items-center gap-2">
            <button onClick={exportLibrary} className="btn btn-subtle text-sm">Export</button>
            <label className="btn btn-subtle text-sm cursor-pointer">
              Import
              <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="max-w-6xl mx-auto mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab.toLowerCase() === activeTabLabel.toLowerCase()
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {activeTabLabel === 'Diagrams' && (
            <button
              onClick={() => teamsContext.navigateToEditLibraryDiagram(null)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              + New Diagram
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* ===== EXERCISES TAB ===== */}
        {activeTabLabel === 'Exercises' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <input
                type="text"
                placeholder="Search exercises..."
                value={exerciseSearch}
                onChange={e => setExerciseSearch(e.target.value)}
                className="flex-1 min-w-[180px] max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {uniqueExerciseTypes.length > 0 && (
                <select value={exerciseTypeFilter} onChange={e => setExerciseTypeFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
                  <option value="">All Types</option>
                  {uniqueExerciseTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              {uniqueExerciseAgeGroups.length > 0 && (
                <select value={exerciseAgeFilter} onChange={e => setExerciseAgeFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
                  <option value="">All Ages</option>
                  {uniqueExerciseAgeGroups.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              {uniqueExerciseMoments.length > 0 && (
                <select value={exerciseMomentFilter} onChange={e => setExerciseMomentFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
                  <option value="">All Moments</option>
                  {uniqueExerciseMoments.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
              {(exerciseTypeFilter || exerciseAgeFilter || exerciseMomentFilter) && (
                <button
                  onClick={() => { setExerciseTypeFilter(''); setExerciseAgeFilter(''); setExerciseMomentFilter(''); }}
                  className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200">
                  Clear filters
                </button>
              )}
            </div>

            {filteredExerciseGroups.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                {exerciseSearch || exerciseTypeFilter || exerciseAgeFilter || exerciseMomentFilter
                  ? 'No exercises match your filters.'
                  : 'No exercises yet. Name a section in a session and it will appear here automatically.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredExerciseGroups.map(group => {
                  const rep = group.rep;
                  const isMulti = group.versions.length > 1;
                  const isOpen = expandedGroups.has(group.key);
                  return (
                    <div key={group.key} className={`bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-3 ${isMulti && isOpen ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="font-semibold truncate">{group.name}</div>
                          {isMulti && (
                            <span className="shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-700 text-slate-300">
                              {group.versions.length} versions
                            </span>
                          )}
                        </div>
                        {rep.type && (
                          <span className={`shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full ${
                            rep.type === 'Play' ? 'bg-blue-600/30 text-blue-300' : 'bg-green-600/30 text-green-300'
                          }`}>
                            {rep.type.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {(rep.tags?.ageGroup || rep.tags?.moment) && (
                        <div className="flex flex-wrap gap-1">
                          {rep.tags?.ageGroup && (
                            <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">{rep.tags.ageGroup}</span>
                          )}
                          {rep.tags?.moment && (
                            <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 text-xs rounded">{rep.tags.moment}</span>
                          )}
                        </div>
                      )}

                      {rep.payload?.objective && !isOpen && (
                        <p className="text-xs text-slate-400 line-clamp-2">{rep.payload.objective}</p>
                      )}

                      <div className="text-xs text-slate-500">Updated {formatDate(group.latestUpdatedAt)}</div>

                      {isMulti && isOpen && (
                        <div className="flex flex-col gap-3 pt-2 border-t border-slate-700">
                          {group.versions.map(v => {
                            const thumb = getDiagramThumb(v.payload);
                            const teamName = v.origin?.teamId ? getTeamName(v.origin.teamId) : '';
                            const sessionTitle = v.origin?.sessionTitle || '';
                            return (
                              <div key={v.id} className="flex gap-3 p-3 bg-slate-900/60 rounded-lg border border-slate-700/60">
                                {thumb && (
                                  <img src={thumb} alt="" className="w-20 h-20 object-cover rounded border border-slate-700 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0 flex flex-col gap-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-xs text-slate-500">
                                      {formatDate(v.updatedAt)}
                                      {(teamName || sessionTitle) && (
                                        <> · <span className="text-slate-400">{teamName}{sessionTitle ? ` / ${sessionTitle}` : ''}</span></>
                                      )}
                                    </div>
                                    {v.source === 'manual' && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-600/30 text-amber-300 rounded">SAVED</span>
                                    )}
                                  </div>
                                  {v.payload?.objective && (
                                    <p className="text-xs text-slate-300 line-clamp-2">{v.payload.objective}</p>
                                  )}
                                  {v.payload?.notes && (
                                    <p className="text-xs text-slate-500 line-clamp-1"><span className="text-slate-600">Notes: </span>{v.payload.notes}</p>
                                  )}
                                  <div className="flex gap-2 mt-1">
                                    {isInsertMode && (
                                      <button
                                        onClick={() => handleInsertExercise(v)}
                                        className="btn btn-primary text-xs"
                                      >
                                        Insert
                                      </button>
                                    )}
                                    {v.origin?.teamId && v.origin?.sessionId && (
                                      <button
                                        onClick={() => navigateToSessionBuilder(v.origin.teamId, v.origin.sessionId)}
                                        className="btn btn-subtle text-xs"
                                      >
                                        Open in session
                                      </button>
                                    )}
                                    <button
                                      onClick={() => removeExerciseVersion(v, group.name)}
                                      className="btn btn-danger text-xs ml-auto"
                                    >
                                      {v.source === 'manual' ? 'Delete' : 'Hide'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex gap-2 mt-auto">
                        {isInsertMode && !isOpen && (
                          <button
                            onClick={() => handleInsertExercise(rep)}
                            className="flex-1 btn btn-primary text-sm"
                          >
                            Insert
                          </button>
                        )}
                        {isMulti && (
                          <button
                            onClick={() => toggleGroup(group.key)}
                            className="btn btn-subtle text-sm"
                          >
                            {isOpen ? 'Hide versions' : 'Compare versions'}
                          </button>
                        )}
                        {!isMulti && (
                          <button
                            onClick={() => removeExerciseVersion(rep, group.name)}
                            className="btn btn-danger text-sm"
                            title={rep.source === 'manual' ? 'Delete' : 'Hide from library'}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(manualExerciseItems.length > 0 || hiddenExerciseSet.size > 0) && (
              <div className="mt-8 flex justify-center gap-3 flex-wrap">
                {manualExerciseItems.length > 0 && (
                  <>
                    <button
                      onClick={handleCleanupExercises}
                      className="btn btn-subtle text-sm"
                      title="Remove duplicate saved exercises"
                    >
                      Clean up duplicates
                    </button>
                    <button
                      onClick={() => { if (confirm('Reset exercises to starter items?')) clearExercises(); }}
                      className="btn btn-subtle text-sm text-slate-500"
                    >
                      Clear exercises
                    </button>
                  </>
                )}
                {hiddenExerciseSet.size > 0 && (
                  <button
                    onClick={unhideAllExercises}
                    className="btn btn-subtle text-sm text-slate-400"
                    title="Show previously hidden exercises"
                  >
                    Unhide {hiddenExerciseSet.size} hidden
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* ===== DIAGRAMS TAB ===== */}
        {activeTabLabel === 'Diagrams' && diagramLibrary && (
          <DiagramLibrary
            teamsContext={teamsContext}
            diagramLibrary={diagramLibrary}
            embedded
          />
        )}

        {/* ===== SESSIONS TAB ===== */}
        {activeTabLabel === 'Sessions' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <input
                type="text"
                placeholder="Search sessions..."
                value={sessionSearch}
                onChange={e => setSessionSearch(e.target.value)}
                className="flex-1 min-w-[180px] max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {uniqueSessionAgeGroups.length > 0 && (
                <select value={sessionAgeFilter} onChange={e => setSessionAgeFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
                  <option value="">All Ages</option>
                  {uniqueSessionAgeGroups.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              {uniqueSessionMoments.length > 0 && (
                <select value={sessionMomentFilter} onChange={e => setSessionMomentFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500">
                  <option value="">All Moments</option>
                  {uniqueSessionMoments.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
              {(sessionAgeFilter || sessionMomentFilter) && (
                <button
                  onClick={() => { setSessionAgeFilter(''); setSessionMomentFilter(''); }}
                  className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200">
                  Clear filters
                </button>
              )}
            </div>

            {filteredSessionGroups.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                {sessionSearch || sessionAgeFilter || sessionMomentFilter
                  ? 'No sessions match your filters.'
                  : 'No sessions yet. Give a session a title and it will appear here automatically.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSessionGroups.map(group => {
                  const rep = group.rep;
                  const isMulti = group.versions.length > 1;
                  const groupKey = `sess:${group.key}`;
                  const isOpen = expandedGroups.has(groupKey);
                  return (
                    <div key={groupKey} className={`bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-3 ${isMulti && isOpen ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold truncate">{group.name}</div>
                        {isMulti && (
                          <span className="shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-700 text-slate-300">
                            {group.versions.length} versions
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {rep.tags?.ageGroup && (
                          <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">{rep.tags.ageGroup}</span>
                        )}
                        {rep.tags?.moment && (
                          <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 text-xs rounded">{rep.tags.moment}</span>
                        )}
                        {rep.tags?.duration && (
                          <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs rounded">{rep.tags.duration} min</span>
                        )}
                      </div>

                      {rep.payload?.sections?.length > 0 && !isOpen && (
                        <p className="text-xs text-slate-400">
                          {rep.payload.sections.length} exercise{rep.payload.sections.length !== 1 ? 's' : ''}
                        </p>
                      )}

                      <div className="text-xs text-slate-500">Updated {formatDate(group.latestUpdatedAt)}</div>

                      {isMulti && isOpen && (
                        <div className="flex flex-col gap-3 pt-2 border-t border-slate-700">
                          {group.versions.map(v => {
                            const teamName = v.origin?.teamName || (v.origin?.teamId ? getTeamName(v.origin.teamId) : '');
                            const sectionCount = v.payload?.sections?.length || 0;
                            const firstObjective = v.payload?.sections?.find(s => s.objective)?.objective || '';
                            return (
                              <div key={v.id} className="flex flex-col gap-1 p-3 bg-slate-900/60 rounded-lg border border-slate-700/60">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-xs text-slate-500">
                                    {formatDate(v.updatedAt)}
                                    {teamName && <> · <span className="text-slate-400">{teamName}</span></>}
                                  </div>
                                  {v.source === 'manual' && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-600/30 text-amber-300 rounded">SAVED</span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400">
                                  {sectionCount} exercise{sectionCount !== 1 ? 's' : ''}
                                </p>
                                {firstObjective && (
                                  <p className="text-xs text-slate-300 line-clamp-2">{firstObjective}</p>
                                )}
                                <div className="flex gap-2 mt-1">
                                  <button
                                    onClick={() => handleUseSession(v)}
                                    className="btn btn-primary text-xs"
                                  >
                                    Use Session
                                  </button>
                                  {v.origin?.teamId && v.origin?.sessionId && (
                                    <button
                                      onClick={() => navigateToSessionBuilder(v.origin.teamId, v.origin.sessionId)}
                                      className="btn btn-subtle text-xs"
                                    >
                                      Open
                                    </button>
                                  )}
                                  <button
                                    onClick={() => removeSessionVersion(v, group.name)}
                                    className="btn btn-danger text-xs ml-auto"
                                  >
                                    {v.source === 'manual' ? 'Delete' : 'Hide'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex gap-2 mt-auto">
                        {!isOpen && (
                          <button
                            onClick={() => handleUseSession(rep)}
                            className="flex-1 btn btn-primary text-sm"
                          >
                            Use Session
                          </button>
                        )}
                        {isMulti && (
                          <button
                            onClick={() => toggleGroup(groupKey)}
                            className="btn btn-subtle text-sm"
                          >
                            {isOpen ? 'Hide versions' : 'Compare versions'}
                          </button>
                        )}
                        {!isMulti && (
                          <button
                            onClick={() => removeSessionVersion(rep, group.name)}
                            className="btn btn-danger text-sm"
                            title={rep.source === 'manual' ? 'Delete' : 'Hide from library'}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(manualSessionItems.length > 0 || hiddenSessionSet.size > 0) && (
              <div className="mt-8 flex justify-center gap-3 flex-wrap">
                {manualSessionItems.length > 0 && (
                  <>
                    <button
                      onClick={handleCleanupSessions}
                      className="btn btn-subtle text-sm"
                      title="Remove duplicate saved sessions"
                    >
                      Clean up duplicates
                    </button>
                    <button
                      onClick={() => { if (confirm('Clear all saved sessions?')) clearSessions(); }}
                      className="btn btn-subtle text-sm text-slate-500"
                    >
                      Clear sessions
                    </button>
                  </>
                )}
                {hiddenSessionSet.size > 0 && (
                  <button
                    onClick={unhideAllSessions}
                    className="btn btn-subtle text-sm text-slate-400"
                    title="Show previously hidden sessions"
                  >
                    Unhide {hiddenSessionSet.size} hidden
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Use Session → Pick Team Modal */}
      {useSessionItem && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setUseSessionItem(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
              <h2 className="text-lg font-bold mb-1">Use "{useSessionItem.name}"</h2>
              <p className="text-sm text-slate-400 mb-4">Which team should this session be added to?</p>
              {teams.length === 0 ? (
                <p className="text-slate-400 text-sm">No teams yet. Create a team first.</p>
              ) : (
                <>
                  <select
                    value={selectedUseTeamId}
                    onChange={e => setSelectedUseTeamId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 mb-4"
                  >
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}{t.ageGroup ? ` (${t.ageGroup})` : ''}</option>
                    ))}
                  </select>
                  <div className="flex gap-3">
                    <button onClick={() => setUseSessionItem(null)} className="flex-1 btn btn-subtle">Cancel</button>
                    <button onClick={handleConfirmUseSession} className="flex-1 btn btn-primary">Add to Team</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

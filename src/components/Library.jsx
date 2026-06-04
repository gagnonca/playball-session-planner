import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  libraryPayloadToSection,
  libraryPayloadToSession,
  sectionToLibraryPayload,
  sessionToLibraryPayload,
  toast,
} from '../utils/helpers';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { LIBRARY_HIDDEN_KEY, LIBRARY_PINS_KEY } from '../constants/storage';
import DiagramLibrary from './DiagramLibrary';
import FilterChipGroup from './FilterChipGroup';
import SharePopover from './session-builder/SharePopover';
import ShareModal from './teams/ShareModal';

const TABS = ['Sessions', 'Exercises', 'Diagrams', 'Community'];

// --- Shared visual widgets ---------------------------------------------------

function SyncDot({ synced }) {
  return (
    <span
      title={synced ? 'Synced to your devices' : 'On this device only'}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: synced ? 'var(--good)' : 'var(--ink-3)',
        opacity: synced ? 1 : 0.45,
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  );
}

function PinButton({ pinned, onToggle, size = 'md' }) {
  const dim = size === 'sm' ? 26 : 30;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      title={pinned ? 'Pinned to top' : 'Pin to top'}
      aria-pressed={pinned}
      style={{
        width: dim,
        height: dim,
        borderRadius: 7,
        border: '1px solid',
        borderColor: pinned ? 'var(--accent)' : 'var(--line)',
        background: pinned ? 'var(--accent-soft)' : 'var(--bg-elev)',
        color: pinned ? 'var(--accent)' : 'var(--ink-3)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background-color 150ms, border-color 150ms, color 150ms',
      }}
    >
      <svg width={size === 'sm' ? 12 : 14} height={size === 'sm' ? 12 : 14} viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 4h6v6l3 3v2H6v-2l3-3z" />
        <path d="M12 15v6" />
      </svg>
    </button>
  );
}

const SHARE_META = {
  private:  { label: 'Private',     color: 'var(--ink-3)', icon: 'lock' },
  coaches:  { label: 'Co-coaches',  color: 'var(--accent)', icon: 'users' },
  public:   { label: 'Public',      color: 'var(--good)', icon: 'globe' },
};

function ShareTagIcon({ icon }) {
  if (icon === 'lock') return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
  if (icon === 'users') return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-3-3.87M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a13 13 0 010 18M12 3a13 13 0 000 18" />
    </svg>
  );
}

function ShareTag({ share = 'private', compact }) {
  const meta = SHARE_META[share] || SHARE_META.private;
  return (
    <span
      title={meta.label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: meta.color }}
    >
      <ShareTagIcon icon={meta.icon} />
      {!compact && meta.label}
    </span>
  );
}

// Clickable per-item share editor. Opens SharePopover anchored to the chip.
// Sharing scope is per-team in the data model, so the popover mutates the
// row's source team. Read-only fallback (no editing) is returned for items
// without a known team (e.g. manual library entries with no origin).
function ShareControl({ team, sharingContext, syncContext, onOpenShareModal, onShowLinkDevice, hasAccount = false, compact }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  const editable = Boolean(team && sharingContext);
  const share = team?.sharing?.isShared ? 'coaches' : 'private';
  const meta = SHARE_META[share] || SHARE_META.private;
  const syncEnabled = Boolean(syncContext?.isSyncEnabled);

  if (!editable) return <ShareTag share={share} compact={compact} />;

  const handleMakePrivate = async () => {
    setOpen(false);
    if (!team?.sharing?.shareToken) return;
    if (!window.confirm(`Stop sharing ${team.name}? Co-coaches with the link will lose access.`)) return;
    try {
      await sharingContext.revokeShare(team.sharing.shareToken);
      toast('Sharing turned off');
    } catch {
      toast('Could not revoke share');
    }
  };

  const handleMakeCoCoaches = () => {
    setOpen(false);
    if (!syncEnabled) {
      onShowLinkDevice?.();
      return;
    }
    onOpenShareModal?.(team);
  };

  return (
    <span className="relative inline-flex">
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="inline-flex items-center gap-1 rounded-[6px] transition-colors"
        style={{
          padding: '2px 6px',
          margin: '-2px -6px',
          background: 'transparent',
          border: 'none',
          fontSize: 11.5,
          color: meta.color,
          cursor: 'pointer',
        }}
        title={`${meta.label} — click to change`}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.05)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <ShareTagIcon icon={meta.icon} />
        {!compact && meta.label}
      </button>
      <SharePopover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        current={share}
        syncEnabled={syncEnabled}
        hasAccount={hasAccount}
        exerciseCount={team?.sessions?.reduce((sum, s) => sum + (s.sections?.length || 0), 0) || 0}
        diagramCount={team?.sessions?.reduce((sum, s) => sum + (s.sections?.reduce((dc, sec) => dc + (sec.diagramData || sec.imageDataUrl ? 1 : 0), 0) || 0), 0) || 0}
        onMakePrivate={handleMakePrivate}
        onMakeCoCoaches={handleMakeCoCoaches}
        onTurnOnSync={() => { setOpen(false); onShowLinkDevice?.(); }}
      />
    </span>
  );
}

export default function Library({ teamsContext, libraryHook, diagramLibrary, syncContext, sharingContext, isSignedIn = false, hasAccount = false, onShowSignIn, onShowLinkDevice }) {
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

  // Pinned items — keyed by group key (lowercased name) for sessions/exercises
  // and by raw item id for diagrams. Persists across sessions in localStorage.
  const [pins, setPins] = useLocalStorage(LIBRARY_PINS_KEY, { sessions: [], exercises: [], diagrams: [] });
  const exercisePinSet = useMemo(() => new Set(pins.exercises || []), [pins.exercises]);
  const sessionPinSet = useMemo(() => new Set(pins.sessions || []), [pins.sessions]);
  const togglePin = useCallback((kind, key) => {
    setPins(prev => {
      const list = prev[kind] || [];
      const has = list.includes(key);
      const next = has ? list.filter(k => k !== key) : [...list, key];
      return { ...prev, [kind]: next };
    });
  }, [setPins]);

  // Sync awareness — drives the per-item green/gray dot and the auto-save copy.
  const syncOn = Boolean(syncContext?.isSyncEnabled);
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
      .map(g => ({ ...g, pinned: exercisePinSet.has(g.key) }))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.latestUpdatedAt || '').localeCompare(a.latestUpdatedAt || '');
      });
  }, [exerciseItems, exerciseSearch, exerciseTypeFilter, exerciseAgeFilter, exerciseMomentFilter, exercisePinSet]);

  const filteredSessionGroups = useMemo(() => {
    const q = sessionSearch.toLowerCase();
    return groupByName(sessionItems)
      .filter(g => {
        const matchSearch = !q || g.name.toLowerCase().includes(q);
        const matchAge = !sessionAgeFilter || g.versions.some(v => (v.tags?.ageGroup || '') === sessionAgeFilter);
        const matchMoment = !sessionMomentFilter || g.versions.some(v => (v.tags?.moment || '') === sessionMomentFilter);
        return matchSearch && matchAge && matchMoment;
      })
      .map(g => ({ ...g, pinned: sessionPinSet.has(g.key) }))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.latestUpdatedAt || '').localeCompare(a.latestUpdatedAt || '');
      });
  }, [sessionItems, sessionSearch, sessionAgeFilter, sessionMomentFilter, sessionPinSet]);

  // Counts shown in the tab bar pills
  const tabCounts = useMemo(() => ({
    sessions: filteredSessionGroups.length,
    exercises: filteredExerciseGroups.length,
    diagrams: diagramLibrary?.diagrams?.length || 0,
    community: 0,
  }), [filteredSessionGroups.length, filteredExerciseGroups.length, diagramLibrary?.diagrams?.length]);

  // Team-scoped share editing — opens the existing ShareModal at the page level.
  const [shareModalTeam, setShareModalTeam] = useState(null);
  const handleOpenShareModal = useCallback((team) => setShareModalTeam(team), []);

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
    // Many drills keep their diagram on a variation (progressions), not the
    // section itself — fall back to the first variation that has one.
    for (const v of payload.variations || []) {
      if (v?.imageDataUrl) return v.imageDataUrl;
      if (v?.diagramData?.dataUrl) return v.diagramData.dataUrl;
    }
    return '';
  };

  // Pull a thumbnail off a session payload. Practice section is the
  // distinguishing drill, so look there first; otherwise fall back to the
  // first section that has any image.
  const getSessionThumb = (payload) => {
    const sections = payload?.sections || [];
    const practice = sections.find(s => (s?.type || '').toLowerCase() === 'practice' && getDiagramThumb(s));
    if (practice) return getDiagramThumb(practice);
    const firstWithImg = sections.find(s => getDiagramThumb(s));
    return firstWithImg ? getDiagramThumb(firstWithImg) : '';
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

  // --- Consolidate duplicates: copy one "master" version's full content into the
  // matching section of other sessions, so a dozen near-identical exercises become
  // identical. Targets are addressed by their session origin, never deleted. ---

  // Unique handle for a version even if two sessions happen to share a section id.
  const versionKey = (v) =>
    v.origin?.teamId && v.origin?.sessionId
      ? `${v.origin.teamId}:${v.origin.sessionId}:${v.id}`
      : `manual:${v.id}`;

  // { groupKey, masterKey, targetKeys: Set<string> } | null
  const [consolidate, setConsolidate] = useState(null);

  const startConsolidate = (group) => {
    const masterKey = versionKey(group.rep);
    // Default: select every other version that lives in a session.
    const targetKeys = new Set(
      group.versions
        .filter(v => versionKey(v) !== masterKey && v.origin?.teamId && v.origin?.sessionId)
        .map(versionKey)
    );
    setConsolidate({ groupKey: group.key, masterKey, targetKeys });
    setExpandedGroups(prev => new Set(prev).add(group.key));
  };

  const cancelConsolidate = () => setConsolidate(null);

  const setMaster = (key) => setConsolidate(c => {
    if (!c) return c;
    const targetKeys = new Set(c.targetKeys);
    targetKeys.delete(key); // a version can't be both master and a target
    return { ...c, masterKey: key, targetKeys };
  });

  const toggleTarget = (key) => setConsolidate(c => {
    if (!c) return c;
    const targetKeys = new Set(c.targetKeys);
    if (targetKeys.has(key)) targetKeys.delete(key); else targetKeys.add(key);
    return { ...c, targetKeys };
  });

  const applyConsolidate = (group) => {
    if (!consolidate || consolidate.groupKey !== group.key) return;
    const master = group.versions.find(v => versionKey(v) === consolidate.masterKey);
    if (!master?.payload) { toast('Pick a master version first'); return; }
    const targets = group.versions.filter(
      v => consolidate.targetKeys.has(versionKey(v)) && v.origin?.teamId && v.origin?.sessionId
    );
    if (targets.length === 0) { toast('Check at least one session to overwrite'); return; }

    if (!window.confirm(
      `Copy this "${group.name}" into ${targets.length} other session${targets.length === 1 ? '' : 's'}? ` +
      `Their diagram, objective, notes, and variations will be overwritten to match. This can't be undone.`
    )) return;

    // Group targets by session so each session is written exactly once.
    const bySession = new Map();
    for (const t of targets) {
      const k = `${t.origin.teamId}::${t.origin.sessionId}`;
      if (!bySession.has(k)) bySession.set(k, { teamId: t.origin.teamId, sessionId: t.origin.sessionId, ids: new Set() });
      bySession.get(k).ids.add(t.id);
    }

    let applied = 0;
    for (const { teamId, sessionId, ids } of bySession.values()) {
      const session = getTeam(teamId)?.sessions?.find(s => s.id === sessionId);
      if (!session) continue;
      const newSections = (session.sections || []).map(sec => {
        if (!ids.has(sec.id)) return sec;
        applied++;
        // Adopt the master's content but keep this section's own id so it stays in place.
        return libraryPayloadToSection(master.payload, sec.id);
      });
      updateSession(teamId, sessionId, { sections: newSections });
    }

    toast(`Updated ${applied} session${applied === 1 ? '' : 's'} to match "${group.name}"`);
    setConsolidate(null);
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
    : activeTab === 'community' ? 'Community'
    : 'Exercises';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      {isInsertMode && (
        <header
          className="sticky top-0 z-10"
          style={{ background: 'rgb(var(--bg-rgb) / 0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--line)' }}
        >
          <div className="max-w-6xl mx-auto px-10 py-3 flex items-center justify-between gap-4">
            <button onClick={handleBack} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 13 }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 19l-7-7 7-7" />
              </svg>
              Back to session
            </button>
            <div className="flex items-center gap-2">
              <button onClick={exportLibrary} className="btn btn-ghost">Export</button>
              <label className="btn btn-ghost cursor-pointer">
                Import
                <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
              </label>
            </div>
          </div>
        </header>
      )}

      <div className="max-w-6xl mx-auto px-10 pt-12 pb-4 flex items-start justify-between gap-6">
        <div>
          <div className="text-[11px] font-mono uppercase mb-2" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>PLAYBOOK</div>
          <h1 className="text-[36px] font-bold leading-[1.04]" style={{ letterSpacing: '-0.025em' }}>
            Your playbook
          </h1>
          <p className="mt-2 text-[14px]" style={{ color: 'var(--ink-2)' }}>
            {isInsertMode ? 'Select an item to insert into your session.' : 'Sessions auto-save here as you build them. Pin what you reuse, share what’s worth sharing.'}
          </p>
        </div>
        {!isInsertMode && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={exportLibrary} className="btn btn-ghost" title="Export library JSON">Export</button>
            <label className="btn btn-ghost cursor-pointer" title="Import library JSON">
              Import
              <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        )}
      </div>

      {!isInsertMode && (
        <div className="max-w-6xl mx-auto px-10 pb-5">
          <div
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px]"
            style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', fontSize: 12.5, color: 'var(--ink-2)' }}
          >
            <span style={{ color: 'var(--good)', display: 'inline-flex' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <span>
              <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>Everything auto-saves</strong>
              {' '}&mdash; no Save button anywhere.{' '}
              {syncOn ? 'On all your devices.' : 'On this device until you turn on sync.'}
            </span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-10 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Playbook tabs"
          className="inline-flex items-center gap-1"
        >
          {TABS.map((tab) => {
            const active = tab.toLowerCase() === activeTabLabel.toLowerCase();
            const showDivider = tab === 'Community';
            const countKey = tab.toLowerCase();
            const count = tabCounts[countKey] || 0;
            return (
              <React.Fragment key={tab}>
                {showDivider && <span style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 6px' }} />}
                <button
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleTabChange(tab)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[9px] transition-colors"
                  style={{
                    background: active ? 'var(--bg-elev)' : 'transparent',
                    color: active ? 'var(--ink)' : 'var(--ink-2)',
                    border: active ? '1px solid var(--line-2)' : '1px solid transparent',
                    boxShadow: active ? 'var(--shadow-sm)' : 'none',
                    fontWeight: active ? 500 : 400,
                    fontSize: 13.5,
                  }}
                >
                  {tab}
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      color: active ? 'var(--ink-2)' : 'var(--ink-3)',
                      padding: '1px 6px',
                      background: 'var(--bg-sunken)',
                      borderRadius: 999,
                      fontWeight: 400,
                    }}
                  >
                    {count}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
        {activeTabLabel === 'Diagrams' && (
          <button onClick={() => teamsContext.navigateToEditLibraryDiagram(null)} className="btn btn-primary">
            + New diagram
          </button>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-10 py-6">

        {/* ===== EXERCISES TAB ===== */}
        {activeTabLabel === 'Exercises' && (
          <>
            {/* Filters */}
            <div className="flex flex-col gap-3 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Search exercises..."
                  value={exerciseSearch}
                  onChange={e => setExerciseSearch(e.target.value)}
                  className="flex-1 min-w-[180px] max-w-xs px-4 py-2 input-field"
                />
                {(exerciseTypeFilter || exerciseAgeFilter || exerciseMomentFilter) && (
                  <button
                    onClick={() => { setExerciseTypeFilter(''); setExerciseAgeFilter(''); setExerciseMomentFilter(''); }}
                    className="text-[12px]"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <FilterChipGroup label="Type" value={exerciseTypeFilter} options={uniqueExerciseTypes} onChange={setExerciseTypeFilter} />
                <FilterChipGroup label="Age" value={exerciseAgeFilter} options={uniqueExerciseAgeGroups} onChange={setExerciseAgeFilter} />
                <FilterChipGroup label="Moment" value={exerciseMomentFilter} options={uniqueExerciseMoments} onChange={setExerciseMomentFilter} />
              </div>
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
                  const isConsolidating = consolidate?.groupKey === group.key;
                  const team = rep.origin?.teamId ? getTeam(rep.origin.teamId) : null;
                  const exerciseThumb = getDiagramThumb(rep.payload);
                  const typeTone = rep.type === 'Play'
                    ? { bg: 'var(--accent-soft)', fg: 'var(--accent)' }
                    : rep.type === 'Warm-up'
                    ? { bg: 'rgb(var(--warn-rgb) / 0.18)', fg: 'var(--warn)' }
                    : { bg: 'rgb(var(--good-rgb) / 0.18)', fg: 'var(--good)' };
                  return (
                    <div key={group.key} className={`card card-hover p-4 flex flex-col gap-3 ${isMulti && isOpen ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
                      {exerciseThumb ? (
                        <div
                          className="overflow-hidden rounded-[10px]"
                          style={{
                            background: 'var(--bg-sunken)',
                            border: '1px solid var(--line)',
                            aspectRatio: '16 / 9',
                          }}
                        >
                          <img
                            src={exerciseThumb}
                            alt=""
                            className="w-full h-full"
                            style={{ objectFit: 'contain', display: 'block' }}
                          />
                        </div>
                      ) : isInsertMode ? (
                        <div
                          className="flex items-center justify-center rounded-[10px] text-[11px]"
                          style={{
                            background: 'var(--bg-sunken)',
                            border: '1px dashed var(--line)',
                            aspectRatio: '16 / 9',
                            color: 'var(--ink-3)',
                          }}
                        >
                          No diagram
                        </div>
                      ) : null}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="font-semibold truncate" style={{ letterSpacing: '-0.015em' }}>{group.name}</div>
                          {isMulti && (
                            <span className="shrink-0 px-2 py-0.5 text-[11px] font-mono rounded-full" style={{ background: 'var(--bg-sunken)', color: 'var(--ink-3)' }}>
                              ×{group.versions.length}
                            </span>
                          )}
                        </div>
                        <PinButton pinned={group.pinned} onToggle={() => togglePin('exercises', group.key)} size="sm" />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {rep.type && (
                          <span className="px-2 py-0.5 text-[10.5px] font-mono uppercase rounded-full" style={{ background: typeTone.bg, color: typeTone.fg, letterSpacing: '0.08em' }}>
                            {rep.type}
                          </span>
                        )}
                        {rep.tags?.moment && (
                          <span className="px-2 py-0.5 text-[11px] rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                            {rep.tags.moment}
                          </span>
                        )}
                        {rep.tags?.ageGroup && (
                          <span className="px-2 py-0.5 text-[11px] rounded-full" style={{ background: 'var(--bg-sunken)', color: 'var(--ink-2)' }}>{rep.tags.ageGroup}</span>
                        )}
                      </div>

                      {rep.payload?.objective && !isOpen && (
                        <p className="text-[12.5px] line-clamp-2" style={{ color: 'var(--ink-2)' }}>{rep.payload.objective}</p>
                      )}

                      <div className="flex items-center justify-between gap-3 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                        <span>Updated {formatDate(group.latestUpdatedAt)}</span>
                        <span className="inline-flex items-center gap-3">
                          <ShareControl
                            team={team}
                            sharingContext={sharingContext}
                            syncContext={syncContext}
                            onOpenShareModal={handleOpenShareModal}
                            onShowLinkDevice={onShowLinkDevice}
                            hasAccount={hasAccount}
                            compact
                          />
                          <SyncDot synced={syncOn} />
                        </span>
                      </div>

                      {isMulti && isOpen && (
                        <div className="flex flex-col gap-3 pt-2 border-t border-slate-700">
                          {isConsolidating ? (
                            <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg p-2.5" style={{ background: 'var(--accent-soft)' }}>
                              <span className="text-xs" style={{ color: 'var(--ink-2)' }}>
                                Choose the <b>master</b> (●), check the sessions to overwrite, then apply.
                              </span>
                              <span className="flex gap-2 shrink-0">
                                <button onClick={() => applyConsolidate(group)} className="btn btn-primary text-xs">
                                  Copy into {consolidate.targetKeys.size} session{consolidate.targetKeys.size === 1 ? '' : 's'}
                                </button>
                                <button onClick={cancelConsolidate} className="btn btn-subtle text-xs">Cancel</button>
                              </span>
                            </div>
                          ) : (
                            <button onClick={() => startConsolidate(group)} className="btn btn-subtle text-xs self-start">
                              Consolidate duplicates…
                            </button>
                          )}
                          {group.versions.map(v => {
                            const vKey = versionKey(v);
                            const thumb = getDiagramThumb(v.payload);
                            const teamName = v.origin?.teamId ? getTeamName(v.origin.teamId) : '';
                            const sessionTitle = v.origin?.sessionTitle || '';
                            const inSession = Boolean(v.origin?.teamId && v.origin?.sessionId);
                            const isMaster = isConsolidating && consolidate.masterKey === vKey;
                            const isTarget = isConsolidating && consolidate.targetKeys.has(vKey);
                            return (
                              <div
                                key={vKey}
                                className="flex gap-3 p-3 bg-slate-900/60 rounded-lg border"
                                style={{ borderColor: isMaster ? 'var(--accent)' : 'rgb(51 65 85 / 0.6)' }}
                              >
                                {thumb && (
                                  <img src={thumb} alt="" className="w-20 h-20 object-contain rounded border border-slate-700 shrink-0" style={{ background: 'var(--bg-sunken)' }} />
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
                                  {isConsolidating ? (
                                    <div className="flex items-center gap-4 mt-1 text-xs">
                                      <label className="inline-flex items-center gap-1.5 cursor-pointer" style={{ color: 'var(--ink-2)' }}>
                                        <input
                                          type="radio"
                                          name={`master-${group.key}`}
                                          checked={isMaster}
                                          onChange={() => setMaster(vKey)}
                                        />
                                        Master
                                      </label>
                                      <label
                                        className="inline-flex items-center gap-1.5"
                                        style={{ color: 'var(--ink-2)', opacity: isMaster || !inSession ? 0.4 : 1, cursor: isMaster || !inSession ? 'default' : 'pointer' }}
                                        title={!inSession ? 'Saved library copies are not part of a session' : ''}
                                      >
                                        <input
                                          type="checkbox"
                                          disabled={isMaster || !inSession}
                                          checked={isTarget}
                                          onChange={() => toggleTarget(vKey)}
                                        />
                                        Overwrite{!inSession ? ' (n/a)' : ''}
                                      </label>
                                    </div>
                                  ) : (
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
                                  )}
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

        {/* ===== COMMUNITY TAB ===== */}
        {activeTabLabel === 'Community' && (
          <CommunityTab isSignedIn={isSignedIn} onSignIn={() => onShowSignIn?.()} />
        )}

        {/* ===== SESSIONS TAB ===== */}
        {activeTabLabel === 'Sessions' && (
          <>
            {/* Filters */}
            <div className="flex flex-col gap-3 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Search sessions..."
                  value={sessionSearch}
                  onChange={e => setSessionSearch(e.target.value)}
                  className="flex-1 min-w-[180px] max-w-xs px-4 py-2 input-field"
                />
                {(sessionAgeFilter || sessionMomentFilter) && (
                  <button
                    onClick={() => { setSessionAgeFilter(''); setSessionMomentFilter(''); }}
                    className="text-[12px]"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <FilterChipGroup label="Age" value={sessionAgeFilter} options={uniqueSessionAgeGroups} onChange={setSessionAgeFilter} />
                <FilterChipGroup label="Moment" value={sessionMomentFilter} options={uniqueSessionMoments} onChange={setSessionMomentFilter} />
              </div>
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
                  const team = rep.origin?.teamId ? getTeam(rep.origin.teamId) : null;
                  const sessionThumb = getSessionThumb(rep.payload);
                  return (
                    <div key={groupKey} className={`card card-hover p-4 flex flex-col gap-3 ${isMulti && isOpen ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
                      {sessionThumb && (
                        <div
                          className="overflow-hidden rounded-[10px]"
                          style={{
                            background: 'var(--bg-sunken)',
                            border: '1px solid var(--line)',
                            aspectRatio: '16 / 9',
                          }}
                        >
                          <img
                            src={sessionThumb}
                            alt=""
                            className="w-full h-full"
                            style={{ objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="font-semibold truncate" style={{ letterSpacing: '-0.015em' }}>{group.name}</div>
                          {isMulti && (
                            <span className="shrink-0 px-2 py-0.5 text-[11px] font-mono rounded-full" style={{ background: 'var(--bg-sunken)', color: 'var(--ink-3)' }}>
                              ×{group.versions.length}
                            </span>
                          )}
                        </div>
                        <PinButton pinned={group.pinned} onToggle={() => togglePin('sessions', group.key)} size="sm" />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {rep.tags?.moment && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                            {rep.tags.moment}
                          </span>
                        )}
                        {rep.tags?.ageGroup && (
                          <span className="px-2 py-0.5 text-[11px] rounded-full" style={{ background: 'var(--bg-sunken)', color: 'var(--ink-2)' }}>{rep.tags.ageGroup}</span>
                        )}
                        {rep.tags?.duration && (
                          <span className="font-mono uppercase" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                            {rep.tags.duration} MIN
                          </span>
                        )}
                      </div>

                      {rep.payload?.sections?.length > 0 && !isOpen && (
                        <p className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                          {rep.payload.sections.length} exercise{rep.payload.sections.length !== 1 ? 's' : ''}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-3 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                        <span>Updated {formatDate(group.latestUpdatedAt)}</span>
                        <span className="inline-flex items-center gap-3">
                          <ShareControl
                            team={team}
                            sharingContext={sharingContext}
                            syncContext={syncContext}
                            onOpenShareModal={handleOpenShareModal}
                            onShowLinkDevice={onShowLinkDevice}
                            hasAccount={hasAccount}
                            compact
                          />
                          <SyncDot synced={syncOn} />
                        </span>
                      </div>

                      {isMulti && isOpen && (
                        <div className="flex flex-col gap-3 pt-2 border-t border-slate-700">
                          {group.versions.map(v => {
                            const teamName = v.origin?.teamName || (v.origin?.teamId ? getTeamName(v.origin.teamId) : '');
                            const sectionCount = v.payload?.sections?.length || 0;
                            const firstObjective = v.payload?.sections?.find(s => s.objective)?.objective || '';
                            return (
                              <div key={versionKey(v)} className="flex flex-col gap-1 p-3 bg-slate-900/60 rounded-lg border border-slate-700/60">
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
      {shareModalTeam && sharingContext && (
        <ShareModal
          team={shareModalTeam}
          onClose={() => setShareModalTeam(null)}
          onUpdateTeam={(updatedTeam) => teamsContext.updateTeam?.(shareModalTeam.id, updatedTeam)}
          sharingHook={sharingContext}
        />
      )}

      {useSessionItem && (
        <>
          <div className="modal-backdrop" onClick={() => setUseSessionItem(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="card p-6 w-full max-w-sm animate-fade-in" style={{ boxShadow: 'var(--shadow-lg)' }}>
              <h2 className="text-[18px] font-semibold mb-1" style={{ letterSpacing: '-0.015em' }}>Use &ldquo;{useSessionItem.name}&rdquo;</h2>
              <p className="text-[13px] mb-4" style={{ color: 'var(--ink-2)' }}>Which team should this session be added to?</p>
              {teams.length === 0 ? (
                <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>No teams yet. Create a team first.</p>
              ) : (
                <>
                  <select
                    value={selectedUseTeamId}
                    onChange={e => setSelectedUseTeamId(e.target.value)}
                    className="input-field mb-4"
                  >
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}{t.ageGroup ? ` (${t.ageGroup})` : ''}</option>
                    ))}
                  </select>
                  <div className="flex gap-3">
                    <button onClick={() => setUseSessionItem(null)} className="flex-1 btn btn-secondary">Cancel</button>
                    <button onClick={handleConfirmUseSession} className="flex-1 btn btn-primary">Add to team</button>
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

// Community tab — anyone can browse. Publishing is the only thing gated:
// guests see a small hint pointing to the (optional, free) account.
function CommunityTab({ isSignedIn, onSignIn }) {
  return (
    <>
      <div className="card p-12 text-center" style={{ background: 'var(--bg-elev)' }}>
        <div className="eyebrow mb-3">COMING SOON</div>
        <h3 className="text-[18px] font-semibold mb-2" style={{ letterSpacing: '-0.015em' }}>
          Discover sessions from other coaches
        </h3>
        <p className="text-[13.5px] max-w-md mx-auto" style={{ color: 'var(--ink-2)' }}>
          Coaches will be able to publish sessions, exercises, and diagrams here — and decide per item what to share. We&rsquo;re building this carefully so privacy stays the default.
        </p>
      </div>

      {!isSignedIn && (
        <div
          className="rounded-[14px] p-4 mt-4 flex items-center gap-3"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}
        >
          <div
            style={{
              width: 32, height: 32, borderRadius: 9, background: 'var(--accent-soft)',
              color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
              Want to publish your own sessions?
            </div>
            <div className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
              Browsing is free; publishing needs a free account so other coaches can find your work.
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onSignIn}>Create account</button>
        </div>
      )}
    </>
  );
}

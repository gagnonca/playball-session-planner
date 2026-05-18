import { useState, useEffect, useRef, useCallback } from 'react';
import {
  uid,
  nowIso,
  slugify,
  toast,
  defaultTeam,
  defaultSession,
  migrateToTeamStructure,
} from '../utils/helpers';
import { TEAMS_KEY, CURRENT_VIEW_KEY, LEGACY_SESSION_KEY, COACH_IDENTITY_KEY } from '../constants/storage';
import { VIEWS } from '../constants/navigation';
import { getTeamsData, saveTeamsData, migrateFromLocalStorage, clearTeamsData } from '../utils/indexedDBHelper';

// Paths that are handled by AppShell or reserved — never match as team slugs
const RESERVED_PATHS = new Set([
  'teams', 'diagrams', 'library', 'shared', 'import', 'share',
  'privacy', 'support', 'api', 'assets', 'favicon',
]);

// Build a unique URL slug for a team. Appends short ID suffix if names collide.
function teamUrlSlug(team, allTeams) {
  const base = slugify(team.name);
  const sameSlug = allTeams.filter(t => slugify(t.name) === base);
  if (sameSlug.length <= 1) return base;
  // Collision — append first 4 chars of ID to disambiguate
  return base + '-' + team.id.slice(0, 4);
}

// Build a unique URL slug for a session within a team.
function sessionUrlSlug(session, allSessions) {
  const base = slugify(session?.summary?.title || '');
  const sameSlug = allSessions.filter(s => slugify(s.summary?.title || '') === base);
  if (sameSlug.length <= 1) return base;
  return base + '-' + session.id.slice(0, 4);
}

// Build a URL path from view state and teams data
function buildUrl(viewState, teams) {
  const { currentView, selectedTeamId, selectedSessionId, editingDiagramId } = viewState;

  if (currentView === VIEWS.TEAMS) return '/';

  if (currentView === VIEWS.LIBRARY) return '/library';
  if (currentView === VIEWS.SCHEDULE) return '/schedule';
  if (currentView === VIEWS.SETTINGS) return '/settings';
  if (currentView === VIEWS.WELCOME) return '/welcome';

  if (currentView === VIEWS.DIAGRAM_BUILDER && editingDiagramId) {
    return '/diagrams/' + editingDiagramId;
  }

  const team = teams?.find(t => t.id === selectedTeamId);
  if (!team) return '/';

  const tSlug = teamUrlSlug(team, teams);

  if (currentView === VIEWS.TEAM_DETAIL) return '/' + tSlug;

  if (currentView === VIEWS.SESSION_BUILDER || currentView === VIEWS.DIAGRAM_BUILDER) {
    const session = team.sessions?.find(s => s.id === selectedSessionId);
    const sSlug = sessionUrlSlug(session, team.sessions || []);
    return '/' + tSlug + '/' + sSlug;
  }

  return '/';
}

// Find a team from a URL slug. Handles both plain slugs and slug-with-id-suffix.
function findTeamBySlug(slug, teams) {
  if (!teams) return null;
  // Try exact name slug match (unique team names)
  const exactMatches = teams.filter(t => slugify(t.name) === slug);
  if (exactMatches.length === 1) return exactMatches[0];

  // Try slug-with-id-suffix (e.g., "dragons-3d7f")
  const lastDash = slug.lastIndexOf('-');
  if (lastDash > 0) {
    const basePart = slug.slice(0, lastDash);
    const idPart = slug.slice(lastDash + 1);
    const match = teams.find(t => slugify(t.name) === basePart && t.id.startsWith(idPart));
    if (match) return match;
  }

  // Fall back to first match if multiple share the same slug
  return exactMatches[0] || null;
}

// Find a session from a URL slug within a team's sessions.
function findSessionBySlug(slug, sessions) {
  if (!sessions) return null;
  const exactMatches = sessions.filter(s => slugify(s.summary?.title || '') === slug);
  if (exactMatches.length === 1) return exactMatches[0];

  const lastDash = slug.lastIndexOf('-');
  if (lastDash > 0) {
    const basePart = slug.slice(0, lastDash);
    const idPart = slug.slice(lastDash + 1);
    const match = sessions.find(s => slugify(s.summary?.title || '') === basePart && s.id.startsWith(idPart));
    if (match) return match;
  }

  return exactMatches[0] || null;
}

// Resolve a URL path to a view state using teams data
function resolveUrl(pathname, teams) {
  const path = pathname.replace(/\/+$/, '') || '/'; // trim trailing slashes
  const segments = path.split('/').filter(Boolean); // e.g. ['dragons', 'passing-practice']

  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'teams')) {
    return { currentView: VIEWS.TEAMS };
  }

  // /library
  if (segments[0] === 'library') {
    return { currentView: VIEWS.LIBRARY };
  }

  // /schedule
  if (segments[0] === 'schedule') {
    return { currentView: VIEWS.SCHEDULE };
  }

  // /settings
  if (segments[0] === 'settings') {
    return { currentView: VIEWS.SETTINGS };
  }

  // /welcome
  if (segments[0] === 'welcome') {
    return { currentView: VIEWS.WELCOME };
  }

  // /diagrams → library diagrams tab; /diagrams/<id> → diagram editor
  if (segments[0] === 'diagrams') {
    if (segments.length === 1) {
      return { currentView: VIEWS.LIBRARY, libraryTab: 'diagrams' };
    }
    return {
      currentView: VIEWS.DIAGRAM_BUILDER,
      editingDiagramId: segments[1],
    };
  }

  // Skip reserved paths — they're handled by AppShell
  if (RESERVED_PATHS.has(segments[0])) return null;

  // /<team-slug> or /<team-slug-id>
  const team = findTeamBySlug(segments[0], teams);
  if (!team) return null; // no matching team

  if (segments.length === 1) {
    return {
      currentView: VIEWS.TEAM_DETAIL,
      selectedTeamId: team.id,
    };
  }

  // /<team-slug>/<session-slug>
  const session = findSessionBySlug(segments[1], team.sessions);
  if (!session) {
    // Session slug didn't match — fall back to team detail
    return {
      currentView: VIEWS.TEAM_DETAIL,
      selectedTeamId: team.id,
    };
  }

  return {
    currentView: VIEWS.SESSION_BUILDER,
    selectedTeamId: team.id,
    selectedSessionId: session.id,
  };
}

function isSyncActive() {
  try {
    const raw = localStorage.getItem(COACH_IDENTITY_KEY);
    if (!raw) return false;
    const identity = JSON.parse(raw);
    return Boolean(identity?.coachId && identity?.deviceId);
  } catch {
    return false;
  }
}

function syncHeaders() {
  try {
    const raw = localStorage.getItem(COACH_IDENTITY_KEY);
    if (!raw) return null;
    const identity = JSON.parse(raw);
    if (!identity?.coachId || !identity?.deviceId) return null;
    return {
      'Content-Type': 'application/json',
      'x-coach-id': identity.coachId,
      'x-device-id': identity.deviceId,
    };
  } catch {
    return null;
  }
}

function pgDelete(path) {
  const headers = syncHeaders();
  if (!headers) return;
  fetch(path, { method: 'DELETE', headers })
    .catch(err => console.warn('pgDelete failed', path, err));
}

function pgPut(path, body) {
  const headers = syncHeaders();
  if (!headers) return;
  fetch(path, { method: 'PUT', headers, body: JSON.stringify(body) })
    .catch(err => console.warn('pgPut failed', path, err));
}

// --- Dirty-tracking sync ------------------------------------------------
// Instead of pushing to Postgres on every keystroke, we track which entities
// have unsaved changes ("dirty") and flush them on meaningful moments:
//   • navigation away from the current view
//   • tab goes to background (visibilitychange)
//   • browser close (beforeunload)
//   • 30-second safety-net timer
//
// Create/delete operations still fire immediately — they're deliberate
// user actions, not rapid edits.

const _dirtyTeams = new Map();   // teamId → team object (latest)
const _dirtySessions = new Map(); // sessionId → { teamId, session }
let _flushTimer = null;
const FLUSH_INTERVAL_MS = 30_000;

function markTeamDirty(team) {
  if (!team?.id) return;
  _dirtyTeams.set(team.id, team);
  _scheduleFlush();
}

function markSessionDirty(teamId, session) {
  if (!session?.id || !teamId) return;
  _dirtySessions.set(session.id, { teamId, session });
  _scheduleFlush();
}

function _scheduleFlush() {
  if (_flushTimer) return; // already scheduled
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flushDirtyEntities();
  }, FLUSH_INTERVAL_MS);
}

function flushDirtyEntities() {
  // Flush teams
  for (const [, team] of _dirtyTeams) {
    pgPut(`/api/v2/teams/${encodeURIComponent(team.id)}`, {
      name: team.name ?? 'Untitled Team',
      ageGroup: team.ageGroup ?? null,
      defaultDuration: team.defaultDuration ?? null,
      sharing: team.sharing ?? { isShared: false },
    });
  }
  _dirtyTeams.clear();

  // Flush sessions
  for (const [, { teamId, session }] of _dirtySessions) {
    const { id, sections, isTemplate, ...summary } = session;
    pgPut(`/api/v2/sessions/${encodeURIComponent(id)}`, {
      teamId,
      summary,
      sections: sections ?? [],
      isTemplate: !!isTemplate,
    });
  }
  _dirtySessions.clear();

  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
}

// Immediate push for create operations (not edits)
function putTeamNow(team) {
  if (!team?.id) return;
  pgPut(`/api/v2/teams/${encodeURIComponent(team.id)}`, {
    name: team.name ?? 'Untitled Team',
    ageGroup: team.ageGroup ?? null,
    defaultDuration: team.defaultDuration ?? null,
    sharing: team.sharing ?? { isShared: false },
  });
}

function putSessionNow(teamId, session) {
  if (!session?.id || !teamId) return;
  const { id, sections, isTemplate, ...summary } = session;
  pgPut(`/api/v2/sessions/${encodeURIComponent(id)}`, {
    teamId,
    summary,
    sections: sections ?? [],
    isTemplate: !!isTemplate,
  });
}

// Push every team + session currently in teamsData to Postgres via the
// per-entity v2 API. Used when sync is first enabled — without this, teams
// created in local-only mode never make it to the server and the next pull
// wipes them locally.
async function putAllToPostgres(teamsData) {
  const headers = syncHeaders();
  if (!headers) return;
  const teams = teamsData?.teams || [];
  for (const team of teams) {
    try {
      await fetch(`/api/v2/teams/${encodeURIComponent(team.id)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: team.name ?? 'Untitled Team',
          ageGroup: team.ageGroup ?? null,
          defaultDuration: team.defaultDuration ?? null,
          sharing: team.sharing ?? { isShared: false },
        }),
      });
    } catch (err) {
      console.warn('putAllToPostgres team failed', team.id, err);
    }
    for (const session of team.sessions || []) {
      const { id, sections, isTemplate, ...summary } = session;
      try {
        await fetch(`/api/v2/sessions/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            teamId: team.id,
            summary,
            sections: sections ?? [],
            isTemplate: !!isTemplate,
          }),
        });
      } catch (err) {
        console.warn('putAllToPostgres session failed', id, err);
      }
    }
  }
}

// Flush on tab hide / browser close
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDirtyEntities();
  });
  window.addEventListener('beforeunload', () => flushDirtyEntities());
}

function makeStorageReplacer(_syncActive) {
  // Strip the base64 `dataUrl` from diagramData (redundant with `imageDataUrl`
  // and historically huge), but keep the rest of diagramData intact — the
  // Konva playground stores its editable state (`shapes`, `pitchSize`, etc.)
  // there. Used to nuke the whole `diagramData` when sync was on, which lost
  // every saved diagram on reload.
  return (key, value) => {
    if (key === 'diagramData' && value && typeof value === 'object' && value.dataUrl) {
      const { dataUrl: _strip, ...rest } = value;
      return rest;
    }
    return value;
  };
}

export default function useTeams() {
  // Teams data state
  const [teamsData, setTeamsData] = useState(null);

  // Navigation state
  const [currentView, setCurrentView] = useState(VIEWS.TEAMS);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [selectedVariationId, setSelectedVariationId] = useState(null); // For editing variation diagrams
  const [editingDiagramId, setEditingDiagramId] = useState(null); // For editing library diagrams
  const [libraryTab, setLibraryTab] = useState('exercises'); // Active tab when in LIBRARY view

  // Storage limit modal state
  const [showStorageLimitModal, setShowStorageLimitModal] = useState(false);

  // Ref to skip pushState when restoring from popstate
  const skipNextPush = useRef(false);

  // Helper to push view state to browser history with URL
  const pushViewState = (viewState, url) => {
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    window.history.pushState(viewState, '', url || '/');
  };

  // Initialize teams data with auto-migration from localStorage to IndexedDB
  useEffect(() => {
    (async () => {
      let data = null;

      try {
        // Try to load from IndexedDB first
        const idbData = await getTeamsData();

        if (idbData) {
          // IndexedDB has data, use it
          data = idbData;
        } else {
          // IndexedDB empty, check localStorage for migration
          const existingTeamsData = localStorage.getItem(TEAMS_KEY);

          if (existingTeamsData) {
            // Migrate from localStorage to IndexedDB
            data = JSON.parse(existingTeamsData);
            await migrateFromLocalStorage(existingTeamsData);
            console.log('Migrated teams data to IndexedDB');
          } else {
            // Check for legacy session data
            const legacySessionData = localStorage.getItem(LEGACY_SESSION_KEY);

            if (legacySessionData) {
              // Migrate legacy data
              const legacySession = JSON.parse(legacySessionData);
              data = migrateToTeamStructure(legacySession);
              await saveTeamsData(data);
              console.log('Migrated legacy session to team structure and saved to IndexedDB');
            } else {
              // Initialize with empty teams
              data = {
                version: 1,
                teams: [],
                defaultTeamId: null,
              };
              await saveTeamsData(data);
            }
          }
        }

        // Ensure diagramData.dataUrl is populated from imageDataUrl in memory.
        // IndexedDB strips diagramData.dataUrl when saving (saves storage), but
        // in-memory state must keep it for API pushes (sync, sharing).
        data.teams?.forEach(team => {
          team.sessions?.forEach(session => {
            session.sections?.forEach(sec => {
              if (sec.imageDataUrl && sec.diagramData && !sec.diagramData.dataUrl) {
                sec.diagramData.dataUrl = sec.imageDataUrl;
              }
              sec.variations?.forEach(v => {
                if (v.imageDataUrl && v.diagramData && !v.diagramData.dataUrl) {
                  v.diagramData.dataUrl = v.imageDataUrl;
                }
              });
            });
          });
        });

        setTeamsData(data);

        // Try to resolve navigation from URL first
        const pathname = window.location.pathname;
        const urlResolved = resolveUrl(pathname, data?.teams);

        if (urlResolved) {
          // URL matched a known route — use it
          setCurrentView(urlResolved.currentView);
          setSelectedTeamId(urlResolved.selectedTeamId || null);
          setSelectedSessionId(urlResolved.selectedSessionId || null);
          setSelectedSectionId(null);
          setSelectedVariationId(null);
          setEditingDiagramId(urlResolved.editingDiagramId || null);
          if (urlResolved.libraryTab) setLibraryTab(urlResolved.libraryTab);

          const viewState = {
            currentView: urlResolved.currentView,
            selectedTeamId: urlResolved.selectedTeamId || null,
            selectedSessionId: urlResolved.selectedSessionId || null,
            selectedSectionId: null,
            selectedVariationId: null,
            editingDiagramId: urlResolved.editingDiagramId || null,
          };
          window.history.replaceState(viewState, '', pathname);
        } else {
          // URL didn't match — fall back to saved navigation state
          const savedView = localStorage.getItem(CURRENT_VIEW_KEY);
          if (savedView) {
            const viewState = JSON.parse(savedView);
            setCurrentView(viewState.currentView || VIEWS.TEAMS);
            setSelectedTeamId(viewState.selectedTeamId || null);
            setSelectedSessionId(viewState.selectedSessionId || null);
            setSelectedSectionId(viewState.selectedSectionId || null);
            setSelectedVariationId(viewState.selectedVariationId || null);
            setEditingDiagramId(viewState.editingDiagramId || null);

            const url = buildUrl(viewState, data?.teams);
            window.history.replaceState(viewState, '', url);
          }
        }
      } catch (error) {
        console.error('Error initializing teams:', error);
        const fallbackData = {
          version: 1,
          teams: [],
          defaultTeamId: null,
        };
        setTeamsData(fallbackData);
      }
    })();
  }, []);

  // Save teams data to IndexedDB whenever it changes.
  // Debounced (1s) to avoid running expensive JSON.stringify on every keystroke.
  // For synced users, strip diagramData entirely. For offline users, only strip dataUrl.
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (!teamsData) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        const syncActive = isSyncActive();
        const replacer = makeStorageReplacer(syncActive);
        const dataToSave = JSON.parse(JSON.stringify(teamsData, replacer));
        await saveTeamsData(dataToSave);
      } catch (error) {
        console.error('Error saving teams to IndexedDB:', error);
        if (!isSyncActive()) {
          setShowStorageLimitModal(true);
        }
      }
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [teamsData]);

  // Hydrate and set teams data from server, restoring diagramData.dataUrl from imageDataUrl.
  // Used after sync pull, pairing confirmation, or cross-tab reload from IndexedDB.
  // Does NOT write to IndexedDB — the save effect fires after setState.
  //
  // Memoized with useCallback to give a stable identity — this prevents the
  // BroadcastChannel effect from tearing down/recreating on every render.
  const loadTeamsFromServer = useCallback((serverTeamsData) => {
    // No deep-clone needed: callers already provide a fresh object
    // (JSON.parse of fetch response, or IndexedDB read, or structured clone).
    serverTeamsData.teams?.forEach(team => {
      team.sessions?.forEach(session => {
        session.sections?.forEach(sec => {
          if (sec.imageDataUrl && sec.diagramData && !sec.diagramData.dataUrl) {
            sec.diagramData.dataUrl = sec.imageDataUrl;
          }
          sec.variations?.forEach(v => {
            if (v.imageDataUrl && v.diagramData && !v.diagramData.dataUrl) {
              v.diagramData.dataUrl = v.imageDataUrl;
            }
          });
        });
      });
    });
    setTeamsData(serverTeamsData);
  }, []);

  // Flush dirty entities to Postgres whenever the user navigates away.
  // Skips the initial mount (prevViewRef starts null).
  const prevViewRef = useRef(null);
  useEffect(() => {
    if (prevViewRef.current !== null) {
      flushDirtyEntities();
    }
    prevViewRef.current = currentView;
  }, [currentView, selectedTeamId, selectedSessionId]);

  // Save navigation state to localStorage
  useEffect(() => {
    try {
      const viewState = {
        currentView,
        selectedTeamId,
        selectedSessionId,
        selectedSectionId,
        selectedVariationId,
        editingDiagramId,
      };
      localStorage.setItem(CURRENT_VIEW_KEY, JSON.stringify(viewState));
    } catch (error) {
      console.error('Error saving view state:', error);
    }
  }, [currentView, selectedTeamId, selectedSessionId, selectedSectionId, selectedVariationId, editingDiagramId]);

  // Listen for browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state;
      if (state && state.currentView) {
        skipNextPush.current = true;
        setCurrentView(state.currentView);
        setSelectedTeamId(state.selectedTeamId || null);
        setSelectedSessionId(state.selectedSessionId || null);
        setSelectedSectionId(state.selectedSectionId || null);
        setSelectedVariationId(state.selectedVariationId || null);
        setEditingDiagramId(state.editingDiagramId || null);
        if (state.libraryTab) setLibraryTab(state.libraryTab);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ============ Team CRUD Operations ============

  const createTeam = (name, ageGroup = '') => {
    const team = defaultTeam(name, ageGroup);
    setTeamsData(prev => ({
      ...prev,
      teams: [...prev.teams, team],
      defaultTeamId: prev.defaultTeamId || team.id,
    }));
    putTeamNow(team); // immediate — deliberate action
    return team;
  };

  const updateTeam = (teamId, updates) => {
    let updated = null;
    setTeamsData(prev => ({
      ...prev,
      teams: prev.teams.map(team => {
        if (team.id !== teamId) return team;
        updated = { ...team, ...updates, updatedAt: nowIso() };
        return updated;
      }),
    }));
    if (updated) markTeamDirty(updated); // deferred — flush on navigation/blur
  };

  const deleteTeam = (teamId) => {
    setTeamsData(prev => {
      const newTeams = prev.teams.filter(team => team.id !== teamId);
      return {
        ...prev,
        teams: newTeams,
        defaultTeamId: prev.defaultTeamId === teamId
          ? (newTeams.length > 0 ? newTeams[0].id : null)
          : prev.defaultTeamId,
      };
    });
    pgDelete(`/api/v2/teams/${encodeURIComponent(teamId)}`);
  };

  const getTeam = (teamId) => {
    return teamsData?.teams.find(team => team.id === teamId);
  };

  // ============ Session CRUD Operations ============

  const createSession = (teamId, sessionData = null) => {
    // If no session data provided, create default with team defaults
    let session = sessionData;
    if (!session) {
      const team = getTeam(teamId);
      const teamDefaults = team ? {
        ageGroup: team.ageGroup,
        defaultDuration: team.defaultDuration,
      } : null;
      session = defaultSession(teamDefaults);
    }

    setTeamsData(prev => ({
      ...prev,
      teams: prev.teams.map(team =>
        team.id === teamId
          ? {
              ...team,
              sessions: [...team.sessions, session],
              updatedAt: nowIso(),
            }
          : team
      ),
    }));
    putSessionNow(teamId, session); // immediate — deliberate action
    return session;
  };

  const updateSession = (teamId, sessionId, updates) => {
    let updated = null;
    setTeamsData(prev => ({
      ...prev,
      teams: prev.teams.map(team =>
        team.id === teamId
          ? {
              ...team,
              sessions: team.sessions.map(session => {
                if (session.id !== sessionId) return session;
                updated = { ...session, ...updates, updatedAt: nowIso() };
                return updated;
              }),
              updatedAt: nowIso(),
            }
          : team
      ),
    }));
    if (updated) markSessionDirty(teamId, updated); // deferred — flush on navigation/blur
  };

  const deleteSession = (teamId, sessionId) => {
    setTeamsData(prev => ({
      ...prev,
      teams: prev.teams.map(team =>
        team.id === teamId
          ? {
              ...team,
              sessions: team.sessions.filter(session => session.id !== sessionId),
              updatedAt: nowIso(),
            }
          : team
      ),
    }));
    pgDelete(`/api/v2/sessions/${encodeURIComponent(sessionId)}`);
  };

  const getSession = (teamId, sessionId) => {
    const team = getTeam(teamId);
    return team?.sessions.find(session => session.id === sessionId);
  };

  const duplicateSession = (teamId, sessionId) => {
    const originalSession = getSession(teamId, sessionId);
    if (!originalSession) return null;

    const duplicatedSession = {
      ...JSON.parse(JSON.stringify(originalSession)), // Deep clone
      id: uid(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      summary: {
        ...originalSession.summary,
        title: `${originalSession.summary.title} (Copy)`,
        date: '', // Clear the date for the duplicate
      },
    };

    createSession(teamId, duplicatedSession);
    return duplicatedSession;
  };

  // ============ Navigation Operations ============

  const navigateToTeams = () => {
    setCurrentView(VIEWS.TEAMS);
    setSelectedTeamId(null);
    setSelectedSessionId(null);
    pushViewState({ currentView: VIEWS.TEAMS }, '/');
  };

  const navigateToTeamDetail = (teamId) => {
    const teams = teamsData?.teams || [];
    const team = teams.find(t => t.id === teamId);
    const tSlug = team ? teamUrlSlug(team, teams) : teamId;
    setCurrentView(VIEWS.TEAM_DETAIL);
    setSelectedTeamId(teamId);
    setSelectedSessionId(null);
    pushViewState({ currentView: VIEWS.TEAM_DETAIL, selectedTeamId: teamId }, '/' + tSlug);
  };

  const navigateToSessionBuilder = (teamId, sessionId) => {
    const teams = teamsData?.teams || [];
    const team = teams.find(t => t.id === teamId);
    const session = team?.sessions?.find(s => s.id === sessionId);
    const tSlug = team ? teamUrlSlug(team, teams) : teamId;
    const sSlug = sessionUrlSlug(session, team?.sessions || []);
    setCurrentView(VIEWS.SESSION_BUILDER);
    setSelectedTeamId(teamId);
    setSelectedSessionId(sessionId);
    setSelectedSectionId(null);
    setEditingDiagramId(null);
    pushViewState(
      { currentView: VIEWS.SESSION_BUILDER, selectedTeamId: teamId, selectedSessionId: sessionId },
      '/' + tSlug + '/' + sSlug,
    );
  };

  const navigateToDiagramBuilder = (teamId, sessionId, sectionId) => {
    const teams = teamsData?.teams || [];
    const team = teams.find(t => t.id === teamId);
    const session = team?.sessions?.find(s => s.id === sessionId);
    const tSlug = team ? teamUrlSlug(team, teams) : teamId;
    const sSlug = sessionUrlSlug(session, team?.sessions || []);
    setCurrentView(VIEWS.DIAGRAM_BUILDER);
    setSelectedTeamId(teamId);
    setSelectedSessionId(sessionId);
    setSelectedSectionId(sectionId);
    setSelectedVariationId(null);
    setEditingDiagramId(null);
    pushViewState(
      { currentView: VIEWS.DIAGRAM_BUILDER, selectedTeamId: teamId, selectedSessionId: sessionId, selectedSectionId: sectionId },
      '/' + tSlug + '/' + sSlug + '/diagram',
    );
  };

  const navigateToVariationDiagramBuilder = (teamId, sessionId, sectionId, variationId, useParentAsBase = false) => {
    const teams = teamsData?.teams || [];
    const team = teams.find(t => t.id === teamId);
    const session = team?.sessions?.find(s => s.id === sessionId);
    const tSlug = team ? teamUrlSlug(team, teams) : teamId;
    const sSlug = sessionUrlSlug(session, team?.sessions || []);
    setCurrentView(VIEWS.DIAGRAM_BUILDER);
    setSelectedTeamId(teamId);
    setSelectedSessionId(sessionId);
    setSelectedSectionId(sectionId);
    setSelectedVariationId(variationId);
    setEditingDiagramId(useParentAsBase ? 'USE_PARENT' : null);
    pushViewState(
      { currentView: VIEWS.DIAGRAM_BUILDER, selectedTeamId: teamId, selectedSessionId: sessionId, selectedSectionId: sectionId, selectedVariationId: variationId, editingDiagramId: useParentAsBase ? 'USE_PARENT' : null },
      '/' + tSlug + '/' + sSlug + '/diagram',
    );
  };

  const navigateToDiagramLibrary = (insertMode = false, teamId = null, sessionId = null, sectionId = null) => {
    setCurrentView(VIEWS.DIAGRAM_LIBRARY);
    if (insertMode) {
      setSelectedTeamId(teamId);
      setSelectedSessionId(sessionId);
      setSelectedSectionId(sectionId);
    } else {
      setSelectedTeamId(null);
      setSelectedSessionId(null);
      setSelectedSectionId(null);
    }
    setEditingDiagramId(null);
    pushViewState(
      { currentView: VIEWS.DIAGRAM_LIBRARY, selectedTeamId: insertMode ? teamId : null, selectedSessionId: insertMode ? sessionId : null, selectedSectionId: insertMode ? sectionId : null },
      '/diagrams',
    );
  };

  const navigateToEditLibraryDiagram = (diagramId) => {
    setCurrentView(VIEWS.DIAGRAM_BUILDER);
    setEditingDiagramId(diagramId);
    setSelectedTeamId(null);
    setSelectedSessionId(null);
    setSelectedSectionId(null);
    pushViewState(
      { currentView: VIEWS.DIAGRAM_BUILDER, editingDiagramId: diagramId },
      '/diagrams/' + diagramId,
    );
  };

  const navigateBackFromDiagramBuilder = () => {
    if (selectedTeamId && selectedSessionId) {
      const teams = teamsData?.teams || [];
      const team = teams.find(t => t.id === selectedTeamId);
      const session = team?.sessions?.find(s => s.id === selectedSessionId);
      const tSlug = team ? teamUrlSlug(team, teams) : selectedTeamId;
      const sSlug = sessionUrlSlug(session, team?.sessions || []);
      setCurrentView(VIEWS.SESSION_BUILDER);
      setSelectedSectionId(null);
      pushViewState(
        { currentView: VIEWS.SESSION_BUILDER, selectedTeamId, selectedSessionId },
        '/' + tSlug + '/' + sSlug,
      );
    } else {
      setCurrentView(VIEWS.LIBRARY);
      setLibraryTab('diagrams');
      pushViewState({ currentView: VIEWS.LIBRARY, libraryTab: 'diagrams' }, '/library');
    }
    setEditingDiagramId(null);
  };

  const navigateToLibrary = (tab = 'exercises') => {
    setCurrentView(VIEWS.LIBRARY);
    setLibraryTab(tab);
    setSelectedTeamId(null);
    setSelectedSessionId(null);
    setSelectedSectionId(null);
    setEditingDiagramId(null);
    pushViewState({ currentView: VIEWS.LIBRARY, libraryTab: tab }, '/library');
  };

  const navigateToSchedule = () => {
    setCurrentView(VIEWS.SCHEDULE);
    setSelectedTeamId(null);
    setSelectedSessionId(null);
    setSelectedSectionId(null);
    setEditingDiagramId(null);
    pushViewState({ currentView: VIEWS.SCHEDULE }, '/schedule');
  };

  const navigateToSettings = () => {
    setCurrentView(VIEWS.SETTINGS);
    setSelectedTeamId(null);
    setSelectedSessionId(null);
    setSelectedSectionId(null);
    setEditingDiagramId(null);
    pushViewState({ currentView: VIEWS.SETTINGS }, '/settings');
  };

  const navigateToWelcome = () => {
    setCurrentView(VIEWS.WELCOME);
    setSelectedTeamId(null);
    setSelectedSessionId(null);
    setSelectedSectionId(null);
    setEditingDiagramId(null);
    pushViewState({ currentView: VIEWS.WELCOME }, '/welcome');
  };

  // Navigate to library in insert mode (from session builder)
  const navigateToLibraryInsert = (tab = 'exercises', teamId, sessionId, sectionId = null) => {
    setCurrentView(VIEWS.LIBRARY);
    setLibraryTab(tab);
    setSelectedTeamId(teamId);
    setSelectedSessionId(sessionId);
    setSelectedSectionId(sectionId);
    setEditingDiagramId(null);
    pushViewState(
      { currentView: VIEWS.LIBRARY, libraryTab: tab, selectedTeamId: teamId, selectedSessionId: sessionId, selectedSectionId: sectionId },
      '/library',
    );
  };

  // ============ Return API ============

  return {
    // State
    teamsData,
    currentView,
    selectedTeamId,
    selectedSessionId,
    selectedSectionId,
    selectedVariationId,
    editingDiagramId,
    libraryTab,
    showStorageLimitModal,
    setShowStorageLimitModal,

    // Data loading
    loadTeamsFromServer,

    // Team operations
    createTeam,
    updateTeam,
    deleteTeam,
    getTeam,

    // Session operations
    createSession,
    updateSession,
    deleteSession,
    getSession,
    duplicateSession,

    // Sync
    flushDirtyEntities,
    pushAllToPostgres: () => putAllToPostgres(teamsData),

    // Navigation
    navigateToTeams,
    navigateToTeamDetail,
    navigateToSessionBuilder,
    navigateToDiagramBuilder,
    navigateToVariationDiagramBuilder,
    navigateToDiagramLibrary,
    navigateToEditLibraryDiagram,
    navigateBackFromDiagramBuilder,
    navigateToSchedule,
    navigateToSettings,
    navigateToWelcome,
    navigateToLibrary,
    navigateToLibraryInsert,
  };
}

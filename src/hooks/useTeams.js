import { useState, useEffect, useRef } from 'react';
import {
  uid,
  nowIso,
  slugify,
  defaultTeam,
  defaultSession,
} from '../utils/helpers';
import { CURRENT_VIEW_KEY } from '../constants/storage';
import { VIEWS } from '../constants/navigation';
import {
  useStore,
  getState,
  findSession,
  teams as teamStore,
  sessions as sessionStore,
  editDraft,
  discardDraft,
  saveDraft,
} from '../data/store';

// Paths that are handled by AppShell or reserved — never match as team slugs
const RESERVED_PATHS = new Set([
  'teams', 'diagrams', 'library', 'shared', 'import', 'share',
  'privacy', 'support', 'api', 'assets', 'favicon', 'double-booked', 'community', 'auth', 'join',
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

  // /community → the Library's Community tab (signed-out visitors get the
  // standalone page in AppShell instead)
  if (segments[0] === 'community') {
    return { currentView: VIEWS.LIBRARY, libraryTab: 'community' };
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

// --- Leave guard ------------------------------------------------------------
// An open editor with unsaved changes (session builder, diagram builder)
// registers a guard. Every navigation — in-app links and the browser's Back /
// Forward — asks it first. The guard returns true to intercept (and later
// calls `proceed` if the coach decides to leave), false to let it through.
// target: { view, sessionId }
let leaveGuard = null;

export function setLeaveGuard(fn) {
  leaveGuard = fn;
  return () => { if (leaveGuard === fn) leaveGuard = null; };
}

function guarded(target, go) {
  if (leaveGuard && leaveGuard(target, () => { leaveGuard = null; go(); })) return;
  go();
}

export default function useTeams() {
  // Teams data lives in the shared store (server snapshot); this hook adds
  // navigation on top of it.
  const teamsData = useStore(st => st.teamsData);
  const drafts = useStore(st => st.drafts);

  // Navigation state
  const [currentView, setCurrentView] = useState(VIEWS.TEAMS);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [selectedVariationId, setSelectedVariationId] = useState(null); // For editing variation diagrams
  const [editingDiagramId, setEditingDiagramId] = useState(null); // For editing library diagrams
  const [libraryTab, setLibraryTab] = useState('exercises'); // Active tab when in LIBRARY view

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

  // Resolve the initial URL once, the first time teams are available (from
  // the offline cache or the server, whichever lands first). Views don't
  // render until this has run (navReady) — otherwise a child view's own
  // effects (e.g. Teams auto-opening the default team) rewrite the URL first
  // and the deep link is lost. Resolve from the path the page loaded with.
  const resolvedInitialUrl = useRef(false);
  const initialPath = useRef(window.location.pathname);
  const [navReady, setNavReady] = useState(false);
  useEffect(() => {
    if (!teamsData || resolvedInitialUrl.current) return;
    resolvedInitialUrl.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNavReady(true);

    const pathname = initialPath.current;
    const urlResolved = resolveUrl(pathname, teamsData.teams);

    if (urlResolved) {
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
      return;
    }

    // Static / special pages (privacy, support, shared links…) own their URL.
    const firstSegment = pathname.split('/').filter(Boolean)[0];
    if (firstSegment && RESERVED_PATHS.has(firstSegment)) return;

    // URL didn't match — fall back to saved navigation state
    try {
      const savedView = localStorage.getItem(CURRENT_VIEW_KEY);
      if (!savedView) return;
      const viewState = JSON.parse(savedView);
      setCurrentView(viewState.currentView || VIEWS.TEAMS);
      setSelectedTeamId(viewState.selectedTeamId || null);
      setSelectedSessionId(viewState.selectedSessionId || null);
      setSelectedSectionId(viewState.selectedSectionId || null);
      setSelectedVariationId(viewState.selectedVariationId || null);
      setEditingDiagramId(viewState.editingDiagramId || null);
      window.history.replaceState(viewState, '', buildUrl(viewState, teamsData.teams));
    } catch (error) {
      console.error('Error restoring view state:', error);
    }
  }, [teamsData]);

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

  // Last URL/state this tab showed, so a guarded Back can be undone.
  const shownRef = useRef({ url: window.location.pathname, state: null });
  useEffect(() => {
    shownRef.current = { url: window.location.pathname, state: window.history.state };
  });

  // Listen for browser back/forward buttons
  useEffect(() => {
    const apply = (state) => {
      skipNextPush.current = true;
      setCurrentView(state.currentView);
      setSelectedTeamId(state.selectedTeamId || null);
      setSelectedSessionId(state.selectedSessionId || null);
      setSelectedSectionId(state.selectedSectionId || null);
      setSelectedVariationId(state.selectedVariationId || null);
      setEditingDiagramId(state.editingDiagramId || null);
      if (state.libraryTab) setLibraryTab(state.libraryTab);
    };
    const handlePopState = (event) => {
      const state = event.state;
      if (!state || !state.currentView) return;
      const target = { view: state.currentView, sessionId: state.selectedSessionId || null };
      const targetUrl = window.location.pathname;
      const shown = shownRef.current;
      const intercepted = leaveGuard && leaveGuard(target, () => {
        leaveGuard = null;
        window.history.pushState(state, '', targetUrl);
        apply(state);
      });
      if (intercepted) {
        // The browser already moved; put the editor's entry back on top.
        window.history.pushState(shown.state, '', shown.url);
        return;
      }
      apply(state);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ============ Team CRUD Operations ============
  // Each of these writes to the server immediately (see data/store.js).

  const createTeam = (name, ageGroup = '') => {
    const team = defaultTeam(name, ageGroup);
    teamStore.create(team);
    return team;
  };

  const updateTeam = (teamId, updates) => {
    teamStore.update(teamId, { ...updates, updatedAt: nowIso() });
  };

  const deleteTeam = (teamId) => teamStore.remove(teamId);

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
    sessionStore.create(teamId, session);
    return session;
  };

  // Immediate save — for edits made outside the session builder (rescheduling,
  // library consolidation, …). The builder edits a draft instead.
  const updateSession = (teamId, sessionId, updates) => {
    sessionStore.update(teamId, sessionId, { ...updates, updatedAt: nowIso() });
  };

  const deleteSession = (teamId, sessionId) => sessionStore.remove(teamId, sessionId);

  // What this tab is showing for a session: its unsaved draft if one is open,
  // otherwise the saved copy.
  const getSession = (teamId, sessionId) => {
    return drafts[sessionId]?.value || findSession(getState(), teamId, sessionId);
  };

  const getSavedSession = (teamId, sessionId) => findSession(getState(), teamId, sessionId);

  // Session-builder draft: edits stay in this tab until saveSessionDraft().
  const editSessionDraft = (teamId, sessionId, updates) => {
    editDraft(teamId, sessionId, updates);
  };

  const duplicateSession = (teamId, sessionId) => {
    const originalSession = getSession(teamId, sessionId);
    if (!originalSession) return null;

    const { version: _v, ...original } = originalSession;
    const duplicatedSession = {
      ...JSON.parse(JSON.stringify(original)), // Deep clone
      id: uid(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      summary: {
        ...original.summary,
        title: `${original.summary.title} (Copy)`,
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

  // Navigation goes through the leave guard (see setLeaveGuard).
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
    drafts,
    navReady,

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
    getSavedSession,
    duplicateSession,

    // Session-builder drafts
    editSessionDraft,
    saveSessionDraft: saveDraft,
    discardSessionDraft: discardDraft,

    // Navigation
    navigateToTeams: (...a) => guarded((() => ({ view: VIEWS.TEAMS }))(...a), () => navigateToTeams(...a)),
    navigateToTeamDetail: (...a) => guarded(((teamId) => ({ view: VIEWS.TEAM_DETAIL, teamId }))(...a), () => navigateToTeamDetail(...a)),
    navigateToSessionBuilder: (...a) => guarded(((teamId, sessionId) => ({ view: VIEWS.SESSION_BUILDER, sessionId }))(...a), () => navigateToSessionBuilder(...a)),
    navigateToDiagramBuilder: (...a) => guarded(((teamId, sessionId) => ({ view: VIEWS.DIAGRAM_BUILDER, sessionId }))(...a), () => navigateToDiagramBuilder(...a)),
    navigateToVariationDiagramBuilder: (...a) => guarded(((teamId, sessionId) => ({ view: VIEWS.DIAGRAM_BUILDER, sessionId }))(...a), () => navigateToVariationDiagramBuilder(...a)),
    navigateToDiagramLibrary: (...a) => guarded(((insertMode, teamId, sessionId) => ({ view: VIEWS.DIAGRAM_LIBRARY, sessionId: insertMode ? sessionId : null }))(...a), () => navigateToDiagramLibrary(...a)),
    navigateToEditLibraryDiagram: (...a) => guarded((() => ({ view: VIEWS.DIAGRAM_BUILDER, sessionId: null }))(...a), () => navigateToEditLibraryDiagram(...a)),
    navigateBackFromDiagramBuilder: (...a) => guarded((() => ({ view: selectedSessionId ? VIEWS.SESSION_BUILDER : VIEWS.LIBRARY, sessionId: selectedSessionId }))(...a), () => navigateBackFromDiagramBuilder(...a)),
    navigateToSchedule: (...a) => guarded((() => ({ view: VIEWS.SCHEDULE }))(...a), () => navigateToSchedule(...a)),
    navigateToSettings: (...a) => guarded((() => ({ view: VIEWS.SETTINGS }))(...a), () => navigateToSettings(...a)),
    navigateToWelcome: (...a) => guarded((() => ({ view: VIEWS.WELCOME }))(...a), () => navigateToWelcome(...a)),
    navigateToLibrary: (...a) => guarded((() => ({ view: VIEWS.LIBRARY }))(...a), () => navigateToLibrary(...a)),
    navigateToLibraryInsert: (...a) => guarded(((tab, teamId, sessionId) => ({ view: VIEWS.LIBRARY, sessionId }))(...a), () => navigateToLibraryInsert(...a)),
  };
}

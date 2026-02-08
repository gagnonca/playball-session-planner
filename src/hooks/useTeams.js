import { useState, useEffect, useRef } from 'react';
import {
  uid,
  nowIso,
  defaultTeam,
  defaultSession,
  migrateToTeamStructure,
} from '../utils/helpers';
import { TEAMS_KEY, CURRENT_VIEW_KEY, LEGACY_SESSION_KEY } from '../constants/storage';
import { VIEWS } from '../constants/navigation';

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

  // Ref to skip pushState when restoring from popstate
  const skipNextPush = useRef(false);

  // Helper to push view state to browser history
  const pushViewState = (viewState) => {
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    window.history.pushState(viewState, '');
  };

  // Initialize teams data with auto-migration
  useEffect(() => {
    try {
      // Check if teams data already exists
      const existingTeamsData = localStorage.getItem(TEAMS_KEY);

      if (existingTeamsData) {
        // Load existing teams
        const data = JSON.parse(existingTeamsData);
        setTeamsData(data);
      } else {
        // Check for legacy session data to migrate
        const legacySessionData = localStorage.getItem(LEGACY_SESSION_KEY);

        if (legacySessionData) {
          // Migrate legacy data
          const legacySession = JSON.parse(legacySessionData);
          const migratedData = migrateToTeamStructure(legacySession);
          setTeamsData(migratedData);
          localStorage.setItem(TEAMS_KEY, JSON.stringify(migratedData));
          console.log('Migrated legacy session to team structure');
        } else {
          // Initialize with empty teams
          const initialData = {
            version: 1,
            teams: [],
            defaultTeamId: null,
          };
          setTeamsData(initialData);
          localStorage.setItem(TEAMS_KEY, JSON.stringify(initialData));
        }
      }

      // Load navigation state
      const savedView = localStorage.getItem(CURRENT_VIEW_KEY);
      if (savedView) {
        const viewState = JSON.parse(savedView);
        setCurrentView(viewState.currentView || VIEWS.TEAMS);
        setSelectedTeamId(viewState.selectedTeamId || null);
        setSelectedSessionId(viewState.selectedSessionId || null);
        setSelectedSectionId(viewState.selectedSectionId || null);
        setSelectedVariationId(viewState.selectedVariationId || null);
        setEditingDiagramId(viewState.editingDiagramId || null);
      }
    } catch (error) {
      console.error('Error initializing teams:', error);
      // Fallback to empty state
      const fallbackData = {
        version: 1,
        teams: [],
        defaultTeamId: null,
      };
      setTeamsData(fallbackData);
    }
  }, []);

  // Save teams data to localStorage whenever it changes
  useEffect(() => {
    if (teamsData) {
      try {
        localStorage.setItem(TEAMS_KEY, JSON.stringify(teamsData));
      } catch (error) {
        console.error('Error saving teams:', error);
      }
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

  // Replace initial history entry with current view state on mount
  useEffect(() => {
    const savedView = localStorage.getItem(CURRENT_VIEW_KEY);
    if (savedView) {
      try {
        window.history.replaceState(JSON.parse(savedView), '');
      } catch (e) { /* ignore */ }
    }
  }, []);

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
    return team;
  };

  const updateTeam = (teamId, updates) => {
    setTeamsData(prev => ({
      ...prev,
      teams: prev.teams.map(team =>
        team.id === teamId
          ? { ...team, ...updates, updatedAt: nowIso() }
          : team
      ),
    }));
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
    return session;
  };

  const updateSession = (teamId, sessionId, updates) => {
    setTeamsData(prev => ({
      ...prev,
      teams: prev.teams.map(team =>
        team.id === teamId
          ? {
              ...team,
              sessions: team.sessions.map(session =>
                session.id === sessionId
                  ? { ...session, ...updates, updatedAt: nowIso() }
                  : session
              ),
              updatedAt: nowIso(),
            }
          : team
      ),
    }));
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
    pushViewState({ currentView: VIEWS.TEAMS });
  };

  const navigateToTeamDetail = (teamId) => {
    setCurrentView(VIEWS.TEAM_DETAIL);
    setSelectedTeamId(teamId);
    setSelectedSessionId(null);
    pushViewState({ currentView: VIEWS.TEAM_DETAIL, selectedTeamId: teamId });
  };

  const navigateToSessionBuilder = (teamId, sessionId) => {
    setCurrentView(VIEWS.SESSION_BUILDER);
    setSelectedTeamId(teamId);
    setSelectedSessionId(sessionId);
    setSelectedSectionId(null);
    setEditingDiagramId(null);
    pushViewState({ currentView: VIEWS.SESSION_BUILDER, selectedTeamId: teamId, selectedSessionId: sessionId });
  };

  const navigateToDiagramBuilder = (teamId, sessionId, sectionId) => {
    setCurrentView(VIEWS.DIAGRAM_BUILDER);
    setSelectedTeamId(teamId);
    setSelectedSessionId(sessionId);
    setSelectedSectionId(sectionId);
    setSelectedVariationId(null);
    setEditingDiagramId(null);
    pushViewState({ currentView: VIEWS.DIAGRAM_BUILDER, selectedTeamId: teamId, selectedSessionId: sessionId, selectedSectionId: sectionId });
  };

  const navigateToVariationDiagramBuilder = (teamId, sessionId, sectionId, variationId, useParentAsBase = false) => {
    setCurrentView(VIEWS.DIAGRAM_BUILDER);
    setSelectedTeamId(teamId);
    setSelectedSessionId(sessionId);
    setSelectedSectionId(sectionId);
    setSelectedVariationId(variationId);
    setEditingDiagramId(useParentAsBase ? 'USE_PARENT' : null);
    pushViewState({ currentView: VIEWS.DIAGRAM_BUILDER, selectedTeamId: teamId, selectedSessionId: sessionId, selectedSectionId: sectionId, selectedVariationId: variationId, editingDiagramId: useParentAsBase ? 'USE_PARENT' : null });
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
    pushViewState({ currentView: VIEWS.DIAGRAM_LIBRARY, selectedTeamId: insertMode ? teamId : null, selectedSessionId: insertMode ? sessionId : null, selectedSectionId: insertMode ? sectionId : null });
  };

  const navigateToEditLibraryDiagram = (diagramId) => {
    setCurrentView(VIEWS.DIAGRAM_BUILDER);
    setEditingDiagramId(diagramId);
    setSelectedTeamId(null);
    setSelectedSessionId(null);
    setSelectedSectionId(null);
    pushViewState({ currentView: VIEWS.DIAGRAM_BUILDER, editingDiagramId: diagramId });
  };

  const navigateBackFromDiagramBuilder = () => {
    if (selectedTeamId && selectedSessionId) {
      setCurrentView(VIEWS.SESSION_BUILDER);
      setSelectedSectionId(null);
      pushViewState({ currentView: VIEWS.SESSION_BUILDER, selectedTeamId, selectedSessionId });
    } else {
      setCurrentView(VIEWS.DIAGRAM_LIBRARY);
      pushViewState({ currentView: VIEWS.DIAGRAM_LIBRARY });
    }
    setEditingDiagramId(null);
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

    // Navigation
    navigateToTeams,
    navigateToTeamDetail,
    navigateToSessionBuilder,
    navigateToDiagramBuilder,
    navigateToVariationDiagramBuilder,
    navigateToDiagramLibrary,
    navigateToEditLibraryDiagram,
    navigateBackFromDiagramBuilder,
  };
}

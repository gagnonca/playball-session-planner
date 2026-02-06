import { useState, useEffect } from 'react';
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
  const [editingDiagramId, setEditingDiagramId] = useState(null); // For editing library diagrams

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
        editingDiagramId,
      };
      localStorage.setItem(CURRENT_VIEW_KEY, JSON.stringify(viewState));
    } catch (error) {
      console.error('Error saving view state:', error);
    }
  }, [currentView, selectedTeamId, selectedSessionId, selectedSectionId, editingDiagramId]);

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
    const session = sessionData || defaultSession();
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
  };

  const navigateToTeamDetail = (teamId) => {
    setCurrentView(VIEWS.TEAM_DETAIL);
    setSelectedTeamId(teamId);
    setSelectedSessionId(null);
  };

  const navigateToSessionBuilder = (teamId, sessionId) => {
    setCurrentView(VIEWS.SESSION_BUILDER);
    setSelectedTeamId(teamId);
    setSelectedSessionId(sessionId);
    setSelectedSectionId(null);
    setEditingDiagramId(null);
  };

  const navigateToDiagramBuilder = (teamId, sessionId, sectionId) => {
    setCurrentView(VIEWS.DIAGRAM_BUILDER);
    setSelectedTeamId(teamId);
    setSelectedSessionId(sessionId);
    setSelectedSectionId(sectionId);
    setEditingDiagramId(null);
  };

  const navigateToDiagramLibrary = (insertMode = false, teamId = null, sessionId = null, sectionId = null) => {
    setCurrentView(VIEWS.DIAGRAM_LIBRARY);
    if (insertMode) {
      // Keep context for inserting back to section
      setSelectedTeamId(teamId);
      setSelectedSessionId(sessionId);
      setSelectedSectionId(sectionId);
    } else {
      setSelectedTeamId(null);
      setSelectedSessionId(null);
      setSelectedSectionId(null);
    }
    setEditingDiagramId(null);
  };

  const navigateToEditLibraryDiagram = (diagramId) => {
    setCurrentView(VIEWS.DIAGRAM_BUILDER);
    setEditingDiagramId(diagramId);
    // Clear section context when editing library diagram
    setSelectedTeamId(null);
    setSelectedSessionId(null);
    setSelectedSectionId(null);
  };

  const navigateBackFromDiagramBuilder = () => {
    if (selectedTeamId && selectedSessionId) {
      // Return to session builder
      setCurrentView(VIEWS.SESSION_BUILDER);
      setSelectedSectionId(null);
    } else {
      // Return to diagram library
      setCurrentView(VIEWS.DIAGRAM_LIBRARY);
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
    navigateToDiagramLibrary,
    navigateToEditLibraryDiagram,
    navigateBackFromDiagramBuilder,
  };
}

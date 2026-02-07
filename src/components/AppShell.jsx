import React, { useState, useEffect } from 'react';
import useTeams from '../hooks/useTeams';
import useDiagramLibrary from '../hooks/useDiagramLibrary';
import useSync from '../hooks/useSync';
import useSharing from '../hooks/useSharing';
import { VIEWS } from '../constants/navigation';
import { SHARED_TEAMS_KEY } from '../constants/storage';
import TeamList from './teams/TeamList';
import TeamDetail from './teams/TeamDetail';
import SessionBuilder from './session-builder/SessionBuilder';
import DiagramLibrary from './DiagramLibrary';
import DiagramBuilder from './DiagramBuilder';
import LinkDeviceModal from './LinkDeviceModal';

export default function AppShell() {
  const teamsContext = useTeams();
  const diagramLibrary = useDiagramLibrary();
  const syncContext = useSync();
  const sharingContext = useSharing();

  const [showLinkDeviceModal, setShowLinkDeviceModal] = useState(false);
  const [sharedTeamToken, setSharedTeamToken] = useState(null);
  const [sharedTeamData, setSharedTeamData] = useState(null);
  const [sharedTeamError, setSharedTeamError] = useState(null);

  const {
    currentView,
    teamsData,
    selectedTeamId,
    selectedSessionId,
    selectedSectionId,
    editingDiagramId,
    getTeam,
    getSession,
    updateSession,
    navigateBackFromDiagramBuilder,
    navigateToDiagramLibrary,
  } = teamsContext;

  // Check for shared team URL on mount
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/shared/')) {
      const token = path.split('/shared/')[1];
      if (token) {
        setSharedTeamToken(token);
        loadSharedTeam(token);
      }
    }
  }, []);

  // Load shared team data
  const loadSharedTeam = async (token) => {
    try {
      const team = await sharingContext.fetchSharedTeam(token);
      setSharedTeamData(team);
      setSharedTeamError(null);
    } catch (err) {
      setSharedTeamError(err.message);
      setSharedTeamData(null);
    }
  };

  // Exit shared team view
  const exitSharedView = () => {
    setSharedTeamToken(null);
    setSharedTeamData(null);
    setSharedTeamError(null);
    window.history.pushState({}, '', '/');
  };

  // Initialize sync on first load (auto-create identity)
  useEffect(() => {
    if (teamsData && !syncContext.identity && syncContext.isOnline) {
      // Auto-initialize identity for new users
      // Commented out for now - let users explicitly enable sync
      // syncContext.initializeIdentity();
    }
  }, [teamsData, syncContext.identity, syncContext.isOnline]);

  // Sync teams when they change
  useEffect(() => {
    if (teamsData && syncContext.isSyncEnabled) {
      syncContext.pushTeams(teamsData);
    }
  }, [teamsData, syncContext.isSyncEnabled]);

  // Wait for teams data to load
  if (!teamsData) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show shared team view if viewing a shared link
  if (sharedTeamToken) {
    if (sharingContext.isLoading) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading shared team...</p>
          </div>
        </div>
      );
    }

    if (sharedTeamError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
          <div className="text-center max-w-md">
            <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-bold mb-2">Link Not Valid</h2>
            <p className="text-slate-400 mb-6">{sharedTeamError}</p>
            <button onClick={exitSharedView} className="btn btn-primary">
              Go to My Teams
            </button>
          </div>
        </div>
      );
    }

    if (sharedTeamData) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100">
          {/* Shared Team Header */}
          <div className="bg-slate-800 border-b border-slate-700 p-6">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs font-medium rounded">
                  Shared Team
                </span>
                <span className="text-slate-500 text-sm">View Only</span>
              </div>
              <h1 className="text-3xl font-bold mb-2">{sharedTeamData.teamName}</h1>
              {sharedTeamData.ageGroup && (
                <p className="text-slate-400">{sharedTeamData.ageGroup}</p>
              )}
              <div className="flex items-center gap-4 mt-4">
                <button
                  onClick={() => loadSharedTeam(sharedTeamToken)}
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Check for Updates
                </button>
                <button
                  onClick={exitSharedView}
                  className="text-slate-400 hover:text-slate-300 text-sm"
                >
                  Go to My Teams
                </button>
              </div>
            </div>
          </div>

          {/* Shared Sessions */}
          <div className="max-w-6xl mx-auto p-6">
            <h2 className="text-xl font-bold mb-4">Sessions ({sharedTeamData.sessions?.length || 0})</h2>
            {sharedTeamData.sessions?.length === 0 ? (
              <div className="card p-8 text-center text-slate-400">
                No sessions in this team yet.
              </div>
            ) : (
              <div className="space-y-4">
                {sharedTeamData.sessions.map((session) => (
                  <div key={session.id} className="card p-4">
                    <h3 className="font-semibold text-lg">
                      {session.summary?.title || 'Untitled Session'}
                    </h3>
                    {session.summary?.date && (
                      <p className="text-slate-400 text-sm">{session.summary.date}</p>
                    )}
                    {session.summary?.moment && (
                      <span className="inline-block mt-2 px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded">
                        {session.summary.moment}
                      </span>
                    )}
                    <p className="text-slate-500 text-sm mt-2">
                      {session.sections?.length || 0} section(s)
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  // Handle saving diagram from builder back to section AND to library
  const handleDiagramSave = (diagramData) => {
    if (selectedTeamId && selectedSessionId && selectedSectionId) {
      // Get current session and update the specific section
      const team = getTeam(selectedTeamId);
      const session = getSession(selectedTeamId, selectedSessionId);
      if (session) {
        const section = session.sections.find(s => s.id === selectedSectionId);
        const updatedSections = session.sections.map(s =>
          s.id === selectedSectionId
            ? { ...s, diagramData, imageDataUrl: diagramData.dataUrl }
            : s
        );
        updateSession(selectedTeamId, selectedSessionId, { sections: updatedSections });

        // Also save to library with context
        diagramLibrary.saveDiagram(
          {
            dataUrl: diagramData.dataUrl,
            elements: diagramData.elements || [],
            lines: diagramData.lines || [],
            fieldType: diagramData.fieldType || 'full',
          },
          diagramData.name || section?.name || 'Untitled Diagram',
          diagramData.description || '',
          {
            ageGroup: team?.ageGroup || '',
            moments: session?.summary?.moment ? [session.summary.moment] : [],
            type: section?.type || '',
          }
        );
      }
      navigateBackFromDiagramBuilder();
    } else if (editingDiagramId) {
      // Updating a library diagram
      diagramLibrary.updateDiagram(editingDiagramId, {
        name: diagramData.name,
        description: diagramData.description,
        dataUrl: diagramData.dataUrl,
        elements: diagramData.elements || [],
        lines: diagramData.lines || [],
        fieldType: diagramData.fieldType || 'full',
        tags: diagramData.tags || {},
      });
      navigateBackFromDiagramBuilder();
    } else {
      // Creating new diagram from library (no section context, no existing diagram)
      diagramLibrary.saveDiagram(
        {
          dataUrl: diagramData.dataUrl,
          elements: diagramData.elements || [],
          lines: diagramData.lines || [],
          fieldType: diagramData.fieldType || 'full',
        },
        diagramData.name || 'Untitled Diagram',
        diagramData.description || '',
        diagramData.tags || {}
      );
      navigateBackFromDiagramBuilder();
    }
  };

  // Get initial diagram data and context for editor
  const getDiagramContext = () => {
    if (editingDiagramId) {
      // Editing library diagram - return existing data
      const diagram = diagramLibrary.getDiagram(editingDiagramId);
      return {
        initialDiagram: diagram,
        defaultName: diagram?.name || '',
        defaultDescription: diagram?.description || '',
        ageGroup: diagram?.tags?.ageGroup || '',
        moment: diagram?.tags?.moment || '',
        sectionType: diagram?.tags?.type || '',
      };
    } else if (selectedTeamId && selectedSessionId && selectedSectionId) {
      // Editing section diagram - get context from team/session/section
      const team = getTeam(selectedTeamId);
      const session = getSession(selectedTeamId, selectedSessionId);
      const section = session?.sections.find(s => s.id === selectedSectionId);
      return {
        initialDiagram: section?.diagramData || null,
        defaultName: section?.name || '',
        defaultDescription: section?.objective || '',
        ageGroup: team?.ageGroup || '',
        moment: session?.summary?.moment || '',
        sectionType: section?.type || '',
      };
    }
    return {
      initialDiagram: null,
      defaultName: '',
      defaultDescription: '',
      ageGroup: '',
      moment: '',
      sectionType: '',
    };
  };

  // Full-page diagram builder view
  if (currentView === VIEWS.DIAGRAM_BUILDER) {
    const context = getDiagramContext();
    return (
      <div className="min-h-screen bg-slate-900">
        <DiagramBuilder
          initialDiagram={context.initialDiagram}
          defaultName={context.defaultName}
          defaultDescription={context.defaultDescription}
          ageGroup={context.ageGroup}
          moment={context.moment}
          sectionType={context.sectionType}
          onSave={handleDiagramSave}
          onClose={navigateBackFromDiagramBuilder}
        />
      </div>
    );
  }

  // Diagram library view
  if (currentView === VIEWS.DIAGRAM_LIBRARY) {
    return (
      <DiagramLibrary
        teamsContext={teamsContext}
        diagramLibrary={diagramLibrary}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {currentView === VIEWS.TEAMS && (
        <TeamList
          teamsContext={teamsContext}
          diagramLibrary={diagramLibrary}
          syncContext={syncContext}
          onShowLinkDevice={() => setShowLinkDeviceModal(true)}
        />
      )}
      {currentView === VIEWS.TEAM_DETAIL && (
        <TeamDetail
          teamsContext={teamsContext}
          sharingContext={sharingContext}
        />
      )}
      {currentView === VIEWS.SESSION_BUILDER && (
        <SessionBuilder
          teamsContext={teamsContext}
          diagramLibrary={diagramLibrary}
        />
      )}

      {/* Link Device Modal */}
      {showLinkDeviceModal && (
        <LinkDeviceModal
          onClose={() => setShowLinkDeviceModal(false)}
          hasIdentity={syncContext.isSyncEnabled}
          onRequestCode={syncContext.requestPairingCode}
          onConfirmCode={async (code) => {
            const teams = await syncContext.confirmPairingCode(code);
            if (teams) {
              // Reload page to pick up synced teams
              window.location.reload();
            }
          }}
          onInitialize={async () => {
            await syncContext.initializeIdentity();
            // Push current local teams to server
            if (teamsData) {
              await syncContext.forcePush(teamsData);
            }
          }}
        />
      )}
    </div>
  );
}

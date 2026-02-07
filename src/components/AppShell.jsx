import React, { useState, useEffect, useRef } from 'react';
import useTeams from '../hooks/useTeams';
import useDiagramLibrary from '../hooks/useDiagramLibrary';
import useSync from '../hooks/useSync';
import useSharing from '../hooks/useSharing';
import { VIEWS } from '../constants/navigation';
import { SHARED_TEAMS_KEY, TEAMS_KEY } from '../constants/storage';
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
  const [selectedSharedSession, setSelectedSharedSession] = useState(null);
  const hasCheckedForUpdates = useRef(false);
  const sharedTeamsPushTimeouts = useRef({});

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

  // Sync teams when they change (push to server)
  useEffect(() => {
    if (teamsData && syncContext.isSyncEnabled) {
      syncContext.pushTeams(teamsData);
    }
  }, [teamsData, syncContext.isSyncEnabled]);

  // Auto-pull from server on app load when sync is enabled
  useEffect(() => {
    const checkForServerUpdates = async () => {
      // Only check once per app load
      if (hasCheckedForUpdates.current) return;
      if (!syncContext.isSyncEnabled || !syncContext.isOnline) return;
      if (!teamsData) return;

      hasCheckedForUpdates.current = true;

      try {
        const result = await syncContext.pullTeams();
        if (result && result.version > (syncContext.identity?.localVersion || 0)) {
          // Server has newer data - update localStorage and reload
          localStorage.setItem(TEAMS_KEY, JSON.stringify(result.teams));
          window.location.reload();
        }
      } catch (err) {
        console.error('Failed to check for server updates:', err);
      }
    };

    checkForServerUpdates();
  }, [teamsData, syncContext.isSyncEnabled, syncContext.isOnline]);

  // Auto-push shared teams when teamsData changes
  useEffect(() => {
    if (!teamsData?.teams) return;

    // Find all shared teams
    const sharedTeams = teamsData.teams.filter(t => t.sharing?.isShared && t.sharing?.shareToken);

    sharedTeams.forEach(team => {
      const token = team.sharing.shareToken;

      // Clear existing timeout for this team
      if (sharedTeamsPushTimeouts.current[token]) {
        clearTimeout(sharedTeamsPushTimeouts.current[token]);
      }

      // Debounce: wait 3 seconds before pushing to avoid rapid updates
      sharedTeamsPushTimeouts.current[token] = setTimeout(() => {
        sharingContext.pushUpdate(token, team)
          .catch(err => console.error('Failed to auto-sync shared team:', err));
      }, 3000);
    });

    // Cleanup function to clear timeouts
    return () => {
      Object.values(sharedTeamsPushTimeouts.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, [teamsData]);

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
      // Show session detail view if a session is selected
      if (selectedSharedSession) {
        return (
          <div className="min-h-screen bg-slate-900 text-slate-100">
            {/* Session Header */}
            <div className="bg-slate-800 border-b border-slate-700 p-6">
              <div className="max-w-4xl mx-auto">
                <button
                  onClick={() => setSelectedSharedSession(null)}
                  className="text-blue-400 hover:text-blue-300 mb-3 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Sessions
                </button>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs font-medium rounded">
                    Shared Team
                  </span>
                  <span className="text-slate-500 text-sm">View Only</span>
                </div>
                <h1 className="text-2xl font-bold">
                  {selectedSharedSession.summary?.title || 'Untitled Session'}
                </h1>
                {selectedSharedSession.summary?.date && (
                  <p className="text-slate-400 mt-1">{selectedSharedSession.summary.date}</p>
                )}
              </div>
            </div>

            {/* Session Content */}
            <div className="max-w-4xl mx-auto p-6">
              {/* Session Summary */}
              <div className="card p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Session Info</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedSharedSession.summary?.moment && (
                    <div>
                      <span className="text-slate-500">Moment:</span>
                      <span className="ml-2 text-slate-300">{selectedSharedSession.summary.moment}</span>
                    </div>
                  )}
                  {selectedSharedSession.summary?.theme && (
                    <div>
                      <span className="text-slate-500">Theme:</span>
                      <span className="ml-2 text-slate-300">{selectedSharedSession.summary.theme}</span>
                    </div>
                  )}
                  {selectedSharedSession.summary?.playerCount && (
                    <div>
                      <span className="text-slate-500">Players:</span>
                      <span className="ml-2 text-slate-300">{selectedSharedSession.summary.playerCount}</span>
                    </div>
                  )}
                  {selectedSharedSession.summary?.duration && (
                    <div>
                      <span className="text-slate-500">Duration:</span>
                      <span className="ml-2 text-slate-300">{selectedSharedSession.summary.duration} min</span>
                    </div>
                  )}
                </div>
                {selectedSharedSession.summary?.notes && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <span className="text-slate-500 text-sm">Notes:</span>
                    <p className="text-slate-300 mt-1 whitespace-pre-wrap">{selectedSharedSession.summary.notes}</p>
                  </div>
                )}
              </div>

              {/* Sections */}
              <h2 className="text-lg font-semibold mb-4">
                Sections ({selectedSharedSession.sections?.length || 0})
              </h2>
              {selectedSharedSession.sections?.length === 0 ? (
                <div className="card p-8 text-center text-slate-400">
                  No sections in this session.
                </div>
              ) : (
                <div className="space-y-6">
                  {selectedSharedSession.sections.map((section, index) => (
                    <div key={section.id} className="card p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <span className="text-xs text-slate-500 uppercase tracking-wider">
                            {section.type || 'Section'} • {section.duration || '?'} min
                          </span>
                          <h3 className="text-lg font-semibold mt-1">
                            {section.name || `Section ${index + 1}`}
                          </h3>
                        </div>
                      </div>

                      {section.objective && (
                        <div className="mb-4">
                          <span className="text-slate-500 text-sm">Objective:</span>
                          <p className="text-slate-300 mt-1">{section.objective}</p>
                        </div>
                      )}

                      {section.description && (
                        <div className="mb-4">
                          <span className="text-slate-500 text-sm">Description:</span>
                          <p className="text-slate-300 mt-1 whitespace-pre-wrap">{section.description}</p>
                        </div>
                      )}

                      {section.keyPoints && (
                        <div className="mb-4">
                          <span className="text-slate-500 text-sm">Key Points:</span>
                          <p className="text-slate-300 mt-1 whitespace-pre-wrap">{section.keyPoints}</p>
                        </div>
                      )}

                      {/* Diagram */}
                      {section.imageDataUrl && (
                        <div className="mt-4">
                          <img
                            src={section.imageDataUrl}
                            alt="Diagram"
                            className="max-w-full rounded-lg border border-slate-700"
                          />
                        </div>
                      )}

                      {/* Variations */}
                      {section.variations?.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-700">
                          <span className="text-slate-500 text-sm">Variations:</span>
                          <div className="mt-2 space-y-2">
                            {section.variations.map((variation, vIndex) => (
                              <div key={vIndex} className="bg-slate-700/50 rounded p-3">
                                <p className="text-slate-300 text-sm">{variation.text || variation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      // Show session list
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
                  <button
                    key={session.id}
                    onClick={() => setSelectedSharedSession(session)}
                    className="card p-4 w-full text-left hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {session.summary?.title || 'Untitled Session'}
                        </h3>
                        {session.summary?.date && (
                          <p className="text-slate-400 text-sm">{session.summary.date}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {session.summary?.moment && (
                            <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded">
                              {session.summary.moment}
                            </span>
                          )}
                          <span className="text-slate-500 text-sm">
                            {session.sections?.length || 0} section(s)
                          </span>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
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
              // Save teams to localStorage before reloading
              localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
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
          onReset={() => {
            syncContext.resetSync();
            setShowLinkDeviceModal(false);
          }}
        />
      )}
    </div>
  );
}

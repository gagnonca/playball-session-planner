import React from 'react';
import useTeams from '../hooks/useTeams';
import useDiagramLibrary from '../hooks/useDiagramLibrary';
import { VIEWS } from '../constants/navigation';
import TeamList from './teams/TeamList';
import TeamDetail from './teams/TeamDetail';
import SessionBuilder from './session-builder/SessionBuilder';
import DiagramLibrary from './DiagramLibrary';
import DiagramBuilder from './DiagramBuilder';

export default function AppShell() {
  const teamsContext = useTeams();
  const diagramLibrary = useDiagramLibrary();
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
      {currentView === VIEWS.TEAMS && <TeamList teamsContext={teamsContext} diagramLibrary={diagramLibrary} />}
      {currentView === VIEWS.TEAM_DETAIL && <TeamDetail teamsContext={teamsContext} />}
      {currentView === VIEWS.SESSION_BUILDER && <SessionBuilder teamsContext={teamsContext} diagramLibrary={diagramLibrary} />}
    </div>
  );
}

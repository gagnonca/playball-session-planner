import React from 'react';
import useTeams from '../hooks/useTeams';
import TeamList from './teams/TeamList';
import TeamDetail from './teams/TeamDetail';
import SessionBuilder from './session-builder/SessionBuilder';

export default function AppShell() {
  const teamsContext = useTeams();

  const { currentView, teamsData } = teamsContext;

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

  // Render appropriate view based on navigation state
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {currentView === 'teams' && <TeamList teamsContext={teamsContext} />}
      {currentView === 'team-detail' && <TeamDetail teamsContext={teamsContext} />}
      {currentView === 'session-builder' && <SessionBuilder teamsContext={teamsContext} />}
    </div>
  );
}

import React, { useState } from 'react';
import SessionCard from './SessionCard';
import ScheduleSessionModal from './ScheduleSessionModal';
import ShareModal from './ShareModal';
import { toast } from '../../utils/helpers';

export default function TeamDetail({ teamsContext, sharingContext, diagramLibrary }) {
  const {
    selectedTeamId,
    getTeam,
    updateTeam,
    navigateToTeams,
    navigateToSessionBuilder,
    navigateToDiagramLibrary,
    deleteSession,
    duplicateSession,
  } = teamsContext;

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'scheduled'

  const team = getTeam(selectedTeamId);

  if (!team) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-slate-400">Team not found</p>
          <button onClick={navigateToTeams} className="btn btn-primary mt-4">
            Back to Teams
          </button>
        </div>
      </div>
    );
  }

  const sessions = team.sessions || [];

  // Filter sessions based on type
  const filteredSessions = sessions.filter(session => {
    if (filterType === 'scheduled') {
      return session.summary.date && session.summary.date.length > 0;
    }
    return true; // 'all'
  });

  // Sort sessions by date (scheduled first, then by date, then templates by updated date)
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    const aHasDate = a.summary.date && a.summary.date.length > 0;
    const bHasDate = b.summary.date && b.summary.date.length > 0;

    if (aHasDate && !bHasDate) return -1;
    if (!aHasDate && bHasDate) return 1;

    if (aHasDate && bHasDate) {
      return new Date(a.summary.date) - new Date(b.summary.date);
    }

    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  const scheduledCount = sessions.filter(s => s.summary.date && s.summary.date.length > 0).length;

  const handleSelectSession = (sessionId) => {
    navigateToSessionBuilder(selectedTeamId, sessionId);
  };

  const handleDuplicateSession = (sessionId) => {
    const newSession = duplicateSession(selectedTeamId, sessionId);
    if (newSession) {
      toast('Session duplicated');
    }
  };

  const handleDeleteSession = (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session && window.confirm(`Delete "${session.summary.title || 'Untitled Session'}"?`)) {
      deleteSession(selectedTeamId, sessionId);
      toast('Session deleted');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-6">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={navigateToTeams}
            className="text-blue-400 hover:text-blue-300 mb-3 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Teams
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{team.name}</h1>
              <div className="flex items-center gap-3 text-slate-400">
                {team.ageGroup && <span>{team.ageGroup}</span>}
                {team.defaultDuration && (
                  <>
                    {team.ageGroup && <span className="text-slate-600">·</span>}
                    <span>{team.defaultDuration} min default</span>
                  </>
                )}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  {showSettings ? 'Hide' : 'Edit'}
                </button>
              </div>
              {/* Inline Settings */}
              {showSettings && (
                <div className="mt-3 p-4 bg-slate-700/50 rounded-lg border border-slate-600 flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Team Name</label>
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => updateTeam(selectedTeamId, { name: e.target.value })}
                      className="input-field w-48"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Age Group</label>
                    <input
                      type="text"
                      value={team.ageGroup || ''}
                      onChange={(e) => updateTeam(selectedTeamId, { ageGroup: e.target.value })}
                      placeholder="e.g., U8"
                      className="input-field w-24"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Default Duration</label>
                    <input
                      type="text"
                      value={team.defaultDuration || ''}
                      onChange={(e) => updateTeam(selectedTeamId, { defaultDuration: e.target.value })}
                      placeholder="60"
                      className="input-field w-24"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      toast('Team settings saved');
                    }}
                    className="btn btn-primary text-sm"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateToDiagramLibrary()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Diagrams</span>
                {diagramLibrary?.diagrams?.length > 0 && (
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                    {diagramLibrary.diagrams.length}
                  </span>
                )}
              </button>
              {sharingContext && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span className="hidden sm:inline">Share</span>
                  {team.sharing?.isShared && (
                    <span className="ml-1 w-2 h-2 bg-green-400 rounded-full" title="Shared" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-sm text-slate-400 mb-1">Total Sessions</p>
            <p className="text-3xl font-bold text-blue-400">{sessions.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-400 mb-1">Scheduled</p>
            <p className="text-3xl font-bold text-green-400">{scheduledCount}</p>
          </div>
        </div>

        {/* Filter and Create Button */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              All ({sessions.length})
            </button>
            <button
              onClick={() => setFilterType('scheduled')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterType === 'scheduled'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Scheduled ({scheduledCount})
            </button>
          </div>
          <button onClick={() => setShowScheduleModal(true)} className="btn btn-primary">
            + New Session
          </button>
        </div>

        {/* Sessions List */}
        {sortedSessions.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-slate-400 mb-6">
              <svg
                className="w-24 h-24 mx-auto mb-4 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-slate-300 mb-2">
                {filterType === 'all' ? 'No sessions yet' : 'No scheduled sessions'}
              </h3>
              <p className="text-slate-500 mb-6">
                Create your first session to get started
              </p>
            </div>
            <button onClick={() => setShowScheduleModal(true)} className="btn btn-primary">
              + Create Session
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedSessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onSelect={handleSelectSession}
                onDuplicate={handleDuplicateSession}
                onDelete={handleDeleteSession}
              />
            ))}
          </div>
        )}
      </div>

      {/* Schedule Session Modal */}
      {showScheduleModal && (
        <ScheduleSessionModal
          teamsContext={teamsContext}
          teamId={selectedTeamId}
          onClose={() => setShowScheduleModal(false)}
        />
      )}

      {/* Share Modal */}
      {showShareModal && sharingContext && (
        <ShareModal
          team={team}
          onClose={() => setShowShareModal(false)}
          onUpdateTeam={(updatedTeam) => updateTeam(selectedTeamId, updatedTeam)}
          sharingHook={sharingContext}
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import SessionCard from './SessionCard';
import ScheduleSessionModal from './ScheduleSessionModal';
import { toast } from '../../utils/helpers';

export default function TeamDetail({ teamsContext }) {
  const {
    selectedTeamId,
    getTeam,
    navigateToTeams,
    navigateToSessionBuilder,
    deleteSession,
    duplicateSession,
  } = teamsContext;

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'scheduled', 'templates'

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
    } else if (filterType === 'templates') {
      return !session.summary.date || session.summary.date.length === 0;
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
  const templateCount = sessions.filter(s => !s.summary.date || s.summary.date.length === 0).length;

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
          <h1 className="text-3xl font-bold mb-2">{team.name}</h1>
          {team.ageGroup && <p className="text-slate-400">{team.ageGroup}</p>}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-sm text-slate-400 mb-1">Total Sessions</p>
            <p className="text-3xl font-bold text-blue-400">{sessions.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-400 mb-1">Scheduled</p>
            <p className="text-3xl font-bold text-green-400">{scheduledCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-400 mb-1">Templates</p>
            <p className="text-3xl font-bold text-purple-400">{templateCount}</p>
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
            <button
              onClick={() => setFilterType('templates')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterType === 'templates'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Templates ({templateCount})
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
                {filterType === 'all' && 'No sessions yet'}
                {filterType === 'scheduled' && 'No scheduled sessions'}
                {filterType === 'templates' && 'No template sessions'}
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
    </div>
  );
}

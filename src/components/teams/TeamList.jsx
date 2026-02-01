import React, { useState } from 'react';
import TeamCard from './TeamCard';
import CreateTeamModal from './CreateTeamModal';
import { toast } from '../../utils/helpers';

export default function TeamList({ teamsContext }) {
  const { teamsData, navigateToTeamDetail, deleteTeam } = teamsContext;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);

  const teams = teamsData?.teams || [];

  const handleSelectTeam = (teamId) => {
    navigateToTeamDetail(teamId);
  };

  const handleCreateTeam = () => {
    setEditingTeam(null);
    setShowCreateModal(true);
  };

  const handleEditTeam = (team) => {
    setEditingTeam(team);
    setShowCreateModal(true);
  };

  const handleDeleteTeam = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const confirmMessage = team.sessions?.length > 0
      ? `Delete "${team.name}"? This will delete ${team.sessions.length} session(s).`
      : `Delete "${team.name}"?`;

    if (window.confirm(confirmMessage)) {
      deleteTeam(teamId);
      toast('Team deleted');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">PlayBall Session Planner</h1>
          <p className="text-slate-400">Manage your teams and training sessions</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">My Teams</h2>
          <button onClick={handleCreateTeam} className="btn btn-primary">
            + Create Team
          </button>
        </div>

        {teams.length === 0 ? (
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-slate-300 mb-2">
                No teams yet
              </h3>
              <p className="text-slate-500 mb-6">
                Create your first team to start planning training sessions
              </p>
            </div>
            <button onClick={handleCreateTeam} className="btn btn-primary">
              + Create Your First Team
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map(team => (
              <TeamCard
                key={team.id}
                team={team}
                onSelect={handleSelectTeam}
                onEdit={handleEditTeam}
                onDelete={handleDeleteTeam}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Team Modal */}
      {showCreateModal && (
        <CreateTeamModal
          teamsContext={teamsContext}
          editingTeam={editingTeam}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTeam(null);
          }}
        />
      )}
    </div>
  );
}

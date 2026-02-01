import React from 'react';

export default function TeamCard({ team, onSelect, onEdit, onDelete }) {
  const sessionCount = team.sessions?.length || 0;
  const upcomingSessions = team.sessions?.filter(s => s.summary.date && new Date(s.summary.date) >= new Date()).length || 0;

  return (
    <div
      className="card p-6 cursor-pointer hover:border-blue-500 transition-all"
      onClick={() => onSelect(team.id)}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-xl font-bold text-slate-100">{team.name}</h3>
          {team.ageGroup && (
            <p className="text-sm text-slate-400 mt-1">{team.ageGroup}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(team);
            }}
            className="btn btn-subtle text-sm px-3 py-1"
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(team.id);
            }}
            className="btn btn-danger text-sm px-3 py-1"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
        <div className="bg-slate-800/50 p-3 rounded-lg">
          <p className="text-slate-400 mb-1">Total Sessions</p>
          <p className="text-2xl font-bold text-blue-400">{sessionCount}</p>
        </div>
        <div className="bg-slate-800/50 p-3 rounded-lg">
          <p className="text-slate-400 mb-1">Upcoming</p>
          <p className="text-2xl font-bold text-green-400">{upcomingSessions}</p>
        </div>
      </div>

      <div className="mt-4 text-xs text-slate-500">
        Last updated: {new Date(team.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}

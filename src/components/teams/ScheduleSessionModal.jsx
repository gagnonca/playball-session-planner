import React, { useState } from 'react';
import { toast } from '../../utils/helpers';

export default function ScheduleSessionModal({ teamsContext, teamId, onClose }) {
  const { createSession, navigateToSessionBuilder } = teamsContext;

  const [sessionDate, setSessionDate] = useState('');

  const handleCreateBlank = () => {
    const session = createSession(teamId);
    toast('Session created');
    navigateToSessionBuilder(teamId, session.id);
    onClose();
  };

  const handleSchedule = (e) => {
    e.preventDefault();

    if (!sessionDate) {
      toast('Please select a date');
      return;
    }

    const session = createSession(teamId);
    const { updateSession } = teamsContext;
    updateSession(teamId, session.id, {
      summary: {
        ...session.summary,
        date: sessionDate,
      },
    });

    toast('Session scheduled');
    navigateToSessionBuilder(teamId, session.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Create New Session</h2>

        <div className="space-y-4 mb-6">
          <div>
            <button
              onClick={handleCreateBlank}
              className="w-full p-4 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-left transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100">Blank Session</h3>
                  <p className="text-sm text-slate-400">Start from scratch</p>
                </div>
              </div>
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-800 text-slate-500">or</span>
            </div>
          </div>

          <form onSubmit={handleSchedule}>
            <div className="p-4 bg-slate-700 border border-slate-600 rounded-lg">
              <label className="label-text mb-2 block">Schedule for a specific date</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="input-field mb-3"
              />
              <button type="submit" className="btn btn-primary w-full">
                Create & Schedule
              </button>
            </div>
          </form>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="btn btn-subtle">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

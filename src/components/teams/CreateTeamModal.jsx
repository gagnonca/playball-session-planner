import React, { useState, useEffect } from 'react';
import { toast } from '../../utils/helpers';

export default function CreateTeamModal({ teamsContext, editingTeam, onClose }) {
  const { createTeam, updateTeam } = teamsContext;

  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState('');

  useEffect(() => {
    if (editingTeam) {
      setName(editingTeam.name);
      setAgeGroup(editingTeam.ageGroup || '');
    }
  }, [editingTeam]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name.trim()) {
      toast('Please enter a team name');
      return;
    }

    if (editingTeam) {
      // Update existing team
      updateTeam(editingTeam.id, {
        name: name.trim(),
        ageGroup: ageGroup.trim(),
      });
      toast('Team updated');
    } else {
      // Create new team
      createTeam(name.trim(), ageGroup.trim());
      toast('Team created');
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">
          {editingTeam ? 'Edit Team' : 'Create New Team'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="label-text">Team Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., U12 Tigers"
              className="input-field"
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label className="label-text">Age Group (optional)</label>
            <input
              type="text"
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              placeholder="e.g., U12"
              className="input-field"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-subtle"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              {editingTeam ? 'Save Changes' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

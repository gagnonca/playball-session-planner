import React from 'react';

// Hash team name -> one of a fixed palette of warm tones for the age-group tile.
const TEAM_TONES = ['#c8553d', '#3d7a4a', '#3d5a8a', '#9a5a3a', '#6a4a8a', '#3a6a7a'];
function teamTone(team) {
  if (team.color) return team.color;
  const key = team.id || team.name || '';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TEAM_TONES[h % TEAM_TONES.length];
}

function nextSessionLabel(team) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = (team.sessions || [])
    .filter(s => s.summary?.date && new Date(s.summary.date) >= today)
    .sort((a, b) => new Date(a.summary.date) - new Date(b.summary.date))[0];
  if (!upcoming?.summary?.date) return null;
  const d = new Date(upcoming.summary.date);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TeamCard({ team, onSelect, onEdit, onDelete }) {
  const sessionCount = team.sessions?.length || 0;
  const tone = teamTone(team);
  const next = nextSessionLabel(team);
  const playerCount = team.roster?.length || 0;

  return (
    <div
      className="card card-hover p-5 cursor-pointer"
      onClick={() => onSelect(team.id)}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-[13px]"
          style={{ background: tone, color: '#fff', letterSpacing: '-0.01em' }}
        >
          {team.ageGroup || (team.name ? team.name.slice(0, 2).toUpperCase() : '·')}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[19px] font-semibold leading-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.015em' }}>
            {team.name}
          </h3>
          <p className="text-[13px] mt-1" style={{ color: 'var(--ink-2)' }}>
            {playerCount > 0 ? `${playerCount} players · ` : ''}
            {sessionCount} session{sessionCount === 1 ? '' : 's'}
            {next ? ` · next ${next}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 -mr-1 -mt-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(team); }}
            className="btn btn-ghost"
            style={{ padding: '6px 10px', fontSize: 12.5 }}
            aria-label={`Edit ${team.name}`}
          >
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(team.id); }}
            className="btn btn-ghost"
            style={{ padding: '6px 8px', fontSize: 12.5, color: 'var(--danger)' }}
            aria-label={`Delete ${team.name}`}
            title="Delete team"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

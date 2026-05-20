import React from 'react';

const TEAM_TONES = ['#c8553d', '#3d7a4a', '#3d5a8a', '#9a5a3a', '#6a4a8a', '#3a6a7a'];
function teamTone(team) {
  if (team?.color) return team.color;
  const key = team?.id || team?.name || '';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TEAM_TONES[h % TEAM_TONES.length];
}

function sessionStatusCounts(team) {
  const sessions = team?.sessions || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let ready = 0;
  let drafting = 0;
  for (const s of sessions) {
    const scheduled = s?.summary?.date && new Date(s.summary.date) >= today;
    if (scheduled) ready += 1;
    else drafting += 1;
  }
  return { ready, drafting };
}

function TeamRow({ team, active, onSelect }) {
  const tone = teamTone(team);
  const playerCount = team.players?.length || team.roster?.length || 0;
  const focus = (team.focus || team.ageGroup || '').toString().toLowerCase();
  const { ready, drafting } = sessionStatusCounts(team);

  return (
    <button
      onClick={() => onSelect(team.id)}
      style={{
        width: '100%',
        textAlign: 'left',
        borderRadius: 10,
        padding: '10px 12px',
        background: active ? 'var(--bg-elev)' : 'transparent',
        border: active ? '1px solid var(--line-2)' : '1px solid transparent',
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        position: 'relative',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.03)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {active && (
        <div
          style={{
            position: 'absolute',
            left: -1, top: 8, bottom: 8,
            width: 3, background: 'var(--accent)', borderRadius: 2,
          }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 30, height: 30, borderRadius: 7,
            background: tone, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10.5, fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {team.ageGroup || (team.name || '?').slice(0, 2).toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.005em', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {team.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {playerCount > 0 ? `${playerCount} player${playerCount === 1 ? '' : 's'}` : 'No roster yet'}
            {focus && playerCount > 0 ? ` · ${focus}` : focus ? focus : ''}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 8, paddingTop: 8,
          borderTop: '1px solid var(--line)',
          display: 'flex', gap: 12, fontSize: 11, color: 'var(--ink-2)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--accent)' }} />
          <strong style={{ fontWeight: 600 }}>{drafting}</strong>
          <span style={{ color: 'var(--ink-3)' }}>drafting</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--good)' }} />
          <strong style={{ fontWeight: 600 }}>{ready}</strong>
          <span style={{ color: 'var(--ink-3)' }}>scheduled</span>
        </span>
      </div>
    </button>
  );
}

// Sticky left rail of teams used on Training Home and Team Detail. The team
// spine: pick a team here, the right pane updates.
export default function TeamSpine({ teams, activeId, onSelect, onCreateTeam }) {
  return (
    <aside
      style={{
        width: 268,
        flexShrink: 0,
        background: 'var(--bg-sunken)',
        borderRight: '1px solid var(--line)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        overflowY: 'auto',
        alignSelf: 'stretch',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 4px 6px',
        }}
      >
        <div className="eyebrow">Teams</div>
        {onCreateTeam && (
          <button
            onClick={onCreateTeam}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              background: 'var(--bg-elev)',
              border: '1px solid var(--line)',
              fontSize: 12,
              cursor: 'pointer',
              color: 'var(--ink-2)',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Team
          </button>
        )}
      </div>

      {teams.length === 0 ? (
        <div
          style={{
            padding: '14px 12px',
            borderRadius: 10,
            background: 'var(--bg-elev)',
            border: '1px dashed var(--line-2)',
            fontSize: 12.5,
            color: 'var(--ink-2)',
            lineHeight: 1.5,
          }}
        >
          A team holds your roster, sessions, and fixtures. Most coaches start with one.
        </div>
      ) : (
        teams.map(t => (
          <TeamRow key={t.id} team={t} active={t.id === activeId} onSelect={onSelect} />
        ))
      )}
    </aside>
  );
}

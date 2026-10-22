import React, { useState } from 'react';

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

function TeamRow({ team, active, onSelect, card }) {
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
        padding: card ? '12px 14px' : '10px 12px',
        background: active || card ? 'var(--bg-elev)' : 'transparent',
        border: active ? '1px solid var(--line-2)' : card ? '1px solid var(--line)' : '1px solid transparent',
        boxShadow: active || card ? 'var(--shadow-sm)' : 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        position: 'relative',
      }}
      onMouseEnter={(e) => { if (!active && !card) e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.03)'; }}
      onMouseLeave={(e) => { if (!active && !card) e.currentTarget.style.background = 'transparent'; }}
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
// Teams marked as a previous season (team.archived) sit in their own
// collapsible section below the current ones.
// `fullWidth`: on a phone the rail is the whole Training page (team picker).
export default function TeamSpine({ teams, activeId, onSelect, onCreateTeam, fullWidth }) {
  const currentTeams = teams.filter(t => !t.archived);
  const previousTeams = teams.filter(t => t.archived);
  const [showPrevious, setShowPrevious] = useState(false);
  // Always expanded while viewing a previous-season team so it's highlighted.
  const previousOpen = showPrevious || previousTeams.some(t => t.id === activeId);
  return (
    <aside
      style={{
        width: fullWidth ? '100%' : 268,
        flex: fullWidth ? 1 : undefined,
        flexShrink: 0,
        background: fullWidth ? 'var(--bg)' : 'var(--bg-sunken)',
        borderRight: fullWidth ? 'none' : '1px solid var(--line)',
        padding: fullWidth ? 16 : 14,
        display: 'flex',
        flexDirection: 'column',
        gap: fullWidth ? 8 : 6,
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

      {currentTeams.length === 0 ? (
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
        currentTeams.map(t => (
          <TeamRow key={t.id} team={t} active={t.id === activeId} onSelect={onSelect} card={fullWidth} />
        ))
      )}

      {previousTeams.length > 0 && (
        <>
          <button
            onClick={() => setShowPrevious(v => !v)}
            aria-expanded={previousOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              marginTop: 12,
              padding: '10px 4px 6px',
              border: 0,
              borderTop: '1px solid var(--line)',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: 'var(--ink-3)',
            }}
          >
            <span className="eyebrow">Previous Seasons</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              {previousTeams.length}
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: previousOpen ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </button>
          {previousOpen && previousTeams.map(t => (
            <div key={t.id} style={{ opacity: t.id === activeId ? 1 : 0.75 }}>
              <TeamRow team={t} active={t.id === activeId} onSelect={onSelect} card={fullWidth} />
            </div>
          ))}
        </>
      )}
    </aside>
  );
}

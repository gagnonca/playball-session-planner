import React from 'react';
import playballIcon from '../assets/playball-icon.png';
import { VIEWS } from '../constants/navigation';

// 224px sticky left rail. Shows on the four shared surfaces (Home, Schedule,
// Library, Settings) and on Team Detail. Hidden on focused work surfaces
// (Session Builder, Diagram Builder) where the user needs the full width.

const ICONS = {
  home: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1v-9.5z" />
  ),
  schedule: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  ),
  library: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  ),
  settings: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M10.325 4.317a1 1 0 011.35 0l1.318 1.218a1 1 0 00.92.244l1.74-.412a1 1 0 011.214.738l.412 1.74a1 1 0 00.244.92l1.218 1.318a1 1 0 010 1.35l-1.218 1.318a1 1 0 00-.244.92l.412 1.74a1 1 0 01-.738 1.214l-1.74.412a1 1 0 00-.92.244l-1.318 1.218a1 1 0 01-1.35 0l-1.318-1.218a1 1 0 00-.92-.244l-1.74.412a1 1 0 01-1.214-.738l-.412-1.74a1 1 0 00-.244-.92L4.317 12.675a1 1 0 010-1.35l1.218-1.318a1 1 0 00.244-.92l-.412-1.74a1 1 0 01.738-1.214l1.74-.412a1 1 0 00.92-.244l1.318-1.218z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </>
  ),
};

function RailLink({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-[9px] transition-colors flex items-center gap-2.5"
      style={{
        padding: '8px 10px',
        background: active ? 'var(--bg-elev)' : 'transparent',
        border: active ? '1px solid var(--line)' : '1px solid transparent',
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
        color: active ? 'var(--ink)' : 'var(--ink-2)',
        fontSize: 13.5,
        fontWeight: active ? 500 : 400,
        letterSpacing: '-0.005em',
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.04)'; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = 'var(--ink-2)'; e.currentTarget.style.background = 'transparent'; } }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        {icon}
      </svg>
      <span>{label}</span>
    </button>
  );
}

export default function NavRail({ teamsContext, syncContext }) {
  const {
    currentView,
    navigateToTeams,
    navigateToSchedule,
    navigateToLibrary,
    navigateToSettings,
  } = teamsContext;

  const syncEnabled = Boolean(syncContext?.isSyncEnabled);
  const syncStatus = syncContext?.syncStatus || 'idle';
  const isOnline = syncContext?.isOnline ?? true;

  // Pill state — copy + dot color
  let pillCopy, pillTone;
  if (!syncEnabled) {
    pillCopy = 'On this device';
    pillTone = 'var(--ink-3)';
  } else if (!isOnline) {
    pillCopy = 'Offline';
    pillTone = 'var(--warn)';
  } else if (syncStatus === 'syncing') {
    pillCopy = 'Syncing…';
    pillTone = 'var(--warn)';
  } else if (syncStatus === 'error') {
    pillCopy = 'Sync error';
    pillTone = 'var(--danger)';
  } else {
    pillCopy = 'Synced';
    pillTone = 'var(--good)';
  }

  return (
    <aside
      className="sticky top-0 h-screen flex-shrink-0 flex flex-col"
      style={{
        width: 224,
        background: 'var(--bg-sunken)',
        borderRight: '1px solid var(--line)',
        padding: '20px 14px 16px',
      }}
    >
      {/* Brand */}
      <button
        onClick={navigateToTeams}
        className="flex items-center gap-2.5 mb-7 px-1.5"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <img src={playballIcon} alt="PlayBall" className="w-8 h-8 rounded-[10px] shadow-sm" />
        <div className="text-left">
          <div className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.015em' }}>PlayBall</div>
          <div className="font-mono uppercase" style={{ fontSize: 9.5, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
            Session planner
          </div>
        </div>
      </button>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        <RailLink
          icon={ICONS.home}
          label="Home"
          active={currentView === VIEWS.TEAMS || currentView === VIEWS.TEAM_DETAIL}
          onClick={navigateToTeams}
        />
        <RailLink
          icon={ICONS.schedule}
          label="Schedule"
          active={currentView === VIEWS.SCHEDULE}
          onClick={navigateToSchedule}
        />
        <RailLink
          icon={ICONS.library}
          label="Library"
          active={currentView === VIEWS.LIBRARY || currentView === VIEWS.DIAGRAM_LIBRARY}
          onClick={() => navigateToLibrary('sessions')}
        />
        <RailLink
          icon={ICONS.settings}
          label="Settings"
          active={currentView === VIEWS.SETTINGS}
          onClick={navigateToSettings}
        />
      </nav>

      {/* Footer — sync pill + user chip */}
      <div className="flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
        <div
          className="inline-flex items-center gap-2 px-2 py-1.5 rounded-[8px]"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}
        >
          <span
            className="inline-block rounded-full"
            style={{ width: 8, height: 8, background: pillTone, flexShrink: 0 }}
          />
          <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>{pillCopy}</span>
        </div>
        <button
          onClick={navigateToSettings}
          className="inline-flex items-center gap-2 px-2 py-1.5 rounded-[8px] transition-colors"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.04)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span
            className="inline-flex items-center justify-center rounded-full font-semibold"
            style={{ width: 24, height: 24, background: 'var(--ink)', color: 'var(--bg)', fontSize: 11, flexShrink: 0 }}
          >
            {syncEnabled ? 'C' : 'G'}
          </span>
          <div className="text-left min-w-0">
            <div className="text-[12.5px]" style={{ color: 'var(--ink)', fontWeight: 500 }}>
              {syncEnabled ? 'Coach' : 'Guest'}
            </div>
            <div className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
              {syncEnabled ? 'Signed in' : 'No account'}
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
}

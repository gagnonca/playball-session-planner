import React from 'react';
import playballIcon from '../assets/playball-icon.png';
import { VIEWS } from '../constants/navigation';

// Top horizontal app header. Replaces the 224px left rail. Shows brand,
// primary tabs (Training/Schedule/Playbook/Settings), sync status, About,
// and an account avatar.

function TabLink({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '18px 16px',
        fontSize: 13,
        color: active ? 'var(--ink)' : 'var(--ink-2)',
        fontWeight: active ? 600 : 500,
        marginBottom: -1,
        background: 'transparent',
        border: 'none',
        borderBottomStyle: 'solid',
        borderBottomWidth: 2,
        borderBottomColor: active ? 'var(--accent)' : 'transparent',
        cursor: 'pointer',
        fontFamily: 'inherit',
        letterSpacing: '-0.005em',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--ink)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--ink-2)'; }}
    >
      {label}
    </button>
  );
}

export default function AppHeader({ teamsContext, syncContext, accountContext, onShowAbout }) {
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
  const hasAccount = Boolean(accountContext?.isSignedIn);
  const accountInitial = (accountContext?.account?.email || '?').trim().charAt(0).toUpperCase() || 'A';

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

  const tier = hasAccount ? 'account' : (syncEnabled ? 'sync' : 'offline');
  const chipLetter = tier === 'account' ? accountInitial : (tier === 'sync' ? 'C' : 'G');
  const chipTitle = tier === 'account'
    ? `Account · ${accountContext?.account?.email || 'Signed in'}`
    : (tier === 'sync' ? 'Coach · Synced device' : 'Guest · No account · no tracking');

  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 22px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg-elev)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <button
        onClick={navigateToTeams}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <img src={playballIcon} alt="PlayBall" style={{ width: 30, height: 30, borderRadius: 8 }} />
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)' }}>PlayBall</span>
      </button>

      <div style={{ flex: 1 }} />

      <nav style={{ display: 'flex' }}>
        <TabLink
          label="Training"
          active={currentView === VIEWS.TEAMS || currentView === VIEWS.TEAM_DETAIL}
          onClick={navigateToTeams}
        />
        <TabLink
          label="Schedule"
          active={currentView === VIEWS.SCHEDULE}
          onClick={navigateToSchedule}
        />
        <TabLink
          label="Playbook"
          active={currentView === VIEWS.LIBRARY || currentView === VIEWS.DIAGRAM_LIBRARY}
          onClick={() => navigateToLibrary('sessions')}
        />
        <TabLink
          label="Settings"
          active={currentView === VIEWS.SETTINGS}
          onClick={navigateToSettings}
        />
      </nav>

      <div style={{ flex: 1 }} />

      <div
        title={pillCopy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 999,
          background: 'var(--bg-sunken)',
          border: '1px solid var(--line)',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: 4, background: pillTone, display: 'inline-block' }} />
        <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{pillCopy}</span>
      </div>

      {onShowAbout && (
        <button
          onClick={onShowAbout}
          title="About PlayBall"
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'transparent', border: '1px solid var(--line)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-2)', cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
      )}

      <button
        onClick={navigateToSettings}
        title={chipTitle}
        style={{
          width: 32, height: 32, borderRadius: 16,
          background: tier === 'account' ? 'var(--accent)' : 'var(--bg-sunken)',
          border: '1px solid var(--line)',
          color: tier === 'account' ? 'var(--accent-ink)' : 'var(--ink)',
          fontSize: 12, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {chipLetter}
      </button>
    </header>
  );
}

import React from 'react';
import playballIcon from '../assets/playball-icon.png';
import { VIEWS } from '../constants/navigation';
import useIsMobile from '../hooks/useIsMobile';

// Top horizontal app header. Replaces the 224px left rail. Shows brand,
// primary tabs (Training/Schedule/Playbook/Settings), sync status, About,
// and an account avatar. On a phone the tabs move to a bottom tab bar.

const TAB_ICONS = {
  Training: <><rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="M12 5v14" /><circle cx="12" cy="12" r="2.5" /></>,
  Schedule: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  Playbook: <><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z" /><path d="M5 17a3 3 0 013-3h11" /></>,
  Settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>,
};

function BottomTab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '8px 0 6px',
        background: 'transparent',
        border: 'none',
        color: active ? 'var(--accent)' : 'var(--ink-2)',
        fontSize: 10.5,
        fontWeight: active ? 600 : 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {TAB_ICONS[label]}
      </svg>
      {label}
    </button>
  );
}

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
  const isMobile = useIsMobile();
  const hasAccount = Boolean(accountContext?.isSignedIn);
  const accountInitial = (accountContext?.account?.email || '?').trim().charAt(0).toUpperCase() || 'A';

  let pillCopy, pillTone;
  if (!syncEnabled) {
    pillCopy = 'Demo';
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
    pillCopy = 'Saved';
    pillTone = 'var(--good)';
  }

  const tier = hasAccount && syncEnabled ? 'account' : 'demo';
  const chipLetter = tier === 'account' ? accountInitial : 'D';
  const chipTitle = tier === 'account'
    ? `Signed in · ${accountContext?.account?.email || ''}`
    : 'Demo · nothing is saved';

  const tabs = [
    { label: 'Training', active: currentView === VIEWS.TEAMS || currentView === VIEWS.TEAM_DETAIL, onClick: navigateToTeams },
    { label: 'Schedule', active: currentView === VIEWS.SCHEDULE, onClick: navigateToSchedule },
    { label: 'Playbook', active: currentView === VIEWS.LIBRARY || currentView === VIEWS.DIAGRAM_LIBRARY, onClick: () => navigateToLibrary('sessions') },
    { label: 'Settings', active: currentView === VIEWS.SETTINGS, onClick: navigateToSettings },
  ];

  return (
    <>
    <header
      style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: isMobile ? '0 16px' : '0 22px',
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

      {!isMobile && (
        <>
          <nav style={{ display: 'flex' }}>
            {tabs.map(t => <TabLink key={t.label} {...t} />)}
          </nav>
          <div style={{ flex: 1 }} />
        </>
      )}

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

      {onShowAbout && !isMobile && (
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
    {isMobile && (
      <nav
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 30,
          display: 'flex',
          background: 'rgb(var(--bg-elev-rgb) / 0.96)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid var(--line)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {tabs.map(t => <BottomTab key={t.label} {...t} />)}
      </nav>
    )}
    </>
  );
}

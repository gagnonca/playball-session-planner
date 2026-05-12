import React, { useState } from 'react';
import TeamCard from './TeamCard';
import CreateTeamModal from './CreateTeamModal';
import SyncStatus from '../SyncStatus';
import AboutModal from '../AboutModal';
import WelcomeModal from '../WelcomeModal';
import { toast } from '../../utils/helpers';
import { HAS_SEEN_WELCOME_KEY, IOS_PROMO_DISMISSED_KEY } from '../../constants/storage';
import playballIcon from '../../assets/playball-icon.png';
import appStoreBadge from '../../assets/app-store-badge.svg';

function dayLabel() {
  const d = new Date();
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  const month = d.toLocaleDateString(undefined, { month: 'long' });
  const day = d.getDate();
  return `${weekday.toUpperCase()} · ${month.toUpperCase()} ${day}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TeamList({ teamsContext, syncContext, sharingContext, onShowLinkDevice, iosReferral, onDismissIosReferral }) {
  const { teamsData, navigateToTeamDetail, deleteTeam, navigateToLibrary, navigateToSchedule } = teamsContext;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(HAS_SEEN_WELCOME_KEY));
  const [editingTeam, setEditingTeam] = useState(null);
  const [iosPromoDismissed, setIosPromoDismissed] = useState(() => !!localStorage.getItem(IOS_PROMO_DISMISSED_KEY));

  const teams = teamsData?.teams || [];
  const followedShares = sharingContext?.followedShares || [];

  const handleDismissIosPromo = () => {
    setIosPromoDismissed(true);
    localStorage.setItem(IOS_PROMO_DISMISSED_KEY, 'true');
  };

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
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* Top bar — light hairline, not a heavy filled banner */}
      <header
        className="sticky top-0 z-10"
        style={{ background: 'rgb(var(--bg-rgb) / 0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--line)' }}
      >
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={playballIcon} alt="PlayBall" className="w-9 h-9 rounded-xl shadow-sm" />
            <div>
              <div className="text-[15px] font-semibold leading-tight" style={{ letterSpacing: '-0.015em' }}>PlayBall</div>
              <div className="text-[11px] font-mono uppercase" style={{ color: 'var(--ink-3)', letterSpacing: '0.08em' }}>Session planner</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {syncContext && (
              <SyncStatus
                status={syncContext.syncStatus}
                lastSyncAt={syncContext.lastSyncAt}
                onLinkDevice={onShowLinkDevice}
              />
            )}
            {navigateToSchedule && (
              <button
                onClick={() => navigateToSchedule()}
                className="btn btn-ghost"
                title="Schedule"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Schedule
              </button>
            )}
            <button
              onClick={() => navigateToLibrary('exercises')}
              className="btn btn-ghost"
              title="Library"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Library
            </button>
            <button
              onClick={() => setShowAboutModal(true)}
              className="btn btn-ghost"
              title="About & settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M10.325 4.317a1 1 0 011.35 0l1.318 1.218a1 1 0 00.92.244l1.74-.412a1 1 0 011.214.738l.412 1.74a1 1 0 00.244.92l1.218 1.318a1 1 0 010 1.35l-1.218 1.318a1 1 0 00-.244.92l.412 1.74a1 1 0 01-.738 1.214l-1.74.412a1 1 0 00-.92.244l-1.318 1.218a1 1 0 01-1.35 0l-1.318-1.218a1 1 0 00-.92-.244l-1.74.412a1 1 0 01-1.214-.738l-.412-1.74a1 1 0 00-.244-.92L4.317 12.675a1 1 0 010-1.35l1.218-1.318a1 1 0 00.244-.92l-.412-1.74a1 1 0 01.738-1.214l1.74-.412a1 1 0 00.92-.244l1.318-1.218z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              About
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-10 pb-16">
        {/* Greeting */}
        <div className="mb-10">
          <div className="text-[11px] font-mono uppercase mb-2" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>{dayLabel()}</div>
          <h1 className="text-[40px] font-semibold leading-[1.04]" style={{ letterSpacing: '-0.02em' }}>
            {greeting()}, Coach.
          </h1>
          <p className="mt-3 text-[14.5px]" style={{ color: 'var(--ink-2)' }}>
            {teams.length === 0
              ? 'Start by creating a team — sessions, diagrams and reflections will live alongside it.'
              : `${teams.length} team${teams.length === 1 ? '' : 's'} · everything you build saves automatically.`}
          </p>
        </div>

        {/* iOS Referral Banner */}
        {iosReferral && teams.length > 0 && (
          <div className="mb-10 card p-5 relative" style={{ background: 'var(--accent-soft)', borderColor: 'rgb(var(--accent-rgb) / 0.35)' }}>
            <button
              onClick={onDismissIosReferral}
              className="absolute top-3 right-3 p-1 rounded-md"
              style={{ color: 'var(--ink-2)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgb(var(--accent-rgb) / 0.18)' }}>
                <span className="text-xl">📱</span>
              </div>
              <div>
                <h3 className="text-[16px] font-semibold mb-1" style={{ color: 'var(--accent)' }}>Link your iOS app</h3>
                <p className="text-[13.5px] mb-3" style={{ color: 'var(--ink)' }}>
                  To link training sessions from the PlayBall iOS app:
                </p>
                <ol className="text-[13px] space-y-1 list-decimal list-inside" style={{ color: 'var(--ink-2)' }}>
                  <li>Select a team below</li>
                  <li>Tap <span style={{ color: 'var(--ink)', fontWeight: 500 }}>Share</span></li>
                  <li>Copy the share code</li>
                  <li>Paste it in your iOS app</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Teams section */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="text-[11px] font-mono uppercase" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>YOUR TEAMS</div>
              <h2 className="text-[24px] font-semibold mt-1" style={{ letterSpacing: '-0.02em' }}>Pick up where you left off</h2>
            </div>
            {teams.length > 0 && (
              <button onClick={handleCreateTeam} className="btn btn-primary">
                <span style={{ fontWeight: 600 }}>+</span> New team
              </button>
            )}
          </div>

          {teams.length === 0 ? (
            <div className="card p-12 text-center">
              <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--ink-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-[18px] font-semibold mb-2">No teams yet</h3>
              <p className="text-[13.5px] mb-6" style={{ color: 'var(--ink-2)' }}>
                Create your first team to start planning training sessions.
              </p>
              <button onClick={handleCreateTeam} className="btn btn-primary">
                + Create your first team
              </button>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {teams.map(team => (
                <TeamCard
                  key={team.id}
                  team={team}
                  onSelect={handleSelectTeam}
                  onEdit={handleEditTeam}
                  onDelete={handleDeleteTeam}
                />
              ))}
              <button
                onClick={handleCreateTeam}
                className="rounded-[14px] flex flex-col items-center justify-center text-center transition-colors"
                style={{
                  minHeight: 132,
                  border: '1px dashed var(--line-2)',
                  background: 'transparent',
                  color: 'var(--ink-2)',
                  padding: '20px',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.color = 'var(--ink-2)'; }}
              >
                <span style={{ fontSize: 24, lineHeight: 1, marginBottom: 6 }}>+</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Add a team</span>
              </button>
            </div>
          )}
        </section>

        {/* iOS App Promo */}
        {!iosReferral && !iosPromoDismissed && teams.length > 0 && (
          <div className="mt-10 card p-5 relative">
            <button
              onClick={handleDismissIosPromo}
              className="absolute top-3 right-3 p-1 rounded-md"
              style={{ color: 'var(--ink-3)' }}
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center gap-4">
              <img src={playballIcon} alt="PlayBall" className="w-12 h-12 rounded-xl shadow-sm flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-[15px] font-semibold mb-1">Your schedule, in your pocket</h3>
                <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
                  Share your sessions directly to the PlayBall iOS app — it also handles game-day substitution management.
                </p>
              </div>
              <a
                href="https://apps.apple.com/us/app/playball-equal-playing-time/id6744836650"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 opacity-90 hover:opacity-100 transition-opacity"
              >
                <img src={appStoreBadge} alt="Download on the App Store" className="h-10" />
              </a>
            </div>
          </div>
        )}

        {/* Shared With Me */}
        {followedShares.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center gap-3 mb-5">
              <div className="text-[11px] font-mono uppercase" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>SHARED WITH ME</div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                View only
              </span>
            </div>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {followedShares.map(share => (
                <div key={share.shareToken} className="card card-hover p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[17px] font-semibold" style={{ letterSpacing: '-0.015em' }}>
                        {share.teamName || 'Shared Team'}
                      </h3>
                      {share.ageGroup && (
                        <p className="text-[13px] mt-1" style={{ color: 'var(--ink-2)' }}>{share.ageGroup}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Stop following "${share.teamName || 'this team'}"?`)) {
                          sharingContext.unfollowShare(share.shareToken);
                          toast('Removed from followed teams');
                        }
                      }}
                      className="p-1.5 rounded"
                      style={{ color: 'var(--ink-3)' }}
                      title="Stop following"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="text-[11px] font-mono uppercase mb-4" style={{ color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                    Followed {new Date(share.followedAt).toLocaleDateString()}
                  </div>
                  <a href={`/shared/${share.shareToken}`} className="btn btn-secondary w-full text-center">
                    View team
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

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

      {showAboutModal && (
        <AboutModal
          onClose={() => setShowAboutModal(false)}
          onRestartTutorial={() => {
            setShowAboutModal(false);
            localStorage.removeItem(HAS_SEEN_WELCOME_KEY);
            setShowWelcome(true);
          }}
        />
      )}

      {showWelcome && (
        <WelcomeModal
          iosReferral={iosReferral}
          onDismiss={() => setShowWelcome(false)}
          onGetStarted={() => {
            setShowWelcome(false);
            setEditingTeam(null);
            setShowCreateModal(true);
          }}
        />
      )}
    </div>
  );
}

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

export default function TeamList({ teamsContext, syncContext, sharingContext, onShowLinkDevice, iosReferral, onDismissIosReferral }) {
  const { teamsData, navigateToTeamDetail, deleteTeam, navigateToLibrary } = teamsContext;
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
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={playballIcon}
              alt="PlayBall"
              className="w-14 h-14 rounded-2xl shadow-lg"
            />
            <div>
              <h1 className="text-3xl font-bold">PlayBall</h1>
              <p className="text-slate-400">Session Planner</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Sync Status */}
            {syncContext && (
              <SyncStatus
                status={syncContext.syncStatus}
                lastSyncAt={syncContext.lastSyncAt}
                onLinkDevice={onShowLinkDevice}
              />
            )}
            {/* Library Button */}
            <button
              onClick={() => navigateToLibrary('exercises')}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors text-sm"
              title="Library"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="hidden sm:inline">Library</span>
            </button>
            {/* About Button */}
            <button
              onClick={() => setShowAboutModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors text-sm"
              title="About PlayBall"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">About</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* iOS Referral Banner - shown when arriving from iOS app with existing teams */}
        {iosReferral && teams.length > 0 && (
          <div className="mb-6 p-5 bg-blue-600/10 border border-blue-500/30 rounded-xl relative">
            <button
              onClick={onDismissIosReferral}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xl">📱</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-300 mb-2">Link Your iOS App</h3>
                <p className="text-slate-300 text-sm mb-3">
                  To link training sessions from the PlayBall iOS app:
                </p>
                <ol className="text-slate-400 text-sm space-y-1 list-decimal list-inside">
                  <li>Select a team below</li>
                  <li>Tap <span className="text-slate-300 font-medium">Share</span></li>
                  <li>Copy the share code</li>
                  <li>Paste it in your iOS app</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">My Teams</h2>
          <button onClick={handleCreateTeam} className="btn btn-primary">
            + Create Team
          </button>
        </div>

        {teams.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-slate-400 mb-6">
              <svg
                className="w-24 h-24 mx-auto mb-4 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-slate-300 mb-2">
                No teams yet
              </h3>
              <p className="text-slate-500 mb-6">
                Create your first team to start planning training sessions
              </p>
            </div>
            <button onClick={handleCreateTeam} className="btn btn-primary">
              + Create Your First Team
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map(team => (
              <TeamCard
                key={team.id}
                team={team}
                onSelect={handleSelectTeam}
                onEdit={handleEditTeam}
                onDelete={handleDeleteTeam}
              />
            ))}
          </div>
        )}

        {/* iOS App Promo - shown to all users (unless dismissed or arrived from iOS) */}
        {!iosReferral && !iosPromoDismissed && teams.length > 0 && (
          <div className="mt-8 p-5 bg-slate-800/60 border border-slate-700 rounded-xl relative">
            <button
              onClick={handleDismissIosPromo}
              className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center gap-4">
              <img
                src={playballIcon}
                alt="PlayBall"
                className="w-12 h-12 rounded-xl shadow-md flex-shrink-0"
              />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-200 mb-1">Sync to the PlayBall iOS App</h3>
                <p className="text-slate-400 text-sm">
                  Share your sessions directly to the PlayBall iOS app — which also handles game day substitution management.
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

        {/* Shared With Me Section (AC) */}
        {followedShares.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold">Shared With Me</h2>
              <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs font-medium rounded">
                View Only
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {followedShares.map(share => (
                <div
                  key={share.shareToken}
                  className="card p-5 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-100">
                        {share.teamName || 'Shared Team'}
                      </h3>
                      {share.ageGroup && (
                        <p className="text-sm text-slate-400 mt-1">{share.ageGroup}</p>
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
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                      title="Stop following"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 mb-4">
                    Followed {new Date(share.followedAt).toLocaleDateString()}
                  </div>
                  <a
                    href={`/shared/${share.shareToken}`}
                    className="btn btn-secondary w-full text-center"
                  >
                    View Team
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Team Modal */}
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

      {/* About Modal */}
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

      {/* Welcome Modal (first-time visitors) */}
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

import React, { useState } from 'react';
import { toast } from '../../utils/helpers';
import { COACH_IDENTITY_KEY } from '../../constants/storage';

/**
 * Modal for sharing a team with assistant coaches.
 * Handles generating share links, copying, pushing updates, and revoking.
 */
export default function ShareModal({
  team,
  onClose,
  onUpdateTeam,
  sharingHook,
}) {
  const { generateShareLink, revokeShare, copyShareUrl, copyShareCode, isLoading } = sharingHook;
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const isShared = team?.sharing?.isShared && team?.sharing?.shareToken;
  const shareToken = team?.sharing?.shareToken;

  // Sharing requires sync to be active so team data is persisted in the database
  const syncActive = (() => {
    try {
      const raw = localStorage.getItem(COACH_IDENTITY_KEY);
      if (!raw) return false;
      const identity = JSON.parse(raw);
      return Boolean(identity?.coachId && identity?.deviceId);
    } catch { return false; }
  })();

  const handleGenerateLink = async () => {
    try {
      const result = await generateShareLink(team);

      // Update team with sharing info
      onUpdateTeam({
        ...team,
        sharing: {
          isShared: true,
          shareToken: result.shareToken,
          sharedAt: result.sharedAt,
          lastPushedAt: result.sharedAt,
        },
      });

      toast('Share link created');
    } catch (err) {
      toast('Failed to create share link');
    }
  };

  const handleCopyLink = async () => {
    if (!shareToken) return;
    try {
      await copyShareUrl(shareToken);
      toast('Link copied to clipboard');
    } catch (err) {
      toast('Failed to copy link');
    }
  };

  const handleCopyCode = async () => {
    if (!shareToken) return;
    try {
      await copyShareCode(shareToken);
      toast('Code copied to clipboard');
    } catch (err) {
      toast('Failed to copy code');
    }
  };

  const handleRevoke = async () => {
    if (!shareToken) return;
    try {
      await revokeShare(shareToken);

      // Clear sharing info
      onUpdateTeam({
        ...team,
        sharing: {
          isShared: false,
          shareToken: null,
          sharedAt: null,
          lastPushedAt: null,
        },
      });

      toast('Share link revoked');
      onClose();
    } catch (err) {
      toast('Failed to revoke share');
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            {isShared ? 'Sharing Settings' : 'Share with Assistants'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <div className="text-slate-300 font-medium">{team?.name}</div>
          <div className="text-slate-500 text-sm">{team?.ageGroup}</div>
        </div>

        {!isShared ? (
          // Not shared yet
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              Create a link to share this team with your assistant coaches. They'll be able to view all sessions (read-only).
            </p>

            {!syncActive && (
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-amber-300 text-sm">Set up sync first to share your team. Go to Settings and pair your device.</span>
              </div>
            )}

            <button
              onClick={handleGenerateLink}
              disabled={isLoading || !syncActive}
              className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Generate Share Link'}
            </button>
          </div>
        ) : (
          // Already shared
          <div className="space-y-4">
            {/* Share code displayed prominently */}
            <div className="text-center py-3">
              <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2">
                Share Code
              </label>
              <div className="text-4xl font-mono font-bold text-white tracking-[0.3em]">
                {shareToken}
              </div>
              <p className="text-slate-500 text-xs mt-2">
                Enter this code in the PlayBall iOS app
              </p>
            </div>

            {/* Copy buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyCode}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Code
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Copy Link
              </button>
            </div>

            {/* Auto-sync indicator */}
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-300 text-sm">Changes sync automatically</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Shared:</span>
                <span className="ml-2 text-slate-300">
                  {formatDate(team.sharing.sharedAt)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Last sync:</span>
                <span className="ml-2 text-slate-300">
                  {formatDate(team.sharing.lastPushedAt)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowRevokeConfirm(true)}
              className="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded-lg transition-colors"
            >
              Stop Sharing
            </button>
          </div>
        )}

        {/* Revoke confirmation */}
        {showRevokeConfirm && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-300 text-sm mb-3">
              Stop sharing this team? Assistants will immediately lose access.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRevoke}
                disabled={isLoading}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
              >
                {isLoading ? 'Revoking...' : 'Yes, Stop Sharing'}
              </button>
              <button
                onClick={() => setShowRevokeConfirm(false)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs text-center">
            Assistants can only view sessions. Changes you make sync automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

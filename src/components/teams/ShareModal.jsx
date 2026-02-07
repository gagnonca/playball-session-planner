import React, { useState } from 'react';
import { toast } from '../../utils/helpers';

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
  const { generateShareLink, pushUpdate, revokeShare, copyShareUrl, isLoading } = sharingHook;
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const isShared = team?.sharing?.isShared && team?.sharing?.shareToken;
  const shareToken = team?.sharing?.shareToken;

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

  const handlePushUpdate = async () => {
    if (!shareToken) return;
    try {
      const result = await pushUpdate(shareToken, team);

      // Update last pushed timestamp
      onUpdateTeam({
        ...team,
        sharing: {
          ...team.sharing,
          lastPushedAt: result.pushedAt,
        },
      });

      toast('Updates pushed to assistants');
    } catch (err) {
      toast('Failed to push updates');
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

            <button
              onClick={handleGenerateLink}
              disabled={isLoading}
              className="w-full btn btn-primary"
            >
              {isLoading ? 'Creating...' : 'Generate Share Link'}
            </button>
          </div>
        ) : (
          // Already shared
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2">
                Share Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/shared/${shareToken}`}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 text-sm truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  title="Copy link"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Shared:</span>
                <span className="ml-2 text-slate-300">
                  {formatDate(team.sharing.sharedAt)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Last update:</span>
                <span className="ml-2 text-slate-300">
                  {formatDate(team.sharing.lastPushedAt)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePushUpdate}
                disabled={isLoading}
                className="flex-1 btn btn-primary"
              >
                {isLoading ? 'Pushing...' : 'Push Updates'}
              </button>
              <button
                onClick={() => setShowRevokeConfirm(true)}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded-lg transition-colors"
              >
                Stop Sharing
              </button>
            </div>

            <p className="text-slate-500 text-xs">
              Push updates to sync your latest changes with assistant coaches.
            </p>
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
            Assistants can only view sessions. They cannot make changes.
          </p>
        </div>
      </div>
    </div>
  );
}

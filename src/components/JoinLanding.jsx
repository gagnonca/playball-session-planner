import React, { useState, useEffect } from 'react';
import playballIcon from '../assets/playball-icon.png';
import appStoreBadge from '../assets/app-store-badge.svg';

const ROLE_COPY = {
  cocoach: { label: 'Co-coach', detail: 'You can see the roster, games and practice plans, and edit games.' },
  assistant: { label: 'Assistant coach', detail: 'You can see the roster, games and practice plans, and keep your own copies of games to plan with.' },
};

const ERRORS = {
  not_found: 'This invite link isn’t valid. Ask the coach for a new one.',
  used: 'This invite has already been used. Ask the coach for a new one.',
  expired: 'This invite has expired. Ask the coach for a new one.',
};

/**
 * JoinLanding — shown at /join?t=TOKEN when the link opens in a browser
 * instead of the iOS app (no app installed, or opened on a computer).
 * Joining a team happens in the app, so this previews the invite and points
 * there.
 */
export default function JoinLanding({ token, onDismiss }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v2/invites/${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) setError(ERRORS[data.error] || ERRORS.not_found);
        else setPreview(data);
      } catch {
        if (!cancelled) setError('Connection error. Please try again.');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const role = preview ? ROLE_COPY[preview.role] : null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={playballIcon} alt="PlayBall" className="w-16 h-16 rounded-2xl shadow-lg mx-auto mb-4" />
          <h1 className="text-2xl font-bold">PlayBall</h1>
          <p className="text-slate-400 text-sm mt-1">Coach Invite</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
          {!preview && !error && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Loading invite...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-400 font-medium mb-2">Invite Unavailable</p>
              <p className="text-slate-400 text-sm">{error}</p>
            </div>
          )}

          {preview && (
            <>
              <div className="text-center mb-5">
                {preview.mascotEmoji && <div className="text-6xl mb-3">{preview.mascotEmoji}</div>}
                <h2 className="text-xl font-bold">{preview.teamName}</h2>
                <p className="text-sm text-slate-400 mt-2">
                  {preview.invitedBy ? `${preview.invitedBy} invited you` : 'You’re invited'} as {role?.label.toLowerCase() || 'a coach'}.
                </p>
              </div>
              {role && <p className="text-slate-400 text-sm text-center mb-5">{role.detail}</p>}
              <p className="text-slate-300 text-sm text-center mb-4">
                Open this link on your iPhone with PlayBall installed to join.
              </p>
              <a
                href="https://apps.apple.com/us/app/playball-equal-playing-time/id6744836650"
                target="_blank"
                rel="noopener noreferrer"
                className="flex justify-center"
              >
                <img src={appStoreBadge} alt="Download on the App Store" className="h-10 opacity-90 hover:opacity-100 transition-opacity" />
              </a>
            </>
          )}
        </div>

        {onDismiss && (
          <button onClick={onDismiss} className="w-full mt-4 text-slate-500 hover:text-slate-300 text-sm transition-colors">
            Go to getplayball.app
          </button>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import playballIcon from '../assets/playball-icon.png';
import appStoreBadge from '../assets/app-store-badge.svg';

/**
 * ImportLanding — shown at /import?code=XXXXXX
 *
 * Shows a team preview and explains what will happen, then lets the user
 * tap "Continue to PlayBall" to open the iOS app via custom URL scheme.
 */
export default function ImportLanding({ code, onDismiss }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tappedOpen, setTappedOpen] = useState(false);

  useEffect(() => {
    fetchPreview();
  }, [code]);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/team-share/${code}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'This share code is no longer valid.');
        return;
      }
      const team = data.team;
      setPreview({
        name: team._name || team.name || 'Unknown Team',
        emoji: team._mascotEmoji || team.mascotEmoji || null,
        playerCount: (team._players || team.players || []).length,
        gameCount: (team._games || team.games || []).length,
        hasTrainingSessions: !!data.trainingShareCode,
      });
    } catch (e) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openInApp = () => {
    window.location.href = `playball://import-team?code=${code}`;
    setTappedOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <img
            src={playballIcon}
            alt="PlayBall"
            className="w-16 h-16 rounded-2xl shadow-lg mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold">PlayBall</h1>
          <p className="text-slate-400 text-sm mt-1">Team Invite</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Loading team info...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-400 font-medium mb-2">Code Not Found</p>
              <p className="text-slate-400 text-sm">{error}</p>
            </div>
          )}

          {preview && !loading && (
            <>
              {/* Team preview */}
              <div className="text-center mb-5">
                {preview.emoji ? (
                  <div className="text-6xl mb-3">{preview.emoji}</div>
                ) : (
                  <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                    </svg>
                  </div>
                )}
                <h2 className="text-xl font-bold">{preview.name}</h2>
                <div className="flex items-center justify-center gap-4 mt-2 text-sm text-slate-400">
                  <span>{preview.playerCount} players</span>
                  <span>&middot;</span>
                  <span>{preview.gameCount} games</span>
                </div>
                {preview.hasTrainingSessions && (
                  <div className="flex items-center justify-center gap-1.5 mt-2 text-sm text-green-400">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd" />
                    </svg>
                    Training sessions included
                  </div>
                )}
              </div>

              {/* Explanation */}
              <p className="text-slate-400 text-sm text-center mb-5">
                You've been invited to import this team into the PlayBall iOS app. Tap below to open the app and add it automatically.
              </p>

              {/* Primary CTA */}
              <button
                onClick={openInApp}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in PlayBall
              </button>

              {/* Post-tap fallback */}
              {tappedOpen && (
                <div className="mt-4 pt-4 border-t border-slate-700 animate-fade-in">
                  <p className="text-slate-400 text-xs text-center mb-3">
                    App didn't open? Make sure PlayBall is installed:
                  </p>
                  <a
                    href="https://apps.apple.com/us/app/playball-equal-playing-time/id6744836650"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex justify-center mb-4"
                  >
                    <img src={appStoreBadge} alt="Download on the App Store" className="h-10 opacity-90 hover:opacity-100 transition-opacity" />
                  </a>
                  <p className="text-slate-500 text-xs text-center mb-2">Or enter this code manually in the app:</p>
                  <div className="bg-slate-900 rounded-xl py-3 text-center">
                    <span className="font-mono text-2xl font-bold tracking-[0.3em] text-white select-all">
                      {code}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="w-full mt-4 text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            Go to getplayball.app
          </button>
        )}
      </div>
    </div>
  );
}

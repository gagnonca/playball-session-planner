import React, { useState, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { HELP_PREFS_KEY } from '../constants/storage';

// Help content for different section types
export const HELP_CONTENT = {
  play: {
    title: "Play Section",
    content: (
      <div className="space-y-3">
        <p><strong>At the start:</strong> Get players engaged as they arrive. Free play with encouragement from coaches but less instruction. Easy to add kids as they filter in.</p>
        <p><strong>At the end:</strong> Reinforce what was learned during practice. Let them apply it in a game-like situation.</p>
        <p className="text-sm text-slate-400 mt-2">✨ Keep it fun, fast-paced, and game-like!</p>
      </div>
    ),
  },
  practice: {
    title: "Practice Section",
    content: (
      <div className="space-y-3">
        <p><strong>This is where learning happens.</strong> Practice exercises are where we cover the objectives of the training session.</p>
        <p><strong>Five Elements of a Good Training Activity:</strong></p>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>Organized:</strong> Is the activity organized in the right way?</li>
          <li><strong>Game-like:</strong> Is the activity game-like?</li>
          <li><strong>Repetition:</strong> Is there repetition toward the overall goal?</li>
          <li><strong>Challenging:</strong> Are players being challenged appropriately?</li>
          <li><strong>Coaching:</strong> Is there effective coaching based on age/level?</li>
        </ul>
        <p className="text-sm text-slate-400 mt-2">💡 Use guided questions to help players discover solutions!</p>
      </div>
    ),
  },
  moments: {
    title: "Moments of the Game",
    content: (
      <div className="space-y-3">
        <p>Every soccer game can be broken down into <strong>four moments</strong>. By focusing on one moment per session, you create targeted, game-realistic training.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 font-semibold text-blue-300 mb-1">
              <span>⚡</span> Attacking
            </div>
            <p className="text-xs text-slate-400">When your team has the ball and is trying to score. Focus on passing, dribbling, shooting, creating space.</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 font-semibold text-blue-300 mb-1">
              <span>🛡️</span> Defending
            </div>
            <p className="text-xs text-slate-400">When the opponent has the ball. Focus on positioning, pressing, tackling, communication.</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 font-semibold text-blue-300 mb-1">
              <span>🔄</span> Transition to Attack
            </div>
            <p className="text-xs text-slate-400">The moment you win the ball back. Can you quickly play forward and exploit the disorganized defense?</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 font-semibold text-blue-300 mb-1">
              <span>↩️</span> Transition to Defense
            </div>
            <p className="text-xs text-slate-400">The moment you lose possession. React immediately - press the ball or recover goal-side.</p>
          </div>
        </div>
        <p className="text-sm text-slate-400 mt-2">💡 Pick one moment to focus your session around. This helps create cohesive, purposeful training!</p>
      </div>
    ),
  },
};

// Utility to reset all help preferences
export function resetHelpPreferences() {
  try {
    localStorage.removeItem(HELP_PREFS_KEY);
    return true;
  } catch {
    return false;
  }
}

export default function ContextualHelp({ type, onDismiss, forceShow = false }) {
  const [prefs, setPrefs] = useLocalStorage(HELP_PREFS_KEY, {});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show if forced or if user hasn't dismissed this help before
    if (forceShow || !prefs[`dismissed_${type}`]) {
      setIsVisible(true);
    }
  }, [type, prefs, forceShow]);

  // Handle external forceShow changes
  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
    }
  }, [forceShow]);

  const handleDismiss = (forever = false) => {
    if (forever) {
      setPrefs({ ...prefs, [`dismissed_${type}`]: true });
    }
    setIsVisible(false);
    if (onDismiss) onDismiss();
  };

  if (!isVisible || !HELP_CONTENT[type]) return null;

  const help = HELP_CONTENT[type];

  return (
    <div className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-4 mb-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-blue-300 mb-2">{help.title}</h4>
          <div className="text-sm text-slate-300">
            {help.content}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-4 pt-3 border-t border-blue-600/30">
        <button
          onClick={() => handleDismiss(false)}
          className="btn btn-subtle text-xs"
        >
          Got it
        </button>
        <button
          onClick={() => handleDismiss(true)}
          className="btn btn-subtle text-xs"
        >
          Don't show again
        </button>
      </div>
    </div>
  );
}

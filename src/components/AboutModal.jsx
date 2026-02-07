import React from 'react';
import appStoreBadge from '../assets/app-store-badge.svg';
import playballIcon from '../assets/playball-icon.png';

export default function AboutModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-700">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <img
              src={playballIcon}
              alt="PlayBall"
              className="w-12 h-12 rounded-xl shadow-lg"
            />
            <div>
              <h2 className="text-2xl font-bold text-white">PlayBall</h2>
              <p className="text-slate-400 text-sm">Tools for youth coaches</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {/* Session Planner - This App */}
          <div className="bg-slate-700/50 rounded-lg p-4 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📋</span>
              <h3 className="font-semibold text-blue-300">Session Planner</h3>
              <span className="px-2 py-0.5 bg-blue-600/30 text-blue-300 text-xs rounded-full">You are here</span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Plan your training sessions using the Play-Practice-Play methodology.
              Create drills, add diagrams, and export professional PDFs for game day.
            </p>
          </div>

          {/* iOS App */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⏱️</span>
              <h3 className="font-semibold text-slate-200">Equal Playing Time</h3>
              <span className="px-2 py-0.5 bg-slate-600 text-slate-300 text-xs rounded-full">iOS App</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-3">
              Track substitutions during games to ensure every player gets fair playing time.
              Never lose track of who's been on the field.
            </p>
            <a
              href="https://apps.apple.com/us/app/playball-equal-playing-time/id6744836650"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block opacity-90 hover:opacity-100 transition-opacity"
            >
              <img
                src={appStoreBadge}
                alt="Download on the App Store"
                className="h-10"
              />
            </a>
          </div>

          {/* Story */}
          <div className="pt-4 border-t border-slate-700">
            <p className="text-slate-400 text-sm leading-relaxed">
              <span className="text-blue-400 font-medium">PlayBall</span> is built with love for everyone who devotes their time to youth sports.
              The name is a tribute to my dad, who coached me throughout my childhood and taught me
              the importance of fair play and equal playing time for every kid.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs text-center">
            Made with care for coaches everywhere.
          </p>
        </div>
      </div>
    </div>
  );
}

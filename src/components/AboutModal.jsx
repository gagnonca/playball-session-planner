import React from 'react';
import appStoreBadge from '../assets/app-store-badge.svg';

export default function AboutModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">PlayBall</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-slate-300 leading-relaxed">
            PlayBall is built with love for everyone who volunteers their time to youth sports.
          </p>

          <p className="text-slate-300 leading-relaxed">
            The name <span className="text-blue-400 font-medium">PlayBall</span> is a tribute to my dad,
            who coached me throughout my childhood and taught me the importance of fair play
            and equal playing time for every kid.
          </p>

          <div className="pt-4 border-t border-slate-700">
            <p className="text-slate-500 text-sm mb-3">
              Also available on iOS:
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
                className="h-12"
              />
            </a>
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

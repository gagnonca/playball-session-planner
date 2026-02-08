import React, { useState } from 'react';
import playballIcon from '../assets/playball-icon.png';
import appStoreBadge from '../assets/app-store-badge.svg';
import { HAS_SEEN_WELCOME_KEY } from '../constants/storage';

const STEPS = [
  { id: 'welcome' },
  { id: 'features' },
  { id: 'about' },
];

export default function WelcomeModal({ onDismiss, onGetStarted }) {
  const [step, setStep] = useState(0);

  const dismiss = () => {
    localStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true');
    onDismiss();
  };

  const handleGetStarted = () => {
    localStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true');
    onGetStarted();
  };

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-700 overflow-hidden">
        {/* Content */}
        <div className="p-8">
          {/* Step 1: Welcome */}
          {current.id === 'welcome' && (
            <div className="text-center">
              <img
                src={playballIcon}
                alt="PlayBall"
                className="w-24 h-24 rounded-3xl shadow-lg mx-auto mb-6"
              />
              <h2 className="text-3xl font-bold text-white mb-1">Welcome to PlayBall</h2>
              <p className="text-blue-400 font-medium mb-4">Session Planner</p>
              <p className="text-slate-300 leading-relaxed">Plan your youth soccer training sessions using the Play-Practice-Play methodology. Build drills, create diagrams, and take professional session plans to the field.</p>
            </div>
          )}

          {/* Step 2: Features */}
          {current.id === 'features' && (
            <div>
              <h2 className="text-2xl font-bold text-white text-center mb-6">{current.heading}</h2>
              <div className="space-y-4">
                <div className="flex gap-4 items-start p-4 bg-slate-700/40 rounded-xl">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">👥</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Create a Team</h3>
                    <p className="text-slate-400 text-sm">Set up your team with age group and session defaults. All your sessions stay organized in one place.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start p-4 bg-slate-700/40 rounded-xl">
                  <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">📋</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Plan Sessions</h3>
                    <p className="text-slate-400 text-sm">Build training sessions with the Play-Practice-Play structure. Add drills, diagrams, guided questions, and coaching notes.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start p-4 bg-slate-700/40 rounded-xl">
                  <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">📄</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Take It to the Field</h3>
                    <p className="text-slate-400 text-sm">Export professional PDF session plans. Save favorite drills to your library and reuse them across sessions.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: About & Get Started */}
          {current.id === 'about' && (
            <div>
              <h2 className="text-2xl font-bold text-white text-center mb-5">The PlayBall Family</h2>

              <div className="space-y-3 mb-5">
                <div className="bg-slate-700/40 rounded-xl p-4 border border-blue-500/30">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">📋</span>
                    <h3 className="font-semibold text-blue-300">Session Planner</h3>
                    <span className="px-2 py-0.5 bg-blue-600/30 text-blue-300 text-xs rounded-full">You are here</span>
                  </div>
                  <p className="text-slate-400 text-sm">Plan training sessions, create diagrams, and export PDFs for game day.</p>
                </div>

                <div className="bg-slate-700/40 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">⏱️</span>
                    <h3 className="font-semibold text-slate-200">Equal Playing Time</h3>
                    <span className="px-2 py-0.5 bg-slate-600 text-slate-300 text-xs rounded-full">iOS App</span>
                  </div>
                  <p className="text-slate-400 text-sm mb-2">Track substitutions during games to ensure every player gets fair time on the field.</p>
                  <a
                    href="https://apps.apple.com/us/app/playball-equal-playing-time/id6744836650"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block opacity-90 hover:opacity-100 transition-opacity"
                  >
                    <img src={appStoreBadge} alt="Download on the App Store" className="h-9" />
                  </a>
                </div>
              </div>

              <p className="text-slate-500 text-sm text-center leading-relaxed mb-6">
                The name <span className="text-blue-400 font-medium">PlayBall</span> is a tribute to my dad,
                who coached me throughout my childhood and taught me the importance of fair play
                and equal playing time for every kid.
              </p>

              <div className="flex justify-center">
                <button
                  onClick={handleGetStarted}
                  className="btn btn-primary text-lg px-8 py-3"
                >
                  Create My First Team
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <div className="px-8 pb-6">
          {/* Dot indicators */}
          <div className="flex justify-center gap-2 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step ? 'bg-blue-500 w-6' : 'bg-slate-600'
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          {current.id !== 'about' && (
            <div className="flex justify-between items-center">
              <button
                onClick={dismiss}
                className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
              >
                Skip
              </button>
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="btn btn-subtle text-sm"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={() => setStep(step + 1)}
                  className="btn btn-primary text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

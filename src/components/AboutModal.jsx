import React from 'react';
import appStoreBadge from '../assets/app-store-badge.svg';
import playballIcon from '../assets/playball-icon.png';

export default function AboutModal({ onClose, onRestartTutorial }) {
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="card p-6 w-full max-w-lg animate-fade-in" style={{ boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflow: 'auto' }}>
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <img src={playballIcon} alt="PlayBall" className="w-12 h-12 rounded-xl shadow-sm" />
              <div>
                <h2 className="text-[22px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>PlayBall</h2>
                <p className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>Tools for youth coaches</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md"
              style={{ color: 'var(--ink-3)' }}
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            <section>
              <div className="text-[11px] font-mono uppercase mb-2" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
                THE PLAYBALL FAMILY
              </div>
              {/* Session Planner — this app */}
              <div
                className="rounded-[12px] p-4 mb-3"
                style={{ background: 'var(--accent-soft)', border: '1px solid rgb(var(--accent-rgb) / 0.35)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base" aria-hidden>📋</span>
                  <h3 className="text-[15px] font-semibold" style={{ color: 'var(--accent)' }}>Session Planner</h3>
                  <span className="px-2 py-0.5 text-[10.5px] font-mono uppercase rounded-full" style={{ background: 'rgb(var(--accent-rgb) / 0.18)', color: 'var(--accent)', letterSpacing: '0.08em' }}>
                    You are here
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                  Plan training sessions using the Play–Practice–Play methodology. Create drills, add diagrams, and export game-day PDFs.
                </p>
              </div>

              {/* iOS App */}
              <div className="rounded-[12px] p-4" style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base" aria-hidden>⏱️</span>
                  <h3 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Equal Playing Time</h3>
                  <span className="px-2 py-0.5 text-[10.5px] font-mono uppercase rounded-full" style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', color: 'var(--ink-2)', letterSpacing: '0.08em' }}>
                    iOS app
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed mb-3" style={{ color: 'var(--ink-2)' }}>
                  Track substitutions during games to ensure every player gets fair playing time. Never lose track of who&rsquo;s been on the field.
                </p>
                <a
                  href="https://apps.apple.com/us/app/playball-equal-playing-time/id6744836650"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block opacity-90 hover:opacity-100 transition-opacity"
                >
                  <img src={appStoreBadge} alt="Download on the App Store" className="h-10" />
                </a>
              </div>
            </section>

            <div className="hairline" />

            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>PlayBall</span> is built with love for everyone who devotes their time to youth sports. The name is a tribute to my dad, who coached me throughout my childhood and taught me the importance of fair play and equal playing time for every kid.
            </p>
          </div>

          <div className="mt-6 pt-4 hairline flex items-center justify-between">
            <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
              Made with care for coaches everywhere.
            </p>
            {onRestartTutorial && (
              <button
                onClick={onRestartTutorial}
                className="text-[12px] transition-colors"
                style={{ color: 'var(--ink-3)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; }}
              >
                Restart tutorial
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

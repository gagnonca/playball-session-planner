import React, { useState } from 'react';
import { toast, defaultSection } from '../../utils/helpers';
import { PPP_TEMPLATES } from '../../constants/coaching';

// "How would you like to start?" — PPP-default chooser, blank fallback,
// or pull from the saved library. Replaces the old date-first flow.
export default function ScheduleSessionModal({ teamsContext, teamId, onClose, onFromLibrary, hasLibraryItems }) {
  const { createSession, updateSession, navigateToSessionBuilder, getTeam } = teamsContext;
  const team = getTeam ? getTeam(teamId) : null;

  const [sessionDate, setSessionDate] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);

  // Apply the chosen date to a session we just created. We pass the session
  // object in directly — not its id — because looking it up via
  // teamsContext.getSession() here would read from the closure-captured
  // teamsData, which doesn't include the just-queued createSession() update.
  const applyDateIfSet = (session) => {
    if (!sessionDate || !session) return;
    updateSession(teamId, session.id, {
      summary: { ...session.summary, date: sessionDate },
    });
  };

  const handleCreatePPP = () => {
    const session = createSession(teamId);
    const moment = session?.summary?.moment || 'default';
    const template = PPP_TEMPLATES[moment] || PPP_TEMPLATES['default'] || PPP_TEMPLATES[Object.keys(PPP_TEMPLATES)[0]];

    const buildSection = (cfg) => {
      const s = defaultSection();
      s.type = cfg.type;
      s.name = cfg.name;
      s.time = cfg.time;
      s.objective = cfg.objective;
      s.organization = cfg.organization || '';
      if (cfg.guidedQA) s.guidedQA = cfg.guidedQA;
      return s;
    };

    const sections = [
      buildSection(template.play1),
      buildSection(template.practice),
      buildSection(template.play2),
    ];

    updateSession(teamId, session.id, { sections });
    applyDateIfSet(session);
    toast('Play-Practice-Play session created');
    navigateToSessionBuilder(teamId, session.id);
    onClose();
  };

  const handleCreateBlank = () => {
    const session = createSession(teamId);
    applyDateIfSet(session);
    toast('Session created');
    navigateToSessionBuilder(teamId, session.id);
    onClose();
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="card animate-fade-in w-full max-w-[620px]" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="p-6">
            <div className="eyebrow mb-2">
              NEW SESSION{team?.name ? ` · ${team.name.toUpperCase()}${team.ageGroup ? ` ${team.ageGroup}` : ''}` : ''}
            </div>
            <h2 className="text-[24px] font-semibold leading-tight mb-5" style={{ letterSpacing: '-0.02em' }}>
              How would you like to start?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              {/* PPP — Recommended */}
              <button
                onClick={handleCreatePPP}
                className="text-left rounded-[14px] p-4 transition-all"
                style={{
                  background: 'var(--bg-elev)',
                  border: '1.5px solid var(--accent)',
                  boxShadow: '0 0 0 3px rgb(var(--accent-rgb) / 0.12)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="6" cy="6" r="3" />
                      <circle cx="12" cy="18" r="3" />
                      <circle cx="18" cy="6" r="3" />
                      <path d="M9 6h6M6 9v6M18 9v6" />
                    </svg>
                  </div>
                  <span className="px-2 py-0.5 text-[10.5px] font-mono uppercase rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', letterSpacing: '0.08em' }}>
                    Recommended
                  </span>
                </div>
                <div className="text-[16px] font-semibold mb-1" style={{ letterSpacing: '-0.015em' }}>Play–Practice–Play</div>
                <p className="text-[12.5px] leading-snug mb-3" style={{ color: 'var(--ink-2)' }}>
                  A warm playing block, a focused practice, then game-like play to finish.
                </p>
                <div className="font-mono uppercase" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                  3 sections · ~60 min target
                </div>
              </button>

              {/* Blank */}
              <button
                onClick={handleCreateBlank}
                className="text-left rounded-[14px] p-4 transition-all"
                style={{
                  background: 'var(--bg-elev)',
                  border: '1px solid var(--line)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--bg-sunken)', color: 'var(--ink-2)' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                </div>
                <div className="text-[16px] font-semibold mb-1" style={{ letterSpacing: '-0.015em' }}>Blank session</div>
                <p className="text-[12.5px] leading-snug mb-3" style={{ color: 'var(--ink-2)' }}>
                  Start with nothing. Add sections as you go.
                </p>
                <div className="font-mono uppercase" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                  0 sections
                </div>
              </button>
            </div>

            {hasLibraryItems && (
              <button
                onClick={onFromLibrary}
                className="w-full text-left rounded-[14px] p-4 mb-3 transition-all flex items-center gap-3"
                style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--line-2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; }}
              >
                <div
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--bg-elev)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] font-semibold" style={{ letterSpacing: '-0.015em' }}>Pick from your library</div>
                  <p className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>Reuse a saved session as a starting point.</p>
                </div>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--ink-3)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Schedule date (optional) */}
            <div className="rounded-[12px] p-3" style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}>
              {!showSchedule ? (
                <button
                  type="button"
                  onClick={() => setShowSchedule(true)}
                  className="btn btn-ghost w-full justify-start"
                  style={{ padding: '4px 4px', fontSize: 13 }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Schedule for a specific date (optional)
                </button>
              ) : (
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="label-text">Date</label>
                    <input
                      type="date"
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="input-field"
                      autoFocus
                    />
                  </div>
                  <button onClick={() => { setSessionDate(''); setShowSchedule(false); }} className="btn btn-ghost">
                    Skip
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer reassurance */}
          <div className="px-6 py-3 flex items-center justify-between hairline" style={{ background: 'var(--bg-sunken)', borderTop: '1px solid var(--line)', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
            <p className="inline-flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-2)' }}>
              <span style={{ color: 'var(--good)', display: 'inline-flex' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              Sessions auto-save to your library as you build them.
            </p>
            <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      </div>
    </>
  );
}

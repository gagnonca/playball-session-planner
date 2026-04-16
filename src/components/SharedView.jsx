import React, { useState, useEffect, useRef } from 'react';

// Eagerly fire the fetch at module load — runs while JS is still parsing.
// By the time React mounts, the response is likely already in flight or cached.
const _eager = (() => {
  const path = window.location.pathname;
  if (!path.startsWith('/shared/')) return null;
  const parts = path.replace('/shared/', '').split('/');
  const token = parts[0];
  if (!token) return null;
  const sessionId = parts[1] || null;
  return {
    token,
    sessionId,
    sessionsPromise: fetch(`/api/share/${token}/sessions`).then(r => r.json()).catch(() => null),
    detailPromise: sessionId
      ? fetch(`/api/share/${token}/sessions/${sessionId}`).then(r => r.json()).catch(() => null)
      : null,
  };
})();

export default function SharedView() {
  const [teamData, setTeamData] = useState(null);
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const tokenRef = useRef(_eager?.token || window.location.pathname.replace('/shared/', '').split('/')[0]);

  // Consume the eager fetch on mount
  useEffect(() => {
    const token = tokenRef.current;
    if (!token) { setError('Missing share code'); return; }

    (async () => {
      try {
        let data;
        if (_eager?.sessionsPromise && _eager.token === token) {
          data = await _eager.sessionsPromise;
        } else {
          const res = await fetch(`/api/share/${token}/sessions`);
          data = await res.json();
        }
        if (!data?.success) throw new Error(data?.message || 'Share link is not valid');
        setTeamData(data);

        // Deep link to session
        const sid = _eager?.sessionId;
        if (sid) {
          let detail;
          if (_eager?.detailPromise) {
            detail = await _eager.detailPromise;
          } else {
            const res = await fetch(`/api/share/${token}/sessions/${sid}`);
            detail = await res.json();
          }
          if (detail?.success) setSession(detail.session);
        }
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  // Browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/shared/')) {
        const sid = path.replace('/shared/', '').split('/')[1];
        if (sid) {
          loadSession(sid);
        } else {
          setSession(null);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Auto-refresh when tab regains focus so shared data is always fresh
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && tokenRef.current) {
        refreshSessions();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const token = tokenRef.current;

  const refreshSessions = async () => {
    try {
      const res = await fetch(`/api/share/${token}/sessions`);
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || 'Share link is not valid');
      setTeamData(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const res = await fetch(`/api/share/${token}/sessions/${sessionId}`);
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || 'Session not found');
      setSession(data.session);
      // Keep team name/ageGroup in sync from the latest API response
      if (data.teamName) {
        setTeamData(prev => prev ? { ...prev, teamName: data.teamName, ageGroup: data.ageGroup || prev.ageGroup } : prev);
      }
      window.history.pushState({}, '', `/shared/${token}/${sessionId}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const exitSharedView = () => {
    window.location.href = '/';
  };

  // Loading
  if (!teamData && !error) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading shared team...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold mb-2">Link Not Valid</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button onClick={exitSharedView} className="btn btn-primary">
            Go to My Teams
          </button>
        </div>
      </div>
    );
  }

  // Session detail
  if (session) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <div className="bg-slate-800 border-b border-slate-700 p-6">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => {
                setSession(null);
                window.history.pushState({}, '', `/shared/${token}`);
              }}
              className="text-blue-400 hover:text-blue-300 mb-3 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Sessions
            </button>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs font-medium rounded">
                {teamData?.teamName || 'Shared Team'}
              </span>
              {teamData?.ageGroup && (
                <span className="text-slate-500 text-sm">{teamData.ageGroup}</span>
              )}
              <span className="text-slate-500 text-sm">View Only</span>
            </div>
            <h1 className="text-2xl font-bold">
              {session.summary?.title || 'Untitled Session'}
            </h1>
            {session.summary?.date && (
              <p className="text-slate-400 mt-1">{session.summary.date}</p>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-6">
          {/* Session Summary */}
          <div className="card p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Session Info</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {session.summary?.moment && (
                <div>
                  <span className="text-slate-500">Moment:</span>
                  <span className="ml-2 text-slate-300">{session.summary.moment}</span>
                </div>
              )}
              {session.summary?.duration && (
                <div>
                  <span className="text-slate-500">Duration:</span>
                  <span className="ml-2 text-slate-300">{session.summary.duration} min</span>
                </div>
              )}
              {session.summary?.ageGroup && (
                <div>
                  <span className="text-slate-500">Age Group:</span>
                  <span className="ml-2 text-slate-300">{session.summary.ageGroup}</span>
                </div>
              )}
              {session.summary?.playerActions?.length > 0 && (
                <div className="col-span-2">
                  <span className="text-slate-500">Player Actions:</span>
                  <span className="ml-2 text-slate-300">{session.summary.playerActions.join(', ')}</span>
                </div>
              )}
              {session.summary?.keyQualities?.length > 0 && (
                <div className="col-span-2">
                  <span className="text-slate-500">Key Qualities:</span>
                  <span className="ml-2 text-slate-300">{session.summary.keyQualities.join(', ')}</span>
                </div>
              )}
            </div>
            {session.summary?.notes && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <span className="text-slate-500 text-sm">Notes:</span>
                <p className="text-slate-300 mt-1 whitespace-pre-wrap">{session.summary.notes}</p>
              </div>
            )}
          </div>

          {/* Sections */}
          <h2 className="text-lg font-semibold mb-4">
            Sections ({session.sections?.length || 0})
          </h2>
          {session.sections?.length === 0 ? (
            <div className="card p-8 text-center text-slate-400">
              No sections in this session.
            </div>
          ) : (
            <div className="space-y-6">
              {session.sections.map((section, index) => (
                <div key={section.id} className="card p-6">
                  <h3 className="text-lg font-semibold mb-2">
                    {index + 1}. {section.name || `Section ${index + 1}`}
                  </h3>
                  <span className="inline-block px-3 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded-full mb-4">
                    {section.type || 'Section'}{section.time ? ` • ${section.time} min` : ''}
                  </span>

                  {section.imageDataUrl && (
                    <img
                      src={section.imageDataUrl}
                      alt="Diagram"
                      className="w-full rounded-lg border border-slate-700 mb-4"
                      loading="lazy"
                    />
                  )}

                  <div className="space-y-3">
                    {section.objective && (
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">Objective</span>
                        <p className="text-slate-300 mt-1 whitespace-pre-wrap">{section.objective}</p>
                      </div>
                    )}
                    {section.organization && (
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">Organization</span>
                        <p className="text-slate-300 mt-1 whitespace-pre-wrap">{section.organization}</p>
                      </div>
                    )}
                    {section.type === 'Practice' && (section.guidedQA || section.questions) && (
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">Guided Q&A</span>
                        <p className="text-slate-300 mt-1 whitespace-pre-wrap font-mono text-sm">{section.guidedQA || section.questions}</p>
                      </div>
                    )}
                    {section.notes && (
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">Notes</span>
                        <p className="text-slate-300 mt-1 whitespace-pre-wrap">{section.notes}</p>
                      </div>
                    )}
                  </div>

                  {section.variations?.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-700">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Variations</h3>
                        <p className="text-sm text-slate-400">Less / Core / More challenging</p>
                      </div>
                      <div className="space-y-6">
                        {section.variations.map((variation, vIndex) => (
                          <div key={variation.id || vIndex} className="border border-slate-700 rounded-lg p-5">
                            <h4 className="font-semibold text-slate-200 mb-3">
                              {variation.name || `Variation ${vIndex + 1}`}
                            </h4>
                            {variation.imageDataUrl && (
                              <img
                                src={variation.imageDataUrl}
                                alt="Variation diagram"
                                className="w-full rounded-lg border border-slate-600 mb-3"
                                loading="lazy"
                              />
                            )}
                            <div className="space-y-3">
                              {variation.objective && (
                                <div className="bg-slate-800/50 rounded-lg p-4">
                                  <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">Objective</span>
                                  <p className="text-slate-300 mt-1 text-sm whitespace-pre-wrap">{variation.objective}</p>
                                </div>
                              )}
                              {variation.organization && (
                                <div className="bg-slate-800/50 rounded-lg p-4">
                                  <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">Organization</span>
                                  <p className="text-slate-300 mt-1 text-sm whitespace-pre-wrap">{variation.organization}</p>
                                </div>
                              )}
                              {(variation.guidedQA || variation.questions) && (
                                <div className="bg-slate-800/50 rounded-lg p-4">
                                  <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">Guided Q&A</span>
                                  <p className="text-slate-300 mt-1 text-sm whitespace-pre-wrap font-mono">{variation.guidedQA || variation.questions}</p>
                                </div>
                              )}
                              {variation.notes && (
                                <div className="bg-slate-800/50 rounded-lg p-4">
                                  <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">Notes</span>
                                  <p className="text-slate-300 mt-1 text-sm whitespace-pre-wrap">{variation.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Session list
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="bg-slate-800 border-b border-slate-700 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs font-medium rounded">
              Shared Team
            </span>
            <span className="text-slate-500 text-sm">View Only</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">{teamData.teamName}</h1>
          {teamData.ageGroup && (
            <p className="text-slate-400">{teamData.ageGroup}</p>
          )}
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={refreshSessions}
              className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Check for Updates
            </button>
            <button
              onClick={exitSharedView}
              className="text-slate-400 hover:text-slate-300 text-sm"
            >
              Go to My Teams
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-xl font-bold mb-4">Sessions ({teamData.sessions?.length || 0})</h2>
        {teamData.sessions?.length === 0 ? (
          <div className="card p-8 text-center text-slate-400">
            No sessions in this team yet.
          </div>
        ) : (
          <div className="space-y-4">
            {teamData.sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className="card p-4 w-full text-left hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {s.title || 'Untitled Session'}
                    </h3>
                    {s.date && (
                      <p className="text-slate-400 text-sm">{s.date}</p>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

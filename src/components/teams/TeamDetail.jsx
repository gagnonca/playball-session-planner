import React, { useRef, useState } from 'react';
import SessionCard from './SessionCard';
import ScheduleSessionModal from './ScheduleSessionModal';
import ShareModal from './ShareModal';
import SessionLibraryModal from './SessionLibraryModal';
import TeamGames from './TeamGames';
import TeamSpine from './TeamSpine';
import CreateTeamModal from './CreateTeamModal';
import { toast, sessionToLibraryPayload, libraryPayloadToSession, uid, nowIso, downloadJson } from '../../utils/helpers';
import { COACH_IDENTITY_KEY, SESSION_LIBRARY_KEY } from '../../constants/storage';

const TEAM_TONES = ['#c8553d', '#3d7a4a', '#3d5a8a', '#9a5a3a', '#6a4a8a', '#3a6a7a'];
function teamTone(team) {
  if (team?.color) return team.color;
  const key = team?.id || team?.name || '';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TEAM_TONES[h % TEAM_TONES.length];
}
function nextSessionLabel(team) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = (team?.sessions || [])
    .filter(s => s.summary?.date && new Date(s.summary.date) >= today)
    .sort((a, b) => new Date(a.summary.date) - new Date(b.summary.date))[0];
  if (!upcoming?.summary?.date) return null;
  const d = new Date(upcoming.summary.date);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TeamDetail({ teamsContext, sharingContext, libraryHook }) {
  const {
    selectedTeamId,
    teamsData,
    getTeam,
    updateTeam,
    navigateToTeams,
    navigateToTeamDetail,
    navigateToSessionBuilder,
    deleteSession,
    duplicateSession,
  } = teamsContext;

  const allTeams = teamsData?.teams || [];
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSessionLibrary, setShowSessionLibrary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'scheduled'
  const [linkCode, setLinkCode] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [gamesRefreshKey, setGamesRefreshKey] = useState(0);
  const teamGamesRef = useRef(null);
  const [sessionLibrary, setSessionLibrary] = useState(() => {
    try {
      const lib = JSON.parse(localStorage.getItem(SESSION_LIBRARY_KEY)) || { version: 1, items: [] };
      // Note: we no longer strip base64 data URLs from old library items here.
      // Clearing imageDataUrl would destroy the only image reference for pre-CDN
      // library items. The CDN upload flow handles new saves going forward.
      return lib;
    } catch { return { version: 1, items: [] }; }
  });

  const team = getTeam(selectedTeamId);

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        <div className="text-center">
          <p className="text-xl" style={{ color: 'var(--ink-2)' }}>Team not found</p>
          <button onClick={navigateToTeams} className="btn btn-primary mt-4">
            Back to teams
          </button>
        </div>
      </div>
    );
  }

  const sessions = team.sessions || [];

  // Filter sessions based on type
  const filteredSessions = sessions.filter(session => {
    if (filterType === 'scheduled') {
      return session.summary.date && session.summary.date.length > 0;
    }
    return true; // 'all'
  });

  // Sort sessions by date (scheduled first, then by date, then templates by
  // updated date). Falls back across updatedAt → createdAt → 0 so an undefined
  // timestamp (e.g. a session reassembled by an older server build) doesn't
  // poison the comparator and leave the list looking unsorted.
  const ts = (s) => {
    const v = s?.updatedAt || s?.createdAt || s?.summary?.updatedAt || s?.summary?.createdAt;
    const n = v ? new Date(v).getTime() : 0;
    return Number.isFinite(n) ? n : 0;
  };
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    const aHasDate = a.summary.date && a.summary.date.length > 0;
    const bHasDate = b.summary.date && b.summary.date.length > 0;

    if (aHasDate && !bHasDate) return -1;
    if (!aHasDate && bHasDate) return 1;

    if (aHasDate && bHasDate) {
      // Most-recent scheduled date first (descending).
      return new Date(b.summary.date) - new Date(a.summary.date);
    }

    return ts(b) - ts(a);
  });

  const scheduledCount = sessions.filter(s => s.summary.date && s.summary.date.length > 0).length;

  const handleSelectSession = (sessionId) => {
    navigateToSessionBuilder(selectedTeamId, sessionId);
  };

  const handleDuplicateSession = (sessionId) => {
    const newSession = duplicateSession(selectedTeamId, sessionId);
    if (newSession) {
      toast('Session duplicated');
    }
  };

  const handleDeleteSession = (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session && window.confirm(`Delete "${session.summary.title || 'Untitled Session'}"?`)) {
      deleteSession(selectedTeamId, sessionId);
      toast('Session deleted');
    }
  };

  const saveSessionLibrary = (lib) => {
    setSessionLibrary(lib);
    try {
      localStorage.setItem(SESSION_LIBRARY_KEY, JSON.stringify(lib));
    } catch (e) {
      toast('Storage full — could not save library');
      console.error('localStorage save failed:', e);
    }
  };

  const handleSaveSessionToLibrary = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const payload = sessionToLibraryPayload(session);

    // Upload diagram images to CDN to keep localStorage compact
    const itemId = uid();
    try {
      const uploadImage = async (base64, suffix) => {
        const res = await fetch('/api/session-library/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, key: `${itemId}-${suffix}` }),
        });
        const data = await res.json();
        return data.success ? data.url : null;
      };

      const sections = payload.sections || [];
      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        // Upload section diagram image
        if (sec.imageDataUrl && sec.imageDataUrl.startsWith('data:')) {
          const cdnUrl = await uploadImage(sec.imageDataUrl, `s${i}`);
          if (cdnUrl) {
            sec.imageDataUrl = cdnUrl;
            // Strip the large dataUrl from diagramData but keep elements/lines
            if (sec.diagramData) {
              delete sec.diagramData.dataUrl;
            }
          }
        }
        // Upload variation diagram images
        if (Array.isArray(sec.variations)) {
          for (let j = 0; j < sec.variations.length; j++) {
            const v = sec.variations[j];
            if (v.imageDataUrl && v.imageDataUrl.startsWith('data:')) {
              const cdnUrl = await uploadImage(v.imageDataUrl, `s${i}v${j}`);
              if (cdnUrl) {
                v.imageDataUrl = cdnUrl;
                if (v.diagramData) {
                  delete v.diagramData.dataUrl;
                }
              }
            }
          }
        }
      }
    } catch (err) {
      // CDN upload failed — save with data URLs as fallback
      console.warn('CDN upload failed, saving with data URLs:', err);
    }

    const item = {
      id: itemId,
      name: session.summary.title || 'Untitled Session',
      ageGroup: session.summary.ageGroup || '',
      moment: session.summary.moment || '',
      sectionCount: session.sections?.length || 0,
      playerActions: session.summary.playerActions || [],
      keyQualities: session.summary.keyQualities || [],
      payload,
      updatedAt: nowIso(),
    };
    const lib = { ...sessionLibrary, items: [...sessionLibrary.items, item] };
    saveSessionLibrary(lib);

    // Also save to unified library hook for cross-team browsing
    if (libraryHook) {
      libraryHook.saveSession(session, session.summary.title || 'Untitled Session');
    }

    toast('Session saved to library');
  };

  const handleInsertSessionFromLibrary = (itemId) => {
    const item = sessionLibrary.items.find(i => i.id === itemId);
    if (!item) return;
    const teamDefaults = { ageGroup: team.ageGroup, defaultDuration: team.defaultDuration };
    const newSession = libraryPayloadToSession(item.payload, teamDefaults);
    teamsContext.createSession(selectedTeamId, newSession);
    setShowSessionLibrary(false);
    toast('Session loaded from library');
    navigateToSessionBuilder(selectedTeamId, newSession.id);
  };

  const handleDeleteSessionLibraryItem = (itemId) => {
    const lib = { ...sessionLibrary, items: sessionLibrary.items.filter(i => i.id !== itemId) };
    saveSessionLibrary(lib);
    toast('Removed from library');
  };

  const handleExportSessionLibrary = () => {
    downloadJson('session-library.json', sessionLibrary);
  };

  const handleImportSessionLibrary = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.items || !Array.isArray(data.items)) {
          toast('Invalid library file');
          return;
        }
        const merged = {
          ...sessionLibrary,
          items: [...sessionLibrary.items, ...data.items],
        };
        saveSessionLibrary(merged);
        toast(`Imported ${data.items.length} session(s)`);
      } catch {
        toast('Failed to import');
      }
    };
    reader.readAsText(file);
  };

  const handleClearSessionLibrary = () => {
    if (window.confirm('Clear your entire session library? This cannot be undone.')) {
      saveSessionLibrary({ version: 1, items: [] });
      toast('Session library cleared');
    }
  };

  const tone = teamTone(team);
  const next = nextSessionLabel(team);
  const playerCount = team.roster?.length || 0;

  return (
    <div className="flex-1 flex min-h-0" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <TeamSpine
        teams={allTeams}
        activeId={selectedTeamId}
        onSelect={navigateToTeamDetail}
        onCreateTeam={() => setShowCreateTeamModal(true)}
      />
      <div className="flex-1 min-w-0 overflow-auto">
      <header
        className="sticky top-0 z-10"
        style={{ background: 'rgb(var(--bg-rgb) / 0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--line)' }}
      >
        <div className="max-w-6xl mx-auto px-10 py-3 flex items-center justify-end gap-4">
          <div className="flex items-center gap-2">
            {sharingContext && (
              <button
                onClick={() => setShowShareModal(true)}
                className="btn btn-secondary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span>Share team</span>
                {team.sharing?.isShared && (
                  <span className="ml-0.5 w-2 h-2 rounded-full" style={{ background: 'var(--good)' }} title="Shared" />
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-10 pt-10 pb-16">
        <div className="flex items-start gap-5 mb-2">
          <div
            className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center font-semibold text-[15px]"
            style={{ background: tone, color: '#fff', letterSpacing: '-0.015em' }}
          >
            {team.ageGroup || (team.name ? team.name.slice(0, 2).toUpperCase() : '·')}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[36px] font-semibold leading-[1.04]" style={{ letterSpacing: '-0.02em' }}>{team.name}</h1>
            <p className="mt-2 text-[14px]" style={{ color: 'var(--ink-2)' }}>
              {playerCount > 0 ? `${playerCount} players · ` : ''}
              {sessions.length} session{sessions.length === 1 ? '' : 's'}
              {next ? ` · next ${next}` : ''}
              {team.defaultDuration ? ` · ${team.defaultDuration} min default` : ''}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="ml-2 text-[13px]"
                style={{ color: 'var(--accent)' }}
              >
                {showSettings ? 'Hide' : 'Edit'}
              </button>
            </p>
            {showSettings && (
              <div className="mt-4 card p-4 flex flex-wrap gap-4 items-end">
                <div>
                  <label className="label-text">Team name</label>
                  <input
                    type="text"
                    value={team.name}
                    onChange={(e) => updateTeam(selectedTeamId, { name: e.target.value })}
                    className="input-field w-56"
                  />
                </div>
                <div>
                  <label className="label-text">Age group</label>
                  <input
                    type="text"
                    value={team.ageGroup || ''}
                    onChange={(e) => updateTeam(selectedTeamId, { ageGroup: e.target.value })}
                    placeholder="e.g., U8"
                    className="input-field w-28"
                  />
                </div>
                <div>
                  <label className="label-text">Default duration (min)</label>
                  <input
                    type="text"
                    value={team.defaultDuration || ''}
                    onChange={(e) => updateTeam(selectedTeamId, { defaultDuration: e.target.value })}
                    placeholder="60"
                    className="input-field w-28"
                  />
                </div>
                <button
                  onClick={() => {
                    setShowSettings(false);
                    toast('Team settings saved');
                  }}
                  className="btn btn-primary"
                >
                  Done
                </button>
                <div className="w-full pt-3 mt-1" style={{ borderTop: '1px solid var(--line)' }}>
                  <label className="label-text">Link iOS team</label>
                  {team.iosShareCode ? (
                    <p className="text-[13px] mt-1" style={{ color: 'var(--ink-2)' }}>
                      Linked to iOS share code <span style={{ fontFamily: 'monospace' }}>{team.iosShareCode}</span>. Games pushed from the iOS app will appear below.
                    </p>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={linkCode}
                        onChange={(e) => setLinkCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6))}
                        placeholder="ABC123"
                        className="input-field w-32"
                        style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}
                      />
                      <button
                        disabled={linkBusy || linkCode.length !== 6}
                        onClick={async () => {
                          setLinkBusy(true);
                          try {
                            const raw = localStorage.getItem(COACH_IDENTITY_KEY);
                            const id = raw ? JSON.parse(raw) : null;
                            if (!id?.coachId || !id?.deviceId) {
                              toast('Pair this device before linking an iOS team.');
                              return;
                            }
                            const res = await fetch(
                              `/api/v2/teams/${encodeURIComponent(selectedTeamId)}/link-ios`,
                              {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'x-coach-id': id.coachId,
                                  'x-device-id': id.deviceId,
                                },
                                body: JSON.stringify({ shareCode: linkCode }),
                              }
                            );
                            const data = await res.json();
                            if (!data.success) {
                              toast(data.message || 'Could not link iOS team.');
                              return;
                            }
                            updateTeam(selectedTeamId, { iosShareCode: linkCode });
                            setLinkCode('');
                            setGamesRefreshKey(k => k + 1);
                            toast(
                              data.gamesTransferred
                                ? `Linked — ${data.gamesTransferred} game${data.gamesTransferred === 1 ? '' : 's'} imported.`
                                : 'Linked — games will appear after the next iOS push.'
                            );
                          } catch (err) {
                            toast('Network error linking iOS team.');
                            console.error(err);
                          } finally {
                            setLinkBusy(false);
                          }
                        }}
                        className="btn btn-secondary"
                      >
                        {linkBusy ? 'Linking…' : 'Link'}
                      </button>
                      <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                        Paste the 6-char share code from the PlayBall iOS app.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="hairline mt-8 mb-8" />

        {(team.players || []).length > 0 && (
          <>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-mono uppercase" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>ROSTER</div>
                <h2 className="text-[24px] font-semibold mt-1" style={{ letterSpacing: '-0.02em' }}>
                  {team.players.length} player{team.players.length === 1 ? '' : 's'}
                </h2>
              </div>
              <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                Synced from the PlayBall iOS app
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mb-10">
              {team.players.map(p => (
                <div
                  key={p.id}
                  className="inline-flex items-center gap-2 rounded-full pr-3"
                  style={{
                    background: 'var(--bg-elev)',
                    border: '1px solid var(--line)',
                    padding: '4px 4px 4px 4px',
                  }}
                >
                  <span
                    className="inline-block rounded-full flex-shrink-0"
                    style={{
                      width: 22,
                      height: 22,
                      background: p.tintHex || 'var(--ink-3)',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {(p.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-[13px]" style={{ color: 'var(--ink)' }}>{p.name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Sessions section header + filter + new button */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-[11px] font-mono uppercase" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>SESSIONS</div>
            <h2 className="text-[24px] font-semibold mt-1" style={{ letterSpacing: '-0.02em' }}>
              {sessions.length === 0 ? 'Build your first plan' : 'Plans for this team'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div
              role="tablist"
              aria-label="Filter sessions"
              className="inline-flex p-1 rounded-[10px]"
              style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}
            >
              {[
                { key: 'all', label: `All (${sessions.length})` },
                { key: 'scheduled', label: `Scheduled (${scheduledCount})` },
              ].map(opt => {
                const active = filterType === opt.key;
                return (
                  <button
                    key={opt.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilterType(opt.key)}
                    className="px-3 py-1.5 text-[12.5px] rounded-[7px] transition-colors"
                    style={{
                      background: active ? 'var(--bg-elev)' : 'transparent',
                      color: active ? 'var(--ink)' : 'var(--ink-2)',
                      border: active ? '1px solid var(--line-2)' : '1px solid transparent',
                      boxShadow: active ? 'var(--shadow-sm)' : 'none',
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowScheduleModal(true)} className="btn btn-primary">
              + New session
            </button>
          </div>
        </div>

        {sortedSessions.length === 0 ? (
          <div className="card p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--ink-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-[18px] font-semibold mb-2">
              {filterType === 'all' ? 'No sessions yet' : 'No scheduled sessions'}
            </h3>
            <p className="text-[13.5px] mb-6" style={{ color: 'var(--ink-2)' }}>
              Create your first session to get started.
            </p>
            <button onClick={() => setShowScheduleModal(true)} className="btn btn-primary">
              + Create session
            </button>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {sortedSessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onSelect={handleSelectSession}
                onDuplicate={handleDuplicateSession}
                onDelete={handleDeleteSession}
                onSaveToLibrary={handleSaveSessionToLibrary}
              />
            ))}
          </div>
        )}

        {team.iosShareCode && (
          <>
            <div className="hairline mt-12 mb-8" />
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <div className="text-[11px] font-mono uppercase" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>GAMES</div>
                <h2 className="text-[24px] font-semibold mt-1" style={{ letterSpacing: '-0.02em' }}>
                  From the PlayBall iOS app
                </h2>
              </div>
              <button
                onClick={() => teamGamesRef.current?.startCreate()}
                className="btn btn-primary"
              >
                + New game
              </button>
            </div>
            <TeamGames ref={teamGamesRef} key={gamesRefreshKey} teamId={selectedTeamId} players={team.players || []} />
          </>
        )}
      </main>

      {/* Schedule Session Modal */}
      {showScheduleModal && (
        <ScheduleSessionModal
          teamsContext={teamsContext}
          teamId={selectedTeamId}
          onClose={() => setShowScheduleModal(false)}
          hasLibraryItems={sessionLibrary.items.length > 0}
          onFromLibrary={() => {
            setShowScheduleModal(false);
            setShowSessionLibrary(true);
          }}
        />
      )}

      {/* Share Modal */}
      {showShareModal && sharingContext && (
        <ShareModal
          team={team}
          onClose={() => setShowShareModal(false)}
          onUpdateTeam={(updatedTeam) => updateTeam(selectedTeamId, updatedTeam)}
          sharingHook={sharingContext}
        />
      )}

      {/* Session Library Modal */}
      <SessionLibraryModal
        isOpen={showSessionLibrary}
        onClose={() => setShowSessionLibrary(false)}
        library={sessionLibrary}
        onInsert={handleInsertSessionFromLibrary}
        onDelete={handleDeleteSessionLibraryItem}
        onExport={handleExportSessionLibrary}
        onImport={handleImportSessionLibrary}
        onClear={handleClearSessionLibrary}
      />

      {showCreateTeamModal && (
        <CreateTeamModal
          teamsContext={teamsContext}
          editingTeam={null}
          onClose={() => setShowCreateTeamModal(false)}
        />
      )}
      </div>
    </div>
  );
}

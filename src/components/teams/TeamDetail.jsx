import React, { useState } from 'react';
import SessionCard from './SessionCard';
import ScheduleSessionModal from './ScheduleSessionModal';
import ShareModal from './ShareModal';
import SessionLibraryModal from './SessionLibraryModal';
import { toast, sessionToLibraryPayload, libraryPayloadToSession, uid, nowIso, downloadJson } from '../../utils/helpers';
import { SESSION_LIBRARY_KEY } from '../../constants/storage';

export default function TeamDetail({ teamsContext, sharingContext, libraryHook }) {
  const {
    selectedTeamId,
    getTeam,
    updateTeam,
    navigateToTeams,
    navigateToSessionBuilder,
    navigateToLibrary,
    deleteSession,
    duplicateSession,
  } = teamsContext;

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSessionLibrary, setShowSessionLibrary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'scheduled'
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
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-slate-400">Team not found</p>
          <button onClick={navigateToTeams} className="btn btn-primary mt-4">
            Back to Teams
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

  // Sort sessions by date (scheduled first, then by date, then templates by updated date)
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    const aHasDate = a.summary.date && a.summary.date.length > 0;
    const bHasDate = b.summary.date && b.summary.date.length > 0;

    if (aHasDate && !bHasDate) return -1;
    if (!aHasDate && bHasDate) return 1;

    if (aHasDate && bHasDate) {
      return new Date(a.summary.date) - new Date(b.summary.date);
    }

    return new Date(b.updatedAt) - new Date(a.updatedAt);
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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-6">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={navigateToTeams}
            className="text-blue-400 hover:text-blue-300 mb-3 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Teams
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{team.name}</h1>
              <div className="flex items-center gap-3 text-slate-400">
                {team.ageGroup && <span>{team.ageGroup}</span>}
                {team.defaultDuration && (
                  <>
                    {team.ageGroup && <span className="text-slate-600">·</span>}
                    <span>{team.defaultDuration} min default</span>
                  </>
                )}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  {showSettings ? 'Hide' : 'Edit'}
                </button>
              </div>
              {/* Inline Settings */}
              {showSettings && (
                <div className="mt-3 p-4 bg-slate-700/50 rounded-lg border border-slate-600 flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Team Name</label>
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => updateTeam(selectedTeamId, { name: e.target.value })}
                      className="input-field w-48"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Age Group</label>
                    <input
                      type="text"
                      value={team.ageGroup || ''}
                      onChange={(e) => updateTeam(selectedTeamId, { ageGroup: e.target.value })}
                      placeholder="e.g., U8"
                      className="input-field w-24"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Default Duration</label>
                    <input
                      type="text"
                      value={team.defaultDuration || ''}
                      onChange={(e) => updateTeam(selectedTeamId, { defaultDuration: e.target.value })}
                      placeholder="60"
                      className="input-field w-24"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      toast('Team settings saved');
                    }}
                    className="btn btn-primary text-sm"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {navigateToLibrary && (
                <button
                  onClick={() => navigateToLibrary('sessions')}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="hidden sm:inline">Library</span>
                </button>
              )}
              {sharingContext && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span className="hidden sm:inline">Share</span>
                  {team.sharing?.isShared && (
                    <span className="ml-1 w-2 h-2 bg-green-400 rounded-full" title="Shared" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-sm text-slate-400 mb-1">Total Sessions</p>
            <p className="text-3xl font-bold text-blue-400">{sessions.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-400 mb-1">Scheduled</p>
            <p className="text-3xl font-bold text-green-400">{scheduledCount}</p>
          </div>
        </div>

        {/* Filter and Create Button */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              All ({sessions.length})
            </button>
            <button
              onClick={() => setFilterType('scheduled')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterType === 'scheduled'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Scheduled ({scheduledCount})
            </button>
          </div>
          <button onClick={() => setShowScheduleModal(true)} className="btn btn-primary">
            + New Session
          </button>
        </div>

        {/* Sessions List */}
        {sortedSessions.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-slate-400 mb-6">
              <svg
                className="w-24 h-24 mx-auto mb-4 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-slate-300 mb-2">
                {filterType === 'all' ? 'No sessions yet' : 'No scheduled sessions'}
              </h3>
              <p className="text-slate-500 mb-6">
                Create your first session to get started
              </p>
            </div>
            <button onClick={() => setShowScheduleModal(true)} className="btn btn-primary">
              + Create Session
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      </div>

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
    </div>
  );
}

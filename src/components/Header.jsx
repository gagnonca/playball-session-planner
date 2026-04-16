import React from 'react';
import playballIcon from '../assets/playball-icon.png';
import SyncStatus from './SyncStatus';

export default function Header({
  onDownloadPDF,
  onOpenAISettings,
  isAIConfigured = false,
  onNavigateToLibrary,
  onSaveAs,
  syncStatus,
  lastSyncAt,
  onLinkDevice,
}) {
  return (
    <header className="sticky top-0 z-10 backdrop-blur-md bg-slate-900/80 border-b border-slate-700 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img
            src={playballIcon}
            alt="PlayBall"
            className="w-10 h-10 rounded-xl shadow-lg"
          />
          <div>
            <div className="font-bold text-lg tracking-tight">PlayBall Session Planner</div>
            <div className="text-xs text-slate-400">Build Your Training Sessions</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap no-print">
          {syncStatus && (
            <SyncStatus status={syncStatus} lastSyncAt={lastSyncAt} onLinkDevice={onLinkDevice} />
          )}
          {onNavigateToLibrary && (
            <button
              onClick={onNavigateToLibrary}
              className="btn btn-subtle text-sm"
              title="Open Library"
            >
              Library
            </button>
          )}
          {onOpenAISettings && (
            <button
              onClick={onOpenAISettings}
              className={`btn text-sm ${isAIConfigured ? 'btn-subtle' : 'btn-secondary'}`}
              title={isAIConfigured ? 'AI configured - click to manage' : 'Set up AI assistant'}
            >
              ✨ {isAIConfigured ? 'AI On' : 'AI'}
            </button>
          )}
          {onSaveAs && (
            <button
              onClick={onSaveAs}
              className="btn btn-subtle text-sm"
              title="Save a renamed copy of this session to your library"
            >
              Save As…
            </button>
          )}
          <button onClick={onDownloadPDF} className="btn btn-primary text-sm">
            📄 Download PDF
          </button>
        </div>
      </div>
    </header>
  );
}

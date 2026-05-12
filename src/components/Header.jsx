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
    <header
      className="sticky top-0 z-10"
      style={{
        background: 'rgb(var(--bg-rgb) / 0.85)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={playballIcon} alt="PlayBall" className="w-9 h-9 rounded-xl shadow-sm" />
          <div>
            <div className="text-[15px] font-semibold leading-tight" style={{ letterSpacing: '-0.015em' }}>PlayBall</div>
            <div className="text-[11px] font-mono uppercase" style={{ color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
              Session planner
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap no-print">
          {syncStatus && (
            <SyncStatus status={syncStatus} lastSyncAt={lastSyncAt} onLinkDevice={onLinkDevice} />
          )}
          {onNavigateToLibrary && (
            <button onClick={onNavigateToLibrary} className="btn btn-ghost" title="Open Library">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Library
            </button>
          )}
          {onOpenAISettings && (
            <button
              onClick={onOpenAISettings}
              className={isAIConfigured ? 'btn btn-soft' : 'btn btn-ghost'}
              title={isAIConfigured ? 'AI configured — click to manage' : 'Set up AI assistant'}
            >
              <span aria-hidden style={{ marginRight: 4 }}>✨</span>
              {isAIConfigured ? 'AI on' : 'AI'}
            </button>
          )}
          {onSaveAs && (
            <button onClick={onSaveAs} className="btn btn-ghost" title="Save a renamed copy to library">
              Save as…
            </button>
          )}
          <button onClick={onDownloadPDF} className="btn btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download PDF
          </button>
        </div>
      </div>
    </header>
  );
}

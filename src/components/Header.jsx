import React from 'react';

export default function Header({
  onOpenLibrary,
  onSave,
  onDownloadPDF,
  onOpenAISettings,
  isAIConfigured = false,
}) {
  const handleDownloadPDF = () => {
    onSave(); // Auto-save before downloading
    onDownloadPDF();
  };

  return (
    <header className="sticky top-0 z-10 backdrop-blur-md bg-slate-900/80 border-b border-slate-700 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center text-2xl shadow-lg">
            ⚽
          </div>
          <div>
            <div className="font-bold text-lg tracking-tight">PlayBall Session Planner</div>
            <div className="text-xs text-slate-400">Build Your Training Sessions</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap no-print">
          {onOpenAISettings && (
            <button
              onClick={onOpenAISettings}
              className={`btn text-sm ${isAIConfigured ? 'btn-subtle' : 'btn-secondary'}`}
              title={isAIConfigured ? 'AI configured - click to manage' : 'Set up AI assistant'}
            >
              ✨ {isAIConfigured ? 'AI On' : 'AI'}
            </button>
          )}
          <button onClick={onOpenLibrary} className="btn btn-secondary text-sm">
            Library
          </button>
          <button onClick={onSave} className="btn btn-secondary text-sm">
            Save
          </button>
          <button onClick={handleDownloadPDF} className="btn btn-primary text-sm">
            📄 Download PDF
          </button>
        </div>
      </div>
    </header>
  );
}

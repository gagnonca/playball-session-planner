import React from 'react';

export default function AddSectionModal({
  isOpen,
  onClose,
  onChooseLibrary,
  onBuildFromScratch,
  onPPP,
  hasSections = false,
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose} />

      {/* Modal Content */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold">Add to Session</h2>
            <p className="text-sm text-slate-400 mt-1">
              {hasSections
                ? 'Add another exercise or choose from your library.'
                : 'Start with the Play-Practice-Play structure or build custom sections.'}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-subtle">
            Close
          </button>
        </div>

        {/* PPP - Primary action when no sections exist */}
        {!hasSections && onPPP && (
          <div className="mb-6">
            <button
              onClick={onPPP}
              className="w-full btn btn-primary text-lg py-4 flex flex-col items-center gap-1"
            >
              <span className="font-bold">Play - Practice - Play</span>
              <span className="text-sm opacity-80">Recommended structure with pre-filled content</span>
            </button>
          </div>
        )}

        {/* Divider when PPP is shown */}
        {!hasSections && onPPP && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border-t border-slate-600"></div>
            <span className="text-slate-500 text-sm">or add individual sections</span>
            <div className="flex-1 border-t border-slate-600"></div>
          </div>
        )}

        {/* Other options */}
        <div className="flex gap-3 justify-center">
          <button onClick={onChooseLibrary} className="btn btn-secondary flex-1">
            From Library
          </button>
          <button onClick={onBuildFromScratch} className="btn btn-subtle flex-1">
            Custom Section
          </button>
        </div>

        {/* Add PPP button for existing sessions too */}
        {hasSections && onPPP && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <button
              onClick={onPPP}
              className="w-full btn btn-subtle text-sm"
            >
              Replace with Play-Practice-Play structure
            </button>
          </div>
        )}
      </div>
    </>
  );
}

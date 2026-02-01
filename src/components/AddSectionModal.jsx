import React from 'react';

export default function AddSectionModal({ isOpen, onClose, onChooseLibrary, onBuildFromScratch }) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose} />

      {/* Modal Content */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold">Add a section</h2>
            <p className="text-sm text-slate-400 mt-1">
              Choose a saved exercise or build a new section from scratch.
            </p>
          </div>
          <button onClick={onClose} className="btn btn-subtle">
            Close
          </button>
        </div>

        <div className="flex gap-3 justify-center mt-6">
          <button onClick={onChooseLibrary} className="btn btn-secondary">
            Choose from Library
          </button>
          <button onClick={onBuildFromScratch} className="btn btn-primary">
            Build from Scratch
          </button>
        </div>
      </div>
    </>
  );
}

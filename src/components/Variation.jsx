import React, { useCallback } from 'react';
import { fileToDataUrl } from '../utils/helpers';

// Auto-grow textarea handler
const useAutoGrow = () => {
  return useCallback((e) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.max(target.scrollHeight, 72) + 'px';
  }, []);
};

export default function Variation({ variation, onUpdate, onRemove, parentDiagram, sectionId, teamsContext }) {
  const handleAutoGrow = useAutoGrow();

  const handleChange = (field, value) => {
    onUpdate({ ...variation, [field]: value });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    handleChange('imageDataUrl', dataUrl);
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    handleChange('imageDataUrl', '');
    handleChange('diagramData', null);
  };

  const handleOpenDiagramBuilder = (useParentAsBase = false) => {
    if (teamsContext) {
      const { selectedTeamId, selectedSessionId, navigateToVariationDiagramBuilder } = teamsContext;
      navigateToVariationDiagramBuilder(selectedTeamId, selectedSessionId, sectionId, variation.id, useParentAsBase);
    }
  };

  const handleCopyFromParentAndEdit = () => {
    // Open diagram builder with parent diagram as starting point
    handleOpenDiagramBuilder(true);
  };

  return (
    <div className="mt-4 p-4 bg-slate-900/30 border border-slate-700 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <input
          type="text"
          value={variation.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Variation name (e.g., Less Challenging)"
          className="input-field font-semibold flex-1"
        />
        <button
          onClick={onRemove}
          className="btn btn-danger ml-3 no-print"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 mb-4">
        {/* Diagram Box */}
        <div className="border-2 border-dashed border-slate-700 rounded-xl p-3 flex flex-col gap-2">
          {variation.imageDataUrl ? (
            <>
              <img
                src={variation.imageDataUrl}
                alt="Variation diagram"
                className="w-full rounded-lg border border-slate-700"
              />
              <div className="flex gap-2 no-print">
                <button
                  onClick={() => handleOpenDiagramBuilder(false)}
                  className="btn btn-primary flex-1 text-xs py-1"
                >
                  Edit Diagram
                </button>
                <button
                  onClick={handleRemoveImage}
                  className="btn btn-danger text-xs py-1"
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-slate-400 mb-2">Diagram</p>
              {parentDiagram && (
                <button
                  onClick={handleCopyFromParentAndEdit}
                  className="btn btn-secondary text-xs py-1"
                >
                  Start from Parent
                </button>
              )}
              <button
                onClick={() => handleOpenDiagramBuilder(false)}
                className="btn btn-primary text-xs py-1"
              >
                Build Diagram
              </button>
              <label className="btn btn-subtle text-xs py-1 cursor-pointer">
                Upload Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Text Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label-text">Objective</label>
          <textarea
            value={variation.objective}
            onChange={(e) => handleChange('objective', e.target.value)}
            onInput={handleAutoGrow}
            rows="3"
            className="input-field resize-none overflow-hidden"
          />
        </div>

        <div>
          <label className="label-text">Organization</label>
          <textarea
            value={variation.organization}
            onChange={(e) => handleChange('organization', e.target.value)}
            onInput={handleAutoGrow}
            rows="3"
            className="input-field resize-none overflow-hidden"
          />
        </div>

        <div>
          <label className="label-text">Guided questions</label>
          <textarea
            value={variation.questions}
            onChange={(e) => handleChange('questions', e.target.value)}
            onInput={handleAutoGrow}
            rows="3"
            className="input-field resize-none overflow-hidden"
          />
        </div>

        <div>
          <label className="label-text">Answers</label>
          <textarea
            value={variation.answers}
            onChange={(e) => handleChange('answers', e.target.value)}
            onInput={handleAutoGrow}
            rows="3"
            className="input-field resize-none overflow-hidden"
          />
        </div>

        <div>
          <label className="label-text">Notes</label>
          <textarea
            value={variation.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            onInput={handleAutoGrow}
            rows="3"
            className="input-field resize-none overflow-hidden"
          />
        </div>
      </div>
      </div>
    </div>
  );
}

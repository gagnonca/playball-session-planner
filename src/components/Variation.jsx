import React, { useState } from 'react';
import DiagramBuilder from './DiagramBuilderNew';
import { fileToDataUrl } from '../utils/helpers';

export default function Variation({ variation, onUpdate, onRemove, parentDiagram }) {
  const [showDiagramBuilder, setShowDiagramBuilder] = useState(false);

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

  const handleSaveDiagram = (diagramData) => {
    handleChange('diagramData', diagramData);
    handleChange('imageDataUrl', diagramData.dataUrl);
    setShowDiagramBuilder(false);
  };

  const handleCopyFromParent = () => {
    if (parentDiagram) {
      handleChange('diagramData', parentDiagram);
      handleChange('imageDataUrl', parentDiagram.dataUrl);
    }
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
                  onClick={() => setShowDiagramBuilder(true)}
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
                  onClick={handleCopyFromParent}
                  className="btn btn-secondary text-xs py-1"
                >
                  📋 Copy from Parent
                </button>
              )}
              <button
                onClick={() => setShowDiagramBuilder(true)}
                className="btn btn-primary text-xs py-1"
              >
                🎨 Build Diagram
              </button>
              <label className="btn btn-subtle text-xs py-1 cursor-pointer">
                📁 Upload Image
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
            rows="3"
            className="input-field resize-y"
          />
        </div>

        <div>
          <label className="label-text">Organization</label>
          <textarea
            value={variation.organization}
            onChange={(e) => handleChange('organization', e.target.value)}
            rows="3"
            className="input-field resize-y"
          />
        </div>

        <div>
          <label className="label-text">Guided questions</label>
          <textarea
            value={variation.questions}
            onChange={(e) => handleChange('questions', e.target.value)}
            rows="3"
            className="input-field resize-y"
          />
        </div>

        <div>
          <label className="label-text">Answers</label>
          <textarea
            value={variation.answers}
            onChange={(e) => handleChange('answers', e.target.value)}
            rows="3"
            className="input-field resize-y"
          />
        </div>

        <div>
          <label className="label-text">Notes</label>
          <textarea
            value={variation.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows="3"
            className="input-field resize-y"
          />
        </div>
      </div>
      </div>

      {/* Diagram Builder Modal */}
      {showDiagramBuilder && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50">
          <div className="w-full h-full">
            <DiagramBuilder
              initialDiagram={variation.diagramData}
              onSave={handleSaveDiagram}
              onClose={() => setShowDiagramBuilder(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

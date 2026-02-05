import React, { useState, useEffect } from 'react';
import Variation from './Variation';
import ContextualHelp from './ContextualHelp';
import { fileToDataUrl, defaultVariation } from '../utils/helpers';

export default function Section({
  section,
  isSelected,
  onUpdate,
  onRemove,
  onDuplicate,
  onSaveToLibrary,
  onSelectSection,
  teamsContext,
  diagramLibrary,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [previousType, setPreviousType] = useState(section.type);

  // Show help when section type changes
  useEffect(() => {
    if (section.type !== previousType) {
      setShowHelp(true);
      setPreviousType(section.type);
    }
  }, [section.type, previousType]);

  const handleChange = (field, value) => {
    onUpdate({ ...section, [field]: value });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    handleChange('imageDataUrl', dataUrl);
    e.target.value = ''; // Reset input
  };

  const handleRemoveImage = () => {
    // Update both fields in a single call to avoid race condition
    onUpdate({ ...section, imageDataUrl: '', diagramData: null });
  };

  const handleOpenDiagramBuilder = () => {
    if (teamsContext) {
      const { selectedTeamId, selectedSessionId, navigateToDiagramBuilder } = teamsContext;
      navigateToDiagramBuilder(selectedTeamId, selectedSessionId, section.id);
    }
  };

  const handleOpenDiagramLibrary = () => {
    if (teamsContext) {
      const { selectedTeamId, selectedSessionId, navigateToDiagramLibrary } = teamsContext;
      navigateToDiagramLibrary(true, selectedTeamId, selectedSessionId, section.id);
    }
  };

  const handleAddVariation = () => {
    const newVariation = defaultVariation();
    handleChange('variations', [...section.variations, newVariation]);
  };

  const handleUpdateVariation = (index, updatedVariation) => {
    const newVariations = [...section.variations];
    newVariations[index] = updatedVariation;
    handleChange('variations', newVariations);
  };

  const handleRemoveVariation = (index) => {
    const newVariations = section.variations.filter((_, i) => i !== index);
    handleChange('variations', newVariations);
  };

  const handleSaveToLibrary = () => {
    const name = prompt('Save this section as (name):', section.name || '');
    if (name === null) return;
    onSaveToLibrary(section, name);
  };

  return (
    <div className="card p-6 my-4">
      {/* Section Header */}
      <div className="flex justify-between items-start gap-4 mb-4">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          <svg
            className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-0' : 'rotate-90'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="inline-block px-3 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded-full mb-2">
            {section.type.toUpperCase()}
          </div>
          <input
            type="text"
            value={section.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Section name (e.g., Free Play (2v2) / Practice: Passing Gates / The Game)"
            className="input-field text-lg font-bold"
            onFocus={() => setIsCollapsed(false)}
          />

          <div className="flex flex-wrap gap-3 mt-3">
            <div className="flex items-center gap-2">
              <label className="label-text">Type</label>
              <select
                value={section.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="input-field w-auto"
              >
                <option value="Play">Play</option>
                <option value="Practice">Practice</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="label-text">Time (optional)</label>
              <input
                type="text"
                value={section.time}
                onChange={(e) => handleChange('time', e.target.value)}
                placeholder="e.g., 10 min"
                className="input-field w-32"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="label-text">Selected</label>
              <input
                type="radio"
                name="selectedSection"
                checked={isSelected}
                onChange={() => onSelectSection(section.id)}
                className="w-4 h-4"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 no-print">
          <button onClick={handleSaveToLibrary} className="btn btn-subtle text-sm">
            Save to Library
          </button>
          <button onClick={handleAddVariation} className="btn btn-subtle text-sm">
            + Variation
          </button>
          <button onClick={onDuplicate} className="btn btn-subtle text-sm">
            Duplicate
          </button>
          <button onClick={onRemove} className="btn btn-danger text-sm">
            Remove
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <>
          {/* Contextual Help */}
          {showHelp && (
            <ContextualHelp
              type={section.type.toLowerCase()}
              onDismiss={() => setShowHelp(false)}
            />
          )}

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Image/Diagram Box */}
        <div className="border-2 border-dashed border-slate-700 rounded-xl p-4 flex flex-col gap-3">
          {section.imageDataUrl ? (
            <>
              <img
                src={section.imageDataUrl}
                alt="Section diagram"
                className="w-full rounded-lg border border-slate-700"
              />
              <div className="flex flex-col gap-2 no-print">
                <div className="flex gap-2">
                  <button
                    onClick={handleOpenDiagramBuilder}
                    className="btn btn-primary flex-1"
                  >
                    {section.diagramData ? 'Edit Diagram' : 'Build Diagram'}
                  </button>
                  <button onClick={handleRemoveImage} className="btn btn-danger">
                    Remove
                  </button>
                </div>
                {diagramLibrary?.diagrams?.length > 0 && (
                  <button
                    onClick={handleOpenDiagramLibrary}
                    className="btn btn-subtle w-full"
                  >
                    Replace from Library
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="text-slate-500 text-center py-8">
                Upload an image or build a diagram
              </div>
              <div className="flex flex-col gap-2 no-print">
                <button
                  onClick={handleOpenDiagramBuilder}
                  className="btn btn-primary"
                >
                  Build Diagram
                </button>
                {diagramLibrary?.diagrams?.length > 0 && (
                  <button
                    onClick={handleOpenDiagramLibrary}
                    className="btn btn-subtle"
                  >
                    Insert from Library
                  </button>
                )}
                <label className="btn btn-subtle cursor-pointer">
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Objective</label>
              <textarea
                value={section.objective}
                onChange={(e) => handleChange('objective', e.target.value)}
                rows="3"
                className="input-field resize-y"
              />
            </div>

            <div>
              <label className="label-text">Organization</label>
              <textarea
                value={section.organization}
                onChange={(e) => handleChange('organization', e.target.value)}
                rows="3"
                className="input-field resize-y"
              />
            </div>

            {/* Guided Questions - Only for Practice sections */}
            {section.type === 'Practice' && (
              <>
                <div>
                  <label className="label-text">Guided questions</label>
                  <textarea
                    value={section.questions}
                    onChange={(e) => handleChange('questions', e.target.value)}
                    rows="3"
                    className="input-field resize-y"
                    placeholder="What questions will help players discover the solution?"
                  />
                </div>

                <div>
                  <label className="label-text">Answers</label>
                  <textarea
                    value={section.answers}
                    onChange={(e) => handleChange('answers', e.target.value)}
                    rows="3"
                    className="input-field resize-y"
                    placeholder="What are the key points players should learn?"
                  />
                </div>
              </>
            )}

            <div>
              <label className="label-text">Notes</label>
              <textarea
                value={section.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows="3"
                className="input-field resize-y"
              />
            </div>
          </div>

          {/* Variations */}
          {section.variations.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Variations</h3>
                <p className="text-sm text-slate-400">Use for Less / Core / More challenging options</p>
              </div>
              {section.variations.map((variation, index) => (
                <Variation
                  key={variation.id}
                  variation={variation}
                  onUpdate={(updated) => handleUpdateVariation(index, updated)}
                  onRemove={() => handleRemoveVariation(index)}
                  parentDiagram={section.diagramData}
                />
              ))}
            </div>
          )}
        </div>
      </div>
        </>
      )}

    </div>
  );
}

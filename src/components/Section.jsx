import React, { useState, useEffect, useCallback } from 'react';
import Variation from './Variation';
import ContextualHelp from './ContextualHelp';
import { fileToDataUrl, defaultVariation, toast, migrateToGuidedQA } from '../utils/helpers';

// Auto-grow textarea handler
const useAutoGrow = () => {
  const handleAutoGrow = useCallback((e) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.max(target.scrollHeight, 72) + 'px';
  }, []);
  return handleAutoGrow;
};

export default function Section({
  section,
  onUpdate,
  onRemove,
  onSaveToLibrary,
  onOpenLibrary,
  teamsContext,
  diagramLibrary,
  aiContext,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTypeHelp, setShowTypeHelp] = useState(false);
  const [previousType, setPreviousType] = useState(section.type);
  const [generatingField, setGeneratingField] = useState(null);
  const handleAutoGrow = useAutoGrow();

  // Migrate legacy questions/answers to guidedQA if needed
  useEffect(() => {
    if ((section.questions || section.answers) && !section.guidedQA) {
      const migrated = migrateToGuidedQA(section.questions, section.answers);
      if (migrated) {
        onUpdate({ ...section, guidedQA: migrated, questions: '', answers: '' });
      }
    }
  }, [section.id]);

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
    e.target.value = '';
  };

  const handleRemoveImage = () => {
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

  // AI Content Generation - direct generation from context (no user prompt)
  const handleGenerateField = async (fieldName) => {
    if (!aiContext?.aiHook) return;

    const { aiHook, sessionSummary, onConfigureAI } = aiContext;

    // Check if AI is configured
    if (!aiHook.isConfigured()) {
      if (onConfigureAI) {
        onConfigureAI();
      }
      return;
    }

    setGeneratingField(fieldName);
    try {
      const context = {
        moment: sessionSummary?.moment,
        ageGroup: sessionSummary?.ageGroup,
        playerActions: sessionSummary?.playerActions,
        keyQualities: sessionSummary?.keyQualities,
        sectionName: section.name,
        sectionType: section.type,
        sectionTime: section.time,
        objective: section.objective,
        organization: section.organization,
        guidedQA: section.guidedQA,
        notes: section.notes,
      };

      const content = await aiHook.generateFieldContent(fieldName, context);
      handleChange(fieldName, content);
      toast('Generated ✨');
    } catch (error) {
      toast(`AI Error: ${error.message}`);
    } finally {
      setGeneratingField(null);
    }
  };

  const isAIConfigured = aiContext?.aiHook?.isConfigured?.() ?? false;

  // Render field with floating AI button
  const renderAIField = (label, fieldName, value, placeholder, rows = 3, extraClasses = '') => (
    <div>
      <label className="label-text">{label}</label>
      <div className="relative">
        <textarea
          value={value || ''}
          onChange={(e) => handleChange(fieldName, e.target.value)}
          onInput={handleAutoGrow}
          rows={rows}
          className={`input-field resize-none overflow-hidden pr-10 ${extraClasses}`}
          placeholder={placeholder}
        />
        {aiContext && isAIConfigured && (
          <button
            onClick={() => handleGenerateField(fieldName)}
            disabled={generatingField === fieldName}
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-md transition-all text-yellow-400/60 hover:text-yellow-400 hover:bg-slate-700/50"
            title="Generate with AI"
          >
            {generatingField === fieldName ? (
              <span className="animate-spin text-xs">⟳</span>
            ) : (
              <span className="text-sm">✨</span>
            )}
          </button>
        )}
      </div>
    </div>
  );

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
            placeholder="Section name (e.g., Free Play / Passing Gates / The Game)"
            className="input-field text-lg font-bold"
            onFocus={() => setIsCollapsed(false)}
          />

          <div className="flex flex-wrap gap-3 mt-3">
            <div className="flex items-center gap-2">
              <label className="label-text">Type</label>
              <button
                type="button"
                onClick={() => setShowTypeHelp(true)}
                className="w-5 h-5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center transition-colors"
                title="What is Play vs Practice?"
              >
                ?
              </button>
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
              <label className="label-text">Time</label>
              <input
                type="text"
                value={section.time}
                onChange={(e) => handleChange('time', e.target.value)}
                placeholder="10 min"
                className="input-field w-24"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 no-print">
          {onOpenLibrary && (
            <button
              onClick={onOpenLibrary}
              className="btn btn-subtle text-sm"
              title="Load from library"
            >
              Library
            </button>
          )}
          <button
            onClick={handleSaveToLibrary}
            className="btn btn-subtle text-sm"
            title="Save to library"
          >
            Save
          </button>
          <button
            onClick={handleAddVariation}
            className="btn btn-subtle text-sm"
            title="Add variation"
          >
            + Variation
          </button>
          <button
            onClick={onRemove}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded transition-colors"
            title="Remove section"
          >
            ×
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <>
          {/* Contextual Help - auto-shown on type change */}
          {showHelp && (
            <ContextualHelp
              type={section.type.toLowerCase()}
              onDismiss={() => setShowHelp(false)}
            />
          )}

          {/* Contextual Help - on-demand via ? button */}
          {showTypeHelp && (
            <ContextualHelp
              type={section.type.toLowerCase()}
              forceShow={true}
              onDismiss={() => setShowTypeHelp(false)}
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
                        {section.diagramData ? 'Edit' : 'Build'}
                      </button>
                      <button onClick={handleRemoveImage} className="btn btn-danger">
                        ×
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
                    Add a diagram
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
                        From Library
                      </button>
                    )}
                    <label className="btn btn-subtle cursor-pointer">
                      Upload
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
                {renderAIField(
                  'Objective',
                  'objective',
                  section.objective,
                  'What will players learn or improve?'
                )}

                {renderAIField(
                  'Organization',
                  'organization',
                  section.organization,
                  'Field setup, players, equipment...'
                )}

                {/* Guided Q&A - Only for Practice sections */}
                {section.type === 'Practice' && (
                  <div className="md:col-span-2">
                    {renderAIField(
                      'Guided Q&A',
                      'guidedQA',
                      section.guidedQA,
                      'Q1: What do you see?\nA1: Look for teammates...',
                      4,
                      'font-mono text-sm'
                    )}
                  </div>
                )}

                {renderAIField(
                  'Notes',
                  'notes',
                  section.notes,
                  'Coaching tips, variations...'
                )}
              </div>

              {/* Variations */}
              {section.variations.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">Variations</h3>
                    <p className="text-sm text-slate-400">Less / Core / More challenging</p>
                  </div>
                  {section.variations.map((variation, index) => (
                    <Variation
                      key={variation.id}
                      variation={variation}
                      onUpdate={(updated) => handleUpdateVariation(index, updated)}
                      onRemove={() => handleRemoveVariation(index)}
                      parentDiagram={section.diagramData}
                      sectionId={section.id}
                      teamsContext={teamsContext}
                      aiContext={aiContext}
                      parentSection={section}
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

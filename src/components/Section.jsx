import React, { useState, useEffect, useCallback } from 'react';
import Variation from './Variation';
import ContextualHelp from './ContextualHelp';
import { fileToDataUrl, defaultVariation, toast, migrateToGuidedQA } from '../utils/helpers';
import { FIELD_PLACEHOLDERS } from '../constants/prompts';

// Auto-grow textarea handler
const useAutoGrow = () => {
  const handleAutoGrow = useCallback((e) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.max(target.scrollHeight, 72) + 'px'; // Min height of 72px (3 rows)
  }, []);

  return handleAutoGrow;
};

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
  aiContext, // { aiHook, sessionSummary, onConfigureAI }
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTypeHelp, setShowTypeHelp] = useState(false);
  const [previousType, setPreviousType] = useState(section.type);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeAIField, setActiveAIField] = useState(null); // Which field's AI prompt is open
  const [aiPromptText, setAIPromptText] = useState(''); // User's description for AI
  const [generatingField, setGeneratingField] = useState(null); // Which field is currently generating
  const handleAutoGrow = useAutoGrow();

  // Migrate legacy questions/answers to guidedQA if needed
  useEffect(() => {
    if ((section.questions || section.answers) && !section.guidedQA) {
      const migrated = migrateToGuidedQA(section.questions, section.answers);
      if (migrated) {
        onUpdate({ ...section, guidedQA: migrated, questions: '', answers: '' });
      }
    }
  }, [section.id]); // Only run once per section

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

  // AI Content Generation - per field
  const handleOpenAIPrompt = (fieldName) => {
    if (!aiContext?.aiHook) return;

    const { aiHook, onConfigureAI } = aiContext;

    // Check if AI is configured
    if (!aiHook.isConfigured()) {
      if (onConfigureAI) {
        onConfigureAI();
      }
      return;
    }

    setActiveAIField(fieldName);
    setAIPromptText('');
  };

  const handleCancelAIPrompt = () => {
    setActiveAIField(null);
    setAIPromptText('');
  };

  const handleGenerateField = async () => {
    if (!aiContext?.aiHook || !activeAIField || !aiPromptText.trim()) return;

    const { aiHook, sessionSummary } = aiContext;

    setGeneratingField(activeAIField);
    try {
      const context = {
        // Session-level context
        moment: sessionSummary?.moment,
        ageGroup: sessionSummary?.ageGroup,
        playerActions: sessionSummary?.playerActions,
        keyQualities: sessionSummary?.keyQualities,
        // Section-level context
        sectionName: section.name,
        sectionType: section.type,
        sectionTime: section.time,
        // Other fields for cross-referencing
        objective: section.objective,
        organization: section.organization,
        guidedQA: section.guidedQA,
        notes: section.notes,
        // User's prompt
        userPrompt: aiPromptText,
      };

      const content = await aiHook.generateFieldContent(activeAIField, context);

      // Update the specific field
      handleChange(activeAIField, content);
      toast('Generated ✨');

      // Close the prompt
      setActiveAIField(null);
      setAIPromptText('');
    } catch (error) {
      toast(`AI Error: ${error.message}`);
    } finally {
      setGeneratingField(null);
    }
  };

  const handleAIPromptKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerateField();
    } else if (e.key === 'Escape') {
      handleCancelAIPrompt();
    }
  };

  const isAIConfigured = aiContext?.aiHook?.isConfigured?.() ?? false;

  // Render AI-enabled field with floating AI button inside textarea
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
        {aiContext && activeAIField !== fieldName && (
          <button
            onClick={() => handleOpenAIPrompt(fieldName)}
            disabled={generatingField === fieldName}
            className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-md transition-all ${
              isAIConfigured
                ? 'text-yellow-400/60 hover:text-yellow-400 hover:bg-slate-700/50'
                : 'text-slate-500/40 hover:text-slate-400 hover:bg-slate-700/50'
            }`}
            title={isAIConfigured ? 'Generate with AI' : 'Configure AI to enable'}
          >
            {generatingField === fieldName ? (
              <span className="animate-pulse text-xs">...</span>
            ) : (
              <span className="text-sm">✨</span>
            )}
          </button>
        )}
        {activeAIField === fieldName && (
          <div className="absolute top-2 right-2 left-2 flex gap-2 bg-slate-800/95 p-2 rounded-lg border border-slate-600 shadow-lg">
            <input
              type="text"
              value={aiPromptText}
              onChange={(e) => setAIPromptText(e.target.value)}
              onKeyDown={handleAIPromptKeyDown}
              placeholder={FIELD_PLACEHOLDERS[fieldName] || 'Describe what you want...'}
              className="input-field flex-1 text-sm py-1"
              autoFocus
            />
            <button
              onClick={handleGenerateField}
              disabled={!aiPromptText.trim() || generatingField === fieldName}
              className="btn btn-primary text-sm px-3 py-1"
            >
              {generatingField === fieldName ? '...' : '✨'}
            </button>
            <button
              onClick={handleCancelAIPrompt}
              className="btn btn-subtle text-sm px-2 py-1"
            >
              ✕
            </button>
          </div>
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
            placeholder="Section name (e.g., Free Play (2v2) / Practice: Passing Gates / The Game)"
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
                <label className="label-text">Guided Q&A</label>
                <div className="relative">
                  <textarea
                    value={section.guidedQA || ''}
                    onChange={(e) => handleChange('guidedQA', e.target.value)}
                    onInput={handleAutoGrow}
                    rows={4}
                    className="input-field resize-none overflow-hidden pr-10 font-mono text-sm"
                    placeholder="Q1: What do you see when you have the ball?&#10;A1: Look for open teammates, scan for space&#10;&#10;Q2: When should you pass vs dribble?&#10;A2: Pass when teammate is in better position"
                  />
                  {aiContext && activeAIField !== 'guidedQA' && (
                    <button
                      onClick={() => handleOpenAIPrompt('guidedQA')}
                      disabled={generatingField === 'guidedQA'}
                      className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-md transition-all ${
                        isAIConfigured
                          ? 'text-yellow-400/60 hover:text-yellow-400 hover:bg-slate-700/50'
                          : 'text-slate-500/40 hover:text-slate-400 hover:bg-slate-700/50'
                      }`}
                      title={isAIConfigured ? 'Generate with AI' : 'Configure AI to enable'}
                    >
                      {generatingField === 'guidedQA' ? (
                        <span className="animate-pulse text-xs">...</span>
                      ) : (
                        <span className="text-sm">✨</span>
                      )}
                    </button>
                  )}
                  {activeAIField === 'guidedQA' && (
                    <div className="absolute top-2 right-2 left-2 flex gap-2 bg-slate-800/95 p-2 rounded-lg border border-slate-600 shadow-lg">
                      <input
                        type="text"
                        value={aiPromptText}
                        onChange={(e) => setAIPromptText(e.target.value)}
                        onKeyDown={handleAIPromptKeyDown}
                        placeholder={FIELD_PLACEHOLDERS['guidedQA'] || 'Describe what you want...'}
                        className="input-field flex-1 text-sm py-1"
                        autoFocus
                      />
                      <button
                        onClick={handleGenerateField}
                        disabled={!aiPromptText.trim() || generatingField === 'guidedQA'}
                        className="btn btn-primary text-sm px-3 py-1"
                      >
                        {generatingField === 'guidedQA' ? '...' : '✨'}
                      </button>
                      <button
                        onClick={handleCancelAIPrompt}
                        className="btn btn-subtle text-sm px-2 py-1"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
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
                <p className="text-sm text-slate-400">Use for Less / Core / More challenging options</p>
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

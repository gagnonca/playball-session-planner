import React, { useCallback, useState, useEffect } from 'react';
import { fileToDataUrl, migrateToGuidedQA, toast } from '../utils/helpers';
import { FIELD_PLACEHOLDERS } from '../constants/prompts';

// Auto-grow textarea handler
const useAutoGrow = () => {
  return useCallback((e) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.max(target.scrollHeight, 72) + 'px';
  }, []);
};

export default function Variation({ variation, onUpdate, onRemove, parentDiagram, sectionId, teamsContext, aiContext, parentSection }) {
  const handleAutoGrow = useAutoGrow();
  const [activeAIField, setActiveAIField] = useState(null);
  const [aiPromptText, setAIPromptText] = useState('');
  const [generatingField, setGeneratingField] = useState(null);

  // Migrate legacy questions/answers to guidedQA if needed
  useEffect(() => {
    if ((variation.questions || variation.answers) && !variation.guidedQA) {
      const migrated = migrateToGuidedQA(variation.questions, variation.answers);
      if (migrated) {
        onUpdate({ ...variation, guidedQA: migrated, questions: '', answers: '' });
      }
    }
  }, [variation.id]);

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

  // AI Content Generation - per field
  const handleOpenAIPrompt = (fieldName) => {
    if (!aiContext?.aiHook) return;

    const { aiHook, onConfigureAI } = aiContext;

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
        moment: sessionSummary?.moment,
        ageGroup: sessionSummary?.ageGroup,
        playerActions: sessionSummary?.playerActions,
        keyQualities: sessionSummary?.keyQualities,
        sectionName: parentSection?.name || variation.name,
        sectionType: parentSection?.type || 'Practice',
        sectionTime: parentSection?.time,
        objective: variation.objective || parentSection?.objective,
        organization: variation.organization || parentSection?.organization,
        guidedQA: variation.guidedQA || parentSection?.guidedQA,
        notes: variation.notes || parentSection?.notes,
        userPrompt: aiPromptText,
      };

      const content = await aiHook.generateFieldContent(activeAIField, context);
      handleChange(activeAIField, content);
      toast('Generated ✨');

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
          {renderAIField(
            'Objective',
            'objective',
            variation.objective,
            'What will players learn or improve?'
          )}

          {renderAIField(
            'Organization',
            'organization',
            variation.organization,
            'Field setup, players, equipment...'
          )}

          <div className="md:col-span-2">
            {renderAIField(
              'Guided Q&A',
              'guidedQA',
              variation.guidedQA,
              'Q1: What do you see when you have the ball?\nA1: Look for open teammates, scan for space',
              4,
              'font-mono text-sm'
            )}
          </div>

          {renderAIField(
            'Notes',
            'notes',
            variation.notes,
            'Coaching tips, variations...'
          )}
        </div>
      </div>
    </div>
  );
}

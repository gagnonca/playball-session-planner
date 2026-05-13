import React, { useState, useEffect } from 'react';
import RichTextEditor from './RichTextEditor';
import GuidedQAEditor from './GuidedQAEditor';
import AIField from './AIField';
import { fileToDataUrl, migrateToGuidedQA, toast } from '../utils/helpers';

// Variation renders inside a parent Section's variation card. The parent
// owns the colored header strip + outer border; this component fills the
// body with the variation's name + diagram + AIField text inputs.
export default function Variation({
  variation,
  onUpdate,
  onRemove,
  parentDiagram,
  sectionId,
  teamsContext,
  aiContext,
  parentSection,
  hideRemove = false,
}) {
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
    handleOpenDiagramBuilder(true);
  };

  const buildContext = () => ({
    moment: aiContext?.sessionSummary?.moment,
    ageGroup: aiContext?.sessionSummary?.ageGroup,
    playerActions: aiContext?.sessionSummary?.playerActions,
    keyQualities: aiContext?.sessionSummary?.keyQualities,
    sectionName: parentSection?.name || variation.name,
    sectionType: parentSection?.type || 'Practice',
    sectionTime: parentSection?.time,
    objective: variation.objective || parentSection?.objective,
    organization: variation.organization || parentSection?.organization,
    guidedQA: variation.guidedQA || parentSection?.guidedQA,
    notes: variation.notes || parentSection?.notes,
  });

  const handleGenerateField = async (fieldName, extraPrompt) => {
    if (!aiContext?.aiHook) return;
    const { aiHook, onConfigureAI } = aiContext;
    if (!aiHook.isConfigured()) {
      onConfigureAI?.();
      return;
    }
    setGeneratingField(fieldName);
    try {
      const content = await aiHook.generateFieldContent(fieldName, buildContext(), extraPrompt);
      handleChange(fieldName, content);
      toast('Generated ✨');
    } catch (error) {
      toast(`AI error: ${error.message}`);
    } finally {
      setGeneratingField(null);
    }
  };

  const isAIConfigured = aiContext?.aiHook?.isConfigured?.() ?? false;

  return (
    <div className="p-3 flex flex-col gap-3">
      <input
        type="text"
        value={variation.name || ''}
        onChange={(e) => handleChange('name', e.target.value)}
        placeholder="Variation name (e.g., Less Challenging)"
        className="w-full bg-transparent outline-none"
        style={{
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          color: 'var(--ink)',
          border: 'none',
          padding: 0,
        }}
      />

      {/* Diagram surface — small, optional */}
      <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--line)' }}>
        {variation.imageDataUrl ? (
          <img src={variation.imageDataUrl} alt="Variation diagram" className="block w-full" style={{ aspectRatio: '16 / 9', objectFit: 'cover' }} />
        ) : (
          <button
            onClick={() => handleOpenDiagramBuilder(false)}
            className="w-full flex items-center justify-center font-mono uppercase"
            style={{
              aspectRatio: '16 / 9',
              background: 'color-mix(in oklab, #6aa365 22%, var(--bg-sunken))',
              color: 'rgba(255,255,255,0.85)',
              border: 'none',
              fontSize: 10.5,
              letterSpacing: '0.12em',
              cursor: 'pointer',
            }}
            title="Draw a diagram for this variation"
          >
            TAP TO DRAW
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1 -mt-1 no-print">
        {variation.imageDataUrl ? (
          <>
            <button onClick={() => handleOpenDiagramBuilder(false)} className="btn btn-ghost" style={{ fontSize: 11.5 }}>Edit</button>
            <button onClick={handleRemoveImage} className="btn btn-ghost" style={{ fontSize: 11.5, color: 'var(--danger)' }}>Remove</button>
          </>
        ) : parentDiagram ? (
          <button onClick={handleCopyFromParentAndEdit} className="btn btn-ghost" style={{ fontSize: 11.5 }}>
            Start from parent
          </button>
        ) : null}
        {!variation.imageDataUrl && (
          <label className="btn btn-ghost cursor-pointer" style={{ fontSize: 11.5 }}>
            Upload
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        )}
      </div>

      <AIField
        label="Objective"
        isAIConfigured={isAIConfigured}
        isGenerating={generatingField === 'objective'}
        onSuggest={() => handleGenerateField('objective')}
        onSuggestWithPrompt={(p) => handleGenerateField('objective', p)}
      >
        <RichTextEditor
          value={variation.objective || ''}
          onChange={(html) => handleChange('objective', html)}
          placeholder="What changes for this variation?"
        />
      </AIField>

      <AIField
        label="Organization"
        isAIConfigured={isAIConfigured}
        isGenerating={generatingField === 'organization'}
        onSuggest={() => handleGenerateField('organization')}
        onSuggestWithPrompt={(p) => handleGenerateField('organization', p)}
      >
        <RichTextEditor
          value={variation.organization || ''}
          onChange={(html) => handleChange('organization', html)}
          placeholder="Adjusted setup, restrictions, rules…"
        />
      </AIField>

      <AIField
        label="Guided Q&A"
        isAIConfigured={isAIConfigured}
        isGenerating={generatingField === 'guidedQA'}
        onSuggest={() => handleGenerateField('guidedQA')}
        onSuggestWithPrompt={(p) => handleGenerateField('guidedQA', p)}
      >
        <GuidedQAEditor
          value={variation.guidedQA}
          onChange={(html) => handleChange('guidedQA', html)}
          placeholder="Q1: What do you see?\nA1: Look for teammates…"
        />
      </AIField>

      <AIField
        label="Notes"
        isAIConfigured={isAIConfigured}
        isGenerating={generatingField === 'notes'}
        onSuggest={() => handleGenerateField('notes')}
        onSuggestWithPrompt={(p) => handleGenerateField('notes', p)}
      >
        <RichTextEditor
          value={variation.notes || ''}
          onChange={(html) => handleChange('notes', html)}
          placeholder="Coaching cues for this variation…"
        />
      </AIField>

      {!hideRemove && (
        <button
          onClick={onRemove}
          className="btn btn-ghost self-end"
          style={{ fontSize: 12, color: 'var(--danger)' }}
        >
          Remove variation
        </button>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import Variation from './Variation';
import ContextualHelp from './ContextualHelp';
import RichTextEditor from './RichTextEditor';
import GuidedQAEditor from './GuidedQAEditor';
import AIField from './AIField';
import { fileToDataUrl, defaultVariation, toast, migrateToGuidedQA } from '../utils/helpers';

// Kind colors mirror SessionRail tiles for visual continuity.
function getKindTone(type) {
  const t = (type || '').toLowerCase();
  if (t === 'warm-up' || t === 'warmup' || t === 'warm up') return { fg: 'var(--warn)', bg: 'rgb(var(--warn-rgb) / 0.16)' };
  if (t === 'play' || t === 'game') return { fg: 'var(--good)', bg: 'rgb(var(--good-rgb) / 0.18)' };
  if (t === 'cool down' || t === 'cool-down' || t === 'cooldown') return { fg: 'var(--ink-3)', bg: 'var(--bg-sunken)' };
  return { fg: 'var(--accent)', bg: 'var(--accent-soft)' };
}

function FieldThumbnail({ src, label = 'TAP TO DRAW', onClick, dashed = false }) {
  return (
    <button
      onClick={onClick}
      className="relative w-full overflow-hidden rounded-[14px]"
      style={{
        aspectRatio: '16 / 9',
        background: src ? 'transparent' : 'color-mix(in oklab, #6aa365 30%, var(--bg-sunken))',
        border: dashed ? '1.5px dashed var(--line-2)' : '1px solid var(--line)',
        cursor: 'pointer',
        padding: 0,
      }}
      title={src ? 'Edit diagram' : 'Draw a diagram'}
    >
      {src ? (
        <img src={src} alt="Section diagram" className="w-full h-full object-cover" />
      ) : (
        <>
          <svg viewBox="0 0 320 180" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <rect key={i} x={i * 40} y="0" width="40" height="180" fill={i % 2 ? 'rgba(255,255,255,0.05)' : 'transparent'} />
            ))}
            <rect x="8" y="8" width="304" height="164" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" fill="none" />
            <line x1="160" y1="8" x2="160" y2="172" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
            <circle cx="160" cy="90" r="22" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" fill="none" />
          </svg>
          <div
            className="absolute inset-0 flex items-center justify-center font-mono uppercase"
            style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: '0.12em', fontSize: 11, pointerEvents: 'none' }}
          >
            {label}
          </div>
        </>
      )}
    </button>
  );
}

// Default starter labels for the three variation slots.
const VARIATION_PRESETS = [
  { name: 'Less challenging',  tone: 'warn'   },
  { name: 'Core',              tone: 'accent' },
  { name: 'More challenging',  tone: 'good'   },
];

function toneStyles(tone) {
  if (tone === 'warn')   return { color: 'var(--warn)',   bg: 'rgb(var(--warn-rgb) / 0.14)' };
  if (tone === 'good')   return { color: 'var(--good)',   bg: 'rgb(var(--good-rgb) / 0.16)' };
  return { color: 'var(--accent)', bg: 'var(--accent-soft)' };
}

function varToneFor(idx, total) {
  if (total >= 3) return VARIATION_PRESETS[idx]?.tone || 'accent';
  if (total === 2) return idx === 0 ? 'warn' : 'good';
  return 'accent';
}

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
  const [showHelp, setShowHelp] = useState(false);
  const [showTypeHelp, setShowTypeHelp] = useState(false);
  const [previousType, setPreviousType] = useState(section.type);
  const [generatingField, setGeneratingField] = useState(null);
  const [variationsOpen, setVariationsOpen] = useState(() => (section.variations || []).length > 0);

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
      const { selectedTeamId, selectedSessionId, navigateToLibraryInsert } = teamsContext;
      navigateToLibraryInsert('diagrams', selectedTeamId, selectedSessionId, section.id);
    }
  };

  const handleAddVariation = () => {
    const idx = (section.variations || []).length;
    const preset = VARIATION_PRESETS[Math.min(idx, VARIATION_PRESETS.length - 1)];
    const newVariation = { ...defaultVariation(), name: preset?.name || '' };
    handleChange('variations', [...(section.variations || []), newVariation]);
    setVariationsOpen(true);
  };

  const handleUpdateVariation = (index, updatedVariation) => {
    const newVariations = [...(section.variations || [])];
    newVariations[index] = updatedVariation;
    handleChange('variations', newVariations);
  };

  const handleRemoveVariation = (index) => {
    const newVariations = (section.variations || []).filter((_, i) => i !== index);
    handleChange('variations', newVariations);
  };

  const handleSaveToLibrary = () => {
    const name = prompt('Save this section as (name):', section.name || '');
    if (name === null) return;
    onSaveToLibrary(section, name);
  };

  const buildContext = () => ({
    moment: aiContext?.sessionSummary?.moment,
    ageGroup: aiContext?.sessionSummary?.ageGroup,
    playerActions: aiContext?.sessionSummary?.playerActions,
    keyQualities: aiContext?.sessionSummary?.keyQualities,
    sectionName: section.name,
    sectionType: section.type,
    sectionTime: section.time,
    objective: section.objective,
    organization: section.organization,
    guidedQA: section.guidedQA,
    notes: section.notes,
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
  const sectionTone = getKindTone(section.type);
  const variations = section.variations || [];
  const variationCount = variations.length;

  return (
    <article className="my-2">
      {/* Section header — eyebrow, big name input, type + time controls */}
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div
            className="font-mono uppercase inline-flex items-center gap-2"
            style={{ fontSize: 11, color: sectionTone.fg, letterSpacing: '0.12em' }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 6, height: 6, background: sectionTone.fg }}
            />
            {section.type || 'SECTION'}
            {section.time && <span style={{ color: 'var(--ink-3)' }}>· {section.time}</span>}
          </div>
          <div className="flex items-center gap-1 no-print">
            {onOpenLibrary && (
              <button onClick={onOpenLibrary} className="btn btn-ghost" style={{ fontSize: 12.5 }} title="Load from library">
                Library
              </button>
            )}
            <button onClick={handleSaveToLibrary} className="btn btn-ghost" style={{ fontSize: 12.5 }} title="Save to library">
              Save
            </button>
            <button
              onClick={onRemove}
              className="btn btn-ghost"
              style={{ padding: '4px 6px', color: 'var(--danger)' }}
              title="Remove section"
              aria-label="Remove section"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
              </svg>
            </button>
          </div>
        </div>

        <input
          type="text"
          value={section.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Section name (e.g. Free play · 1v1 in wide channels · The game)"
          className="w-full bg-transparent outline-none"
          style={{
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: 'var(--ink)',
            border: 'none',
            padding: '4px 0',
            lineHeight: 1.1,
          }}
        />

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono uppercase" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>TYPE</span>
            <select
              value={section.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="input-field w-auto"
              style={{ padding: '4px 8px', fontSize: 13 }}
            >
              <option value="Play">Play</option>
              <option value="Practice">Practice</option>
            </select>
            <button
              type="button"
              onClick={() => setShowTypeHelp(true)}
              className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center"
              style={{ background: 'var(--bg-sunken)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}
              title="What is Play vs Practice?"
            >
              ?
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono uppercase" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>TIME</span>
            <input
              type="text"
              value={section.time || ''}
              onChange={(e) => handleChange('time', e.target.value)}
              placeholder="10 min"
              className="input-field"
              style={{ width: 90, padding: '4px 8px', fontSize: 13 }}
            />
          </div>
        </div>

        {showHelp && (
          <div className="mt-4">
            <ContextualHelp type={section.type.toLowerCase()} onDismiss={() => setShowHelp(false)} />
          </div>
        )}
        {showTypeHelp && (
          <div className="mt-4">
            <ContextualHelp type={section.type.toLowerCase()} forceShow onDismiss={() => setShowTypeHelp(false)} />
          </div>
        )}
      </header>

      {/* Diagram surface */}
      <section className="mb-6">
        <div className="font-mono uppercase mb-2" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
          DIAGRAM
        </div>
        <FieldThumbnail
          src={section.imageDataUrl}
          label={section.diagramData ? 'TAP TO EDIT' : 'TAP TO DRAW'}
          onClick={handleOpenDiagramBuilder}
        />
        <div className="flex flex-wrap gap-2 mt-2 no-print">
          {section.imageDataUrl ? (
            <>
              <button onClick={handleOpenDiagramBuilder} className="btn btn-secondary" style={{ fontSize: 12.5 }}>
                {section.diagramData ? 'Edit diagram' : 'Build diagram'}
              </button>
              {diagramLibrary?.diagrams?.length > 0 && (
                <button onClick={handleOpenDiagramLibrary} className="btn btn-ghost" style={{ fontSize: 12.5 }}>
                  Replace from library
                </button>
              )}
              <button onClick={handleRemoveImage} className="btn btn-ghost" style={{ fontSize: 12.5, color: 'var(--danger)' }}>
                Remove
              </button>
            </>
          ) : (
            <>
              {diagramLibrary?.diagrams?.length > 0 && (
                <button onClick={handleOpenDiagramLibrary} className="btn btn-ghost" style={{ fontSize: 12.5 }}>
                  From library
                </button>
              )}
              <label className="btn btn-ghost cursor-pointer" style={{ fontSize: 12.5 }}>
                Upload image
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </>
          )}
        </div>
      </section>

      {/* Objective + Organization */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <AIField
          label="Objective"
          isAIConfigured={isAIConfigured}
          isGenerating={generatingField === 'objective'}
          onSuggest={() => handleGenerateField('objective')}
          onSuggestWithPrompt={(p) => handleGenerateField('objective', p)}
          contextSummary="Uses moment, age group, section type + what you've typed"
        >
          <RichTextEditor
            value={section.objective || ''}
            onChange={(html) => handleChange('objective', html)}
            placeholder="What will players learn or improve?"
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
            value={section.organization || ''}
            onChange={(html) => handleChange('organization', html)}
            placeholder="Field setup, players, equipment…"
          />
        </AIField>
      </section>

      {/* Guided Q&A — Practice only */}
      {section.type === 'Practice' && (
        <section className="mb-6">
          <AIField
            label="Guided Q&A"
            hint="Help players discover solutions themselves"
            isAIConfigured={isAIConfigured}
            isGenerating={generatingField === 'guidedQA'}
            onSuggest={() => handleGenerateField('guidedQA')}
            onSuggestWithPrompt={(p) => handleGenerateField('guidedQA', p)}
          >
            <GuidedQAEditor
              value={section.guidedQA}
              onChange={(html) => handleChange('guidedQA', html)}
              placeholder={'Q1: What do you see?\nA1: Look for teammates…'}
            />
          </AIField>
        </section>
      )}

      {/* Coaching notes */}
      <section className="mb-6">
        <AIField
          label="Coaching notes"
          isAIConfigured={isAIConfigured}
          isGenerating={generatingField === 'notes'}
          onSuggest={() => handleGenerateField('notes')}
          onSuggestWithPrompt={(p) => handleGenerateField('notes', p)}
        >
          <RichTextEditor
            value={section.notes || ''}
            onChange={(html) => handleChange('notes', html)}
            placeholder="Cues, common pitfalls, what to celebrate…"
          />
        </AIField>
      </section>

      {/* Variations — collapsed behind a button until first add */}
      <section>
        <div className="hairline mb-4" />
        {variationCount === 0 ? (
          <button
            onClick={handleAddVariation}
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
            title="Add a variation"
          >
            <span aria-hidden style={{ marginRight: 2 }}>+</span> Add variation
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-mono uppercase" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                  VARIATIONS ({variationCount})
                </div>
                <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
                  Less / Core / More challenging — offer ramps for every player.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setVariationsOpen(o => !o)}
                  className="btn btn-ghost"
                  style={{ fontSize: 12.5 }}
                >
                  {variationsOpen ? 'Hide' : 'Show'}
                </button>
                {variationCount < 3 && (
                  <button onClick={handleAddVariation} className="btn btn-ghost" style={{ fontSize: 12.5 }}>
                    + Add
                  </button>
                )}
              </div>
            </div>

            {variationsOpen && (
              <div className="grid gap-3" style={{ gridTemplateColumns: variationCount === 1 ? '1fr' : `repeat(${variationCount}, minmax(0, 1fr))` }}>
                {variations.map((variation, index) => {
                  const tone = varToneFor(index, variationCount);
                  const toneClr = toneStyles(tone);
                  const isCore = tone === 'accent';
                  return (
                    <div
                      key={variation.id}
                      className="rounded-[14px] overflow-hidden"
                      style={{
                        border: isCore ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                        boxShadow: isCore ? '0 0 0 3px rgb(var(--accent-rgb) / 0.10)' : 'var(--shadow-sm)',
                        background: 'var(--bg-elev)',
                      }}
                    >
                      <div
                        className="flex items-center justify-between px-3 py-2"
                        style={{ background: toneClr.bg, borderBottom: '1px solid var(--line)' }}
                      >
                        <span
                          className="font-mono uppercase"
                          style={{ fontSize: 10.5, color: toneClr.color, letterSpacing: '0.1em' }}
                        >
                          {tone === 'warn' ? 'LESS CHALLENGING' : tone === 'good' ? 'MORE CHALLENGING' : 'CORE'}
                          {isCore && <span style={{ marginLeft: 6 }}>· ACTIVE</span>}
                        </span>
                        <button
                          onClick={() => handleRemoveVariation(index)}
                          className="btn btn-ghost"
                          style={{ padding: '2px 6px', fontSize: 11, color: 'var(--ink-3)' }}
                          aria-label="Remove variation"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                      <Variation
                        variation={variation}
                        onUpdate={(updated) => handleUpdateVariation(index, updated)}
                        onRemove={() => handleRemoveVariation(index)}
                        parentDiagram={section.diagramData}
                        sectionId={section.id}
                        teamsContext={teamsContext}
                        aiContext={aiContext}
                        parentSection={section}
                        hideRemove
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </article>
  );
}

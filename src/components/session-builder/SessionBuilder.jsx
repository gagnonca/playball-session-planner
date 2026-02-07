import { useState, useEffect, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Header from '../Header';
import SessionSummary from '../SessionSummary';
import Section from '../Section';
import AddSectionModal from '../AddSectionModal';
import LibraryModal from '../LibraryModal';
import AIConfigModal from '../AIConfigModal';
import SessionPlanPDF from '../SessionPlanPDF';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import useAI from '../../hooks/useAI';
import {
  defaultSection,
  libraryPayloadToSection,
  sectionToLibraryPayload,
  getStarterLibraryItems,
  toast,
  downloadJson,
  uid,
  nowIso,
} from '../../utils/helpers';
import { PPP_TEMPLATES } from '../../constants/coaching';

const LIB_KEY = "ppp_section_library_v1";

// Sortable wrapper component for sections
function SortableSection({ section, teamsContext, diagramLibrary, aiContext, ...props }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-start gap-2">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing mt-6 p-2 hover:bg-slate-700 rounded transition-colors no-print"
          title="Drag to reorder"
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>
        <div className="flex-1">
          <Section section={section} teamsContext={teamsContext} diagramLibrary={diagramLibrary} aiContext={aiContext} {...props} />
        </div>
      </div>
    </div>
  );
}

export default function SessionBuilder({ teamsContext, diagramLibrary }) {
  const {
    selectedTeamId,
    selectedSessionId,
    getTeam,
    getSession,
    updateSession,
    navigateToTeamDetail,
  } = teamsContext;

  // Get the current session from team context
  const team = getTeam(selectedTeamId);
  const session = getSession(selectedTeamId, selectedSessionId);

  // Library state (global, shared across teams)
  const [library, setLibrary] = useLocalStorage(LIB_KEY, {
    version: 1,
    items: [],
  });

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isAIConfigOpen, setIsAIConfigOpen] = useState(false);
  const [libraryInsertMode, setLibraryInsertMode] = useState('append');

  // AI Hook
  const aiHook = useAI();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize starter library items if empty
  useEffect(() => {
    if (library.items.length === 0) {
      setLibrary({
        ...library,
        items: getStarterLibraryItems(),
      });
    }
  }, []); // Only run once on mount

  // Handle missing team or session
  if (!team || !session) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-slate-400 mb-4">Session not found</p>
          <button
            onClick={() => navigateToTeamDetail(selectedTeamId)}
            className="btn btn-primary"
          >
            Back to Team
          </button>
        </div>
      </div>
    );
  }

  // Helper to update session in team context
  const setSession = useCallback((updater) => {
    const newSession = typeof updater === 'function' ? updater(session) : updater;
    updateSession(selectedTeamId, selectedSessionId, newSession);
  }, [selectedTeamId, selectedSessionId, session, updateSession]);

  // Session Summary handlers
  const handleUpdateSummary = useCallback((updatedSummary) => {
    setSession(prev => ({ ...prev, summary: updatedSummary }));
  }, [setSession]);

  // Section handlers
  const handleUpdateSection = useCallback((sectionId, updatedSection) => {
    setSession(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === sectionId ? updatedSection : s)
    }));
  }, [setSession]);

  const handleRemoveSection = useCallback((sectionId) => {
    setSession(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== sectionId),
      selectedSectionId: prev.selectedSectionId === sectionId ? null : prev.selectedSectionId
    }));
  }, [setSession]);

  const handleDuplicateSection = useCallback((sectionId) => {
    const section = session.sections.find(s => s.id === sectionId);
    if (!section) return;

    const copy = structuredClone(section);
    copy.id = uid();
    copy.name = (copy.name || 'Section') + ' (copy)';
    copy.variations = (copy.variations || []).map(v => ({ ...v, id: uid() }));

    setSession(prev => ({
      ...prev,
      sections: [...prev.sections, copy]
    }));
    toast('Section duplicated ✅');
  }, [session.sections, setSession]);

  const handleSelectSection = useCallback((sectionId) => {
    setSession(prev => ({ ...prev, selectedSectionId: sectionId }));
  }, [setSession]);

  // Handle drag and drop reordering
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setSession(prev => {
        const oldIndex = prev.sections.findIndex(s => s.id === active.id);
        const newIndex = prev.sections.findIndex(s => s.id === over.id);

        return {
          ...prev,
          sections: arrayMove(prev.sections, oldIndex, newIndex),
        };
      });
    }
  }, [setSession]);

  const handleSaveToLibrary = useCallback((section, name) => {
    const payload = sectionToLibraryPayload(section);
    const entryName = (name || section.name || 'Untitled section').trim() || 'Untitled section';

    // Check if item with same name exists
    const existing = library.items.find(x => (x.name || '').toLowerCase() === entryName.toLowerCase());

    const item = {
      id: existing?.id || uid(),
      name: entryName,
      type: section.type || payload.type || 'Other',
      payload,
      updatedAt: nowIso(),
    };

    if (existing) {
      // Update existing
      setLibrary(prev => ({
        ...prev,
        items: prev.items.map(x => x.id === existing.id ? item : x)
      }));
    } else {
      // Add new
      setLibrary(prev => ({
        ...prev,
        items: [item, ...prev.items]
      }));
    }

    toast('Saved to Library ✅');
  }, [library.items, setLibrary]);

  // Add section handlers
  const handleAddSection = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const handleBuildFromScratch = useCallback(() => {
    const newSection = defaultSection();
    newSection.type = 'Practice';
    setSession(prev => ({ ...prev, sections: [...prev.sections, newSection] }));
    setIsAddModalOpen(false);
    toast('New section added ✅');
  }, [setSession]);

  const handleChooseFromLibrary = useCallback(() => {
    setIsAddModalOpen(false);
    setIsLibraryModalOpen(true);
  }, []);

  // PPP button - create Play/Practice/Play structure with moment-based templates
  const handlePPP = useCallback(() => {
    const moment = session.summary.moment;
    const template = PPP_TEMPLATES[moment] || PPP_TEMPLATES['default'];

    const newSections = [];

    // Create Free Play section
    const play1 = defaultSection();
    play1.type = template.play1.type;
    play1.name = template.play1.name;
    play1.time = template.play1.time;
    play1.objective = template.play1.objective;
    play1.organization = template.play1.organization;
    newSections.push(play1);

    // Create Practice section
    const practice = defaultSection();
    practice.type = template.practice.type;
    practice.name = template.practice.name;
    practice.time = template.practice.time;
    practice.objective = template.practice.objective;
    practice.organization = template.practice.organization;
    practice.guidedQA = template.practice.guidedQA || '';
    newSections.push(practice);

    // Create The Game section
    const play2 = defaultSection();
    play2.type = template.play2.type;
    play2.name = template.play2.name;
    play2.time = template.play2.time;
    play2.objective = template.play2.objective;
    play2.organization = template.play2.organization;
    newSections.push(play2);

    setSession(prev => ({ ...prev, sections: newSections }));
    toast('Play-Practice-Play structure created ✅');
  }, [session.summary.moment, setSession]);

  // Add Practice button - insert before last Play/Game
  const handleAddPractice = useCallback(() => {
    const newSection = defaultSection();
    newSection.type = 'Practice';
    newSection.name = 'Practice';

    // Find last Play/Game section
    let lastPlayIndex = -1;
    for (let i = session.sections.length - 1; i >= 0; i--) {
      const type = (session.sections[i].type || '').toLowerCase();
      if (type === 'play' || type === 'game') {
        lastPlayIndex = i;
        break;
      }
    }

    if (lastPlayIndex >= 0) {
      setSession(prev => ({
        ...prev,
        sections: [
          ...prev.sections.slice(0, lastPlayIndex),
          newSection,
          ...prev.sections.slice(lastPlayIndex)
        ]
      }));
    } else {
      setSession(prev => ({
        ...prev,
        sections: [...prev.sections, newSection]
      }));
    }

    toast('Practice added ✅');
  }, [session.sections, setSession]);

  // Library handlers
  const handleInsertLibraryItem = useCallback((itemId) => {
    const item = library.items.find(x => x.id === itemId);
    if (!item) return;

    const newSection = libraryPayloadToSection(item.payload);

    if (libraryInsertMode === 'after-selected' && session.selectedSectionId) {
      const idx = session.sections.findIndex(s => s.id === session.selectedSectionId);
      if (idx >= 0) {
        setSession(prev => ({
          ...prev,
          sections: [
            ...prev.sections.slice(0, idx + 1),
            newSection,
            ...prev.sections.slice(idx + 1)
          ]
        }));
      } else {
        setSession(prev => ({
          ...prev,
          sections: [...prev.sections, newSection]
        }));
      }
    } else {
      setSession(prev => ({
        ...prev,
        sections: [...prev.sections, newSection]
      }));
    }

    toast('Section inserted ✅');
  }, [library.items, libraryInsertMode, session.selectedSectionId, session.sections, setSession]);

  const handleOverwriteLibraryItem = useCallback((itemId) => {
    if (!session.selectedSectionId) return;

    const section = session.sections.find(s => s.id === session.selectedSectionId);
    const item = library.items.find(x => x.id === itemId);
    if (!section || !item) return;

    const payload = sectionToLibraryPayload(section);
    const updatedItem = {
      ...item,
      type: section.type || payload.type || 'Other',
      payload,
      updatedAt: nowIso(),
    };

    setLibrary(prev => ({
      ...prev,
      items: prev.items.map(x => x.id === itemId ? updatedItem : x)
    }));

    toast('Library item overwritten ✅');
  }, [session.selectedSectionId, session.sections, library.items, setLibrary]);

  const handleDeleteLibraryItem = useCallback((itemId) => {
    setLibrary(prev => ({
      ...prev,
      items: prev.items.filter(x => x.id !== itemId)
    }));
    toast('Library item deleted ✅');
  }, [setLibrary]);

  const handleExportLibrary = useCallback(() => {
    downloadJson('ppp-library.json', library);
    toast('Library exported ✅');
  }, [library]);

  const handleImportLibrary = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!imported.items || !Array.isArray(imported.items)) {
          throw new Error('Invalid library format');
        }
        setLibrary(imported);
        toast('Library imported ✅');
      } catch (error) {
        alert('That library JSON didn\'t parse correctly.');
      }
    };
    reader.readAsText(file);
  }, [setLibrary]);

  const handleClearLibrary = useCallback(() => {
    if (!confirm('Clear your saved section library?')) return;
    setLibrary({ version: 1, items: getStarterLibraryItems() });
    toast('Library cleared ✅');
  }, [setLibrary]);

  // Session import/export/clear
  const handleExportSession = useCallback(() => {
    downloadJson((session.summary.title?.trim() || 'session') + '.json', session);
    toast('Session exported ✅');
  }, [session]);

  const handleImportSession = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        setSession(imported);
        toast('Session imported ✅');
      } catch (error) {
        alert('That session JSON didn\'t parse correctly.');
      }
    };
    reader.readAsText(file);
  }, [setSession]);

  const handleClearSession = useCallback(() => {
    if (!confirm('Clear the whole session?')) return;
    setSession({
      ...session,
      summary: { title: '', date: '', duration: '', ageGroup: '', moment: '', playerActions: [], keyQualities: [], notes: '', keywords: '' },
      sections: [],
      selectedSectionId: null,
    });
    toast('Session cleared ✅');
  }, [setSession, session]);

  const handleSave = useCallback(() => {
    // Auto-saving is handled by team context updates, but provide feedback
    toast('Saved ✅');
  }, []);

  const handleDownloadPDF = useCallback(async () => {
    try {
      console.log('=== PDF Generation Started ===');
      console.log('Session data:', session);

      toast('Generating PDF...');

      // Generate the PDF blob
      console.log('Creating PDF component...');
      const pdfComponent = <SessionPlanPDF session={session} />;
      console.log('PDF component created:', pdfComponent);

      console.log('Generating PDF blob...');
      const blob = await pdf(pdfComponent).toBlob();
      console.log('PDF blob generated:', blob);
      console.log('Blob size:', blob.size, 'bytes');
      console.log('Blob type:', blob.type);

      // Create download link
      console.log('Creating download link...');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = (session.summary.title?.trim() || 'session-plan') + '.pdf';
      console.log('Download filename:', link.download);

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('=== PDF Generation Complete ===');
      toast('PDF downloaded ✅');
    } catch (error) {
      console.error('=== PDF Generation Error ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Full error:', error);
      toast('PDF generation failed ❌ - Check console for details');
    }
  }, [session]);

  const handleBackToTeam = useCallback(() => {
    navigateToTeamDetail(selectedTeamId);
  }, [navigateToTeamDetail, selectedTeamId]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Breadcrumb Navigation */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={handleBackToTeam}
            className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to {team.name}</span>
          </button>
        </div>
      </div>

      <Header
        onOpenLibrary={() => setIsLibraryModalOpen(true)}
        onSave={handleSave}
        onDownloadPDF={handleDownloadPDF}
        onOpenAISettings={() => setIsAIConfigOpen(true)}
        isAIConfigured={aiHook.isConfigured()}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <SessionSummary
          summary={session.summary}
          onUpdate={handleUpdateSummary}
        />

        {session.sections.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-2">Sections</h2>
            <p className="text-slate-400 text-sm mb-4">
              Always start and end with Play. Add as many Practice blocks as you want (drills or variations). Drag to reorder.
            </p>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={session.sections.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {session.sections.map(section => (
              <SortableSection
                key={section.id}
                section={section}
                isSelected={session.selectedSectionId === section.id}
                onUpdate={(updated) => handleUpdateSection(section.id, updated)}
                onRemove={() => handleRemoveSection(section.id)}
                onDuplicate={() => handleDuplicateSection(section.id)}
                onSaveToLibrary={handleSaveToLibrary}
                onSelectSection={handleSelectSection}
                teamsContext={teamsContext}
                diagramLibrary={diagramLibrary}
                aiContext={{
                  aiHook,
                  sessionSummary: session.summary,
                  onConfigureAI: () => setIsAIConfigOpen(true),
                }}
              />
            ))}
          </SortableContext>
        </DndContext>

        <div className="flex justify-center my-8">
          <button onClick={handleAddSection} className="btn btn-primary text-lg px-6 py-3">
            + Add Exercise
          </button>
        </div>

        <footer className="text-slate-400 text-sm text-center my-4">
          Tip: Click <strong>Download PDF</strong> to export your session plan as a formatted PDF document.
        </footer>

        <div className="no-print flex flex-wrap gap-3 justify-center my-6">
          <button onClick={handleExportSession} className="btn btn-subtle text-sm">
            Export Session JSON
          </button>
          <label className="btn btn-subtle text-sm cursor-pointer">
            Import Session JSON
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImportSession(file);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
          </label>
          <button onClick={handleClearSession} className="btn btn-danger text-sm">
            Clear session
          </button>
        </div>
      </main>

      {/* Modals */}
      <AddSectionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onChooseLibrary={handleChooseFromLibrary}
        onBuildFromScratch={handleBuildFromScratch}
        onPPP={() => {
          handlePPP();
          setIsAddModalOpen(false);
        }}
        hasSections={session.sections.length > 0}
      />

      <LibraryModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        library={library}
        selectedSectionId={session.selectedSectionId}
        insertMode={libraryInsertMode}
        onInsert={handleInsertLibraryItem}
        onOverwrite={handleOverwriteLibraryItem}
        onDelete={handleDeleteLibraryItem}
        onSetInsertMode={setLibraryInsertMode}
        onExportLibrary={handleExportLibrary}
        onImportLibrary={handleImportLibrary}
        onClearLibrary={handleClearLibrary}
      />

      <AIConfigModal
        isOpen={isAIConfigOpen}
        onClose={() => setIsAIConfigOpen(false)}
        aiHook={aiHook}
      />
    </div>
  );
}

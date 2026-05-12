import { useState, useCallback, useRef } from 'react';
import { pdf } from '@react-pdf/renderer';
import SessionSummary from '../SessionSummary';
import Section from '../Section';
import AddSectionModal from '../AddSectionModal';
import LibraryModal from '../LibraryModal';
import AIConfigModal from '../AIConfigModal';
import SessionPlanPDF from '../SessionPlanPDF';
import ShareModal from '../teams/ShareModal';
import SessionRail from './SessionRail';
import SharePopover from './SharePopover';
import { planTotal, parseMinutes, countReferenced } from '../../utils/sessionDuration';
import useAI from '../../hooks/useAI';
import {
  defaultSection,
  libraryPayloadToSection,
  toast,
  downloadJson,
} from '../../utils/helpers';
import { PPP_TEMPLATES } from '../../constants/coaching';

// AutoSaved chip — small inline pill confirming everything persists automatically.
function AutoSavedChip() {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
      style={{ background: 'rgb(var(--good-rgb) / 0.12)', color: 'var(--good)', fontSize: 11.5 }}
      title="Auto-saved — no Save button needed"
    >
      <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: 'var(--good)' }} />
      <span>Auto-saved</span>
    </span>
  );
}

// DurationChip — current vs target minutes. Mono. Color-coded:
// neutral on target, warn when under by >3, danger when over.
function DurationChip({ current, target }) {
  const overOrUnder = target > 0 ? current - target : 0;
  let color = 'var(--ink-2)';
  let bg = 'var(--bg-sunken)';
  if (target > 0) {
    if (overOrUnder > 0) { color = 'var(--danger)'; bg = 'rgb(var(--danger-rgb) / 0.10)'; }
    else if (overOrUnder < -3) { color = 'var(--warn)'; bg = 'rgb(var(--warn-rgb) / 0.12)'; }
    else { color = 'var(--good)'; bg = 'rgb(var(--good-rgb) / 0.12)'; }
  }
  return (
    <span
      className="font-mono uppercase"
      style={{
        padding: '4px 9px',
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 10.5,
        letterSpacing: '0.08em',
      }}
      title={target > 0 ? (overOrUnder === 0 ? 'On target' : overOrUnder > 0 ? `${overOrUnder} over target` : `${-overOrUnder} under target`) : 'No target set'}
    >
      {target > 0 ? `${current}/${target} MIN` : `${current} MIN`}
    </span>
  );
}

export default function SessionBuilder({ teamsContext, diagramLibrary, libraryHook, syncContext, sharingContext, onShowLinkDevice }) {
  const {
    selectedTeamId,
    selectedSessionId,
    getTeam,
    getSession,
    updateSession,
    updateTeam,
    navigateToTeams,
    navigateToTeamDetail,
    navigateToLibraryInsert,
  } = teamsContext;

  // Get the current session from team context
  const team = getTeam(selectedTeamId);
  const session = getSession(selectedTeamId, selectedSessionId);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [libraryOpenedFromSectionId, setLibraryOpenedFromSectionId] = useState(null);
  const [isAIConfigOpen, setIsAIConfigOpen] = useState(false);
  const [libraryInsertMode, setLibraryInsertMode] = useState('append');
  const [saveAsState, setSaveAsState] = useState(null); // { name, description } when open
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const shareBtnRef = useRef(null);

  // AI Hook
  const aiHook = useAI();

  // Handle missing team or session (corrupt data, stale URL, etc.)
  if (!team || !session || !session.summary) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        <div className="text-center">
          <p className="text-xl mb-4" style={{ color: 'var(--ink-2)' }}>Session not found</p>
          <div className="flex gap-3 justify-center">
            {team && (
              <button
                onClick={() => navigateToTeamDetail(selectedTeamId)}
                className="btn btn-primary"
              >
                Back to {team.name}
              </button>
            )}
            <button
              onClick={navigateToTeams}
              className={team ? 'btn btn-secondary' : 'btn btn-primary'}
            >
              All teams
            </button>
          </div>
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

  const handleSelectSummary = useCallback(() => {
    setSession(prev => ({ ...prev, selectedSectionId: null }));
  }, [setSession]);

  const handleReorderSections = useCallback((nextSections) => {
    setSession(prev => ({ ...prev, sections: nextSections }));
  }, [setSession]);

  const handleSaveToLibrary = useCallback((section, name) => {
    const entryName = (name || section.name || 'Untitled section').trim() || 'Untitled section';
    const sessionContext = {
      ageGroup: session.summary?.ageGroup || '',
      moment: session.summary?.moment || '',
    };
    libraryHook.saveExercise(section, entryName, sessionContext);
    toast('Saved to Library ✅');
  }, [libraryHook, session.summary]);

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
    navigateToLibraryInsert('exercises', selectedTeamId, selectedSessionId);
  }, [navigateToLibraryInsert, selectedTeamId, selectedSessionId]);

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
    const item = libraryHook.exercises.items.find(x => x.id === itemId);
    if (!item) return;

    const newSection = libraryPayloadToSection(item.payload, item.id);

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
  }, [libraryHook.exercises.items, libraryInsertMode, session.selectedSectionId, session.sections, setSession]);

  const handleReplaceWithLibraryItem = useCallback((itemId) => {
    if (!libraryOpenedFromSectionId) return;

    const item = libraryHook.exercises.items.find(x => x.id === itemId);
    if (!item) return;

    // Replace: section now carries the library item's id, so edits flow to that library entry.
    const newSection = libraryPayloadToSection(item.payload, item.id);

    setSession(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === libraryOpenedFromSectionId ? newSection : s)
    }));

    setIsLibraryModalOpen(false);
    toast('Section replaced ✅');
  }, [libraryOpenedFromSectionId, libraryHook.exercises.items, setSession]);

  const handleDeleteLibraryItem = useCallback((itemId) => {
    libraryHook.deleteExercise(itemId);
    toast('Library item deleted ✅');
  }, [libraryHook]);

  const handleExportLibrary = useCallback(() => {
    libraryHook.exportLibrary();
    toast('Library exported ✅');
  }, [libraryHook]);

  const handleImportLibrary = useCallback((file) => {
    libraryHook.importLibrary(file)
      .then(() => toast('Library imported ✅'))
      .catch(() => alert('That library JSON didn\'t parse correctly.'));
  }, [libraryHook]);

  const handleClearLibrary = useCallback(() => {
    if (!confirm('Clear your saved section library?')) return;
    libraryHook.clearExercises();
    toast('Library cleared ✅');
  }, [libraryHook]);

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

  const handleOpenSaveAs = useCallback(() => {
    setSaveAsState({
      name: `${session.summary?.title || 'Untitled session'} (copy)`,
      description: '',
    });
  }, [session.summary?.title]);

  const handleConfirmSaveAs = useCallback(() => {
    const name = (saveAsState?.name || '').trim();
    if (!name) return;
    const description = (saveAsState?.description || '').trim();
    // Snapshot into the manual library. New id because saveSession dedupes by name
    // against existing manual items — if the name is unique, this creates a new entry.
    const sessionToSave = description
      ? { ...session, summary: { ...session.summary, notes: description } }
      : session;
    libraryHook.saveSession(sessionToSave, name);
    setSaveAsState(null);
    toast('Saved to Library ✅');
  }, [saveAsState, session, libraryHook]);

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

  // Selection: null = Summary view; otherwise = a section id.
  const selectedSectionId = session.selectedSectionId ?? null;
  const activeSection = selectedSectionId
    ? session.sections.find(s => s.id === selectedSectionId)
    : null;

  // Duration math for the chip
  const planMinutes = planTotal(session.sections);
  const targetMinutes = parseMinutes(session.summary?.duration);

  // Share state — derived from the parent team's sharing flag. Per-item share
  // scope isn't in the data model yet; sharing a session is sharing its team.
  const syncEnabled = Boolean(syncContext?.isSyncEnabled);
  const hasAccount = false; // Account tier isn't wired yet; popover treats Public as locked.
  const isTeamShared = Boolean(team?.sharing?.isShared && team?.sharing?.shareToken);
  const shareScope = isTeamShared ? 'coaches' : 'private';
  const refCounts = countReferenced(session.sections);

  const handleMakePrivate = async () => {
    if (!sharingContext || !team?.sharing?.shareToken) {
      // Already private — just close.
      setSharePopoverOpen(false);
      return;
    }
    setSharePopoverOpen(false);
    if (!window.confirm(`Stop sharing ${team.name}? Co-coaches with the link will lose access.`)) return;
    try {
      await sharingContext.revokeShare(team.sharing.shareToken);
      updateTeam(team.id, { ...team, sharing: { isShared: false, shareToken: null, sharedAt: null } });
      toast('Sharing turned off');
    } catch {
      toast('Could not revoke share');
    }
  };

  const handleMakeCoCoaches = () => {
    setSharePopoverOpen(false);
    if (!syncEnabled) {
      onShowLinkDevice?.();
      return;
    }
    // Hand off to the existing ShareModal for link generation + copy UX.
    setIsShareModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* Sticky top bar */}
      <header
        className="sticky top-0 z-20"
        style={{
          background: 'rgb(var(--bg-elev-rgb) / 0.94)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={handleBackToTeam}
            className="btn btn-ghost flex-shrink-0"
            style={{ padding: '4px 8px', fontSize: 13 }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 19l-7-7 7-7" />
            </svg>
            <span>{team.name}</span>
          </button>
          <span style={{ color: 'var(--ink-3)' }}>/</span>
          <span
            className="font-semibold truncate"
            style={{ fontSize: 16, letterSpacing: '-0.015em', color: 'var(--ink)' }}
            title={session.summary?.title || 'Untitled session'}
          >
            {session.summary?.title || 'Untitled session'}
          </span>
          <AutoSavedChip />

          <div className="flex-1" />

          <DurationChip current={planMinutes} target={targetMinutes} />

          {/* Share menu — opens the cascading scope popover */}
          <div className="relative">
            <button
              ref={shareBtnRef}
              onClick={() => setSharePopoverOpen(o => !o)}
              className="btn btn-ghost"
              title="Share scope"
              aria-haspopup="dialog"
              aria-expanded={sharePopoverOpen}
            >
              {shareScope === 'coaches' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M17 21v-2a4 4 0 00-3-3.87M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
                  <circle cx="9" cy="7" r="4" strokeWidth={1.6} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="4" y="11" width="16" height="10" rx="2" strokeWidth={1.6} />
                  <path d="M8 11V7a4 4 0 018 0v4" strokeWidth={1.6} strokeLinecap="round" />
                </svg>
              )}
              {shareScope === 'coaches' ? 'Co-coaches' : 'Private'}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--ink-3)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <SharePopover
              open={sharePopoverOpen}
              anchorRef={shareBtnRef}
              onClose={() => setSharePopoverOpen(false)}
              current={shareScope}
              syncEnabled={syncEnabled}
              hasAccount={hasAccount}
              exerciseCount={refCounts.exercises}
              diagramCount={refCounts.diagrams}
              onMakePrivate={handleMakePrivate}
              onMakeCoCoaches={handleMakeCoCoaches}
              onTurnOnSync={() => { setSharePopoverOpen(false); onShowLinkDevice?.(); }}
            />
          </div>

          <button
            onClick={handleDownloadPDF}
            className="btn btn-ghost"
            title="Download PDF"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export PDF
          </button>
          <button
            onClick={handleOpenSaveAs}
            className="btn btn-ghost"
            title="Save a renamed copy to library"
          >
            Save as…
          </button>
          <button
            onClick={() => setIsAIConfigOpen(true)}
            className="btn btn-soft"
            title="AI Coach (configure)"
          >
            <span aria-hidden style={{ marginRight: 4 }}>✨</span>
            Ask Coach
          </button>
        </div>
      </header>

      {/* Two-column body */}
      <div className="flex-1 flex max-w-[1400px] mx-auto w-full">
        <SessionRail
          summary={session.summary}
          sections={session.sections}
          selectedSectionId={selectedSectionId}
          onSelectSummary={handleSelectSummary}
          onSelectSection={handleSelectSection}
          onReorderSections={handleReorderSections}
          onAddSection={handleAddSection}
        />

        <main className="flex-1 min-w-0 px-8 py-8 overflow-x-hidden">
          {activeSection ? (
            <>
              <Section
                key={activeSection.id}
                section={activeSection}
                onUpdate={(updated) => handleUpdateSection(activeSection.id, updated)}
                onRemove={() => {
                  handleRemoveSection(activeSection.id);
                  handleSelectSummary();
                }}
                onSaveToLibrary={handleSaveToLibrary}
                onOpenLibrary={() => {
                  setLibraryOpenedFromSectionId(activeSection.id);
                  setIsLibraryModalOpen(true);
                }}
                teamsContext={teamsContext}
                diagramLibrary={diagramLibrary}
                aiContext={{
                  aiHook,
                  sessionSummary: session.summary,
                  onConfigureAI: () => setIsAIConfigOpen(true),
                }}
              />
            </>
          ) : (
            <SessionSummary
              summary={session.summary}
              onUpdate={handleUpdateSummary}
            />
          )}

          <footer className="mt-12">
            <div className="hairline mb-6" />
            <div className="no-print flex flex-wrap gap-3 justify-center">
              <button onClick={handleExportSession} className="btn btn-ghost">Export JSON</button>
              <label className="btn btn-ghost cursor-pointer">
                Import JSON
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
              <button onClick={handleClearSession} className="btn btn-ghost" style={{ color: 'var(--danger)' }}>
                Clear session
              </button>
            </div>
          </footer>
        </main>
      </div>

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
        onClose={() => {
          setIsLibraryModalOpen(false);
          setLibraryOpenedFromSectionId(null);
        }}
        library={libraryHook.exercises}
        openedFromSectionId={libraryOpenedFromSectionId}
        insertMode={libraryInsertMode}
        onInsert={handleInsertLibraryItem}
        onReplace={handleReplaceWithLibraryItem}
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

      {isShareModalOpen && sharingContext && (
        <ShareModal
          team={team}
          onClose={() => setIsShareModalOpen(false)}
          onUpdateTeam={(updatedTeam) => updateTeam(selectedTeamId, updatedTeam)}
          sharingHook={sharingContext}
        />
      )}

      {saveAsState && (
        <>
          <div className="modal-backdrop" onClick={() => setSaveAsState(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="card p-6 w-full max-w-md animate-fade-in" style={{ boxShadow: 'var(--shadow-lg)' }}>
              <h2 className="text-[18px] font-semibold mb-1" style={{ letterSpacing: '-0.015em' }}>Save a copy to Library</h2>
              <p className="text-[13px] mb-4" style={{ color: 'var(--ink-2)' }}>
                Your work autosaves. Save As snapshots this session under a new name so you can reuse it as a template — pick something unique.
              </p>
              <label className="label-text">Name</label>
              <input
                type="text"
                autoFocus
                value={saveAsState.name}
                onChange={e => setSaveAsState(s => ({ ...s, name: e.target.value }))}
                className="input-field mb-3"
              />
              <label className="label-text">Description (optional)</label>
              <textarea
                rows={3}
                value={saveAsState.description}
                onChange={e => setSaveAsState(s => ({ ...s, description: e.target.value }))}
                placeholder="What makes this session unique? Age group, focus, etc."
                className="input-field mb-4 resize-none"
              />
              <div className="flex gap-3">
                <button onClick={() => setSaveAsState(null)} className="flex-1 btn btn-secondary">Cancel</button>
                <button
                  onClick={handleConfirmSaveAs}
                  disabled={!saveAsState.name.trim()}
                  className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save copy
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

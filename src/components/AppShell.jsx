import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import useTeams from '../hooks/useTeams';
import useDiagramLibrary from '../hooks/useDiagramLibrary';
import useLibrary from '../hooks/useLibrary';
import useSync from '../hooks/useSync';
import useSharing from '../hooks/useSharing';
import useAccount from '../hooks/useAccount';
import { VIEWS } from '../constants/navigation';
import { TEAMS_KEY, HAS_SEEN_WELCOME_KEY } from '../constants/storage';
import { uploadDiagramImage } from '../utils/uploadImage';
import { getTeamsData } from '../utils/indexedDBHelper';
import { mergeTeamsData } from '../utils/helpers';
import TeamList from './teams/TeamList';
import TeamDetail from './teams/TeamDetail';
import SessionBuilder from './session-builder/SessionBuilder';
import DiagramBuilder from './DiagramPlayground';
import Library from './Library';
import Schedule from './Schedule';
import Settings from './Settings';
import Welcome from './Welcome';
import AboutModal from './AboutModal';
import AppHeader from './AppHeader';
import LinkDeviceModal from './LinkDeviceModal';
import AccountModal from './AccountModal';
import StorageLimitModal from './StorageLimitModal';
import ImportLanding from './ImportLanding';

// Error boundary: catches rendering crashes and shows recovery UI
class ViewErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('View crashed:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
          <div className="text-center max-w-md px-6">
            <svg className="w-14 h-14 mx-auto mb-5" style={{ color: 'var(--warn)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-semibold mb-2" style={{ letterSpacing: '-0.02em' }}>Something went wrong</h2>
            <p className="mb-6" style={{ color: 'var(--ink-2)' }}>This page ran into an error. Your data is safe.</p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onRecover();
              }}
              className="btn btn-primary"
            >
              Back to Teams
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Capture the original URL before any hooks can rewrite it.
// This must run at module level (or in a lazy initializer) so useTeams'
// resolveUrl() + replaceState() doesn't clobber the path.
function readInitialUrl() {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  return { path, params };
}

// Legacy diagrams (elements/lines) saved via uploadDiagramImage have their
// dataUrl stripped — the image lives on the section's imageDataUrl instead.
// When opening a saved diagram for edit, fold the section/variation image
// back in so the Konva playground's legacy fallback can display it.
function withLegacyImageFallback(diagramData, fallbackImageUrl) {
  if (!diagramData) return diagramData ?? null;
  if (diagramData.dataUrl || diagramData.imageDataUrl) return diagramData;
  if (!fallbackImageUrl) return diagramData;
  return { ...diagramData, dataUrl: fallbackImageUrl };
}


export default function AppShell() {
  // Read URL synchronously before useTeams can rewrite it
  const [initialUrl] = useState(readInitialUrl);

  const teamsContext = useTeams();
  const diagramLibrary = useDiagramLibrary();
  const libraryHook = useLibrary();
  const loadTeamsFromServerRef = useRef(null);
  const teamsDataRef = useRef(null);
  const tabIdRef = useRef(Math.random().toString(36).slice(2));
  const broadcastingRef = useRef(false);
  const channelRef = useRef(null);
  const syncContext = useSync({
    // Using a ref so useSync doesn't rebind on every render of AppShell.
    onRemoteUpdate: useCallback((teams) => {
      if (loadTeamsFromServerRef.current) loadTeamsFromServerRef.current(teams);
    }, []),
  });
  const sharingContext = useSharing();
  const accountContext = useAccount();

  const [showLinkDeviceModal, setShowLinkDeviceModal] = useState(false);
  const [linkDeviceDefaultMode, setLinkDeviceDefaultMode] = useState(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [iosReferral, setIosReferral] = useState(false);
  const [importCode, setImportCode] = useState(() => {
    if (initialUrl.path === '/import') {
      const code = initialUrl.params.get('code');
      if (code) {
        localStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true');
        return code.toUpperCase();
      }
    }
    return null;
  });
  const [staticPage, setStaticPage] = useState(() => {
    if (initialUrl.path === '/privacy') return 'privacy';
    if (initialUrl.path === '/support') return 'support';
    return null;
  });
  // Held in state (not just localStorage) so dismissing the Welcome screen
  // forces a re-render even when currentView is already TEAMS — without this,
  // setCurrentView(TEAMS) bails and the gate keeps showing Welcome.
  const [hasSeenWelcome, setHasSeenWelcome] = useState(() => {
    try { return localStorage.getItem(HAS_SEEN_WELCOME_KEY) === 'true'; } catch { return false; }
  });
  const dismissWelcome = () => {
    try { localStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true'); } catch { /* ignore */ }
    setHasSeenWelcome(true);
  };
  const hasCheckedForUpdates = useRef(false);

  // First-sync activation: create the identity, push every existing local
  // team/session to Postgres via the per-entity v2 API.
  const enableSyncForFirstTime = async () => {
    await syncContext.initializeIdentity();
    if (teamsContext.pushAllToPostgres) {
      await teamsContext.pushAllToPostgres();
    }
  };

  const {
    currentView,
    teamsData,
    selectedTeamId,
    selectedSessionId,
    selectedSectionId,
    selectedVariationId,
    editingDiagramId,
    showStorageLimitModal,
    setShowStorageLimitModal,
    getTeam,
    getSession,
    updateSession,
    navigateToTeams,
    navigateBackFromDiagramBuilder,
  } = teamsContext;

  // Expose test function for storage limit modal (development only)
  useEffect(() => {
    window.testStorageLimit = () => {
      setShowStorageLimitModal(true);
      console.log('Storage limit modal triggered for testing. Call window.testStorageLimit(false) to close it.');
    };
    window.testStorageLimit.close = () => setShowStorageLimitModal(false);
    return () => {
      delete window.testStorageLimit;
    };
  }, []);

  // Handle routes that need async work on mount (iOS referral).
  // Shared routes are handled by SharedView component (never reaches AppShell).
  // Import code, static pages are handled synchronously in useState initializers.
  useEffect(() => {
    const { path, params } = initialUrl;

    if (path === '/share/new' && params.get('ref') === 'ios-app') {
      setIosReferral(true);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Initialize sync on first load (auto-create identity)
  useEffect(() => {
    if (teamsData && !syncContext.identity && syncContext.isOnline) {
      // Auto-initialize identity for new users
      // Commented out for now - let users explicitly enable sync
      // syncContext.initializeIdentity();
    }
  }, [teamsData, syncContext.identity, syncContext.isOnline]);

  // Teams now write to Postgres via per-entity PUT/DELETE in useTeams.js.
  // No blob push — the old path caused merge/version-conflict resurrections.

  // Keep a live ref to loadTeamsFromServer so sync callbacks (BroadcastChannel
  // messages, visibility pulls) always call the current one.
  useEffect(() => { loadTeamsFromServerRef.current = teamsContext.loadTeamsFromServer; }, [teamsContext.loadTeamsFromServer]);

  // Keep a live ref to the current teamsData so the visibility-refresh effect
  // (whose listeners persist across renders) always merges against the latest
  // local state instead of a stale captured value.
  useEffect(() => { teamsDataRef.current = teamsContext.teamsData; }, [teamsContext.teamsData]);

  // Auto-pull from server on app load when sync is enabled. Pulls are merged
  // per-entity by updatedAt (mergeTeamsData) so a stale tab picks up other-device
  // edits without overwriting its own unflushed local work (writes flush on a
  // 30s debounce). One additional safety: don't adopt anything when the server
  // is empty but local is not — protects users who just enabled sync and
  // haven't finished pushing yet.
  useEffect(() => {
    const checkForServerUpdates = async () => {
      if (hasCheckedForUpdates.current) return;
      if (!syncContext.isSyncEnabled || !syncContext.isOnline) return;
      if (!teamsData) return;

      hasCheckedForUpdates.current = true;

      try {
        const result = await syncContext.pullTeams();
        if (!result) return;
        const serverTeamCount = result.teams?.teams?.length || 0;
        const localTeamCount = teamsData?.teams?.length || 0;
        if (serverTeamCount === 0 && localTeamCount > 0) return;
        teamsContext.loadTeamsFromServer(mergeTeamsData(teamsData, result.teams));
      } catch (err) {
        console.error('Failed to check for server updates:', err);
      }
    };

    checkForServerUpdates();
  }, [teamsData, syncContext.isSyncEnabled, syncContext.isOnline]);

  // Pull on visibility change / window focus so a tab that was in the background
  // (or was left open from a prior session) reconciles with the server before
  // the user edits anything. Merged per-entity by updatedAt to preserve any
  // unflushed local edits in this tab.
  useEffect(() => {
    if (!syncContext.isSyncEnabled) return;

    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!syncContext.isOnline) return;
      try {
        const result = await syncContext.pullTeams();
        if (!result) return;
        const current = teamsDataRef.current;
        if (loadTeamsFromServerRef.current) {
          loadTeamsFromServerRef.current(mergeTeamsData(current, result.teams));
        }
      } catch (err) {
        console.error('Visibility pull failed:', err);
      }
    };

    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [syncContext.isSyncEnabled, syncContext.isOnline]);

  // Cross-tab mirror: notify other tabs when teamsData changes so they can
  // reload from IndexedDB. Sends a lightweight signal (NO data payload) to
  // avoid structured-cloning hundreds of MB of base64 images on every edit.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('playball-teams');
    channelRef.current = ch;
    ch.onmessage = async (e) => {
      if (!e.data || e.data.tabId === tabIdRef.current) return;
      if (e.data.type === 'teams-changed') {
        // Another tab edited data — reload from IndexedDB (the source of truth).
        broadcastingRef.current = true;
        try {
          const fresh = await getTeamsData();
          if (fresh && loadTeamsFromServerRef.current) {
            loadTeamsFromServerRef.current(fresh);
          }
        } catch (err) {
          console.warn('Cross-tab reload failed:', err);
        } finally {
          setTimeout(() => { broadcastingRef.current = false; }, 0);
        }
      }
    };
    return () => { ch.close(); channelRef.current = null; };
  }, []); // stable — no deps needed since we use refs

  useEffect(() => {
    if (!channelRef.current || !teamsData) return;
    if (broadcastingRef.current) return; // came from another tab, don't echo
    // Lightweight signal — no data payload, other tabs read from IndexedDB
    channelRef.current.postMessage({ type: 'teams-changed', tabId: tabIdRef.current });
  }, [teamsData]);

  // Library now writes to Postgres via per-entity PUT/DELETE in useLibrary.js.
  // No blob push.

  // Pull library from server once on load when sync is enabled
  const libraryPulledRef = useRef(false);
  useEffect(() => {
    if (libraryPulledRef.current) return;
    if (!syncContext.isSyncEnabled || !syncContext.isOnline || !teamsData) return;
    libraryPulledRef.current = true;

    const pullLibraryFromServer = async () => {
      try {
        const result = await syncContext.pullLibrary();
        if (result?.library) {
          const { exercises, sessions } = result.library;
          if (exercises?.items?.length > (libraryHook.exercises?.items?.length || 0)) {
            libraryHook.setExercisesRaw(exercises);
          }
          if (sessions?.items?.length > (libraryHook.sessions?.items?.length || 0)) {
            libraryHook.setSessionsRaw(sessions);
          }
        }
      } catch (err) {
        console.error('Failed to pull library from server:', err);
      }
    };

    pullLibraryFromServer();
  }, [syncContext.isSyncEnabled, syncContext.isOnline, teamsData]);

  // Pull diagrams from server when sync is enabled. Mirrors the library pull
  // above — diagram library now syncs per-entity via /api/v2/diagrams.
  // Marks "pulled" only after a successful fetch, so pairing later (which
  // flips isSyncEnabled true) does trigger a retry.
  const diagramsPulledRef = useRef(false);
  useEffect(() => {
    if (diagramsPulledRef.current) return;
    if (!syncContext.isSyncEnabled || !syncContext.isOnline) return;
    if (!diagramLibrary.isLoaded) return;

    const identityRaw = localStorage.getItem('ppp_coach_identity_v1');
    if (!identityRaw) return;
    let identity;
    try { identity = JSON.parse(identityRaw); } catch { return; }
    if (!identity?.coachId || !identity?.deviceId) return;

    (async () => {
      try {
        const res = await fetch('/api/v2/diagrams', {
          headers: {
            'x-coach-id': identity.coachId,
            'x-device-id': identity.deviceId,
          },
        });
        const data = await res.json();
        if (!data?.success || !Array.isArray(data.diagrams)) return;
        diagramsPulledRef.current = true;

        // Each Postgres row is { id, coach_id, name, payload, updated_at }.
        // The payload IS the diagram object we stored. Merge by id + recency.
        const incoming = data.diagrams
          .map(row => row.payload && typeof row.payload === 'object'
            ? { ...row.payload, id: row.id, updatedAt: row.payload.updatedAt || row.updated_at }
            : null
          )
          .filter(Boolean);
        if (incoming.length > 0) {
          diagramLibrary.setDiagramsRaw(incoming);
        }

        // One-shot migration: push every local diagram that the server doesn't
        // know about. Pre-sync diagrams live only in localStorage; this gets
        // them into Postgres so they're available on every paired device.
        const MIGRATION_FLAG = 'ppp_diagrams_migrated_v1';
        if (!localStorage.getItem(MIGRATION_FLAG)) {
          const serverIds = incoming.map(d => d.id);
          const pushed = diagramLibrary.pushAllToServer(serverIds);
          if (pushed > 0) {
            console.log(`[diagram-migrate] pushed ${pushed} local diagrams to server`);
          }
          localStorage.setItem(MIGRATION_FLAG, '1');
        }
      } catch (err) {
        console.error('Failed to pull diagrams from server:', err);
      }
    })();
  }, [syncContext.isSyncEnabled, syncContext.isOnline, diagramLibrary.isLoaded, diagramLibrary]);

  // Track pending share pushes so we can flush them on pagehide / periodic max-age.
  // lastPushedAt tracks the last *successful* push per token so continuously editing
  // users still get a push at least every MAX_SHARE_PUSH_INTERVAL.
  const pendingShareTeamsRef = useRef({}); // token -> team (latest snapshot)
  const lastSharePushAtRef = useRef({}); // token -> epoch ms
  const MAX_SHARE_PUSH_INTERVAL_MS = 15000;

  // Shared team data is now served live from Postgres via /api/share/:token
  // (reads teams.sharing->>shareToken). No client-side push is needed — the
  // team is always up-to-date as soon as per-entity PUTs land. This kills the
  // old sendBeacon pagehide flush that was blowing past the 64KB keepalive cap.

  // Show PlayBall import landing page for /import?code=XXXXXX deep links
  if (importCode) {
    return <ImportLanding code={importCode} onDismiss={() => {
      setImportCode(null);
      window.history.replaceState({}, '', '/');
    }} />;
  }

  // Shared views are handled by SharedView component (routed in App.jsx)

  // Wait for teams data to load
  if (!teamsData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-10 w-10 mx-auto mb-4"
            style={{ border: '2px solid var(--line)', borderBottomColor: 'var(--accent)' }}
          />
          <p style={{ color: 'var(--ink-2)' }}>Loading…</p>
        </div>
      </div>
    );
  }

  // Handle saving diagram from builder back to section/variation AND to library.
  // Uploads the base64 image to CDN first, then stores a lightweight CDN URL
  // instead of the massive base64 string (the #1 cause of memory bloat).
  const handleDiagramSave = async (diagramData) => {
    // Navigate back immediately so the user isn't blocked by the upload
    navigateBackFromDiagramBuilder();

    // Upload base64 to CDN — returns { imageUrl, diagramData (without dataUrl) }
    const { imageUrl, diagramData: cleanDiagram } = await uploadDiagramImage(diagramData);

    const libraryPayload = {
      dataUrl: imageUrl, // CDN URL (or base64 fallback if upload failed)
      elements: cleanDiagram.elements || [],
      lines: cleanDiagram.lines || [],
      fieldType: cleanDiagram.fieldType || 'full',
      // Preserve Konva playground state on the library copy so a future edit
      // loads editable shapes instead of falling back to legacy mode.
      shapes: cleanDiagram.shapes,
      pitchSize: cleanDiagram.pitchSize,
      pitchView: cleanDiagram.pitchView,
      orientation: cleanDiagram.orientation,
    };

    if (selectedTeamId && selectedSessionId && selectedSectionId && selectedVariationId) {
      // Saving to a variation within a section
      const team = getTeam(selectedTeamId);
      const session = getSession(selectedTeamId, selectedSessionId);
      if (session) {
        const section = session.sections.find(s => s.id === selectedSectionId);
        if (section) {
          const updatedVariations = section.variations.map(v =>
            v.id === selectedVariationId
              ? { ...v, diagramData: cleanDiagram, imageDataUrl: imageUrl }
              : v
          );
          const updatedSections = session.sections.map(s =>
            s.id === selectedSectionId
              ? { ...s, variations: updatedVariations }
              : s
          );
          updateSession(selectedTeamId, selectedSessionId, { sections: updatedSections });

          const variation = section.variations.find(v => v.id === selectedVariationId);
          diagramLibrary.saveDiagram(
            libraryPayload,
            diagramData.name || variation?.name || section?.name || 'Untitled Diagram',
            diagramData.description || '',
            {
              ageGroup: team?.ageGroup || '',
              moments: session?.summary?.moment ? [session.summary.moment] : [],
              type: section?.type || '',
            }
          );
        }
      }
    } else if (selectedTeamId && selectedSessionId && selectedSectionId) {
      // Saving to a section (not a variation)
      const team = getTeam(selectedTeamId);
      const session = getSession(selectedTeamId, selectedSessionId);
      if (session) {
        const section = session.sections.find(s => s.id === selectedSectionId);
        const updatedSections = session.sections.map(s =>
          s.id === selectedSectionId
            ? { ...s, diagramData: cleanDiagram, imageDataUrl: imageUrl }
            : s
        );
        updateSession(selectedTeamId, selectedSessionId, { sections: updatedSections });

        diagramLibrary.saveDiagram(
          libraryPayload,
          diagramData.name || section?.name || 'Untitled Diagram',
          diagramData.description || '',
          {
            ageGroup: team?.ageGroup || '',
            moments: session?.summary?.moment ? [session.summary.moment] : [],
            type: section?.type || '',
          }
        );
      }
    } else if (editingDiagramId && editingDiagramId !== 'USE_PARENT') {
      // Updating a library diagram
      diagramLibrary.updateDiagram(editingDiagramId, {
        name: diagramData.name,
        description: diagramData.description,
        dataUrl: imageUrl,
        elements: cleanDiagram.elements || [],
        lines: cleanDiagram.lines || [],
        fieldType: cleanDiagram.fieldType || 'full',
        // Konva state — keep the editable shapes on the library copy so the
        // next Edit click loads them instead of falling back to legacy.
        shapes: cleanDiagram.shapes,
        pitchSize: cleanDiagram.pitchSize,
        pitchView: cleanDiagram.pitchView,
        orientation: cleanDiagram.orientation,
        tags: diagramData.tags || {},
      });
    } else {
      // Creating new diagram from library (no section context, no existing diagram)
      diagramLibrary.saveDiagram(
        libraryPayload,
        diagramData.name || 'Untitled Diagram',
        diagramData.description || '',
        diagramData.tags || {}
      );
    }
  };

  // Get initial diagram data and context for editor
  const getDiagramContext = () => {
    if (editingDiagramId && editingDiagramId !== 'USE_PARENT') {
      // Editing library diagram - return existing data
      const diagram = diagramLibrary.getDiagram(editingDiagramId);
      return {
        initialDiagram: diagram,
        defaultName: diagram?.name || '',
        defaultDescription: diagram?.description || '',
        ageGroup: diagram?.tags?.ageGroup || '',
        moment: diagram?.tags?.moment || '',
        sectionType: diagram?.tags?.type || '',
      };
    } else if (selectedTeamId && selectedSessionId && selectedSectionId && selectedVariationId) {
      // Editing variation diagram
      const team = getTeam(selectedTeamId);
      const session = getSession(selectedTeamId, selectedSessionId);
      const section = session?.sections.find(s => s.id === selectedSectionId);
      const variation = section?.variations.find(v => v.id === selectedVariationId);

      // Use parent diagram as base if USE_PARENT flag is set, or if variation has no diagram
      const useParentAsBase = editingDiagramId === 'USE_PARENT';
      const sourceDiagram = useParentAsBase
        ? section?.diagramData
        : (variation?.diagramData || section?.diagramData);
      const fallbackImage = useParentAsBase
        ? section?.imageDataUrl
        : (variation?.imageDataUrl || section?.imageDataUrl);
      const initialDiagram = withLegacyImageFallback(sourceDiagram, fallbackImage);

      return {
        initialDiagram,
        defaultName: variation?.name || section?.name || '',
        defaultDescription: variation?.objective || section?.objective || '',
        ageGroup: team?.ageGroup || '',
        moment: session?.summary?.moment || '',
        sectionType: section?.type || '',
      };
    } else if (selectedTeamId && selectedSessionId && selectedSectionId) {
      // Editing section diagram - get context from team/session/section
      const team = getTeam(selectedTeamId);
      const session = getSession(selectedTeamId, selectedSessionId);
      const section = session?.sections.find(s => s.id === selectedSectionId);
      return {
        initialDiagram: withLegacyImageFallback(section?.diagramData, section?.imageDataUrl),
        defaultName: section?.name || '',
        defaultDescription: section?.objective || '',
        ageGroup: team?.ageGroup || '',
        moment: session?.summary?.moment || '',
        sectionType: section?.type || '',
      };
    }
    return {
      initialDiagram: null,
      defaultName: '',
      defaultDescription: '',
      ageGroup: '',
      moment: '',
      sectionType: '',
    };
  };

  // Static pages (privacy, support)
  if (staticPage) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        <div className="max-w-2xl mx-auto px-6 py-12">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm mb-8 transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to PlayBall
          </a>

          {staticPage === 'privacy' && (
            <div className="prose prose-invert max-w-none">
              <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
              <p className="text-slate-400 text-sm mb-8">Effective date: August 27, 2025</p>

              <p className="text-slate-300 leading-relaxed mb-6">
                PlayBall does not collect, store, or share any personal data. We do not use analytics, tracking, advertising identifiers, or third-party SDKs that gather user information.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">Information We Do Not Collect</h2>
              <ul className="text-slate-300 space-y-2 list-disc list-inside">
                <li>No names, emails, phone numbers, or contact info</li>
                <li>No location data</li>
                <li>No device or usage analytics</li>
                <li>No cookies or tracking technologies</li>
                <li>No third-party ad or analytics SDKs</li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">On-Device Data</h2>
              <p className="text-slate-300 leading-relaxed mb-6">
                If PlayBall stores data (e.g., team rosters, game setups, preferences), it remains <strong className="text-white">on your device</strong> and is not transmitted to us.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">Optional Sync & Sharing</h2>
              <p className="text-slate-300 leading-relaxed mb-6">
                If you choose to enable <strong className="text-white">device sync</strong> or <strong className="text-white">team sharing</strong>, the session data you choose to share is transmitted to our servers solely to make those features work. This data is stored anonymously — no personal information, accounts, or identifiers are collected. We do not use this data for any purpose other than delivering it back to you or your shared recipients.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">Changes to This Policy</h2>
              <p className="text-slate-300 leading-relaxed">
                If our practices change (for example, if we add optional features that require network services), we will update this policy and the effective date above.
              </p>

              <div className="mt-10 pt-6 border-t border-slate-700">
                <p className="text-slate-500 text-sm">
                  Contact: <a href="mailto:support@getplayball.app" className="text-blue-400 hover:text-blue-300">support@getplayball.app</a>
                </p>
              </div>
            </div>
          )}

          {staticPage === 'support' && (
            <div className="prose prose-invert max-w-none">
              <h1 className="text-3xl font-bold mb-6">Support</h1>

              <p className="text-slate-300 leading-relaxed mb-6">
                Need help? Email <a href="mailto:support@getplayball.app" className="text-blue-400 hover:text-blue-300 font-medium">support@getplayball.app</a> — we typically reply within 1–2 business days.
              </p>

              <div className="space-y-4">
                <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                  <h3 className="font-semibold text-white mb-1">Report a Bug</h3>
                  <p className="text-slate-400 text-sm">Please include your device model, OS version, and steps to reproduce.</p>
                </div>

                <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                  <h3 className="font-semibold text-white mb-1">Feature Requests</h3>
                  <p className="text-slate-400 text-sm">We love ideas! Email us with your suggestions.</p>
                </div>

                <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                  <h3 className="font-semibold text-white mb-1">Privacy</h3>
                  <p className="text-slate-400 text-sm">
                    PlayBall does not collect personal data. Read our <a href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</a>.
                  </p>
                </div>

                <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                  <h3 className="font-semibold text-white mb-1">Data & Deletion</h3>
                  <p className="text-slate-400 text-sm">PlayBall stores data on your device. If you've enabled sync or sharing, that data is stored anonymously on our servers solely to deliver those features. Delete the app to remove local data, or revoke sharing to remove shared data.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full-page diagram builder view
  if (currentView === VIEWS.DIAGRAM_BUILDER) {
    const context = getDiagramContext();
    return (
      <ViewErrorBoundary onRecover={navigateToTeams}>
        <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
          <DiagramBuilder
            initialDiagram={context.initialDiagram}
            defaultName={context.defaultName}
            defaultDescription={context.defaultDescription}
            ageGroup={context.ageGroup}
            moment={context.moment}
            sectionType={context.sectionType}
            onSave={handleDiagramSave}
            onClose={navigateBackFromDiagramBuilder}
          />
        </div>
      </ViewErrorBoundary>
    );
  }

  // First-run gate — brand-new coaches with zero teams who haven't dismissed
  // the welcome screen land on /welcome instead of an empty Home. The /welcome
  // route also renders this view when reached directly (e.g. from About's
  // "Restart tutorial").
  const teamCount = teamsData?.teams?.length || 0;
  const shouldShowWelcome =
    currentView === VIEWS.WELCOME
    || (currentView === VIEWS.TEAMS && teamCount === 0 && !hasSeenWelcome);
  if (shouldShowWelcome) {
    return (
      <ViewErrorBoundary onRecover={navigateToTeams}>
        <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
          <Welcome
            teamsContext={teamsContext}
            onDismiss={dismissWelcome}
            onShowPair={() => {
              setLinkDeviceDefaultMode('join');
              setShowLinkDeviceModal(true);
            }}
          />
          {showLinkDeviceModal && (
            <LinkDeviceModal
              onClose={() => {
                setShowLinkDeviceModal(false);
                setLinkDeviceDefaultMode(null);
              }}
              hasIdentity={syncContext.isSyncEnabled}
              defaultMode={linkDeviceDefaultMode}
              onRequestCode={syncContext.requestPairingCode}
              onConfirmCode={async (code) => {
                const teams = await syncContext.confirmPairingCode(code);
                if (teams) {
                  teamsContext.loadTeamsFromServer(teams);
                  dismissWelcome();
                  setShowLinkDeviceModal(false);
                  setLinkDeviceDefaultMode(null);
                }
              }}
              onInitialize={enableSyncForFirstTime}
              onReset={() => {
                syncContext.resetSync();
                setShowLinkDeviceModal(false);
                setLinkDeviceDefaultMode(null);
              }}
            />
          )}
        </div>
      </ViewErrorBoundary>
    );
  }

  // SessionBuilder is fullscreen — no nav rail.
  if (currentView === VIEWS.SESSION_BUILDER) {
    return (
      <ViewErrorBoundary onRecover={navigateToTeams}>
        <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
          <SessionBuilder
            teamsContext={teamsContext}
            diagramLibrary={diagramLibrary}
            libraryHook={libraryHook}
            syncContext={syncContext}
            sharingContext={sharingContext}
            accountContext={accountContext}
            onShowLinkDevice={() => setShowLinkDeviceModal(true)}
          />
          {showLinkDeviceModal && (
            <LinkDeviceModal
              onClose={() => {
                setShowLinkDeviceModal(false);
                setLinkDeviceDefaultMode(null);
              }}
              hasIdentity={syncContext.isSyncEnabled}
              defaultMode={linkDeviceDefaultMode}
              onRequestCode={syncContext.requestPairingCode}
              onConfirmCode={async (code) => {
                const teams = await syncContext.confirmPairingCode(code);
                if (teams) {
                  teamsContext.loadTeamsFromServer(teams);
                  setShowLinkDeviceModal(false);
                  setLinkDeviceDefaultMode(null);
                }
              }}
              onInitialize={enableSyncForFirstTime}
              onReset={() => {
                syncContext.resetSync();
                setShowLinkDeviceModal(false);
                setLinkDeviceDefaultMode(null);
              }}
            />
          )}
          {showStorageLimitModal && (
            <StorageLimitModal
              onEnableSync={() => {
                setShowStorageLimitModal(false);
                setLinkDeviceDefaultMode('new');
                setShowLinkDeviceModal(true);
              }}
            />
          )}
        </div>
      </ViewErrorBoundary>
    );
  }

  // Shared surfaces (Home, TeamDetail, Schedule, Library, Settings) live inside
  // the top-header layout. Session Builder + Diagram Builder are fullscreen and
  // bypass this block above.
  return (
    <ViewErrorBoundary onRecover={navigateToTeams}>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        <AppHeader
          teamsContext={teamsContext}
          syncContext={syncContext}
          accountContext={accountContext}
          onShowAbout={() => setShowAboutModal(true)}
        />
        <div className="flex-1 min-w-0 flex flex-col">
        {currentView === VIEWS.TEAMS && (
          <TeamList
            teamsContext={teamsContext}
            syncContext={syncContext}
            sharingContext={sharingContext}
            onShowLinkDevice={() => setShowLinkDeviceModal(true)}
            iosReferral={iosReferral}
            onDismissIosReferral={() => setIosReferral(false)}
          />
        )}
        {currentView === VIEWS.TEAM_DETAIL && (
          <TeamDetail
            teamsContext={teamsContext}
            sharingContext={sharingContext}
            libraryHook={libraryHook}
          />
        )}
        {currentView === VIEWS.SCHEDULE && (
          <Schedule teamsContext={teamsContext} />
        )}
        {currentView === VIEWS.LIBRARY && (
          <Library
            teamsContext={teamsContext}
            libraryHook={libraryHook}
            diagramLibrary={diagramLibrary}
            syncContext={syncContext}
            sharingContext={sharingContext}
            isSignedIn={Boolean(accountContext?.isSignedIn)}
            hasAccount={Boolean(accountContext?.isSignedIn)}
            onShowSignIn={() => setShowAccountModal(true)}
            onShowLinkDevice={() => setShowLinkDeviceModal(true)}
          />
        )}
        {currentView === VIEWS.SETTINGS && (
          <Settings
            teamsContext={teamsContext}
            syncContext={syncContext}
            accountContext={accountContext}
            libraryHook={libraryHook}
            diagramLibrary={diagramLibrary}
            onShowLinkDevice={() => setShowLinkDeviceModal(true)}
            onShowAccount={() => setShowAccountModal(true)}
          />
        )}
        </div>

      {/* Link Device Modal */}
      {showLinkDeviceModal && (
        <LinkDeviceModal
          onClose={() => {
            setShowLinkDeviceModal(false);
            setLinkDeviceDefaultMode(null);
          }}
          hasIdentity={syncContext.isSyncEnabled}
          defaultMode={linkDeviceDefaultMode}
          onRequestCode={syncContext.requestPairingCode}
          onConfirmCode={async (code) => {
            const teams = await syncContext.confirmPairingCode(code);
            if (teams) {
              // Hydrate and set teams data
              teamsContext.loadTeamsFromServer(teams);
              setShowLinkDeviceModal(false);
              setLinkDeviceDefaultMode(null);
            }
          }}
          onInitialize={enableSyncForFirstTime}
          onReset={() => {
            syncContext.resetSync();
            setShowLinkDeviceModal(false);
            setLinkDeviceDefaultMode(null);
          }}
        />
      )}

      {/* Account Modal — stub sign-in. Turns on cloud sync if it isn't already. */}
      {showAccountModal && (
        <AccountModal
          onClose={() => setShowAccountModal(false)}
          hasSync={syncContext.isSyncEnabled}
          onSignIn={async (email) => {
            // If sync isn't on yet, turn it on first — tier 3 implies tier 2.
            if (!syncContext.isSyncEnabled) {
              await enableSyncForFirstTime();
            }
            await accountContext.signIn(email);
          }}
        />
      )}

      {/* Storage Limit Modal */}
      {showStorageLimitModal && (
        <StorageLimitModal
          onEnableSync={() => {
            setShowStorageLimitModal(false);
            setLinkDeviceDefaultMode('new');
            setShowLinkDeviceModal(true);
          }}
        />
      )}

      {showAboutModal && (
        <AboutModal
          onClose={() => setShowAboutModal(false)}
          onRestartTutorial={() => {
            setShowAboutModal(false);
            try { localStorage.removeItem(HAS_SEEN_WELCOME_KEY); } catch { /* ignore */ }
            setHasSeenWelcome(false);
            teamsContext.navigateToWelcome?.();
          }}
        />
      )}
      </div>
    </ViewErrorBoundary>
  );
}

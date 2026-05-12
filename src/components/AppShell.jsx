import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import useTeams from '../hooks/useTeams';
import useDiagramLibrary from '../hooks/useDiagramLibrary';
import useLibrary from '../hooks/useLibrary';
import useSync from '../hooks/useSync';
import useSharing from '../hooks/useSharing';
import { VIEWS } from '../constants/navigation';
import { TEAMS_KEY, HAS_SEEN_WELCOME_KEY } from '../constants/storage';
import { uploadDiagramImage } from '../utils/uploadImage';
import { getTeamsData } from '../utils/indexedDBHelper';
import TeamList from './teams/TeamList';
import TeamDetail from './teams/TeamDetail';
import SessionBuilder from './session-builder/SessionBuilder';
import DiagramBuilder from './DiagramBuilder';
import Library from './Library';
import Schedule from './Schedule';
import Settings from './Settings';
import NavRail from './NavRail';
import LinkDeviceModal from './LinkDeviceModal';
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


export default function AppShell() {
  // Read URL synchronously before useTeams can rewrite it
  const [initialUrl] = useState(readInitialUrl);

  const teamsContext = useTeams();
  const diagramLibrary = useDiagramLibrary();
  const libraryHook = useLibrary();
  const loadTeamsFromServerRef = useRef(null);
  const tabIdRef = useRef(Math.random().toString(36).slice(2));
  const broadcastingRef = useRef(false);
  const channelRef = useRef(null);
  const syncContext = useSync({
    // Called by useSync on version_conflict merges or cross-tab broadcasts.
    // Using a ref so useSync doesn't rebind on every render of AppShell.
    onRemoteUpdate: useCallback((teams) => {
      if (loadTeamsFromServerRef.current) loadTeamsFromServerRef.current(teams);
    }, []),
  });
  const sharingContext = useSharing();

  const [showLinkDeviceModal, setShowLinkDeviceModal] = useState(false);
  const [linkDeviceDefaultMode, setLinkDeviceDefaultMode] = useState(null);
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
  const hasCheckedForUpdates = useRef(false);

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
    loadTeamsFromServer,
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

  // Keep a live ref to loadTeamsFromServer so sync callbacks (conflict merges,
  // BroadcastChannel messages, visibility pulls) always call the current one.
  useEffect(() => { loadTeamsFromServerRef.current = teamsContext.loadTeamsFromServer; }, [teamsContext.loadTeamsFromServer]);

  // Auto-pull from server on app load when sync is enabled
  useEffect(() => {
    const checkForServerUpdates = async () => {
      // Only check once per app load
      if (hasCheckedForUpdates.current) return;
      if (!syncContext.isSyncEnabled || !syncContext.isOnline) return;
      if (!teamsData) return;

      hasCheckedForUpdates.current = true;

      // One-time migration: base64 imageDataUrl was previously stripped from
      // IndexedDB. Force a full pull from Postgres to restore images.
      const needsImageRestore = !localStorage.getItem('ppp_image_restore_v1');

      try {
        const result = await syncContext.pullTeams();
        if (needsImageRestore) {
          console.log('[image-restore] pull result:', result ? 'ok' : 'null');
        }
        if (result && (needsImageRestore || result.version > (syncContext.identity?.localVersion || 0))) {
          // Server has newer data (or we need to restore images) - hydrate and set state
          if (needsImageRestore) {
            // Log image status from server data to help debug
            let total = 0, withImage = 0;
            result.teams?.teams?.forEach(t => t.sessions?.forEach(s => s.sections?.forEach(sec => {
              total++;
              if (sec.imageDataUrl) withImage++;
            })));
            console.log(`[image-restore] server sections: ${total} total, ${withImage} with imageDataUrl`);
          }
          teamsContext.loadTeamsFromServer(result.teams);
          if (needsImageRestore) {
            localStorage.setItem('ppp_image_restore_v1', '1');
          }
        }
      } catch (err) {
        console.error('Failed to check for server updates:', err);
      }
    };

    checkForServerUpdates();
  }, [teamsData, syncContext.isSyncEnabled, syncContext.isOnline]);

  // Pull on visibility change / window focus so a tab that was in the background
  // (or was left open from a prior session) reconciles with the server before the
  // user edits anything. Without this, a stale tab's next write trips a
  // version_conflict that can wipe newer work.
  useEffect(() => {
    if (!syncContext.isSyncEnabled) return;

    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!syncContext.isOnline) return;
      try {
        const result = await syncContext.pullTeams();
        if (result && result.version > (syncContext.identity?.localVersion || 0)) {
          teamsContext.loadTeamsFromServer(result.teams);
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
  }, [syncContext.isSyncEnabled, syncContext.isOnline, syncContext.identity?.localVersion]);

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
      const initialDiagram = useParentAsBase
        ? section?.diagramData || null
        : (variation?.diagramData || section?.diagramData || null);

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
        initialDiagram: section?.diagramData || null,
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
              onInitialize={async () => {
                await syncContext.initializeIdentity();
                if (teamsData) {
                  await syncContext.forcePush(teamsData);
                }
              }}
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
  // the nav-rail layout. Session Builder + Diagram Builder are fullscreen and
  // bypass this block above.
  return (
    <ViewErrorBoundary onRecover={navigateToTeams}>
      <div className="min-h-screen flex" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        <NavRail teamsContext={teamsContext} syncContext={syncContext} />
        <div className="flex-1 min-w-0">
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
            isSignedIn={Boolean(syncContext?.isSyncEnabled)}
          />
        )}
        {currentView === VIEWS.SETTINGS && (
          <Settings
            teamsContext={teamsContext}
            syncContext={syncContext}
            onShowLinkDevice={() => setShowLinkDeviceModal(true)}
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
          onInitialize={async () => {
            await syncContext.initializeIdentity();
            // Push current local teams to server
            if (teamsData) {
              await syncContext.forcePush(teamsData);
            }
          }}
          onReset={() => {
            syncContext.resetSync();
            setShowLinkDeviceModal(false);
            setLinkDeviceDefaultMode(null);
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
      </div>
    </ViewErrorBoundary>
  );
}

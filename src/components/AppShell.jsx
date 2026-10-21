import React, { useState, useEffect, Component } from 'react';
import useTeams from '../hooks/useTeams';
import useDiagramLibrary from '../hooks/useDiagramLibrary';
import useLibrary from '../hooks/useLibrary';
import useSync from '../hooks/useSync';
import useSharing from '../hooks/useSharing';
import useAccount from '../hooks/useAccount';
import { VIEWS } from '../constants/navigation';
import { HAS_SEEN_WELCOME_KEY } from '../constants/storage';
import { uploadDiagramImage } from '../utils/uploadImage';
import { startStore, useStore, startDemo, endDemo } from '../data/store';
import { buildDemoSnapshot } from '../data/demo';
import { findLocalData, importLocalData, findReturningCoach } from '../data/legacyImport';
import { currentUser } from '../data/api';
import { toast } from '../utils/helpers';
import TeamList from './teams/TeamList';
import TeamDetail from './teams/TeamDetail';
import SessionBuilder from './session-builder/SessionBuilder';
import DiagramBuilder from './DiagramPlayground';
import Library from './Library';
import Schedule from './Schedule';
import Settings from './Settings';
import Welcome from './Welcome';
import Community from './Community';
import playballIcon from '../assets/playball-icon.png';
import AboutModal from './AboutModal';
import AppHeader from './AppHeader';
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

  // One store for the whole tab; loads the server snapshot and keeps it fresh.
  useEffect(() => { startStore(); }, []);
  const storeStatus = useStore(st => st.status);
  const storeSource = useStore(st => st.source);

  // First sign-in in each browser: move everything this browser kept locally
  // before accounts (teams, sessions, library, diagrams, templates, favorites)
  // into the account, automatically. Create-only — the account's copy wins,
  // deleted items stay deleted (see data/legacyImport.js). Runs once per
  // account per browser; retried next load if the network dropped mid-way.
  useEffect(() => {
    if (storeStatus !== 'ready' || storeSource !== 'server') return;
    const userId = currentUser()?.id;
    if (!userId) return;
    const FLAG = `ppp_v3_local_import_${userId}`;
    try { if (localStorage.getItem(FLAG)) return; } catch { return; }
    try { localStorage.setItem(FLAG, 'running'); } catch { /* ignore */ }
    (async () => {
      const returning = await findReturningCoach().catch(() => null);
      const found = await findLocalData();
      const tally = found.total > 0 ? await importLocalData(found) : null;
      if (tally?.offline) {
        try { localStorage.removeItem(FLAG); } catch { /* ignore */ }
        toast("Couldn't finish bringing this browser's data into your account — will retry when you're back online.");
        return;
      }
      try { localStorage.setItem(FLAG, new Date().toISOString()); } catch { /* ignore */ }
      if (tally?.created) {
        toast(`Brought ${tally.created} item${tally.created === 1 ? '' : 's'} from this browser into your account.`, 4000);
      } else if (returning) {
        // Their data was already on the server (device sync) — still say so,
        // since the sign-in page was new to them.
        toast('Welcome back — your teams are saved to your account now.', 4000);
      }
      if (tally?.failed) {
        toast(`${tally.failed} item${tally.failed === 1 ? '' : 's'} couldn't be moved — see Settings.`, 6000);
      }
    })();
  }, [storeStatus, storeSource]);

  const teamsContext = useTeams();

  // Signing in (from the sign-in page, in this tab) lands on Training, not
  // wherever the previous session left off. A normal page load keeps its URL.
  const wasSignedOut = React.useRef(false);
  useEffect(() => {
    if (storeStatus === 'signed-out') { wasSignedOut.current = true; return; }
    if (storeStatus === 'ready' && wasSignedOut.current) {
      wasSignedOut.current = false;
      window.history.replaceState({ currentView: VIEWS.TEAMS }, '', '/');
      teamsContext.navigateToTeams();
    }
  }, [storeStatus, teamsContext]);
  const diagramLibrary = useDiagramLibrary();
  const libraryHook = useLibrary();
  const syncContext = useSync();
  const sharingContext = useSharing();
  const accountContext = useAccount();

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
  const [browsingCommunity, setBrowsingCommunity] = useState(() => initialUrl.path.startsWith('/community'));
  const [staticPage, setStaticPage] = useState(() => {
    if (initialUrl.path === '/privacy') return 'privacy';
    if (initialUrl.path === '/support') return 'support';
    if (initialUrl.path === '/double-booked') return 'double-booked';
    return null;
  });

  // Hidden/unlisted pages: keep them out of search results.
  useEffect(() => {
    if (staticPage !== 'double-booked') return;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, [staticPage]);

  // In the demo, every "save / share / sync" affordance leads to sign-up.
  const isDemo = useStore(st => st.demo);
  const goSignUp = () => { if (isDemo) endDemo(); };
  const demoBanner = isDemo ? (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full pl-4 pr-1.5 py-1.5 text-[13px]"
      style={{ background: 'var(--ink)', color: 'var(--bg)', boxShadow: 'var(--shadow-lg)' }}
    >
      <span>{accountContext.isSignedIn ? "You're viewing the demo team." : "Demo — nothing you change here is saved."}</span>
      <button className="btn btn-primary" style={{ padding: '4px 12px' }} onClick={endDemo}>
        {accountContext.isSignedIn ? 'Exit demo' : 'Create a free account'}
      </button>
    </div>
  ) : null;

  const {
    currentView,
    teamsData,
    selectedTeamId,
    selectedSessionId,
    selectedSectionId,
    selectedVariationId,
    editingDiagramId,
    getTeam,
    getSession,
    editSessionDraft,
    navigateToTeams,
    navigateBackFromDiagramBuilder,
  } = teamsContext;

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

  // Show PlayBall import landing page for /import?code=XXXXXX deep links
  if (importCode) {
    return <ImportLanding code={importCode} onDismiss={() => {
      setImportCode(null);
      window.history.replaceState({}, '', '/');
    }} />;
  }

  // Shared views are handled by SharedView component (routed in App.jsx)

  // Wait for teams data to load (cache or server). Without an identity there
  // is nothing to load — fall through to the Welcome / sync setup flow.
  if (!teamsData && storeStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        <div className="text-center max-w-sm px-6">
          <p className="mb-4" style={{ color: 'var(--ink-2)' }}>Couldn't reach PlayBall's server. Check your connection and try again.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }
  if ((!teamsData || !teamsContext.navReady) && storeStatus !== 'signed-out') {
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
          // Into the open session draft — saved with the session's Save button.
          editSessionDraft(selectedTeamId, selectedSessionId, { sections: updatedSections });

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
        editSessionDraft(selectedTeamId, selectedSessionId, { sections: updatedSections });

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
              <p className="text-slate-400 text-sm mb-8">Effective date: October 21, 2026</p>

              <p className="text-slate-300 leading-relaxed mb-6">
                PlayBall asks you to create an account for one reason: so your teams and practice plans are saved,
                and are there on every device you use. That is the only thing your information is used for.
                We do not sell it, share it, advertise with it, or analyze it.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">What we store</h2>
              <ul className="text-slate-300 space-y-2 list-disc list-inside">
                <li><strong className="text-white">Your email address</strong> — to sign you in. If you use Sign in with Google or Apple, we receive the email address (and name, if provided) that service shares. If you choose Apple&rsquo;s &ldquo;Hide My Email&rdquo;, we only see the relay address.</li>
                <li><strong className="text-white">What you create</strong> — teams, rosters, sessions, games, diagrams and library items — so they are available wherever you sign in. It stays private unless you share or publish it.</li>
              </ul>
              <p className="text-slate-300 leading-relaxed mt-4 mb-6">
                PlayBall never has a password for you. Sign-in happens through Google, Apple, or a one-time code emailed to you.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">What we don&rsquo;t do</h2>
              <ul className="text-slate-300 space-y-2 list-disc list-inside">
                <li>No advertising, and no advertising identifiers</li>
                <li>No analytics or tracking, and no third-party analytics SDKs</li>
                <li>No selling or sharing your data with anyone</li>
                <li>No emails other than the sign-in codes you ask for</li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">Sharing with your coaches</h2>
              <p className="text-slate-300 leading-relaxed mb-6">
                If you share a team, anyone with that link can view its sessions (read-only) until you turn sharing off.
                People viewing a shared link do not need an account, and we don&rsquo;t collect anything about them.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">Publishing to the Community</h2>
              <p className="text-slate-300 leading-relaxed mb-6">
                If you choose to publish a session, exercise or diagram, a copy becomes visible to anyone, signed in or not,
                and other coaches can add it to their own teams. Only its text and drawn diagrams are published, never images,
                and your name and email are not shown. You can unpublish at any time. We may remove published items that are
                reported or that we judge inappropriate.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">The PlayBall iOS app</h2>
              <p className="text-slate-300 leading-relaxed mb-6">
                The iOS app keeps your data on your device. If you share a team from the app with a share code,
                that team&rsquo;s data is sent to our servers so the code works.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">Where it lives</h2>
              <p className="text-slate-300 leading-relaxed mb-6">
                Your account and data are stored with our hosting providers, Supabase (database and sign-in) and
                Vercel (website and images), who process it only to run PlayBall.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">Deleting your data</h2>
              <p className="text-slate-300 leading-relaxed mb-6">
                Delete your account any time from Settings → Your account. That permanently removes your account and
                everything in it. You can also email us and we&rsquo;ll do it for you.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">Changes to this policy</h2>
              <p className="text-slate-300 leading-relaxed">
                If anything here changes, we&rsquo;ll update this page and the effective date above.
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
                    PlayBall stores only your sign-in email and what you create, and never sells or shares it. Read our <a href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</a>.
                  </p>
                </div>

                <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                  <h3 className="font-semibold text-white mb-1">Data & Deletion</h3>
                  <p className="text-slate-400 text-sm">On the web, your teams are stored in your PlayBall account. Delete your account from Settings → Your account to permanently remove it and everything in it, or email us. The iOS app keeps data on your device; delete the app to remove it.</p>
                </div>
              </div>
            </div>
          )}

          {staticPage === 'double-booked' && (
            <div className="max-w-none">
              <h1 className="text-3xl font-bold mb-2">Double-Booked</h1>
              <p className="text-slate-400 text-sm mb-8">
                Chrome / Edge extension — finds coaches booked for two games at once, or without
                time to drive between parks, straight from your VSA Otto schedule.
              </p>

              <a
                href="/downloads/double-booked-extension.zip"
                download
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download the extension (.zip)
              </a>

              <h2 className="text-xl font-semibold mt-10 mb-4">Install — takes 30 seconds</h2>
              <ol className="text-slate-300 space-y-3 list-decimal list-inside">
                <li>Download the .zip above and <strong className="text-white">unzip it</strong> (double-click it). You'll get a <code className="text-slate-200">double-booked-extension</code> folder — keep it somewhere permanent, not in Downloads.</li>
                <li>Open <code className="text-slate-200">chrome://extensions</code> (or <code className="text-slate-200">edge://extensions</code>).</li>
                <li>Turn on <strong className="text-white">Developer mode</strong> (top-right toggle).</li>
                <li>Click <strong className="text-white">Load unpacked</strong> and pick that folder.</li>
                <li>Go to <a href="https://vsa.ottosport.ai" className="text-blue-400 hover:text-blue-300">vsa.ottosport.ai</a> and log in. A green <strong className="text-white">⚽ Conflicts</strong> button appears at the bottom-right.</li>
              </ol>

              <h2 className="text-xl font-semibold mt-10 mb-4">Using it</h2>
              <div className="space-y-4">
                <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                  <h3 className="font-semibold text-white mb-1">Your own teams</h3>
                  <p className="text-slate-400 text-sm">Click <strong className="text-slate-200">⚽ Conflicts</strong>, then <strong className="text-slate-200">Find conflicts</strong>. Every clash across your teams, with times, parks, and the overlap or travel gap. Hit <strong className="text-slate-200">Refresh</strong> after a schedule change — no page reload needed.</p>
                </div>
                <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                  <h3 className="font-semibold text-white mb-1">Whole club, by coach</h3>
                  <p className="text-slate-400 text-sm">Switch to <strong className="text-slate-200">Whole club (by coach)</strong>, open a season's full team list in Otto, click <strong className="text-slate-200">Add teams on this page</strong>, then <strong className="text-slate-200">Find conflicts</strong>. Only returns teams your Otto account can see — run it under the director / registrar login for full coverage.</p>
                </div>
                <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                  <h3 className="font-semibold text-white mb-1">Updating</h3>
                  <p className="text-slate-400 text-sm">Download the new .zip, replace the folder's files, then click the ↻ refresh icon on the extension's card in chrome://extensions.</p>
                </div>
              </div>

              <p className="text-slate-500 text-sm mt-10 pt-6 border-t border-slate-700">
                Runs entirely in your browser — it reads the Otto page you're already logged into,
                and no data leaves your machine. Unlisted page; share the link directly.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Signed out → the front door: sign in (no passwords) or try the demo.
  // The public Community is browsable without an account at /community.
  if (storeStatus === 'signed-out' && browsingCommunity) {
    const goSignIn = () => { window.history.pushState({}, '', '/'); setBrowsingCommunity(false); };
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        <header className="flex items-center gap-3 px-6 py-3" style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-elev)' }}>
          <button onClick={goSignIn} className="flex items-center gap-2.5" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <img src={playballIcon} alt="" style={{ width: 28, height: 28, borderRadius: 8 }} />
            <span className="font-bold">PlayBall</span>
          </button>
          <span className="text-[13px]" style={{ color: 'var(--ink-3)' }}>Community</span>
          <div className="flex-1" />
          <button className="btn btn-primary" onClick={goSignIn}>Sign in to add</button>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-[32px] font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Community</h1>
          <p className="text-[14px] mb-6" style={{ color: 'var(--ink-2)' }}>
            Sessions, exercises and diagrams shared by PlayBall coaches. Sign in to add any of them to your team.
          </p>
          <Community onSignIn={goSignIn} createSessionOnTeam={() => {}} />
        </main>
      </div>
    );
  }
  if (storeStatus === 'signed-out') {
    return (
      <Welcome
        onBrowseCommunity={() => { window.history.pushState({}, '', '/community'); setBrowsingCommunity(true); }}
        accountContext={accountContext}
        onStartDemo={() => {
          startDemo(buildDemoSnapshot());
          teamsContext.navigateToTeams();
        }}
      />
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
          {demoBanner}
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
            onShowLinkDevice={goSignUp}
          />
          {demoBanner}
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
            onShowLinkDevice={goSignUp}
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
            onShowSignIn={goSignUp}
            onShowLinkDevice={goSignUp}
          />
        )}
        {currentView === VIEWS.SETTINGS && (
          <Settings
            teamsContext={teamsContext}
            syncContext={syncContext}
            accountContext={accountContext}
            libraryHook={libraryHook}
            diagramLibrary={diagramLibrary}
            onShowLinkDevice={goSignUp}
            onShowAccount={goSignUp}
          />
        )}
        </div>

      {demoBanner}

      {showAboutModal && (
        <AboutModal
          onClose={() => setShowAboutModal(false)}
          onRestartTutorial={() => {
            setShowAboutModal(false);
            // Replay the demo team; "Exit demo" brings the coach's own data back.
            startDemo(buildDemoSnapshot());
            teamsContext.navigateToTeams();
          }}
        />
      )}
      </div>
    </ViewErrorBoundary>
  );
}

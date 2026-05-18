import React, { useState } from 'react';
import { COACH_IDENTITY_KEY } from '../constants/storage';

// Settings → Sync diagnostics. Fetches server-side state for the current
// coach and compares it to the local data the app is holding. Helps diagnose
// "I created X on device A but device B doesn't see it" without needing curl.
//
// Visible on preview deployments, localhost, and dev — hidden on the prod
// host so end-user coaches don't see it. Set localStorage flag
// `ppp_show_diagnostics='1'` to force it on for an emergency prod debug.

const PROD_HOSTS = new Set(['getplayball.app', 'www.getplayball.app']);

export function isDiagnosticsVisible() {
  try {
    if (localStorage.getItem('ppp_show_diagnostics') === '1') return true;
  } catch { /* ignore */ }
  if (typeof window === 'undefined') return false;
  return !PROD_HOSTS.has(window.location.hostname);
}

function syncHeaders() {
  try {
    const raw = localStorage.getItem(COACH_IDENTITY_KEY);
    if (!raw) return null;
    const id = JSON.parse(raw);
    if (!id?.coachId || !id?.deviceId) return null;
    return {
      'x-coach-id': id.coachId,
      'x-device-id': id.deviceId,
    };
  } catch { return null; }
}

function getIdentity() {
  try {
    const raw = localStorage.getItem(COACH_IDENTITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function Row({ label, local, server, hint }) {
  const drift = Number(local) !== Number(server);
  return (
    <div
      className="flex items-center gap-3 py-2"
      style={{ borderBottom: '1px solid var(--line)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{label}</div>
        {hint && <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>{hint}</div>}
      </div>
      <div className="flex items-center gap-3 font-mono text-[12.5px]">
        <span style={{ color: drift ? 'var(--warn)' : 'var(--ink)' }}>{local}</span>
        <span style={{ color: 'var(--ink-3)' }}>local</span>
        <span style={{ color: 'var(--ink-3)' }}>·</span>
        <span style={{ color: drift ? 'var(--warn)' : 'var(--ink)' }}>{server}</span>
        <span style={{ color: 'var(--ink-3)' }}>server</span>
      </div>
    </div>
  );
}

export default function SyncDiagnostics({ teamsContext, libraryHook, diagramLibrary, syncContext }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!syncContext?.isSyncEnabled) return null;
  if (!isDiagnosticsVisible()) return null;

  const run = async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    setCopied(false);

    const headers = syncHeaders();
    if (!headers) {
      setError('No coach identity in localStorage. Is sync actually on?');
      setLoading(false);
      return;
    }

    const identity = getIdentity();

    const fetchJson = async (url) => {
      try {
        const res = await fetch(url, { headers });
        const body = await res.json();
        return { ok: res.ok, status: res.status, body };
      } catch (err) {
        return { ok: false, status: 0, body: { error: err.message } };
      }
    };

    const [coach, libExercises, libSessions, diagrams] = await Promise.all([
      fetchJson(`/api/v2/coaches/${encodeURIComponent(identity.coachId)}`),
      fetchJson('/api/v2/library/exercises'),
      fetchJson('/api/v2/library/sessions'),
      fetchJson('/api/v2/diagrams'),
    ]);

    const localTeams = teamsContext?.teamsData?.teams || [];
    const localSessions = localTeams.flatMap(t => t.sessions || []);
    const localLibExercises = libraryHook?.exercises?.items || [];
    const localLibSessions = libraryHook?.sessions?.items || [];
    const localDiagrams = diagramLibrary?.diagrams || [];

    const next = {
      identity: {
        coachId: identity?.coachId,
        deviceId: identity?.deviceId,
        localVersion: identity?.localVersion,
        lastSyncAt: identity?.lastSyncAt,
      },
      counts: {
        teams: { local: localTeams.length, server: (coach.body?.teams || []).length },
        sessions: { local: localSessions.length, server: (coach.body?.sessions || []).length },
        libraryExercises: { local: localLibExercises.length, server: (libExercises.body?.items || []).length },
        librarySessions: { local: localLibSessions.length, server: (libSessions.body?.items || []).length },
        diagrams: { local: localDiagrams.length, server: (diagrams.body?.diagrams || []).length },
      },
      // Cherry-pick small samples to compare — full bodies are too big to read.
      sampleIds: {
        localTeams: localTeams.map(t => t.id).slice(0, 10),
        serverTeams: (coach.body?.teams || []).map(t => t.id).slice(0, 10),
        localSessions: localSessions.map(s => s.id).slice(0, 10),
        serverSessions: (coach.body?.sessions || []).map(s => s.id).slice(0, 10),
        localDiagrams: localDiagrams.map(d => d.id).slice(0, 10),
        serverDiagrams: (diagrams.body?.diagrams || []).map(d => d.id).slice(0, 10),
      },
      responses: {
        coachStatus: coach.status,
        libExercisesStatus: libExercises.status,
        libSessionsStatus: libSessions.status,
        diagramsStatus: diagrams.status,
      },
    };
    setReport(next);
    setLoading(false);
  };

  const copyJson = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(`Copy failed: ${err.message}`);
    }
  };

  return (
    <section>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-left"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--ink-3)', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 120ms' }}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="eyebrow" style={{ marginBottom: 0 }}>SYNC DIAGNOSTICS</span>
      </button>

      {open && (
        <div className="mt-3">
          <p className="text-[12.5px] mb-3" style={{ color: 'var(--ink-2)' }}>
            Compares what&rsquo;s in this browser to what the server has for your coach id. Mismatches highlight the gap.
          </p>

          <div className="flex items-center gap-2 mb-3">
            <button onClick={run} disabled={loading} className="btn btn-secondary">
              {loading ? 'Checking…' : report ? 'Re-check' : 'Run check'}
            </button>
            {report && (
              <button onClick={copyJson} className="btn btn-ghost" style={{ fontSize: 12.5 }}>
                {copied ? 'Copied!' : 'Copy JSON'}
              </button>
            )}
          </div>

          {error && (
            <div
              className="mb-3 p-3 rounded-[10px] text-[12.5px]"
              style={{
                background: 'rgb(var(--danger-rgb) / 0.1)',
                border: '1px solid rgb(var(--danger-rgb) / 0.3)',
                color: 'var(--danger)',
              }}
            >
              {error}
            </div>
          )}

          {report && (
            <div className="card p-4">
              <div className="text-[11.5px] font-mono uppercase mb-3" style={{ color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                COACH {report.identity.coachId?.slice(0, 12)}… · DEVICE {report.identity.deviceId?.slice(0, 8)}…
              </div>
              <Row
                label="Teams"
                local={report.counts.teams.local}
                server={report.counts.teams.server}
              />
              <Row
                label="Sessions"
                local={report.counts.sessions.local}
                server={report.counts.sessions.server}
              />
              <Row
                label="Library — exercises"
                local={report.counts.libraryExercises.local}
                server={report.counts.libraryExercises.server}
              />
              <Row
                label="Library — sessions"
                local={report.counts.librarySessions.local}
                server={report.counts.librarySessions.server}
              />
              <Row
                label="Diagrams (standalone library)"
                local={report.counts.diagrams.local}
                server={report.counts.diagrams.server}
                hint="Known gap: diagram library is local-only today."
              />

              <div className="mt-3 text-[11px] font-mono" style={{ color: 'var(--ink-3)' }}>
                HTTP — coaches:{report.responses.coachStatus} libExercises:{report.responses.libExercisesStatus} libSessions:{report.responses.libSessionsStatus} diagrams:{report.responses.diagramsStatus}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

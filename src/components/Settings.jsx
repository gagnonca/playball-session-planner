import React, { useState, useEffect } from 'react';
import AppearancePicker from './AppearancePicker';
import AIAssistantSection from './AIAssistantSection';
import SyncDiagnostics, { isDiagnosticsVisible } from './SyncDiagnostics';

// Settings — Appearance, Cloud sync, Storage, Account, Privacy.
// Reads existing hooks. No new API surface; sync/account actions defer
// to the LinkDeviceModal flow already wired into AppShell.

const TEAM_TONES = ['#c8553d', '#3d7a4a', '#3d5a8a', '#9a5a3a', '#6a4a8a', '#3a6a7a'];
function teamTone(team) {
  if (team?.color) return team.color;
  const key = team?.id || team?.name || '';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TEAM_TONES[h % TEAM_TONES.length];
}

function useStorageEstimate() {
  const [estimate, setEstimate] = useState({ used: 0, quota: 0, ready: false });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (navigator.storage?.estimate) {
        try {
          const r = await navigator.storage.estimate();
          if (cancelled) return;
          setEstimate({ used: r.usage || 0, quota: r.quota || 0, ready: true });
        } catch {
          if (!cancelled) setEstimate(e => ({ ...e, ready: true }));
        }
      } else {
        setEstimate(e => ({ ...e, ready: true }));
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return estimate;
}

function formatBytes(n) {
  if (!n || n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

function SyncStateLine({ status, online }) {
  const tone = !online ? 'var(--ink-3)' : status === 'syncing' ? 'var(--warn)' : status === 'error' ? 'var(--danger)' : 'var(--good)';
  const label = !online ? 'Offline' : status === 'syncing' ? 'Syncing now' : status === 'error' ? 'Sync error' : 'Up to date';
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--ink-2)', fontSize: 12.5 }}>
      <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: tone }} />
      {label}
    </span>
  );
}

function TierRow({ active, completed, title, body, cta }) {
  return (
    <div
      className="card p-4 flex items-center gap-4 flex-wrap"
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--line)',
        boxShadow: active ? '0 0 0 3px rgb(var(--accent-rgb) / 0.12)' : 'var(--shadow-sm)',
      }}
    >
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
        style={{
          background: active ? 'var(--accent)' : completed ? 'rgb(var(--good-rgb) / 0.18)' : 'var(--bg-sunken)',
          color: active ? 'var(--accent-ink)' : completed ? 'var(--good)' : 'var(--ink-3)',
          border: active ? 'none' : '1px solid var(--line)',
        }}
      >
        {completed && !active ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : active ? (
          <span className="rounded-full" style={{ width: 8, height: 8, background: 'var(--accent-ink)' }} />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-semibold" style={{ letterSpacing: '-0.015em' }}>
          {title}
          {active && (
            <span className="ml-2 font-mono uppercase" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em' }}>
              · Current
            </span>
          )}
        </div>
        <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-2)' }}>{body}</div>
      </div>
      {cta && <div className="flex-shrink-0">{cta}</div>}
    </div>
  );
}

export default function Settings({ teamsContext, syncContext, accountContext, libraryHook, diagramLibrary, onShowLinkDevice, onShowAccount }) {
  const teams = teamsContext?.teamsData?.teams || [];
  const syncOn = Boolean(syncContext?.isSyncEnabled);
  const isOnline = syncContext?.isOnline ?? true;
  const syncStatus = syncContext?.syncStatus || 'idle';
  const hasAccount = Boolean(accountContext?.isSignedIn);
  const accountEmail = accountContext?.account?.email || '';

  // Downgrade helpers — confirm before destructive transitions
  const unlinkThisDevice = () => {
    if (window.confirm('Unlink this device from cloud sync? Other linked devices keep their data, and your local copy on this device stays here.')) {
      syncContext?.resetSync?.();
    }
  };
  const signOutOfAccount = () => {
    if (window.confirm('Sign out? Cloud sync stays on; you can sign back in any time.')) {
      accountContext?.signOut?.();
    }
  };

  const storage = useStorageEstimate();
  const usedPct = storage.quota > 0 ? Math.min(100, Math.round((storage.used / storage.quota) * 100)) : 0;
  const lowStorage = usedPct >= 70;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <main className="max-w-3xl mx-auto px-6 pt-10 pb-16">
        <div className="eyebrow mb-2">SETTINGS</div>
        <h1 className="text-[40px] font-semibold leading-[1.04]" style={{ letterSpacing: '-0.02em' }}>
          How PlayBall fits you.
        </h1>
        <p className="mt-2 text-[14.5px] max-w-[540px]" style={{ color: 'var(--ink-2)' }}>
          Theme, sync, sharing — all optional. The app works without an account; turn things on as you need them.
        </p>

        <div className="hairline my-8" />

        {/* Appearance */}
        <AppearancePicker />

        <div className="hairline my-8" />

        {/* Sync + Account progression — three tiers the user can move through */}
        <section>
          <div className="eyebrow mb-2">YOUR ACCOUNT</div>
          <h2 className="text-[20px] font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>
            {hasAccount ? 'Signed in' : syncOn ? 'Synced across devices' : 'On this device only'}
          </h2>
          <p className="text-[13px] mb-4 max-w-[540px]" style={{ color: 'var(--ink-2)' }}>
            PlayBall meets you where you are. Start as a guest; turn on cloud sync when you want a second device; add a free account when you want discovery and recovery.
          </p>

          <div className="flex flex-col gap-2">
            {/* Tier 1 — On this device */}
            <TierRow
              tier="offline"
              active={!syncOn && !hasAccount}
              completed={syncOn || hasAccount}
              title="On this device"
              body={
                !syncOn && !hasAccount
                  ? 'No account, no tracking — your work lives in this browser.'
                  : 'Available any time. Unlink this device to go back to local-only.'
              }
              cta={
                (syncOn || hasAccount) ? (
                  hasAccount ? null : (
                    <button
                      onClick={unlinkThisDevice}
                      className="btn btn-ghost"
                      style={{ color: 'var(--danger)' }}
                    >
                      Switch back
                    </button>
                  )
                ) : null
              }
            />

            {/* Tier 2 — Cloud sync */}
            <TierRow
              tier="sync"
              active={syncOn && !hasAccount}
              completed={hasAccount}
              title="Cloud sync"
              body={
                syncOn
                  ? <SyncStateLine status={syncStatus} online={isOnline} />
                  : 'Pair another device with a one-time code and they stay in lockstep.'
              }
              cta={
                hasAccount ? (
                  <span
                    className="font-mono uppercase"
                    style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em' }}
                  >
                    On with account
                  </span>
                ) : syncOn ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => onShowLinkDevice && onShowLinkDevice()} className="btn btn-secondary">
                      Manage devices
                    </button>
                  </div>
                ) : (
                  <button onClick={() => onShowLinkDevice && onShowLinkDevice()} className="btn btn-primary">
                    Turn on sync
                  </button>
                )
              }
            />

            {/* Tier 3 — Free account */}
            <TierRow
              tier="account"
              active={hasAccount}
              completed={false}
              title="Free account"
              body={
                hasAccount
                  ? <span style={{ color: 'var(--ink-2)' }}>Signed in as <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{accountEmail}</span></span>
                  : 'Discover other coaches’ sessions and recover your library if you lose every device. Anonymous coach id stays the only identifier we hold.'
              }
              cta={
                hasAccount ? (
                  <button
                    onClick={signOutOfAccount}
                    className="btn btn-ghost"
                    style={{ color: 'var(--danger)' }}
                  >
                    Sign out
                  </button>
                ) : (
                  <button onClick={() => onShowAccount && onShowAccount()} className="btn btn-primary">
                    Create account
                  </button>
                )
              }
            />
          </div>
        </section>

        {(syncOn || hasAccount) && <div className="hairline my-8" />}

        {/* Teams & co-coaches — only meaningful once sync (or an account) is on */}
        {(syncOn || hasAccount) && (
        <section>
          <div className="eyebrow mb-2">TEAMS &amp; CO-COACHES</div>
          <h2 className="text-[20px] font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Share a whole team</h2>
          <p className="text-[13px] mb-4" style={{ color: 'var(--ink-2)' }}>
            Share an entire team with another coach and they&rsquo;ll see every session you build for it. Manage per-team sharing here.
          </p>
          {teams.length === 0 ? (
            <div className="card p-5 text-center" style={{ color: 'var(--ink-2)' }}>
              <p className="text-[13.5px]">Create a team first to enable sharing.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {teams.map(t => {
                const shared = Boolean(t.sharing?.isShared);
                const tone = teamTone(t);
                return (
                  <button
                    key={t.id}
                    onClick={() => teamsContext.navigateToTeamDetail(t.id)}
                    className="card card-hover p-3.5 flex items-center gap-3.5 text-left"
                  >
                    <div
                      className="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center font-semibold text-[12px]"
                      style={{ background: tone, color: '#fff', letterSpacing: '-0.01em' }}
                    >
                      {t.ageGroup || (t.name ? t.name.slice(0, 2).toUpperCase() : '·')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold truncate" style={{ letterSpacing: '-0.015em' }}>{t.name}</div>
                      <div className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                        {shared ? 'You + co-coaches with the link' : 'Just you'}
                      </div>
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]"
                      style={{
                        background: shared ? 'var(--accent-soft)' : 'var(--bg-sunken)',
                        color: shared ? 'var(--accent)' : 'var(--ink-3)',
                      }}
                    >
                      {shared ? (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 00-3-3.87M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M16 3.13a4 4 0 010 7.75" />
                          </svg>
                          Shared
                        </>
                      ) : (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="11" width="16" height="10" rx="2" />
                            <path d="M8 11V7a4 4 0 018 0v4" />
                          </svg>
                          Private
                        </>
                      )}
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--ink-3)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </section>
        )}

        <div className="hairline my-8" />

        {/* On this device */}
        <section>
          <div className="eyebrow mb-2">ON THIS DEVICE</div>
          <h2 className="text-[20px] font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Storage</h2>
          <p className="text-[13px] mb-3" style={{ color: 'var(--ink-2)' }}>
            {storage.ready
              ? lowStorage
                ? 'Running low. Turn on cloud sync to keep building without losing anything.'
                : 'Plenty of room. Diagrams and notes live in your browser until you turn on sync.'
              : 'Checking how much space PlayBall is using…'}
          </p>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                {storage.ready && storage.quota > 0
                  ? `${formatBytes(storage.used)} of ${formatBytes(storage.quota)} used`
                  : 'Storage usage unavailable'}
              </span>
              <span className="font-mono uppercase" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                {storage.quota > 0 ? `${usedPct}%` : '—'}
              </span>
            </div>
            <div
              className="rounded-full overflow-hidden"
              style={{ height: 6, background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}
            >
              <div
                style={{
                  width: `${Math.max(2, usedPct)}%`,
                  height: '100%',
                  background: lowStorage ? 'var(--warn)' : 'var(--accent)',
                  transition: 'width 240ms ease',
                }}
              />
            </div>
          </div>
        </section>

        <div className="hairline my-8" />

        {/* AI Assistant */}
        <AIAssistantSection />

        {syncOn && isDiagnosticsVisible() && (
          <>
            <div className="hairline my-8" />
            <SyncDiagnostics
              teamsContext={teamsContext}
              libraryHook={libraryHook}
              diagramLibrary={diagramLibrary}
              syncContext={syncContext}
            />
          </>
        )}

        <div className="hairline my-8" />

        {/* Privacy */}
        <section>
          <div className="eyebrow mb-2">WHAT WE COLLECT</div>
          <h2 className="text-[20px] font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Nothing, unless you opt in.</h2>
          <p className="text-[13px] mb-3 max-w-[540px]" style={{ color: 'var(--ink-2)' }}>
            By default, nothing leaves your browser. When you turn on cloud sync or share a team, the relevant data is sent to our servers
            so the feature can work &mdash; that&rsquo;s it. No analytics, no tracking, no email collection.
          </p>
          <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
            Read the full <a href="/privacy" style={{ color: 'var(--accent)' }}>privacy policy</a>.
          </p>
        </section>
      </main>
    </div>
  );
}

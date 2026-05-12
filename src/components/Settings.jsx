import React, { useState, useEffect } from 'react';
import AppearancePicker from './AppearancePicker';

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

export default function Settings({ teamsContext, syncContext, onShowLinkDevice }) {
  const teams = teamsContext?.teamsData?.teams || [];
  const syncOn = Boolean(syncContext?.isSyncEnabled);
  const isOnline = syncContext?.isOnline ?? true;
  const syncStatus = syncContext?.syncStatus || 'idle';

  const storage = useStorageEstimate();
  const usedPct = storage.quota > 0 ? Math.min(100, Math.round((storage.used / storage.quota) * 100)) : 0;
  const lowStorage = usedPct >= 70;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <main className="max-w-3xl mx-auto px-6 pt-10 pb-16">
        <div className="overline mb-2">SETTINGS</div>
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

        {/* Teams & co-coaches */}
        <section>
          <div className="overline mb-2">TEAMS &amp; CO-COACHES</div>
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

        <div className="hairline my-8" />

        {/* On this device */}
        <section>
          <div className="overline mb-2">ON THIS DEVICE</div>
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

        {/* Cloud sync */}
        <section>
          <div className="overline mb-2">CLOUD SYNC</div>
          <h2 className="text-[20px] font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>
            Cloud sync is {syncOn ? 'on' : 'off'}
          </h2>
          <p className="text-[13px] mb-4" style={{ color: 'var(--ink-2)' }}>
            {syncOn
              ? 'Your teams sync between every device that joined with the same pairing code.'
              : 'Everything stays here until you turn this on. Pair a new device to enable.'}
          </p>
          <div className="card p-4 flex items-center gap-4 flex-wrap">
            <div
              className="flex-shrink-0 w-11 h-11 rounded-[11px] flex items-center justify-center"
              style={{ background: syncOn ? 'var(--accent-soft)' : 'var(--bg-sunken)', color: syncOn ? 'var(--accent)' : 'var(--ink-2)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold" style={{ letterSpacing: '-0.015em' }}>
                {syncOn ? 'Connected' : 'Not connected'}
              </div>
              {syncOn ? (
                <div className="text-[12.5px] inline-flex items-center gap-1.5" style={{ color: 'var(--ink-2)' }}>
                  <span
                    className="inline-block rounded-full"
                    style={{
                      width: 8,
                      height: 8,
                      background:
                        syncStatus === 'syncing' ? 'var(--warn)' :
                        syncStatus === 'error' ? 'var(--danger)' :
                        !isOnline ? 'var(--ink-3)' : 'var(--good)',
                    }}
                  />
                  {syncStatus === 'syncing' ? 'Syncing now' : syncStatus === 'error' ? 'Sync error' : !isOnline ? 'Offline' : 'Up to date'}
                </div>
              ) : (
                <div className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                  Pair a device to link this browser to the cloud.
                </div>
              )}
            </div>
            <button
              onClick={() => onShowLinkDevice && onShowLinkDevice()}
              className={syncOn ? 'btn btn-secondary' : 'btn btn-primary'}
            >
              {syncOn ? 'Manage devices' : 'Turn on cloud sync'}
            </button>
          </div>
        </section>

        <div className="hairline my-8" />

        {/* Account */}
        <section>
          <div className="overline mb-2">ACCOUNT (OPTIONAL)</div>
          <h2 className="text-[20px] font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>
            {syncOn ? 'Signed in as a coach' : 'No account required'}
          </h2>
          <p className="text-[13px] mb-4 max-w-[540px]" style={{ color: 'var(--ink-2)' }}>
            PlayBall works without an account. An account adds discovery (other coaches&rsquo; sessions) and recovery if you lose your devices.
            We don&rsquo;t collect names or emails &mdash; sync identity is an anonymous coach id.
          </p>
          <div className="card p-4 flex items-center gap-4 flex-wrap">
            <div
              className="flex-shrink-0 w-11 h-11 rounded-[11px] flex items-center justify-center font-semibold"
              style={{ background: 'var(--ink)', color: 'var(--bg)', fontSize: 14 }}
            >
              {syncOn ? 'C' : 'G'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold" style={{ letterSpacing: '-0.015em' }}>
                {syncOn ? 'Coach' : 'Guest'}
              </div>
              <div className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                {syncOn ? 'Sync is on — every device with your pairing sees the same teams.' : 'You&rsquo;re using PlayBall as a guest.'}
              </div>
            </div>
            {syncOn ? (
              <button
                onClick={() => {
                  if (window.confirm('Reset sync identity? This unlinks every device from this account; your local data stays here.')) {
                    syncContext?.resetSync?.();
                  }
                }}
                className="btn btn-ghost"
                style={{ color: 'var(--danger)' }}
              >
                Reset sync
              </button>
            ) : (
              <button onClick={() => onShowLinkDevice && onShowLinkDevice()} className="btn btn-secondary">
                Pair an existing device
              </button>
            )}
          </div>
        </section>

        <div className="hairline my-8" />

        {/* Privacy */}
        <section>
          <div className="overline mb-2">WHAT WE COLLECT</div>
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

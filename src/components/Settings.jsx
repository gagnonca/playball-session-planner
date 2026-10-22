import React, { useState, useEffect } from 'react';
import AppearancePicker from './AppearancePicker';
import AIAssistantSection from './AIAssistantSection';
import { findLocalData, importLocalData } from '../data/legacyImport';
import { downloadJson, toast } from '../utils/helpers';

// Settings — Appearance, Account (sign out / delete), sharing, AI, Privacy.

const TEAM_TONES = ['#c8553d', '#3d7a4a', '#3d5a8a', '#9a5a3a', '#6a4a8a', '#3a6a7a'];
function teamTone(team) {
  if (team?.color) return team.color;
  const key = team?.id || team?.name || '';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TEAM_TONES[h % TEAM_TONES.length];
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

// Before v3 every browser kept its own copy of the data. If this browser still
// holds anything the server never got (e.g. edits from a tab that never
// flushed), offer to upload it. Nothing appears when there's nothing to recover.
function LegacyDataPanel() {
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    findLocalData().then(f => { if (alive) setFound(f); });
    return () => { alive = false; };
  }, []);
  if (!found || found.total === 0) return null;

  const parts = [
    found.teams.length && `${found.teams.length} team${found.teams.length === 1 ? '' : 's'}`,
    found.sessions.length && `${found.sessions.length} session${found.sessions.length === 1 ? '' : 's'}`,
    found.exercises.length && `${found.exercises.length} library exercise${found.exercises.length === 1 ? '' : 's'}`,
    found.librarySessions.length && `${found.librarySessions.length} library session${found.librarySessions.length === 1 ? '' : 's'}`,
    found.diagrams.length && `${found.diagrams.length} diagram${found.diagrams.length === 1 ? '' : 's'}`,
    found.templates?.length && `${found.templates.length} template${found.templates.length === 1 ? '' : 's'}`,
    found.favorites?.length && `${found.favorites.length} favorite${found.favorites.length === 1 ? '' : 's'}`,
  ].filter(Boolean);

  return (
    <div className="card p-5 mb-8" style={{ borderColor: 'var(--warn)' }}>
      <div className="font-semibold mb-1">Found data only in this browser</div>
      <p className="text-[13px] mb-3" style={{ color: 'var(--ink-2)' }}>
        This browser still has {parts.join(', ')} that your account isn't showing. Usually
        that's because the account already had (or deleted) them, and those are skipped on upload.
      </p>
      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const tally = await importLocalData(found);
            setBusy(false);
            setFound({ ...found, total: 0 });
            toast(tally.failed || tally.offline
              ? `Uploaded ${tally.created}; ${tally.failed + tally.offline} couldn't be uploaded.`
              : `Uploaded ${tally.created} item${tally.created === 1 ? '' : 's'}.`);
          }}
        >
          {busy ? 'Uploading…' : 'Upload to my account'}
        </button>
        <button className="btn btn-secondary" onClick={() => downloadJson('playball-browser-backup.json', found)}>
          Download a copy
        </button>
      </div>
    </div>
  );
}

export default function Settings({ teamsContext, syncContext, accountContext, onShowAccount }) {
  const teams = teamsContext?.teamsData?.teams || [];
  const syncOn = Boolean(syncContext?.isSyncEnabled);
  const isOnline = syncContext?.isOnline ?? true;
  const syncStatus = syncContext?.syncStatus || 'idle';
  const hasAccount = Boolean(accountContext?.isSignedIn);
  const accountEmail = accountContext?.account?.email || '';

  const isDemo = Boolean(syncContext?.isDemo);
  const [deleting, setDeleting] = useState(false);

  const signOutOfAccount = () => {
    if (window.confirm('Sign out of PlayBall on this device?')) accountContext?.signOut?.();
  };
  const deleteAccount = async () => {
    const typed = window.prompt(
      'This permanently deletes your account and every team, session, game, library item and diagram in it. ' +
      'Share links stop working. This cannot be undone.\n\nType DELETE to confirm.'
    );
    if (typed !== 'DELETE') return;
    setDeleting(true);
    try {
      await accountContext.deleteAccount();
      toast('Account deleted');
    } catch (e) {
      toast(`Couldn't delete account — ${e.message}`);
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <main className="max-w-3xl mx-auto px-6 pt-10 pb-16">
        <div className="eyebrow mb-2">SETTINGS</div>
        <h1 className="text-[30px] md:text-[40px] font-semibold leading-[1.04]" style={{ letterSpacing: '-0.02em' }}>
          How PlayBall fits you.
        </h1>
        <p className="mt-2 text-[14.5px] max-w-[540px]" style={{ color: 'var(--ink-2)' }}>
          Your account, sharing, and how PlayBall looks.
        </p>

        <div className="hairline my-8" />

        {/* Appearance */}
        <AppearancePicker />

        <div className="hairline my-8" />

        <section>
          <div className="eyebrow mb-2">YOUR ACCOUNT</div>
          {hasAccount && !isDemo ? (
            <>
              <h2 className="text-[20px] font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Signed in</h2>
              <p className="text-[13px] mb-4" style={{ color: 'var(--ink-2)' }}>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{accountEmail}</span>
                {accountContext?.account?.provider && accountContext.account.provider !== 'email'
                  ? ` · via ${accountContext.account.provider[0].toUpperCase()}${accountContext.account.provider.slice(1)}`
                  : ''}
                {' · '}<SyncStateLine status={syncStatus} online={isOnline} />
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={signOutOfAccount} className="btn btn-secondary">Sign out</button>
                <button onClick={deleteAccount} disabled={deleting} className="btn btn-ghost" style={{ color: 'var(--danger)' }}>
                  {deleting ? 'Deleting…' : 'Delete account and all data'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-[20px] font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>You're in the demo</h2>
              <p className="text-[13px] mb-4" style={{ color: 'var(--ink-2)' }}>
                Create a free account to keep your teams and use them on every device.
              </p>
              <button onClick={() => onShowAccount && onShowAccount()} className="btn btn-primary">Create account</button>
            </>
          )}
        </section>

        {syncOn && <div className="hairline my-8" />}

        {syncOn && <LegacyDataPanel />}

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

        {/* AI Assistant */}
        <AIAssistantSection />

        <div className="hairline my-8" />

        {/* Privacy */}
        <section>
          <div className="eyebrow mb-2">WHAT WE COLLECT</div>
          <h2 className="text-[20px] font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Only what it takes to run your account.</h2>
          <p className="text-[13px] mb-3 max-w-[540px]" style={{ color: 'var(--ink-2)' }}>
            Your email (to sign you in) and the teams, sessions and diagrams you create (so they&rsquo;re on all your devices).
            We never sell, share or analyze it, and there&rsquo;s no advertising or tracking. Delete your account above and it&rsquo;s gone.
          </p>
          <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
            Read the full <a href="/privacy" style={{ color: 'var(--accent)' }}>privacy policy</a>.
          </p>
        </section>
      </main>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../data/api';
import { load } from '../data/store';
import { fetchSetup, markSetupSeen } from '../data/accountSetup';
import { toast } from '../utils/helpers';

// "Your teams" — the account setup screen, the web twin of the iPhone app's.
// Shown once after sign-in when there's something to settle (no coach name
// yet, or a team made in the iPhone app that looks like one of the web teams
// holding its practice sessions), and any time from Settings → Review teams.

function counts(t) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return [
    t.players > 0 && plural(t.players, 'player'),
    t.games > 0 && plural(t.games, 'game'),
    t.sessions > 0 && plural(t.sessions, 'session'),
  ].filter(Boolean).join(' · ') || 'Empty';
}

function AppBadge() {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
    >
      iPhone app
    </span>
  );
}

function TeamLine({ team, trailing }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold truncate" style={{ letterSpacing: '-0.015em' }}>{team.name}</span>
          {team.fromApp && <AppBadge />}
        </div>
        <div className="text-[12px]" style={{ color: 'var(--ink-2)' }}>{counts(team)}</div>
      </div>
      {trailing}
    </div>
  );
}

// One team made in the iPhone app: keep it as its own team, or fold its
// roster and games into a web team (usually the one holding its sessions).
function AppTeamCard({ team, webTeams, choice, onChange }) {
  const target = webTeams.find(t => t.id === choice.into);
  return (
    <div className="card p-4">
      <TeamLine team={team} />
      <select
        className="input-field mt-2"
        aria-label={`What to do with ${team.name}`}
        value={choice.into || ''}
        onChange={(e) => onChange({ ...choice, into: e.target.value || null })}
      >
        <option value="">Keep as its own team</option>
        {webTeams.map(t => (
          <option key={t.id} value={t.id}>Merge into {t.name} ({counts(t)})</option>
        ))}
      </select>
      {target && (
        <>
          <p className="text-[12px] mt-2" style={{ color: 'var(--ink-2)' }}>
            The roster and games from the app join {target.name}&rsquo;s practice sessions.
          </p>
          {target.name !== team.name && (
            <div className="flex items-center gap-2 mt-2 text-[13px]">
              <span style={{ color: 'var(--ink-2)' }}>Name it</span>
              <select
                className="input-field"
                style={{ width: 'auto', padding: '4px 8px' }}
                value={choice.keepAppName ? 'app' : 'web'}
                onChange={(e) => onChange({ ...choice, keepAppName: e.target.value === 'app' })}
              >
                <option value="web">{target.name}</option>
                <option value="app">{team.name}</option>
              </select>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function YourTeamsSetup({ userId, initialInfo, onClose }) {
  const [info, setInfo] = useState(initialInfo || null);
  const [error, setError] = useState(null);
  const [name, setName] = useState(initialInfo ? (initialInfo.name || initialInfo.suggestedName || '') : '');
  const [choices, setChoices] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (info) return undefined;
    let alive = true;
    fetchSetup()
      .then(d => { if (alive) { setInfo(d); setName(d.name || d.suggestedName || ''); } })
      .catch(e => { if (alive) setError(e.status === 0 ? "Couldn't reach PlayBall. Check your connection." : "Couldn't load your teams."); });
    return () => { alive = false; };
  }, [info]);

  const appTeams = useMemo(() => (info?.teams || []).filter(t => t.fromApp), [info]);
  const webTeams = useMemo(() => (info?.teams || []).filter(t => !t.fromApp), [info]);
  const canMerge = appTeams.length > 0 && webTeams.length > 0;
  const listedTeams = canMerge ? webTeams : (info?.teams || []);
  // A web team with the same name is preselected; otherwise it stays separate.
  const choiceFor = (team) => choices[team.id]
    || { into: info?.pairs.find(p => p.app.id === team.id)?.web.id || null, keepAppName: false };
  const isNewAccount = info && !info.name;
  // A name is required once: it's how invited coaches see you.
  const nameMissing = !name.trim();

  const close = () => { markSetupSeen(userId); onClose(); };

  const save = async () => {
    setSaving(true);
    try {
      const trimmed = name.trim();
      if (trimmed !== (info.name || '')) await request('PUT', '/api/v2/account', { name: trimmed });
      let mergedCount = 0;
      for (const team of canMerge ? appTeams : []) {
        const c = choiceFor(team);
        const target = webTeams.find(t => t.id === c.into);
        if (!target) continue;
        await request('POST', `/api/v2/teams/${team.id}/merge`, { into: target.id, name: c.keepAppName ? team.name : target.name });
        mergedCount++;
      }
      if (mergedCount) {
        await load();
        toast(`Merged ${mergedCount} team${mergedCount === 1 ? '' : 's'}.`);
      }
      close();
    } catch (e) {
      toast(`Couldn't save — ${e.message}`);
      setSaving(false);
    }
  };

  return (
    <div className="modal-scroll fixed inset-0 bg-black/50 flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="card w-full max-w-lg p-6" style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-lg)' }}>
        <div className="eyebrow mb-2">YOUR TEAMS</div>
        <h2 className="text-[22px] font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>
          {isNewAccount ? 'Welcome to your PlayBall account' : 'Your teams'}
        </h2>
        <p className="text-[13px] mb-5" style={{ color: 'var(--ink-2)' }}>
          Everything here is on every device you sign in to: practice sessions on the web, rosters and games in the iPhone app.
        </p>

        {error && <p className="text-[13px] mb-4" style={{ color: 'var(--danger)' }}>{error}</p>}
        {!info && !error && <p className="text-[13px] mb-4" style={{ color: 'var(--ink-3)' }}>Loading your teams…</p>}

        {info && (
          <>
            <label className="label-text" htmlFor="coach-name">Your name</label>
            <input
              id="coach-name"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Coach Sam"
              maxLength={80}
            />
            <p className="text-[12px] mt-1 mb-5" style={{ color: 'var(--ink-3)' }}>
              {isNewAccount ? 'Required. ' : ''}Shown to coaches you invite to your teams.
            </p>

            {canMerge && (
              <div className="flex flex-col gap-3 mb-5">
                <div className="eyebrow">FROM THE IPHONE APP</div>
                {appTeams.map(team => (
                  <AppTeamCard
                    key={team.id}
                    team={team}
                    webTeams={webTeams}
                    choice={choiceFor(team)}
                    onChange={(c) => setChoices(prev => ({ ...prev, [team.id]: c }))}
                  />
                ))}
              </div>
            )}

            {listedTeams.length > 0 && (
              <div className="mb-5">
                <div className="eyebrow mb-1">{canMerge ? 'MADE ON THE WEB' : 'ON YOUR ACCOUNT'}</div>
                <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                  {listedTeams.map(t => <TeamLine key={t.id} team={t} />)}
                </div>
              </div>
            )}

            {info.sharedTeams?.length > 0 && (
              <div className="mb-5">
                <div className="eyebrow mb-1">SHARED WITH YOU</div>
                {info.sharedTeams.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-2 text-[14px]">
                    <span className="font-semibold truncate">{t.name}</span>
                    <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                      {t.role === 'cocoach' ? 'Co-coach' : 'Assistant'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="card p-3.5 mb-5 text-[12.5px]" style={{ background: 'var(--bg-sunken)', color: 'var(--ink-2)' }}>
              <p>
                <span className="font-semibold" style={{ color: 'var(--ink)' }}>Teams on your iPhone?</span>{' '}
                Open PlayBall on your iPhone and sign in with this account. You choose there which teams to add or merge.
              </p>
              <p className="mt-2">
                <span className="font-semibold" style={{ color: 'var(--ink)' }}>Assistant coach?</span>{' '}
                Let the head coach set the team up on their account and invite you. There's nothing to add here.
              </p>
            </div>
          </>
        )}

        <div className="flex gap-3 justify-end">
          {!isNewAccount && (
            <button type="button" className="btn btn-subtle" onClick={close} disabled={saving}>Not now</button>
          )}
          <button type="button" className="btn btn-primary" onClick={save} disabled={!info || saving || nameMissing}>
            {saving ? 'Saving…' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

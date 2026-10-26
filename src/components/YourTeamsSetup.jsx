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

function PairCard({ pair, choice, onChange }) {
  const { app, web } = pair;
  const sameName = app.name === web.name;
  return (
    <div className="card p-4">
      <div className="text-[13px] mb-2" style={{ color: 'var(--ink-2)' }}>Looks like the same team:</div>
      <TeamLine team={app} />
      <TeamLine team={web} />
      <div className="flex flex-col gap-2 mt-3">
        <label className="flex items-start gap-2 text-[13.5px] cursor-pointer">
          <input type="radio" checked={choice.merge} onChange={() => onChange({ ...choice, merge: true })} className="mt-1" />
          <span>
            <span className="font-medium">Merge into one team</span>
            <span className="block text-[12px]" style={{ color: 'var(--ink-2)' }}>
              The roster and games from the app join the practice sessions here.
            </span>
          </span>
        </label>
        {choice.merge && !sameName && (
          <div className="flex items-center gap-2 pl-6 text-[13px]">
            <span style={{ color: 'var(--ink-2)' }}>Keep the name</span>
            <select
              className="input-field"
              style={{ width: 'auto', padding: '4px 8px' }}
              value={choice.name}
              onChange={(e) => onChange({ ...choice, name: e.target.value })}
            >
              <option value={web.name}>{web.name}</option>
              <option value={app.name}>{app.name}</option>
            </select>
          </div>
        )}
        <label className="flex items-start gap-2 text-[13.5px] cursor-pointer">
          <input type="radio" checked={!choice.merge} onChange={() => onChange({ ...choice, merge: false })} className="mt-1" />
          <span className="font-medium">Keep them separate</span>
        </label>
      </div>
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

  // Merging is the default for every same-named pair.
  const choiceFor = (pair) => choices[pair.app.id] || { merge: true, name: pair.web.name };

  const paired = useMemo(() => new Set((info?.pairs || []).flatMap(p => [p.app.id, p.web.id])), [info]);
  const otherTeams = (info?.teams || []).filter(t => !paired.has(t.id));
  const isNewAccount = info && !info.name;

  const close = () => { markSetupSeen(userId); onClose(); };

  const save = async () => {
    setSaving(true);
    try {
      const trimmed = name.trim();
      if (trimmed !== (info.name || '')) await request('PUT', '/api/v2/account', { name: trimmed });
      let mergedCount = 0;
      for (const pair of info.pairs) {
        const c = choiceFor(pair);
        if (!c.merge) continue;
        await request('POST', `/api/v2/teams/${pair.app.id}/merge`, { into: pair.web.id, name: c.name });
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
              Shown to coaches you invite to your teams.
            </p>

            {info.pairs.length > 0 && (
              <div className="flex flex-col gap-3 mb-5">
                {info.pairs.map(pair => (
                  <PairCard
                    key={pair.app.id}
                    pair={pair}
                    choice={choiceFor(pair)}
                    onChange={(c) => setChoices(prev => ({ ...prev, [pair.app.id]: c }))}
                  />
                ))}
              </div>
            )}

            {otherTeams.length > 0 && (
              <div className="mb-5">
                <div className="eyebrow mb-1">{info.pairs.length ? 'YOUR OTHER TEAMS' : 'ON YOUR ACCOUNT'}</div>
                <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                  {otherTeams.map(t => <TeamLine key={t.id} team={t} />)}
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
          <button type="button" className="btn btn-subtle" onClick={close} disabled={saving}>Not now</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!info || saving}>
            {saving ? 'Saving…' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';

// Read-only sub schedule for a team the coach syncs from the PlayBall iOS app.
// Opened from a view link (/shared/games/<viewToken>[/<gameId>]) — no account,
// no app. Shows exactly the plan the coach's phone shows: the phone sends it
// with every sync (see api/team-share/push.js).

const REFRESH_MS = 30000;

function parsePath() {
  const [, , , token, gameId] = window.location.pathname.split('/');
  return { token: token || '', gameId: gameId || null };
}

function clock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function minutes(seconds) {
  const m = Math.round(seconds / 6) / 10;
  return Number.isInteger(m) ? `${m}` : m.toFixed(1);
}

// Game seconds as the period and the time into it: { label: 'Q2', into }.
function periodAt(game, t, { isEnd = false } = {}) {
  const len = (game.periodLengthMinutes || 0) * 60;
  const count = game.numberOfPeriods || 2;
  if (!len) return { label: '', period: 1, into: t, boundary: false };
  let period = Math.floor(t / len) + 1;
  let into = t - (period - 1) * len;
  // A shift ending on a period boundary ends that period, not the next one.
  if (isEnd && into < 0.5 && period > 1) { period -= 1; into = len; }
  period = Math.min(period, count);
  const label = count === 4 ? `Q${period}` : `${period === 1 ? '1st' : '2nd'} half`;
  return { label, period, into, boundary: !isEnd && into < 0.5 };
}

// "1st half · 10:00–20:00", or "1st half 20:00 – 2nd half 5:00" across a break.
function shiftSpan(game, s) {
  const a = periodAt(game, s.start);
  const b = periodAt(game, s.end, { isEnd: true });
  if (a.period === b.period) return `${a.label} · ${clock(a.into)}–${clock(b.into)}`;
  return `${a.label} ${clock(a.into)} – ${b.label} ${clock(b.into)}`;
}

function gameDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function ago(iso) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PlayerChip({ player, captain, keeper }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full text-[13px]"
      style={{ padding: '3px 10px 3px 6px', background: 'var(--bg-sunken)', border: '1px solid var(--line)', color: 'var(--ink)' }}
    >
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: player?.tintHex || 'var(--ink-3)' }} />
      {player?.name || 'Player'}
      {captain && <span className="font-semibold" style={{ color: 'var(--accent)' }} title="Captain">C</span>}
      {keeper && <span className="text-[10.5px] font-mono uppercase" style={{ color: 'var(--ink-3)' }}>GK</span>}
    </span>
  );
}

function Page({ children }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-16">{children}</div>
    </div>
  );
}

function GameList({ data, onOpen }) {
  const now = data.fetchedAt;
  const sorted = [...data.games].sort((a, b) => new Date(a.date) - new Date(b.date));
  // Games stay "upcoming" through the day they're played.
  const cutoff = now - 12 * 3600 * 1000;
  const upcoming = sorted.filter(g => new Date(g.date).getTime() >= cutoff);
  const past = sorted.filter(g => new Date(g.date).getTime() < cutoff).reverse();

  const row = (g) => (
    <button
      key={g.id}
      onClick={() => onOpen(g.id)}
      className="w-full text-left rounded-xl p-4 flex items-center gap-3 transition-colors"
      style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{g.name || 'Game'}</div>
        <div className="text-[13px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
          {gameDate(g.date)} · {g.isHome ? 'Home' : 'Away'}
        </div>
      </div>
      {g.live?.period > 0 && (
        <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Live</span>
      )}
      <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ink-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );

  return (
    <>
      <div className="eyebrow mb-2">Upcoming</div>
      {upcoming.length === 0
        ? <p className="text-[14px] mb-6" style={{ color: 'var(--ink-2)' }}>No upcoming games.</p>
        : <div className="flex flex-col gap-2 mb-8">{upcoming.map(row)}</div>}
      {past.length > 0 && (
        <>
          <div className="eyebrow mb-2">Played</div>
          <div className="flex flex-col gap-2">{past.map(row)}</div>
        </>
      )}
    </>
  );
}

function GameDetail({ data, game, onBack }) {
  const byId = Object.fromEntries(data.players.map(p => [p.id, p]));
  const shifts = game.plan?.shifts || [];
  const live = game.live?.period > 0 ? game.live : null;
  const format = `${game.playersOnField}v${game.playersOnField} · ${game.numberOfPeriods} × ${game.periodLengthMinutes} min`;

  // Minutes per player, keeper time included (same as the app).
  const totals = {};
  for (const s of shifts) {
    const d = Math.max(0, s.end - s.start);
    for (const id of [...(s.fieldIDs || []), ...(s.goalieID ? [s.goalieID] : [])]) totals[id] = (totals[id] || 0) + d;
  }
  const available = game.availablePlayerIds.map(id => byId[id]).filter(Boolean);
  // Number the subs made during play; changes at a period break are named instead.
  const subNumber = [];
  let n = 0;
  shifts.forEach((s, i) => { if (i > 0 && !periodAt(game, s.start).boundary) n += 1; subNumber[i] = n; });

  return (
    <>
      <button onClick={onBack} className="btn btn-ghost mb-3" style={{ padding: '4px 6px', fontSize: 13 }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
        </svg>
        All games
      </button>
      <h1 className="text-[26px] font-bold" style={{ letterSpacing: '-0.02em' }}>{game.name || 'Game'}</h1>
      <p className="text-[14px] mt-1" style={{ color: 'var(--ink-2)' }}>
        {gameDate(game.date)} · {game.isHome ? 'Home' : 'Away'} · {format}
      </p>

      {live && (
        <div className="rounded-xl p-3 mt-4 text-[14px]" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
          <strong>In play</strong> — shift {Math.min(live.activeShift + 1, shifts.length)} of {shifts.length} is on the field.
        </div>
      )}

      {!shifts.length ? (
        <div className="rounded-xl p-4 mt-6 text-[14px]" style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
          {game.planOutdated
            ? 'This game changed on the coach’s phone and its new sub plan hasn’t synced yet. It will show here once the coach opens PlayBall.'
            : 'No sub plan for this game yet. It will show here once the coach opens PlayBall with an updated app.'}
        </div>
      ) : (
        <>
          <div className="eyebrow mt-8 mb-2">Subs</div>
          <div className="flex flex-col gap-2">
            {shifts.map((s, i) => {
              const prev = shifts[i - 1];
              const at = periodAt(game, s.start);
              const field = s.fieldIDs || [];
              // On/off the pitch counts the keeper too: a keeper who moves to
              // the field at halftime hasn't come on.
              const pitch = (x) => [...(x?.fieldIDs || []), ...(x?.goalieID ? [x.goalieID] : [])];
              const before = new Set(pitch(prev));
              const after = new Set(pitch(s));
              const on = prev ? [...after].filter(id => !before.has(id)) : [];
              const off = prev ? [...before].filter(id => !after.has(id)) : [];
              const keeperChange = prev && prev.goalieID !== s.goalieID && s.goalieID;
              const isLive = live && live.activeShift === i;
              const isDone = live && i < live.activeShift;
              return (
                <div
                  key={s.id || i}
                  className="rounded-xl p-3.5"
                  style={{
                    background: 'var(--bg-elev)',
                    border: `1.5px solid ${isLive ? 'var(--accent)' : 'var(--line)'}`,
                    opacity: isDone ? 0.55 : 1,
                  }}
                >
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="font-semibold text-[14px]">
                      {i === 0 ? 'Kickoff' : at.boundary ? (game.numberOfPeriods === 4 ? `${at.label} starts` : 'Halftime') : `Sub ${subNumber[i]}`}
                      {isLive && <span className="ml-2 text-[11px] font-mono uppercase" style={{ color: 'var(--accent)' }}>On now</span>}
                    </span>
                    <span className="font-mono text-[12px]" style={{ color: 'var(--ink-2)' }}>
                      {shiftSpan(game, s)}
                    </span>
                  </div>
                  {prev && (on.length > 0 || off.length > 0) && (
                    <div className="text-[13px] mt-2 leading-relaxed">
                      {on.length > 0 && <div><span style={{ color: 'var(--good, #4ade80)' }}>On:</span> {on.map(id => byId[id]?.name || 'Player').join(', ')}</div>}
                      {off.length > 0 && <div><span style={{ color: 'var(--ink-3)' }}>Off:</span> {off.map(id => byId[id]?.name || 'Player').join(', ')}</div>}
                    </div>
                  )}
                  {keeperChange && (
                    <div className="text-[13px] mt-1" style={{ color: 'var(--ink-2)' }}>
                      In goal: {byId[s.goalieID]?.name || 'Player'}
                      {prev.goalieID && after.has(prev.goalieID) ? ` · ${byId[prev.goalieID]?.name || 'Player'} moves to the field` : ''}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {s.goalieID && <PlayerChip player={byId[s.goalieID]} keeper captain={s.goalieID === game.captainID} />}
                    {field.map(id => <PlayerChip key={id} player={byId[id]} captain={id === game.captainID} />)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="eyebrow mt-8 mb-2">Planned minutes</div>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--line)' }}>
            {available.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-2 px-3.5 py-2 text-[14px]"
                style={{ background: i % 2 ? 'var(--bg-elev)' : 'var(--bg-sunken)' }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.tintHex || 'var(--ink-3)' }} />
                <span className="flex-1">{p.name}</span>
                <span className="font-mono">{minutes(totals[p.id] || 0)} min</span>
              </div>
            ))}
          </div>
          <p className="text-[12px] mt-2" style={{ color: 'var(--ink-3)' }}>Includes time in goal.</p>
        </>
      )}
    </>
  );
}

export default function GameScheduleView() {
  const [{ token, gameId }, setRoute] = useState(parsePath);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/share/games/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!body?.success) throw new Error(body?.message || 'This schedule link is not valid.');
      setData({ ...body, fetchedAt: Date.now() });
      setError(null);
    } catch (e) {
      // Keep showing what we have if a refresh fails (weak signal at the field).
      setData(prev => { if (!prev) setError(e.message); return prev; });
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Stay current: the coach's phone syncs as the game goes.
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  useEffect(() => {
    const onPop = () => setRoute(parsePath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = (id) => {
    window.history.pushState({}, '', `/shared/games/${token}${id ? `/${id}` : ''}`);
    setRoute({ token, gameId: id });
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    document.title = data ? `${data.teamName} — sub schedule` : 'Sub schedule — PlayBall';
  }, [data]);

  if (error) {
    return (
      <Page>
        <div className="text-center pt-20">
          <h1 className="text-xl font-bold mb-2">Link not valid</h1>
          <p className="text-[14px]" style={{ color: 'var(--ink-2)' }}>{error}</p>
        </div>
      </Page>
    );
  }
  if (!data) {
    return <Page><p className="text-center pt-20" style={{ color: 'var(--ink-2)' }}>Loading schedule…</p></Page>;
  }

  const game = gameId ? data.games.find(g => g.id === gameId) : null;

  return (
    <Page>
      <div className="flex items-center gap-3 mb-6">
        {data.mascotImageUrl
          ? <img src={data.mascotImageUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
          : <span className="w-11 h-11 rounded-full flex items-center justify-center text-[22px]" style={{ background: 'var(--bg-elev)' }}>{data.mascotEmoji || '⚽'}</span>}
        <div className="min-w-0">
          <div className="font-semibold text-[17px] truncate">{data.teamName}</div>
          <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
            Sub schedule · view only{data.syncedAt ? ` · synced ${ago(data.syncedAt)}` : ''}
          </div>
        </div>
      </div>
      {game
        ? <GameDetail data={data} game={game} onBack={() => go(null)} />
        : <GameList data={data} onOpen={go} />}
    </Page>
  );
}

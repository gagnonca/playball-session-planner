import React, { useEffect, useState, useCallback } from 'react';
import { COACH_IDENTITY_KEY } from '../../constants/storage';

function authHeaders() {
  try {
    const raw = localStorage.getItem(COACH_IDENTITY_KEY);
    if (!raw) return null;
    const id = JSON.parse(raw);
    if (!id?.coachId || !id?.deviceId) return null;
    return {
      'Content-Type': 'application/json',
      'x-coach-id': id.coachId,
      'x-device-id': id.deviceId,
    };
  } catch { return null; }
}

function formatGameDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TeamGames({ teamId }) {
  const [games, setGames] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!teamId) return;
    const headers = authHeaders();
    if (!headers) { setError('Sync not set up — pair this device to load games.'); return; }
    try {
      const res = await fetch(`/api/v2/games?teamId=${encodeURIComponent(teamId)}`, { headers });
      const data = await res.json();
      if (!data.success) {
        if (data.error === 'team_not_owned') { setGames([]); return; }
        setError(data.message || 'Failed to load games.');
        return;
      }
      setGames(data.games || []);
    } catch (e) {
      setError(e.message || 'Network error loading games.');
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-[13.5px]" style={{ color: 'var(--ink-2)' }}>{error}</p>
      </div>
    );
  }
  if (games === null) {
    return (
      <div className="card p-6 text-center">
        <p className="text-[13.5px]" style={{ color: 'var(--ink-2)' }}>Loading games…</p>
      </div>
    );
  }
  if (games.length === 0) {
    return (
      <div className="card p-12 text-center">
        <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--ink-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-[18px] font-semibold mb-2">No games yet</h3>
        <p className="text-[13.5px]" style={{ color: 'var(--ink-2)' }}>
          Games created in the PlayBall iOS app will appear here once the team is synced.
        </p>
      </div>
    );
  }

  // Most recent first, future dates above past dates.
  const sorted = [...games].sort((a, b) => {
    const at = a.date ? new Date(a.date).getTime() : 0;
    const bt = b.date ? new Date(b.date).getTime() : 0;
    return bt - at;
  });

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {sorted.map(g => {
        const dateLabel = formatGameDate(g.date);
        const playerCount = Array.isArray(g.payload?.availablePlayers)
          ? g.payload.availablePlayers.length
          : null;
        return (
          <div key={g.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-semibold leading-tight">{g.name}</h3>
              <span
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  background: g.is_home ? 'var(--bg-sunken)' : 'transparent',
                  border: '1px solid var(--line)',
                  color: 'var(--ink-2)',
                }}
              >
                {g.is_home ? 'Home' : 'Away'}
              </span>
            </div>
            <p className="mt-2 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
              {dateLabel || 'No date set'}
              {playerCount != null ? ` · ${playerCount} player${playerCount === 1 ? '' : 's'}` : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}

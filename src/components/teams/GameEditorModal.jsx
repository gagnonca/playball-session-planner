import React, { useState } from 'react';
import { uid, toast } from '../../utils/helpers';
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

// ISO timestamp → "YYYY-MM-DD" for the <input type="date"> control. We keep
// the time of day from the original game (or set to noon UTC for new ones)
// so toggling the date doesn't shift the day across timezones.
function isoToDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function dateInputToIso(dateStr) {
  if (!dateStr) return null;
  // Anchor at local noon so timezone drift doesn't bump the day.
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toISOString();
}

export default function GameEditorModal({ teamId, teamPlayers = [], game, onClose, onSaved, onDeleted }) {
  const isEdit = !!game;
  const [name, setName] = useState(game?.name ?? '');
  const [date, setDate] = useState(isoToDateInput(game?.date));
  const [isHome, setIsHome] = useState(game?.is_home ?? false);
  const [playersOnField, setPlayersOnField] = useState(game?.payload?.playersOnField ?? 4);
  const [periodLengthMinutes, setPeriodLengthMinutes] = useState(game?.payload?.periodLengthMinutes ?? 10);
  const [numberOfPeriods, setNumberOfPeriods] = useState(game?.payload?.numberOfPeriods ?? 4);
  const [captainID, setCaptainID] = useState(game?.payload?.captainID ?? '');
  // availablePlayers in the iOS payload is the FULL player object per game;
  // we track just the picked id set in the editor and reassemble objects
  // (preferring teamPlayers as the source of truth) on save.
  const initialAvail = Array.isArray(game?.payload?.availablePlayers)
    ? game.payload.availablePlayers.map(p => p?.id).filter(Boolean)
    : teamPlayers.map(p => p.id);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(new Set(initialAvail));
  const [busy, setBusy] = useState(false);

  const togglePlayer = (id) => {
    setSelectedPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) { toast('Name is required'); return; }
    const headers = authHeaders();
    if (!headers) { toast('Pair this device before editing games.'); return; }

    setBusy(true);
    try {
      const id = game?.id || uid();
      const existingPayload = game?.payload || {};
      // Build availablePlayers as the iOS-shaped objects ({id,name,tintHex})
      // so iOS-side decoders see what they expect. Prefer teamPlayers as
      // source of truth; fall back to whatever was on the existing game row
      // for ids no longer in the roster (so we don't silently drop them).
      const teamPlayerById = new Map(teamPlayers.map(p => [p.id, p]));
      const existingAvailById = new Map(
        (existingPayload.availablePlayers || []).filter(p => p?.id).map(p => [p.id, p])
      );
      const availablePlayers = Array.from(selectedPlayerIds).map(pid => {
        return teamPlayerById.get(pid) ?? existingAvailById.get(pid) ?? { id: pid, name: 'Unknown', tintHex: null };
      });
      const payload = {
        ...existingPayload,
        id,
        name: name.trim(),
        date: dateInputToIso(date),
        isHome,
        playersOnField: Number(playersOnField) || 0,
        periodLengthMinutes: Number(periodLengthMinutes) || 0,
        numberOfPeriods: Number(numberOfPeriods) || 0,
        captainID: captainID || null,
        availablePlayers,
        // Default substitutionStyle so iOS-side decoders don't choke when
        // they eventually pull a web-created game. Edit-existing keeps whatever
        // the iOS app set.
        substitutionStyle: existingPayload.substitutionStyle ?? 'short',
      };

      const res = await fetch(`/api/v2/games/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          teamId,
          name: payload.name,
          date: payload.date,
          isHome: payload.isHome,
          payload,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast(data.message || 'Could not save game.');
        return;
      }
      toast(isEdit ? 'Game updated' : 'Game created');
      onSaved?.(data.game);
      onClose();
    } catch (e) {
      console.error(e);
      toast('Network error saving game.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!game?.id) return;
    if (!window.confirm(`Delete "${game.name}"?`)) return;
    const headers = authHeaders();
    if (!headers) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v2/games/${encodeURIComponent(game.id)}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!data.success) {
        toast(data.message || 'Could not delete game.');
        return;
      }
      toast('Game deleted');
      onDeleted?.(game.id);
      onClose();
    } catch (e) {
      console.error(e);
      toast('Network error deleting game.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="card animate-fade-in w-full max-w-[520px]" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="p-6">
            <div className="eyebrow mb-2">{isEdit ? 'EDIT GAME' : 'NEW GAME'}</div>
            <h2 className="text-[24px] font-semibold leading-tight mb-5" style={{ letterSpacing: '-0.02em' }}>
              {isEdit ? name || 'Game' : 'Plan a new game'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="label-text">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Game 9"
                  className="input-field"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-text">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Location</label>
                  <div
                    role="tablist"
                    className="inline-flex p-1 rounded-[10px] w-full"
                    style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}
                  >
                    {[
                      { key: false, label: 'Away' },
                      { key: true, label: 'Home' },
                    ].map(opt => {
                      const active = isHome === opt.key;
                      return (
                        <button
                          key={String(opt.key)}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setIsHome(opt.key)}
                          className="flex-1 px-3 py-1.5 text-[12.5px] rounded-[7px] transition-colors"
                          style={{
                            background: active ? 'var(--bg-elev)' : 'transparent',
                            color: active ? 'var(--ink)' : 'var(--ink-2)',
                            border: active ? '1px solid var(--line-2)' : '1px solid transparent',
                            boxShadow: active ? 'var(--shadow-sm)' : 'none',
                            fontWeight: active ? 500 : 400,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label-text">Players on field</label>
                  <input
                    type="number"
                    min="1"
                    value={playersOnField}
                    onChange={(e) => setPlayersOnField(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Periods</label>
                  <input
                    type="number"
                    min="1"
                    value={numberOfPeriods}
                    onChange={(e) => setNumberOfPeriods(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Period (min)</label>
                  <input
                    type="number"
                    min="1"
                    value={periodLengthMinutes}
                    onChange={(e) => setPeriodLengthMinutes(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              {teamPlayers.length > 0 && (
                <>
                  <div>
                    <label className="label-text">Captain</label>
                    <select
                      value={captainID || ''}
                      onChange={(e) => setCaptainID(e.target.value)}
                      className="input-field"
                    >
                      <option value="">No captain</option>
                      {teamPlayers
                        .filter(p => selectedPlayerIds.has(p.id))
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label-text mb-0">Available players</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                          {selectedPlayerIds.size} / {teamPlayers.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedPlayerIds(new Set(teamPlayers.map(p => p.id)))}
                          className="text-[12px]"
                          style={{ color: 'var(--accent)' }}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPlayerIds(new Set())}
                          className="text-[12px]"
                          style={{ color: 'var(--ink-3)' }}
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {teamPlayers.map(p => {
                        const on = selectedPlayerIds.has(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => togglePlayer(p.id)}
                            className="px-2.5 py-1 rounded-full text-[12.5px] transition-all"
                            style={{
                              background: on ? (p.tintHex || 'var(--accent-soft)') : 'transparent',
                              color: on ? '#fff' : 'var(--ink-2)',
                              border: on ? '1px solid transparent' : '1px solid var(--line)',
                              opacity: on ? 1 : 0.85,
                            }}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div
            className="px-6 py-3 flex items-center justify-between"
            style={{ background: 'var(--bg-sunken)', borderTop: '1px solid var(--line)', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}
          >
            {isEdit ? (
              <button
                onClick={handleDelete}
                disabled={busy}
                className="btn btn-ghost"
                style={{ color: 'var(--bad)' }}
              >
                Delete
              </button>
            ) : <span />}
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="btn btn-ghost" disabled={busy}>Cancel</button>
              <button onClick={handleSave} className="btn btn-primary" disabled={busy || !name.trim()}>
                {busy ? 'Saving…' : isEdit ? 'Save' : 'Create game'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

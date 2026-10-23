// The sub plan for a game synced from the PlayBall iOS app — a line-for-line
// port of the app's planner (PlayBall/Extensions/Game+Plan.swift,
// Game+Substitutions.swift and Model/PlaytimePlanner.swift) so the web shows
// the same shifts as the coach's phone.
//
// The phone only stores a plan once a game kicks off (or for games played
// before the planner existed); until then it builds one from the game's
// settings every time. `effectivePlan` does the same: the stored plan if there
// is one, otherwise one built here.
//
// Keep this in step with the Swift. If the app's planner changes, this has to
// change with it.

const gcd = (a, b) => { while (b !== 0) [a, b] = [b, a % b]; return a; };

// ---- Game helpers (Game.swift, Game+SeasonStats.swift) ----

function totalGameSeconds(g) {
  return g.numberOfPeriods * g.periodLengthMinutes * 60;
}

function goalieIDs(g) {
  return [...new Set([g.goalieH1ID, g.goalieH2ID].filter(Boolean))];
}

function hasGoalies(g) {
  return Boolean(g.goalieH1ID || g.goalieH2ID);
}

function fieldRotationPlayers(g) {
  const keepers = new Set(goalieIDs(g));
  return g.availablePlayers.filter(p => !keepers.has(p.id));
}

function fieldSpots(g) {
  return hasGoalies(g) ? Math.max(g.playersOnField - 1, 1) : g.playersOnField;
}

function requiresGoaliesInField(g) {
  return goalieIDs(g).length > 1 && fieldRotationPlayers(g).length < fieldSpots(g);
}

function usesPerHalfRotation(g) {
  return goalieIDs(g).length > 1 && (Boolean(g.goaliesPlayOutfield) || requiresGoaliesInField(g));
}

function fieldParticipants(g) {
  return usesPerHalfRotation(g) ? g.availablePlayers : fieldRotationPlayers(g);
}

// ---- Shift length (Game+Substitutions.swift, legacySubstitutionPlan) ----

function stepDown(n, f, s) {
  while (s > 1 && f % gcd(n, s) !== 0) s -= 1;
  return s;
}

function segmentsPerHalf(g, n) {
  const f = fieldSpots(g);
  if (!(n > f)) return 1;
  if (g.customSubInterval != null && g.customSubInterval > 0) {
    const halfSeconds = totalGameSeconds(g) / 2;
    return Math.max(1, swiftRound(halfSeconds / g.customSubInterval));
  }
  if (g.subsPerHalf != null && g.subsPerHalf > 0) return g.subsPerHalf + 1;
  const s = stepDown(n, f, Math.min(g.subsPerInterval ?? f, f));
  return g.substitutionStyle === 'short' ? n : n / gcd(n, s);
}

// Swift's .rounded() rounds half away from zero.
function swiftRound(x) {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

function subInterval(g) {
  const total = totalGameSeconds(g);
  if (usesPerHalfRotation(g)) {
    const halfSeconds = total / 2;
    const firstHalf = g.availablePlayers.filter(p => p.id !== g.goalieH1ID);
    const secondHalf = g.availablePlayers.filter(p => p.id !== g.goalieH2ID);
    if (!firstHalf.length || !secondHalf.length) return 0;
    return halfSeconds / segmentsPerHalf(g, firstHalf.length);
  }
  const players = fieldRotationPlayers(g);
  if (!players.length) return 0;
  const f = fieldSpots(g);
  if (players.length <= f) return total;
  const n = players.length;
  if (g.customSubInterval != null) return g.customSubInterval;
  if (g.subsPerHalf != null && g.subsPerHalf > 0) return total / ((g.subsPerHalf + 1) * 2);
  const s = stepDown(n, f, Math.min(g.subsPerInterval ?? f, f));
  const cycleLength = n / gcd(n, s);
  const totalSegments = g.substitutionStyle === 'short' ? n : cycleLength;
  return total / totalSegments;
}

// ---- Shift times (Game+Plan.swift, shiftTimes) ----

function shiftTimes(g) {
  const total = totalGameSeconds(g);
  const d = subInterval(g);
  if (!(total > 0)) return [];
  if (!(d > 0)) return [{ start: 0, end: total, continues: false }];

  const cuts = [];
  let t = d;
  while (t < total - 0.5) {
    cuts.push({ at: t, continues: false });
    t += d;
  }
  const half = total / 2;
  if ((g.goalieH1ID || null) !== (g.goalieH2ID || null) && !cuts.some(c => Math.abs(c.at - half) < 0.5)) {
    cuts.push({ at: half, continues: true });
    cuts.sort((a, b) => a.at - b.at);
  }

  const result = [];
  let start = 0;
  let continues = false;
  for (const cut of [...cuts, { at: total, continues: false }]) {
    result.push({ start, end: cut.at, continues });
    start = cut.at;
    continues = cut.continues;
  }
  return result;
}

function slot(g, start, end) {
  const keeper = start < totalGameSeconds(g) / 2 ? (g.goalieH1ID || null) : (g.goalieH2ID || null);
  const pool = usesPerHalfRotation(g)
    ? g.availablePlayers.filter(p => p.id !== keeper)
    : fieldRotationPlayers(g);
  return { start, end, goalieID: keeper, pool: pool.map(p => p.id), spots: fieldSpots(g), fixed: null, continues: false };
}

function plannerFor(g) {
  const pool = fieldParticipants(g).length;
  const f = Math.min(fieldSpots(g), Math.max(pool, 1));
  let s = Math.min(g.subsPerInterval ?? f, f);
  if (pool > f) s = stepDown(pool, f, s);
  return { roster: g.availablePlayers.map(p => p.id), maxSwaps: Math.max(s, 1) };
}

// ---- The minutes planner (PlaytimePlanner.swift) ----

const duration = (slot) => Math.max(0, slot.end - slot.start);

function targets(roster, projected, chances, fieldSeconds) {
  const ids = [...new Set([...roster, ...projected.keys(), ...chances.keys()])];
  let total = fieldSeconds;
  for (const id of ids) total += projected.get(id) ?? 0;
  const reach = new Map(ids.map(id => [id, (projected.get(id) ?? 0) + (chances.get(id) ?? 0)]));

  const capped = new Map();
  let share = 0;
  for (;;) {
    const open = ids.filter(id => !capped.has(id));
    if (!open.length) break;
    let cappedSum = 0;
    for (const v of capped.values()) cappedSum += v;
    share = (total - cappedSum) / open.length;
    const newlyCapped = open.filter(id => (reach.get(id) ?? 0) < share);
    if (!newlyCapped.length) break;
    for (const id of newlyCapped) capped.set(id, reach.get(id));
  }
  return new Map(ids.map(id => [id, capped.has(id) ? capped.get(id) : share]));
}

function keep(lineup, pool, spots, ranked, leastOwedFirst) {
  const kept = [];
  for (const id of lineup) if (pool.has(id) && !kept.includes(id)) kept.push(id);
  if (kept.length > spots) {
    const drop = new Set(leastOwedFirst(kept).slice(0, kept.length - spots));
    for (let i = kept.length - 1; i >= 0; i--) if (drop.has(kept[i])) kept.splice(i, 1);
  }
  for (const id of ranked) if (kept.length < spots && !kept.includes(id)) kept.push(id);
  return kept;
}

function fill(planner, slots) {
  const order = new Map();
  planner.roster.forEach((id, i) => { if (!order.has(id)) order.set(id, i); });
  const orderOf = (id) => (order.has(id) ? order.get(id) : Number.MAX_SAFE_INTEGER);

  const projected = new Map();
  for (const s of slots) if (s.goalieID) projected.set(s.goalieID, (projected.get(s.goalieID) ?? 0) + duration(s));

  const chancesFrom = Array.from({ length: slots.length + 1 }, () => new Map());
  for (let k = slots.length - 1; k >= 0; k--) {
    const chances = new Map(chancesFrom[k + 1]);
    for (const id of slots[k].pool) chances.set(id, (chances.get(id) ?? 0) + duration(slots[k]));
    chancesFrom[k] = chances;
  }

  const target = targets(
    planner.roster,
    projected,
    chancesFrom[0],
    slots.reduce((sum, s) => sum + duration(s) * Math.min(s.spots, s.pool.length), 0),
  );

  const offSince = new Map();
  const onSince = new Map();
  const result = [];
  let current = [];

  slots.forEach((s, k) => {
    const pool = s.pool;
    const poolSet = new Set(pool);
    const spots = Math.min(s.spots, pool.length);
    const onField = new Set(current);
    const dur = duration(s);

    const need = (id) => {
      const short = (target.get(id) ?? 0) - (projected.get(id) ?? 0);
      return short / Math.max(chancesFrom[k].get(id) ?? 0, 1);
    };
    // null = not clearly different (within half a shift).
    const clearlyOwedMore = (a, b) => {
      const na = need(a), nb = need(b);
      const chances = Math.max(chancesFrom[k].get(a) ?? 0, chancesFrom[k].get(b) ?? 0, 1);
      if (!(Math.abs(na - nb) * chances >= dur / 2)) return null;
      return na > nb;
    };
    const waitedSince = (id) => (onField.has(id) ? Infinity : (offSince.has(id) ? offSince.get(id) : -Infinity));

    const ranked = swiftSorted(pool, (a, b) => {
      const owed = clearlyOwedMore(a, b);
      if (owed !== null) return owed;
      const wa = waitedSince(a), wb = waitedSince(b);
      if (wa !== wb) return wa < wb;
      return orderOf(a) < orderOf(b);
    });

    const leastOwedFirst = (ids) => swiftSorted(ids, (a, b) => {
      const owed = clearlyOwedMore(a, b);
      if (owed !== null) return !owed;
      const sa = onSince.has(a) ? onSince.get(a) : Infinity;
      const sb = onSince.has(b) ? onSince.get(b) : Infinity;
      if (sa !== sb) return sa < sb;
      return orderOf(a) > orderOf(b);
    });

    let lineup;
    if (s.fixed) {
      lineup = keep(s.fixed, poolSet, spots, ranked, leastOwedFirst);
    } else if (!current.length) {
      lineup = ranked.slice(0, spots);
    } else {
      lineup = keep(current, poolSet, spots, ranked, leastOwedFirst);
      if (!s.continues) {
        const desired = ranked.slice(0, spots);
        const incoming = desired.filter(id => !lineup.includes(id)).slice(0, planner.maxSwaps);
        const outgoing = leastOwedFirst(lineup.filter(id => !desired.includes(id))).slice(0, incoming.length);
        for (let i = 0; i < Math.min(outgoing.length, incoming.length); i++) {
          const at = lineup.indexOf(outgoing[i]);
          if (at >= 0) lineup[at] = incoming[i];
        }
      }
    }

    for (const id of lineup) if (!onField.has(id)) onSince.set(id, s.start);
    for (const id of current) if (!lineup.includes(id)) { offSince.set(id, s.start); onSince.delete(id); }
    for (const id of lineup) projected.set(id, (projected.get(id) ?? 0) + dur);

    result.push(lineup);
    current = lineup;
  });
  return result;
}

// Swift's sort(by:) with an "a comes before b" predicate. Swift sorts with a
// stable merge sort (insertion sort for runs under 20, then merging runs), and
// with a predicate that isn't a strict ordering — as here, where "clearly owed
// more" ignores small gaps — the exact algorithm decides the result. So this
// reproduces it rather than calling Array.prototype.sort.
function swiftSorted(input, areInIncreasingOrder) {
  const a = [...input];
  const n = a.length;
  if (n < 2) return a;
  const minRun = minimumRunLength(n);
  // Short arrays (every roster) are a plain insertion sort.
  if (n <= minRun) {
    insertionSort(a, 0, 1, n, areInIncreasingOrder);
    return a;
  }
  const runs = [];
  let start = 0;
  while (start < n) {
    let end = start + 1;
    if (end < n) {
      // Find the next natural run; a descending one is reversed in place.
      const descending = areInIncreasingOrder(a[end], a[end - 1]);
      end += 1;
      while (end < n && areInIncreasingOrder(a[end], a[end - 1]) === descending) end += 1;
      if (descending) reverse(a, start, end);
    }
    if (end < n && end - start < minRun) {
      const newEnd = Math.min(start + minRun, n);
      insertionSort(a, start, end, newEnd, areInIncreasingOrder);
      end = newEnd;
    }
    runs.push([start, end]);
    mergeTopRuns(a, runs, areInIncreasingOrder);
    start = end;
  }
  while (runs.length > 1) mergeRunsAt(a, runs, runs.length - 2, areInIncreasingOrder);
  return a;
}

function minimumRunLength(c) {
  if (c < 64) return c;
  let r = 0;
  while (c >= 64) { r |= c & 1; c >>= 1; }
  return c + r;
}

function reverse(a, lo, hi) {
  for (let i = lo, j = hi - 1; i < j; i++, j--) [a[i], a[j]] = [a[j], a[i]];
}

// Extends a[lo..<sortedEnd] (already sorted) to a[lo..<hi].
function insertionSort(a, lo, sortedEnd, hi, less) {
  for (let i = sortedEnd; i < hi; i++) {
    const x = a[i];
    let j = i;
    while (j > lo && less(x, a[j - 1])) { a[j] = a[j - 1]; j--; }
    a[j] = x;
  }
}

function merge(a, lo, mid, hi, less) {
  const left = a.slice(lo, mid);
  const right = a.slice(mid, hi);
  let i = 0, j = 0, k = lo;
  while (i < left.length && j < right.length) {
    if (less(right[j], left[i])) a[k++] = right[j++];
    else a[k++] = left[i++];
  }
  while (i < left.length) a[k++] = left[i++];
  while (j < right.length) a[k++] = right[j++];
}

function mergeRunsAt(a, runs, i, less) {
  const [lo, mid] = runs[i];
  const [, hi] = runs[i + 1];
  merge(a, lo, mid, hi, less);
  runs.splice(i, 2, [lo, hi]);
}

const runLen = (r) => r[1] - r[0];

function mergeTopRuns(a, runs, less) {
  for (;;) {
    const n = runs.length;
    if (n < 2) return;
    const lastIsShort = n >= 3 && runLen(runs[n - 3]) <= runLen(runs[n - 2]) + runLen(runs[n - 1]);
    const priorIsShort = n >= 4 && runLen(runs[n - 4]) <= runLen(runs[n - 3]) + runLen(runs[n - 2]);
    const lastIsGreater = runLen(runs[n - 2]) <= runLen(runs[n - 1]);
    if (lastIsShort || priorIsShort) {
      const i = n >= 3 && runLen(runs[n - 3]) < runLen(runs[n - 1]) ? n - 3 : n - 2;
      mergeRunsAt(a, runs, i, less);
    } else if (lastIsGreater) {
      mergeRunsAt(a, runs, n - 2, less);
    } else {
      return;
    }
  }
}

// ---- Public ----

export function generatedPlan(game) {
  const g = normalize(game);
  const slots = shiftTimes(g).map(t => ({ ...slot(g, t.start, t.end), continues: t.continues }));
  const lineups = fill(plannerFor(g), slots);
  return {
    shifts: slots.map((s, i) => ({ id: `s${i}`, start: s.start, end: s.end, goalieID: s.goalieID, fieldIDs: lineups[i] })),
  };
}

export function effectivePlan(game) {
  if (game?.plan?.shifts) return game.plan;
  return generatedPlan(game);
}

function normalize(game) {
  return {
    ...game,
    availablePlayers: Array.isArray(game.availablePlayers) ? game.availablePlayers : [],
    numberOfPeriods: Number(game.numberOfPeriods) || 2,
    periodLengthMinutes: Number(game.periodLengthMinutes) || 0,
    playersOnField: Number(game.playersOnField) || 0,
    goalieH1ID: game.goalieH1ID || null,
    goalieH2ID: game.goalieH2ID || null,
  };
}

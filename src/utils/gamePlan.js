// The sub plan for a game synced from the PlayBall iOS app: a line-for-line
// port of the app's planner (PlayBall/Extensions/Game+Substitutions.swift,
// buildSubstitutionPlan, and Game+SeasonStats.swift for minutes) so the web
// shows the same shifts as the coach's phone.
//
// The phone builds the plan from the game's settings every time; nothing is
// stored. Keep this in step with the Swift: if the app's planner changes,
// this has to change with it. scripts/local-stack/plan-parity.mjs checks it
// against fixtures the Swift tests write (PlayBallTests/PlanParityFixtures).

const gcd = (a, b) => { while (b !== 0) [a, b] = [b, a % b]; return a; };

// Swift's .rounded() rounds half away from zero.
const swiftRound = (x) => (x < 0 ? -Math.round(-x) : Math.round(x));

// ---- Game helpers (Game.swift) ----

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

// ---- The plan (Game+Substitutions.swift) ----

// Returns { subDuration, segments: [[playerID]] }, exactly as the app builds it.
export function buildSubstitutionPlan(game) {
  const g = normalize(game);
  if (usesPerHalfRotation(g)) return buildPerHalfPlan(g);

  const players = fieldRotationPlayers(g);
  if (!players.length) return { subDuration: 0, segments: [] };

  const f = fieldSpots(g);
  if (players.length <= f) {
    return { subDuration: totalGameSeconds(g), segments: [players.map(p => p.id)] };
  }

  const n = players.length;
  const totalSeconds = totalGameSeconds(g);

  if (g.customSubInterval != null) {
    return buildSegmentsWithCustomInterval(g, players, g.customSubInterval, totalSeconds);
  }

  // Capped sub events per half: (subs + 1) shifts per half, aligned to halftime.
  if (g.subsPerHalf != null && g.subsPerHalf > 0) {
    const totalSegments = (g.subsPerHalf + 1) * 2;
    const s = Math.min(g.subsPerInterval ?? f, f);
    return { subDuration: totalSeconds / totalSegments, segments: slide(players, f, s, totalSegments, 0).segments };
  }

  // Swap size steps down until every player gets equal segments over a cycle.
  let s = Math.min(g.subsPerInterval ?? f, f);
  while (s > 1 && f % gcd(n, s) !== 0) s -= 1;
  const cycleLength = n / gcd(n, s);
  const totalSegments = g.substitutionStyle === 'short' ? n : cycleLength;
  return { subDuration: totalSeconds / totalSegments, segments: slide(players, f, s, totalSegments, 0).segments };
}

// Sliding window of size f over the players, advancing s each segment.
function slide(players, f, s, count, startIndex) {
  const n = players.length;
  const segments = [];
  let index = startIndex % n;
  for (let i = 0; i < count; i++) {
    segments.push(Array.from({ length: f }, (_, k) => players[(index + k) % n].id));
    index = (index + s) % n;
  }
  return { segments, next: index };
}

// Each half rotates over everyone except that half's keeper, carrying the
// rotation across the break.
function buildPerHalfPlan(g) {
  const halfSeconds = totalGameSeconds(g) / 2;
  const firstHalf = g.availablePlayers.filter(p => p.id !== g.goalieH1ID);
  const secondHalf = g.availablePlayers.filter(p => p.id !== g.goalieH2ID);
  if (!firstHalf.length || !secondHalf.length) return { subDuration: 0, segments: [] };

  const perHalf = segmentsPerHalf(g, firstHalf.length, halfSeconds);
  const segments = [];
  let startIndex = 0;
  for (const pool of [firstHalf, secondHalf]) {
    const { segments: half, next } = rotate(g, pool, perHalf, startIndex);
    segments.push(...half);
    startIndex = next;
  }
  return { subDuration: halfSeconds / perHalf, segments };
}

function rotate(g, pool, count, startIndex) {
  const n = pool.length;
  if (!n) return { segments: [], next: startIndex };
  const f = Math.min(fieldSpots(g), n);
  let s = Math.min(g.subsPerInterval ?? f, f);
  if (n > f) { while (s > 1 && f % gcd(n, s) !== 0) s -= 1; }
  return slide(pool, f, s, count, startIndex);
}

function segmentsPerHalf(g, n, halfSeconds) {
  if (!(n > fieldSpots(g))) return 1;
  if (g.customSubInterval != null && g.customSubInterval > 0) {
    return Math.max(1, Math.trunc(swiftRound(halfSeconds / g.customSubInterval)));
  }
  if (g.subsPerHalf != null && g.subsPerHalf > 0) return g.subsPerHalf + 1;
  const f = fieldSpots(g);
  let s = Math.min(g.subsPerInterval ?? f, f);
  while (s > 1 && f % gcd(n, s) !== 0) s -= 1;
  return g.substitutionStyle === 'short' ? n : n / gcd(n, s);
}

function buildSegmentsWithCustomInterval(g, players, customInterval, totalSeconds) {
  const n = players.length;
  const f = fieldSpots(g);
  let s = Math.min(g.subsPerInterval ?? f, f);
  while (s > 1 && f % gcd(n, s) !== 0) s -= 1;
  const segments = [];
  let startIndex = 0;
  let elapsed = 0;
  // A non-positive interval would never finish; the app can't save one.
  if (!(customInterval > 0)) return { subDuration: customInterval, segments: [] };
  while (elapsed < totalSeconds - 0.5) {
    segments.push(Array.from({ length: f }, (_, k) => players[(startIndex + k) % n].id));
    elapsed += customInterval;
    startIndex = (startIndex + s) % n;
  }
  return { subDuration: customInterval, segments };
}

// ---- Shifts for display ----

// The plan as timed shifts, capped to the game's length. A shift running
// through halftime is split there when the keeper changes, so each part
// names the right keeper. Minutes add up the same as the app's
// playtimeByPlayerID (keepers are credited with their half in goal).
export function effectivePlan(game) {
  const g = normalize(game);
  const { subDuration, segments } = buildSubstitutionPlan(g);
  const total = totalGameSeconds(g);
  const half = total / 2;
  const keeperAt = t => (t < half ? g.goalieH1ID : g.goalieH2ID) || null;
  const shifts = [];
  let elapsed = 0;
  for (const fieldIDs of segments) {
    if (elapsed >= total) break;
    const end = Math.min(elapsed + subDuration, total);
    const cuts = keeperAt(elapsed) !== keeperAt(end - 0.001) && elapsed < half && end > half ? [elapsed, half, end] : [elapsed, end];
    for (let i = 0; i < cuts.length - 1; i++) {
      shifts.push({ id: `s${shifts.length}`, start: cuts[i], end: cuts[i + 1], goalieID: keeperAt(cuts[i]), fieldIDs, continues: i > 0 });
    }
    elapsed = end;
  }
  return { shifts };
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
    subsPerInterval: game.subsPerInterval ?? null,
    subsPerHalf: game.subsPerHalf ?? null,
    customSubInterval: game.customSubInterval ?? null,
  };
}

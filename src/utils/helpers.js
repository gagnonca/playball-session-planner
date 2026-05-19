// Generate unique ID
export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// Get current ISO timestamp
export function nowIso() {
  return new Date().toISOString();
}

// Slugify a string for URL paths
export function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled';
}

// Download JSON file
export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Parse date string (YYYY-MM-DD) as local date, not UTC
// Prevents timezone shifts that move dates to previous/next day
export function parseLocalDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Show toast notification
export function toast(msg, duration = 1200, type = 'default') {
  const t = document.createElement("div");
  t.textContent = msg;

  const baseClasses = "fixed bottom-4 right-4 px-4 py-3 text-white border rounded-lg shadow-lg z-50 animate-fade-in max-w-xs";
  const typeClasses = type === 'error'
    ? 'bg-red-900 border-red-700'
    : 'bg-slate-800 border-slate-700';

  t.className = `${baseClasses} ${typeClasses}`;
  document.body.appendChild(t);
  setTimeout(() => {
    t.classList.add("opacity-0", "transition-opacity", "duration-300");
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// Convert file to Data URL
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Default section structure
export function defaultSection() {
  return {
    id: uid(),
    name: "",
    type: "Play",
    time: "",
    imageDataUrl: "",
    diagramData: null,
    objective: "",
    organization: "",
    guidedQA: "", // Merged questions/answers in Q1:/A1: format
    notes: "",
    variations: [],
  };
}

// Migrate old questions/answers fields to merged guidedQA format
export function migrateToGuidedQA(questions, answers) {
  if (!questions && !answers) return "";

  const qLines = (questions || "").split("\n").filter(l => l.trim());
  const aLines = (answers || "").split("\n").filter(l => l.trim());

  if (qLines.length === 0 && aLines.length === 0) return "";

  const pairs = [];
  const maxLen = Math.max(qLines.length, aLines.length);

  for (let i = 0; i < maxLen; i++) {
    const q = qLines[i] || "";
    const a = aLines[i] || "";
    // Clean up any existing Q:/A: prefixes
    const cleanQ = q.replace(/^Q\d*[:.]?\s*/i, "").trim();
    const cleanA = a.replace(/^A\d*[:.]?\s*/i, "").trim();

    if (cleanQ || cleanA) {
      pairs.push(`Q${i + 1}: ${cleanQ}\nA${i + 1}: ${cleanA}`);
    }
  }

  return pairs.join("\n\n");
}

// Default variation structure
export function defaultVariation() {
  return {
    id: uid(),
    name: "",
    objective: "",
    organization: "",
    guidedQA: "", // Merged questions/answers in Q1:/A1: format
    notes: "",
    imageDataUrl: "",
    diagramData: null,
  };
}

// Section to library payload (strip IDs for fresh inserts)
export function sectionToLibraryPayload(section) {
  const s = structuredClone(section);
  delete s.id;
  if (Array.isArray(s.variations)) {
    s.variations = s.variations.map(v => {
      const vv = structuredClone(v);
      delete vv.id;
      return vv;
    });
  }
  return s;
}

// Library payload to section.
// If the caller passes the library item's id, the produced section adopts it —
// edits to the section then flow back to the same library entry by id.
// Variations are sub-entities and always get fresh uids.
export function libraryPayloadToSection(payload, id = null) {
  const s = defaultSection();
  Object.assign(s, structuredClone(payload));
  s.id = id || uid();
  s.variations = (payload.variations || []).map(vp => {
    const v = defaultVariation();
    Object.assign(v, structuredClone(vp));
    v.id = uid();
    return v;
  });
  return s;
}

// Session to library payload.
// Strips session-level id + ephemeral fields, but preserves section/variation ids
// so loading this session back from the library keeps each section tied to its
// library exercise entry (section.id = library exercise id).
export function sessionToLibraryPayload(session) {
  const s = structuredClone(session);
  delete s.id;
  delete s.selectedSectionId;
  delete s.createdAt;
  delete s.updatedAt;
  if (s.summary) {
    s.summary.date = '';
    s.summary.reflectionNotes = '';
  }
  return s;
}

// Library payload to session.
// If the caller passes the library item's id, the produced session adopts it.
// Sections carry their own ids; if the stored payload has section ids (new format)
// preserve them, otherwise mint fresh uids (legacy payloads where ids were stripped).
export function libraryPayloadToSession(payload, teamDefaults = null, id = null) {
  const session = defaultSession(teamDefaults);
  if (id) session.id = id;
  const p = structuredClone(payload);
  // Overlay summary (keep team defaults for ageGroup/duration if not in payload)
  if (p.summary) {
    session.summary = {
      ...session.summary,
      ...p.summary,
      date: '', // Always clear date
    };
  }
  // Rebuild sections; preserve ids present in payload, else mint fresh
  session.sections = (p.sections || []).map(sec => {
    const s = defaultSection();
    Object.assign(s, sec);
    s.id = sec.id || uid();
    s.variations = (sec.variations || []).map(vp => {
      const v = defaultVariation();
      Object.assign(v, vp);
      v.id = vp.id || uid();
      return v;
    });
    return s;
  });
  return session;
}

// Default team structure
export function defaultTeam(name = "My Team", ageGroup = "") {
  return {
    id: uid(),
    name,
    ageGroup,
    defaultDuration: "60", // Default session duration
    createdAt: nowIso(),
    updatedAt: nowIso(),
    sessions: [],
    // Sharing metadata for AC sharing
    sharing: {
      isShared: false,
      shareToken: null,
      sharedAt: null,
      lastPushedAt: null,
    },
  };
}

// Default session structure
// Accepts optional teamDefaults { ageGroup, defaultDuration } to pre-fill session
export function defaultSession(teamDefaults = null) {
  return {
    id: uid(),
    summary: {
      title: "",
      date: "",
      duration: teamDefaults?.defaultDuration || "",
      ageGroup: teamDefaults?.ageGroup || "",
      moment: "",
      playerActions: [],
      keyQualities: [],
      notes: "",
      keywords: "",
      reflectionNotes: "",
    },
    sections: [],
    selectedSectionId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    isTemplate: false,
  };
}

// Aggregate keywords from all sections into a single comma-separated string
export function aggregateSectionKeywords(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return "";
  }

  const keywordSet = new Set();

  sections.forEach(section => {
    // Get keywords from section
    if (section.keywords && typeof section.keywords === "string") {
      const sectionKeywords = section.keywords
        .split(",")
        .map(k => k.trim())
        .filter(k => k.length > 0);
      sectionKeywords.forEach(k => keywordSet.add(k));
    }

    // Get keywords from variations
    if (Array.isArray(section.variations)) {
      section.variations.forEach(variation => {
        if (variation.keywords && typeof variation.keywords === "string") {
          const varKeywords = variation.keywords
            .split(",")
            .map(k => k.trim())
            .filter(k => k.length > 0);
          varKeywords.forEach(k => keywordSet.add(k));
        }
      });
    }
  });

  return Array.from(keywordSet).join(", ");
}

// Per-entity last-write-wins merge by updatedAt. Used on every pull so a stale
// tab picks up other-device edits without overwriting its own unflushed work
// (writes flush to the server on a 30s debounce).
export function mergeTeamsData(local, remote) {
  const localTeams = (local && local.teams) || [];
  const remoteTeams = (remote && remote.teams) || [];
  const byId = new Map();
  for (const rt of remoteTeams) byId.set(rt.id, rt);
  for (const lt of localTeams) {
    const rt = byId.get(lt.id);
    if (!rt) { byId.set(lt.id, lt); continue; }
    const sessionsById = new Map();
    for (const rs of rt.sessions || []) sessionsById.set(rs.id, rs);
    for (const ls of lt.sessions || []) {
      const rs = sessionsById.get(ls.id);
      if (!rs) { sessionsById.set(ls.id, ls); continue; }
      sessionsById.set(ls.id, (ls.updatedAt || '') >= (rs.updatedAt || '') ? ls : rs);
    }
    const teamPick = (lt.updatedAt || '') >= (rt.updatedAt || '') ? lt : rt;
    // Server-owned fields (mirrored from iOS team-share/push or set by the
    // link-ios endpoint) are not edited on the web — always prefer what the
    // remote returned. Without this, a tie or any local-wins case wipes the
    // newly-merged roster, games, or iOS share linkage from state.
    byId.set(lt.id, {
      ...teamPick,
      iosShareCode: rt.iosShareCode ?? teamPick.iosShareCode ?? null,
      players: Array.isArray(rt.players) ? rt.players : (teamPick.players || []),
      games: Array.isArray(rt.games) ? rt.games : (teamPick.games || []),
      sessions: Array.from(sessionsById.values()),
    });
  }
  return {
    ...remote,
    ...local,
    teams: Array.from(byId.values()),
  };
}

// Migrate legacy session structure to team-based structure
export function migrateToTeamStructure(legacySession) {
  // Create default team
  const team = defaultTeam("My Team", legacySession?.summary?.ageGroup || "");

  // If legacy session exists, convert it
  if (legacySession && legacySession.summary) {
    const session = defaultSession();

    // Copy summary data
    session.summary = {
      ...session.summary,
      ...legacySession.summary,
      // Aggregate keywords from sections if not already set
      keywords: legacySession.summary.keywords || aggregateSectionKeywords(legacySession.sections || []),
      // Ensure notes field exists
      notes: legacySession.summary.notes || "",
    };

    // Copy sections
    session.sections = legacySession.sections || [];
    session.selectedSectionId = legacySession.selectedSectionId || null;
    session.createdAt = legacySession.createdAt || nowIso();
    session.updatedAt = nowIso();

    // Add session to team
    team.sessions.push(session);
  }

  // Return teams structure
  return {
    version: 1,
    teams: [team],
    defaultTeamId: team.id,
  };
}

// Get default starter library items
export function getStarterLibraryItems() {
  const freePlay = {
    id: uid(),
    name: "Free Play (2v2 small goals)",
    type: "Play",
    payload: {
      name: "Free Play (2v2 small goals)",
      type: "Play",
      time: "",
      imageDataUrl: "",
      objective: "Let players play. Encourage lots of touches, bravery, and quick restarts.",
      organization: "Set up 2v2 (or 3v3) with small goals. Multiple fields if needed.",
      keywords: "Play, compete, score, restart",
      guidedQA: "Q1: How can you get the ball away from pressure?\nA1: Change direction, shield, pass to space\n\nQ2: Where is the space?\nA2: Look for gaps, dribble into open areas",
      notes: "",
      variations: []
    },
    updatedAt: nowIso(),
  };

  const theGame = {
    id: uid(),
    name: "The Game (scrimmage)",
    type: "Play",
    payload: {
      name: "The Game (scrimmage)",
      type: "Play",
      time: "",
      imageDataUrl: "",
      objective: "Transfer learning into a game. Minimal stoppages, coach on the fly.",
      organization: "4v4/5v5 scrimmage. Let them solve problems. Keep it fun and fast.",
      keywords: "Scan, space, support, defend",
      guidedQA: "Q1: Where can you support?\nA1: Move to open space, offer an angle\n\nQ2: When can you win it back?\nA2: Press when close, recover when far",
      notes: "",
      variations: []
    },
    updatedAt: nowIso(),
  };

  return [freePlay, theGame];
}

// Generate unique ID
export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// Get current ISO timestamp
export function nowIso() {
  return new Date().toISOString();
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

// Show toast notification
export function toast(msg, duration = 1200) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.className = "fixed bottom-4 right-4 px-4 py-3 bg-slate-800 text-white border border-slate-700 rounded-lg shadow-lg z-50 animate-fade-in";
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
    objective: "",
    organization: "",
    questions: "",
    answers: "",
    notes: "",
    variations: [],
  };
}

// Default variation structure
export function defaultVariation() {
  return {
    id: uid(),
    name: "",
    objective: "",
    organization: "",
    questions: "",
    answers: "",
    notes: "",
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

// Library payload to section (add fresh IDs)
export function libraryPayloadToSection(payload) {
  const s = defaultSection();
  Object.assign(s, structuredClone(payload));
  s.id = uid();
  s.variations = (payload.variations || []).map(vp => {
    const v = defaultVariation();
    Object.assign(v, structuredClone(vp));
    v.id = uid();
    return v;
  });
  return s;
}

// Default team structure
export function defaultTeam(name = "My Team", ageGroup = "") {
  return {
    id: uid(),
    name,
    ageGroup,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    sessions: [],
  };
}

// Default session structure
export function defaultSession() {
  return {
    id: uid(),
    summary: {
      title: "",
      date: "",
      duration: "",
      ageGroup: "",
      moment: "",
      playerActions: [],
      keyQualities: [],
      notes: "",
      keywords: "",
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
      questions: "How can you get the ball away from pressure? Where is space?",
      answers: "Change direction, shield, pass to space, dribble into space.",
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
      questions: "Where can you support? When can you win it back?",
      answers: "Move to open space, offer an angle, press when close, recover when far.",
      notes: "",
      variations: []
    },
    updatedAt: nowIso(),
  };

  return [freePlay, theGame];
}

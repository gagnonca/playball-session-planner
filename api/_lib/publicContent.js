// Everything published to the public Community passes through here first.
//
// Allow-list only: anything not named below is dropped. In particular there
// are NO image fields — no imageDataUrl, dataUrl, legacy diagram PNGs or URLs.
// Diagrams survive only as vector shapes (players, cones, goals, arrows),
// which every viewer re-draws with PlayBall's own renderer, so a published
// item can never carry a picture someone uploaded or crafted.
//
// Rich text keeps a handful of formatting tags with no attributes, so other
// coaches' text can't run script or load anything in a viewer's browser.

const MAX = { title: 120, short: 200, text: 4000, label: 12, list: 30, shapes: 300, points: 60, sections: 30, variations: 10 };

const SHAPE_KINDS = new Set(['attacker', 'defender', 'ball', 'cone', 'goal', 'pass', 'run', 'dribble']);
const LINE_KINDS = new Set(['pass', 'run', 'dribble']);
const GOAL_VARIANTS = new Set(['regulation', 'training', 'pugg-6ft', 'pugg-4ft']);
const PITCH_SIZES = new Set(['4v4', '7v7', '9v9', '11v11']);
const PITCH_VIEWS = new Set(['full', 'half', 'third']);
const ORIENTATIONS = new Set(['horizontal', 'vertical']);
const ALLOWED_TAGS = new Set(['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u']);

const num = (v, lo = -5000, hi = 5000) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : undefined;
};
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const strList = (v, maxItem = MAX.short) =>
  Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, MAX.list).map(x => x.slice(0, maxItem)) : [];

// Keep only allow-listed tags, stripped of every attribute; drop script/style
// bodies entirely. Text content is kept as-is (entities included).
export function safeRichText(html, max = MAX.text) {
  if (typeof html !== 'string') return '';
  let s = html.replace(/<(script|style|iframe|object|embed|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (m, tag) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return '';
    return m.startsWith('</') ? `</${t}>` : (t === 'br' ? '<br>' : `<${t}>`);
  });
  s = s.replace(/<(?![a-z/])/gi, '&lt;'); // stray "<" that isn't one of our tags
  return s.slice(0, max);
}

function safeShape(s) {
  if (!s || !SHAPE_KINDS.has(s.kind)) return null;
  const out = { id: str(s.id, 64) || Math.random().toString(36).slice(2), kind: s.kind };
  if (LINE_KINDS.has(s.kind)) {
    if (Array.isArray(s.points) && s.points.length >= 2) {
      out.points = s.points.slice(0, MAX.points)
        .map(p => ({ x: num(p?.x), y: num(p?.y) }))
        .filter(p => p.x !== undefined && p.y !== undefined);
      if (out.points.length < 2) return null;
    } else {
      for (const k of ['x1', 'y1', 'x2', 'y2']) {
        out[k] = num(s[k]);
        if (out[k] === undefined) return null;
      }
      if (s.bend !== undefined) out.bend = num(s.bend, -500, 500);
    }
  } else {
    out.x = num(s.x);
    out.y = num(s.y);
    if (out.x === undefined || out.y === undefined) return null;
    if (s.rotation !== undefined) out.rotation = num(s.rotation, -720, 720);
    if (s.scale !== undefined) out.scale = num(s.scale, 0.2, 5);
    if (s.label !== undefined) out.label = str(s.label, MAX.label);
    if (s.kind === 'goal' && GOAL_VARIANTS.has(s.variant)) out.variant = s.variant;
  }
  if (typeof s.color === 'string' && /^#[0-9a-f]{6}$/i.test(s.color)) out.color = s.color;
  return out;
}

// A diagram as vector data only. Returns null when there's nothing to draw
// (e.g. a legacy image-only diagram), so callers can leave it out.
export function safeDiagram(d) {
  if (!d || !Array.isArray(d.shapes)) return null;
  const shapes = d.shapes.slice(0, MAX.shapes).map(safeShape).filter(Boolean);
  if (shapes.length === 0) return null;
  return {
    shapes,
    pitchSize: PITCH_SIZES.has(d.pitchSize) ? d.pitchSize : '11v11',
    pitchView: PITCH_VIEWS.has(d.pitchView) ? d.pitchView : 'full',
    orientation: ORIENTATIONS.has(d.orientation) ? d.orientation : 'horizontal',
  };
}

function safeBlock(b) {
  // A section (exercise) or one of its variations.
  return {
    name: str(b?.name, MAX.title),
    type: str(b?.type, 40),
    time: str(b?.time, 20),
    objective: safeRichText(b?.objective),
    organization: safeRichText(b?.organization),
    keywords: str(b?.keywords, MAX.short),
    guidedQA: str(b?.guidedQA, MAX.text),
    notes: safeRichText(b?.notes),
    diagramData: safeDiagram(b?.diagramData),
  };
}

export function safeExercise(p) {
  return {
    ...safeBlock(p),
    variations: (Array.isArray(p?.variations) ? p.variations : []).slice(0, MAX.variations).map(safeBlock),
  };
}

export function safeSession(p) {
  // Library-session payload: { summary, sections }. Dates and post-session
  // reflections are the coach's own business and never published.
  const s = p?.summary || {};
  return {
    summary: {
      title: str(s.title, MAX.title),
      duration: str(s.duration, 20),
      ageGroup: str(s.ageGroup, 20),
      moment: str(s.moment, 40),
      playerActions: strList(s.playerActions, 40),
      keyQualities: strList(s.keyQualities, 40),
      keywords: str(s.keywords, MAX.short),
      notes: safeRichText(s.notes),
    },
    sections: (Array.isArray(p?.sections) ? p.sections : []).slice(0, MAX.sections).map(safeExercise),
  };
}

export function safeTags(t) {
  return {
    ageGroup: str(t?.ageGroup, 20),
    moment: str(t?.moment, 40),
    type: str(t?.type, 40),
  };
}

export function sanitizePublic(kind, payload) {
  if (kind === 'session') return safeSession(payload);
  if (kind === 'exercise') return safeExercise(payload);
  if (kind === 'diagram') return safeDiagram(payload);
  return null;
}

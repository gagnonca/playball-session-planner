// Best-effort migrator: legacy `elements` (stamps) + `lines` (polylines from
// the old DiagramBuilder) → playground `shapes`. Positions and rotations carry
// over directly; line polylines become explicit {x,y}[] points; labels reset
// (the legacy builder didn't store per-stamp labels) and are reassigned as
// A1/A2/D1/D2... so the migrated diagram reads sensibly out of the box.

const MARKER_KINDS = new Set(['attacker', 'defender', 'ball', 'goal', 'cone']);

export function migrateLegacyToShapes(elements = [], lines = []) {
  const out = [];
  let attackerN = 0;
  let defenderN = 0;

  for (const el of elements || []) {
    const kind = el?.type;
    if (!MARKER_KINDS.has(kind)) continue;
    const label =
      kind === 'attacker' ? `A${++attackerN}` :
      kind === 'defender' ? `D${++defenderN}` :
      '';
    out.push({
      id: el.id || `mig-${Math.random().toString(36).slice(2, 10)}`,
      kind,
      x: typeof el.x === 'number' ? el.x : 0,
      y: typeof el.y === 'number' ? el.y : 0,
      label,
      color: el.color,
      rotation: typeof el.rotation === 'number' ? el.rotation : 0,
      scale: typeof el.scaleX === 'number' ? el.scaleX : 1,
    });
  }

  for (const ln of lines || []) {
    const pts = Array.isArray(ln?.points) ? ln.points : [];
    if (pts.length < 4) continue;
    let kind = 'pass';
    if (ln.type === 'run' || ln.type === 'dashed') kind = 'run';
    else if (ln.type === 'dribble' || ln.type === 'squiggly') kind = 'dribble';
    const ptsObjects = [];
    for (let i = 0; i + 1 < pts.length; i += 2) {
      ptsObjects.push({ x: pts[i], y: pts[i + 1] });
    }
    out.push({
      id: ln.id || `mig-${Math.random().toString(36).slice(2, 10)}`,
      kind,
      points: ptsObjects,
      color: ln.color || '#1a1814',
    });
  }

  return out;
}

// Treat a diagram-library entry as "classic" when there's no non-empty shapes
// array but there is legacy content (elements/lines) or a saved image to
// migrate around. Same rule the playground uses to decide legacy mode.
export function isClassicDiagram(d) {
  if (!d) return false;
  if (Array.isArray(d.shapes) && d.shapes.length > 0) return false;
  const hasLegacyMarkers = Array.isArray(d.elements) && d.elements.length > 0;
  const hasLegacyLines = Array.isArray(d.lines) && d.lines.length > 0;
  const hasImage = !!(d.dataUrl || d.imageDataUrl);
  return hasLegacyMarkers || hasLegacyLines || hasImage;
}

// True only when the migrator would actually produce shapes — separates "we
// can convert this" from "this is classic but the source data is too thin".
export function canMigrateDiagram(d) {
  if (!d) return false;
  const hasLegacyMarkers = Array.isArray(d.elements) && d.elements.length > 0;
  const hasLegacyLines = Array.isArray(d.lines) && d.lines.length > 0;
  return hasLegacyMarkers || hasLegacyLines;
}

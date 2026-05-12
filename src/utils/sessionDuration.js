// Tiny helpers shared between SessionBuilder's top-bar DurationChip and the
// SessionRail's PLAN totals. Section.time is free-form text ("12 min", "10",
// "12 min - 15 min") so we extract the first integer; the chip + rail agree
// on the same loose interpretation.

export function parseMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = String(timeStr).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function planTotal(sections) {
  return (sections || []).reduce((sum, s) => sum + parseMinutes(s.time), 0);
}

// Counts referenced exercises (= named sections) and diagrams (= sections
// or variations carrying diagram data) for the cascading share explainer.
export function countReferenced(sections) {
  let exercises = 0;
  let diagrams = 0;
  for (const s of sections || []) {
    if ((s.name || '').trim()) exercises++;
    if (s.diagramData || s.imageDataUrl) diagrams++;
    for (const v of s.variations || []) {
      if (v.diagramData || v.imageDataUrl) diagrams++;
    }
  }
  return { exercises, diagrams };
}

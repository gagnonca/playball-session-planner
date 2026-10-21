// Postgres row → client object mappers. Single source for every endpoint that
// hands entities to the web client (snapshot, PUT responses, legacy blob
// GETs), so `version` and `updatedAt` always ride along the same way.

export function teamFromRow(t) {
  return {
    id: t.id,
    name: t.name,
    ageGroup: t.age_group ?? '',
    defaultDuration: t.default_duration ?? '',
    sharing: t.sharing || { isShared: false },
    archived: !!t.archived,
    iosShareCode: t.ios_share_code ?? null,
    players: Array.isArray(t.players) ? t.players : [],
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    version: t.version ?? 1,
  };
}

export function sessionFromRow(s) {
  // The summary column historically absorbed every non-section field the
  // client sent, including stale client-side id/updatedAt/version values.
  // Row columns win over anything that leaked into it.
  const { id: _id, version: _v, updatedAt: _u, sections: _s, isTemplate: _t, ...summary } = s.summary || {};
  return {
    ...summary,
    id: s.id,
    sections: s.sections || [],
    isTemplate: !!s.is_template,
    updatedAt: s.updated_at,
    version: s.version ?? 1,
  };
}

export function gameFromRow(g) {
  return {
    id: g.id,
    name: g.name,
    date: g.date,
    is_home: g.is_home,
    payload: g.payload || {},
    updatedAt: g.updated_at,
    version: g.version ?? 1,
  };
}

// Library rows were written two ways: the legacy blob mirror stored the whole
// item ({ id, name, type, tags, payload }) in `payload`, while v2 PUTs store
// only the inner section/session payload. Normalize both to the item shape.
export function libraryItemFromRow(r) {
  const p = r.payload || {};
  const isWholeItem = p && typeof p === 'object' && p.id && p.payload && typeof p.payload === 'object';
  return {
    id: r.id,
    name: r.name,
    ...(r.type !== undefined ? { type: r.type ?? (isWholeItem ? p.type : null) } : {}),
    tags: r.tags || (isWholeItem ? p.tags : {}) || {},
    payload: isWholeItem ? p.payload : p,
    updatedAt: r.updated_at,
    version: r.version ?? 1,
  };
}

export function diagramFromRow(r) {
  const p = r.payload && typeof r.payload === 'object' ? r.payload : {};
  return {
    ...p,
    id: r.id,
    name: r.name ?? p.name ?? 'Untitled Diagram',
    updatedAt: r.updated_at,
    version: r.version ?? 1,
  };
}

export function templateFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    exerciseIds: Array.isArray(r.exercise_ids) ? r.exercise_ids : [],
    updatedAt: r.updated_at,
    version: r.version ?? 1,
  };
}

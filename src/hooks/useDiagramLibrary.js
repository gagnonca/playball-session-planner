import { useState, useEffect, useCallback } from 'react';
import { generateId } from '../utils/id';
import { DIAGRAMS_KEY, COACH_IDENTITY_KEY } from '../constants/storage';

// Get current ISO timestamp
const nowIso = () => new Date().toISOString();

// Diagram library: localStorage-first (instant) with per-entity sync to the
// `diagrams` table on Postgres so a coach's library survives device + origin
// changes. Sync mirrors useLibrary's pattern: pgPut on each save/update, pgDelete
// on remove, and a one-shot pull on app mount via setDiagramsRaw.
export default function useDiagramLibrary() {
  const [diagrams, setDiagrams] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load diagrams from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DIAGRAMS_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setDiagrams(data.diagrams || []);
      }
    } catch (error) {
      console.error('Error loading diagram library:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save diagrams to localStorage whenever they change.
  // Strip inline base64 dataUrls (they can be 5-20MB each) — only persist
  // CDN URLs. The diagram can be regenerated from elements/lines if needed.
  useEffect(() => {
    if (isLoaded) {
      try {
        const compact = diagrams.map(d => {
          // Keep CDN URLs (https://...), strip base64 data URLs
          if (d.dataUrl && d.dataUrl.startsWith('data:')) {
            const { dataUrl: _strip, ...rest } = d;
            return rest;
          }
          return d;
        });
        localStorage.setItem(DIAGRAMS_KEY, JSON.stringify({ diagrams: compact }));
      } catch (error) {
        console.error('Error saving diagram library:', error);
      }
    }
  }, [diagrams, isLoaded]);

  // Save or update a diagram in the library (upserts by name)
  // tags: { ageGroup?: string, moments?: string[], type?: string }
  const saveDiagram = (diagramData, name, description = '', tags = {}) => {
    const resolvedName = name || 'Untitled Diagram';
    const normalizedTags = {
      ageGroup: tags.ageGroup || '',
      moments: Array.isArray(tags.moments) ? tags.moments : (tags.moment ? [tags.moment] : []),
      type: tags.type || '',
    };

    // Konva playground state — without these, editing the library diagram
    // later falls back to legacy mode and shows the "can't be edited here"
    // overlay, even though it was saved by the new playground.
    const konvaState = {
      shapes: Array.isArray(diagramData.shapes) ? diagramData.shapes : undefined,
      pitchSize: diagramData.pitchSize,
      pitchView: diagramData.pitchView,
      orientation: diagramData.orientation,
    };

    let result;
    setDiagrams(prev => {
      const existing = prev.find(d => (d.name || '').toLowerCase() === resolvedName.toLowerCase());
      if (existing) {
        const updated = {
          ...existing,
          name: resolvedName,
          description,
          dataUrl: diagramData.dataUrl,
          elements: diagramData.elements || [],
          lines: diagramData.lines || [],
          fieldType: diagramData.fieldType || 'full',
          ...konvaState,
          tags: normalizedTags,
          updatedAt: nowIso(),
        };
        result = updated;
        return prev.map(d => d.id === existing.id ? updated : d);
      }
      const newDiagram = {
        id: generateId('diagram'),
        name: resolvedName,
        description,
        dataUrl: diagramData.dataUrl,
        elements: diagramData.elements || [],
        lines: diagramData.lines || [],
        fieldType: diagramData.fieldType || 'full',
        ...konvaState,
        tags: normalizedTags,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      result = newDiagram;
      return [newDiagram, ...prev];
    });
    if (result) pushDiagram(result);
    return result;
  };

  // Update an existing diagram
  const updateDiagram = (id, updates) => {
    let updated = null;
    setDiagrams(prev =>
      prev.map(diagram => {
        if (diagram.id !== id) return diagram;
        updated = { ...diagram, ...updates, updatedAt: nowIso() };
        return updated;
      })
    );
    if (updated) pushDiagram(updated);
  };

  // Delete a diagram from the library
  const deleteDiagram = (id) => {
    setDiagrams(prev => prev.filter(diagram => diagram.id !== id));
    pgDelete(`/api/v2/diagrams/${encodeURIComponent(id)}`);
  };

  // Get a single diagram by ID
  const getDiagram = (id) => {
    return diagrams.find(diagram => diagram.id === id);
  };

  // Duplicate a diagram
  const duplicateDiagram = (id) => {
    const original = getDiagram(id);
    if (!original) return null;

    const duplicated = {
      ...original,
      id: generateId('diagram'),
      name: `${original.name} (Copy)`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    setDiagrams(prev => [duplicated, ...prev]);
    pushDiagram(duplicated);
    return duplicated;
  };

  // Sync entry point — replace local state from a server pull. Merges by id
  // and prefers newer updatedAt so concurrent edits across devices win.
  const setDiagramsRaw = useCallback((incoming) => {
    if (!Array.isArray(incoming)) return;
    setDiagrams(prev => mergeDiagramsByIdAndRecency(prev, incoming));
  }, []);

  // One-shot migration helper: push every local diagram to Postgres. Used to
  // hydrate the server with diagrams that pre-date diagram sync. pgPut is an
  // upsert so re-pushing an already-synced row is harmless.
  const pushAllToServer = useCallback((existingServerIds = []) => {
    const skip = new Set(existingServerIds);
    let pushed = 0;
    for (const d of diagrams) {
      if (skip.has(d.id)) continue;
      pushDiagram(d);
      pushed += 1;
    }
    return pushed;
  }, [diagrams]);

  return {
    diagrams,
    isLoaded,
    saveDiagram,
    updateDiagram,
    deleteDiagram,
    getDiagram,
    duplicateDiagram,
    setDiagramsRaw,
    pushAllToServer,
  };
}

// ---------- sync helpers ----------

// Build the headers Postgres-mirror endpoints expect. Returns null when there's
// no linked coach identity — in that case calls become no-ops.
function syncHeaders() {
  try {
    const raw = localStorage.getItem(COACH_IDENTITY_KEY);
    if (!raw) return null;
    const identity = JSON.parse(raw);
    if (!identity?.coachId || !identity?.deviceId) return null;
    return {
      'Content-Type': 'application/json',
      'x-coach-id': identity.coachId,
      'x-device-id': identity.deviceId,
    };
  } catch {
    return null;
  }
}

function pgDelete(path) {
  const headers = syncHeaders();
  if (!headers) return;
  fetch(path, { method: 'DELETE', headers })
    .catch(err => console.warn('pgDelete failed', path, err));
}

function pushDiagram(diagram) {
  if (!diagram?.id) return;
  // Strip inline base64 before mirroring — payloads can be huge and Postgres
  // already serves CDN URLs from the saved imageDataUrl side of the section.
  const payload = (diagram.dataUrl && diagram.dataUrl.startsWith('data:'))
    ? { ...diagram, dataUrl: undefined }
    : diagram;
  const headers = syncHeaders();
  if (!headers) return;
  fetch(`/api/v2/diagrams/${encodeURIComponent(diagram.id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ name: diagram.name || null, payload }),
  }).catch(err => console.warn('pgPut diagram failed', diagram.id, err));
}

function mergeDiagramsByIdAndRecency(existing, incoming) {
  const byId = new Map();
  for (const d of existing) {
    if (d?.id) byId.set(d.id, d);
  }
  for (const d of incoming) {
    if (!d?.id) continue;
    const prev = byId.get(d.id);
    if (!prev) { byId.set(d.id, d); continue; }
    const a = prev.updatedAt || '';
    const b = d.updatedAt || '';
    byId.set(d.id, a.localeCompare(b) >= 0 ? prev : d);
  }
  return Array.from(byId.values()).sort((a, b) =>
    (b.updatedAt || '').localeCompare(a.updatedAt || '')
  );
}

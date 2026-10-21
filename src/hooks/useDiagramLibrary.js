import { useCallback } from 'react';
import { generateId } from '../utils/id';
import { useStore, getState, diagrams as diagramStore } from '../data/store';

// Get current ISO timestamp
const nowIso = () => new Date().toISOString();

// Diagram library: rows in the `diagrams` table, read from the server
// snapshot (data/store.js). Every save/update/delete writes immediately.
export default function useDiagramLibrary() {
  const diagrams = useStore(st => st.diagrams);
  const isLoaded = useStore(st => st.teamsData !== null);

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

    const existing = getState().diagrams.find(d => (d.name || '').toLowerCase() === resolvedName.toLowerCase());
    let result;
    if (existing) {
      result = {
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
    } else {
      result = {
        id: generateId('diagram'),
        version: null,
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
    }
    diagramStore.put(result);
    return result;
  };

  // Update an existing diagram
  const updateDiagram = (id, updates) => {
    const current = getState().diagrams.find(d => d.id === id);
    if (!current) return;
    diagramStore.put({ ...current, ...updates, updatedAt: nowIso() });
  };

  // Delete a diagram from the library
  const deleteDiagram = (id) => diagramStore.remove(id);

  // Get a single diagram by ID
  const getDiagram = useCallback((id) => {
    return diagrams.find(diagram => diagram.id === id);
  }, [diagrams]);

  // Duplicate a diagram
  const duplicateDiagram = (id) => {
    const original = getDiagram(id);
    if (!original) return null;

    const duplicated = {
      ...original,
      id: generateId('diagram'),
      version: null,
      name: `${original.name} (Copy)`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    diagramStore.put(duplicated);
    return duplicated;
  };

  return {
    diagrams,
    isLoaded,
    saveDiagram,
    updateDiagram,
    deleteDiagram,
    getDiagram,
    duplicateDiagram,
  };
}

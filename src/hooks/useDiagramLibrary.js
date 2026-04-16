import { useState, useEffect } from 'react';
import { generateId } from '../utils/id';
import { DIAGRAMS_KEY } from '../constants/storage';

// Get current ISO timestamp
const nowIso = () => new Date().toISOString();

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
        tags: normalizedTags,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      result = newDiagram;
      return [newDiagram, ...prev];
    });
    return result;
  };

  // Update an existing diagram
  const updateDiagram = (id, updates) => {
    setDiagrams(prev =>
      prev.map(diagram =>
        diagram.id === id
          ? { ...diagram, ...updates, updatedAt: nowIso() }
          : diagram
      )
    );
  };

  // Delete a diagram from the library
  const deleteDiagram = (id) => {
    setDiagrams(prev => prev.filter(diagram => diagram.id !== id));
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

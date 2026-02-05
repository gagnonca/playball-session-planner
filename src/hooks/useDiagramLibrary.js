import { useState, useEffect } from 'react';

const DIAGRAMS_KEY = 'ppp_diagram_library_v1';

// Generate unique ID
const uid = () => `diagram-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

  // Save diagrams to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(DIAGRAMS_KEY, JSON.stringify({ diagrams }));
      } catch (error) {
        console.error('Error saving diagram library:', error);
      }
    }
  }, [diagrams, isLoaded]);

  // Save a new diagram to the library
  // tags: { ageGroup?: string, moments?: string[], type?: string }
  const saveDiagram = (diagramData, name, description = '', tags = {}) => {
    const newDiagram = {
      id: uid(),
      name: name || 'Untitled Diagram',
      description,
      dataUrl: diagramData.dataUrl,
      elements: diagramData.elements || [],
      lines: diagramData.lines || [],
      fieldType: diagramData.fieldType || 'full',
      tags: {
        ageGroup: tags.ageGroup || '',
        moments: Array.isArray(tags.moments) ? tags.moments : (tags.moment ? [tags.moment] : []),
        type: tags.type || '',
      },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    setDiagrams(prev => [newDiagram, ...prev]);
    return newDiagram;
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
      id: uid(),
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

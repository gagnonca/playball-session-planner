import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { TOOL_MODES, CONE_COLORS, DEFAULT_FIELD, FIELD_TEMPLATES, generateId } from './utils/constants';

const DiagramContext = createContext(null);

export const useDiagram = () => {
  const context = useContext(DiagramContext);
  if (!context) {
    throw new Error('useDiagram must be used within a DiagramProvider');
  }
  return context;
};

export const DiagramProvider = ({ children, initialDiagram }) => {
  // Tool state
  const [toolMode, setToolMode] = useState(TOOL_MODES.SELECT);
  const [selectedConeColor, setSelectedConeColor] = useState(CONE_COLORS[0].color);

  // Field state
  const [fieldType, setFieldType] = useState(() => {
    if (initialDiagram?.fieldType) {
      const found = FIELD_TEMPLATES.find(f => f.value === initialDiagram.fieldType);
      return found || DEFAULT_FIELD;
    }
    return DEFAULT_FIELD;
  });

  // Elements state
  const [shapes, setShapes] = useState(initialDiagram?.elements || []);
  const [lines, setLines] = useState(initialDiagram?.lines || []);

  // Selection state
  const [selectedShapeIds, setSelectedShapeIds] = useState([]);
  const [selectedLineIds, setSelectedLineIds] = useState([]);

  // Drawing state
  const [currentLine, setCurrentLine] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Diagram name
  const [diagramName, setDiagramName] = useState(initialDiagram?.name || '');

  // Stage ref for export
  const stageRef = useRef(null);

  // Shape management
  const addShape = useCallback((type, x, y, extraProps = {}) => {
    const newShape = {
      id: generateId(type),
      type,
      x,
      y,
      rotation: 0,
      ...extraProps,
    };
    setShapes(prev => [...prev, newShape]);
    return newShape.id;
  }, []);

  const updateShape = useCallback((id, updates) => {
    setShapes(prev =>
      prev.map(shape => (shape.id === id ? { ...shape, ...updates } : shape))
    );
  }, []);

  const deleteShape = useCallback((id) => {
    setShapes(prev => prev.filter(shape => shape.id !== id));
    setSelectedShapeIds(prev => prev.filter(sid => sid !== id));
  }, []);

  const deleteSelectedShapes = useCallback(() => {
    setShapes(prev => prev.filter(shape => !selectedShapeIds.includes(shape.id)));
    setSelectedShapeIds([]);
  }, [selectedShapeIds]);

  // Line management
  const addLine = useCallback((lineData) => {
    const newLine = {
      id: generateId('line'),
      hasArrow: true,
      ...lineData,
    };
    setLines(prev => [...prev, newLine]);
    return newLine.id;
  }, []);

  const updateLine = useCallback((id, updates) => {
    setLines(prev =>
      prev.map(line => (line.id === id ? { ...line, ...updates } : line))
    );
  }, []);

  const deleteLine = useCallback((id) => {
    setLines(prev => prev.filter(line => line.id !== id));
    setSelectedLineIds(prev => prev.filter(lid => lid !== id));
  }, []);

  const deleteSelectedLines = useCallback(() => {
    setLines(prev => prev.filter(line => !selectedLineIds.includes(line.id)));
    setSelectedLineIds([]);
  }, [selectedLineIds]);

  // Delete all selected items
  const deleteSelected = useCallback(() => {
    deleteSelectedShapes();
    deleteSelectedLines();
  }, [deleteSelectedShapes, deleteSelectedLines]);

  // Selection management
  const selectShape = useCallback((id, addToSelection = false) => {
    if (addToSelection) {
      setSelectedShapeIds(prev =>
        prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
      );
    } else {
      setSelectedShapeIds([id]);
      setSelectedLineIds([]);
    }
  }, []);

  const selectLine = useCallback((id, addToSelection = false) => {
    if (addToSelection) {
      setSelectedLineIds(prev =>
        prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]
      );
    } else {
      setSelectedLineIds([id]);
      setSelectedShapeIds([]);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedShapeIds([]);
    setSelectedLineIds([]);
  }, []);

  // Check if anything is selected
  const hasSelection = selectedShapeIds.length > 0 || selectedLineIds.length > 0;

  // Get selected items
  const selectedShapes = shapes.filter(s => selectedShapeIds.includes(s.id));
  const selectedLines = lines.filter(l => selectedLineIds.includes(l.id));

  // Bulk operations
  const updateSelectedShapeColor = useCallback((color) => {
    setShapes(prev =>
      prev.map(shape =>
        selectedShapeIds.includes(shape.id) && shape.type === 'cone'
          ? { ...shape, color }
          : shape
      )
    );
  }, [selectedShapeIds]);

  const updateSelectedLineType = useCallback((type) => {
    setLines(prev =>
      prev.map(line =>
        selectedLineIds.includes(line.id) ? { ...line, type } : line
      )
    );
  }, [selectedLineIds]);

  const toggleSelectedLineArrows = useCallback(() => {
    setLines(prev =>
      prev.map(line =>
        selectedLineIds.includes(line.id) ? { ...line, hasArrow: !line.hasArrow } : line
      )
    );
  }, [selectedLineIds]);

  // Line drawing
  const startLine = useCallback((pos, type) => {
    setCurrentLine({
      points: [pos.x, pos.y],
      type,
    });
  }, []);

  const addPointToLine = useCallback((pos) => {
    if (!currentLine) return;
    setCurrentLine(prev => ({
      ...prev,
      points: [...prev.points, pos.x, pos.y],
    }));
  }, [currentLine]);

  const finishLine = useCallback(() => {
    if (!currentLine || currentLine.points.length < 4) {
      setCurrentLine(null);
      return null;
    }

    const newLine = addLine({
      type: currentLine.type,
      points: currentLine.points,
    });

    setCurrentLine(null);
    setToolMode(TOOL_MODES.SELECT);

    return newLine;
  }, [currentLine, addLine]);

  const cancelLine = useCallback(() => {
    setCurrentLine(null);
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setShapes([]);
    setLines([]);
    setSelectedShapeIds([]);
    setSelectedLineIds([]);
    setCurrentLine(null);
  }, []);

  // Export diagram data
  const getDiagramData = useCallback(() => {
    const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2 }) || '';
    return {
      name: diagramName,
      dataUrl,
      elements: shapes,
      lines,
      fieldType: fieldType.value,
    };
  }, [diagramName, shapes, lines, fieldType]);

  const value = {
    // Tool state
    toolMode,
    setToolMode,
    selectedConeColor,
    setSelectedConeColor,

    // Field state
    fieldType,
    setFieldType,

    // Elements
    shapes,
    setShapes,
    lines,
    setLines,

    // Selection
    selectedShapeIds,
    setSelectedShapeIds,
    selectedLineIds,
    setSelectedLineIds,
    selectedShapes,
    selectedLines,
    hasSelection,

    // Drawing state
    currentLine,
    mousePos,
    setMousePos,

    // Diagram name
    diagramName,
    setDiagramName,

    // Stage ref
    stageRef,

    // Shape operations
    addShape,
    updateShape,
    deleteShape,
    deleteSelectedShapes,

    // Line operations
    addLine,
    updateLine,
    deleteLine,
    deleteSelectedLines,

    // Combined operations
    deleteSelected,

    // Selection operations
    selectShape,
    selectLine,
    clearSelection,

    // Bulk operations
    updateSelectedShapeColor,
    updateSelectedLineType,
    toggleSelectedLineArrows,

    // Line drawing
    startLine,
    addPointToLine,
    finishLine,
    cancelLine,

    // Utility
    clearAll,
    getDiagramData,
  };

  return (
    <DiagramContext.Provider value={value}>
      {children}
    </DiagramContext.Provider>
  );
};

export default DiagramContext;

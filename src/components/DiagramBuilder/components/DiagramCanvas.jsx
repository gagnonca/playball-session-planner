import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer, Line, Arrow } from 'react-konva';
import { useDiagram } from '../DiagramContext';
import { TOOL_MODES, SHAPE_TYPES, LINE_TYPES, isStampTool, isLineTool } from '../utils/constants';
import FieldBackground from './FieldBackground';
import TransformerWrapper from './TransformerWrapper';
import QuickActionsBubble from './QuickActionsBubble';
import {
  SoccerBall,
  Goal,
  Cone,
  AttackerMarker,
  DefenderMarker,
  TacticalLine,
  DribbleLine,
  LineAnchorPoints,
} from './shapes';

const DiagramCanvas = () => {
  const {
    stageRef,
    fieldType,
    toolMode,
    setToolMode,
    selectedConeColor,
    shapes,
    lines,
    selectedShapeIds,
    selectedLineIds,
    currentLine,
    mousePos,
    setMousePos,
    addShape,
    updateShape,
    selectShape,
    selectLine,
    clearSelection,
    startLine,
    addPointToLine,
    finishLine,
    cancelLine,
    updateLine,
  } = useDiagram();

  const layerRef = useRef(null);
  const containerRef = useRef(null);
  const [quickActionPosition, setQuickActionPosition] = useState(null);

  // Update quick action bubble position when selection changes
  useEffect(() => {
    if (selectedShapeIds.length === 0 && selectedLineIds.length === 0) {
      setQuickActionPosition(null);
      return;
    }

    // Calculate bounding box of selection
    if (!layerRef.current) return;

    const selectedNodes = selectedShapeIds
      .map(id => layerRef.current.findOne(`#${id}`))
      .filter(Boolean);

    if (selectedNodes.length > 0) {
      const boxes = selectedNodes.map(n => n.getClientRect());
      const minX = Math.min(...boxes.map(b => b.x));
      const maxX = Math.max(...boxes.map(b => b.x + b.width));
      const minY = Math.min(...boxes.map(b => b.y));

      setQuickActionPosition({
        x: (minX + maxX) / 2,
        y: minY,
      });
    } else if (selectedLineIds.length > 0) {
      // For lines, use first point of first selected line
      const firstLine = lines.find(l => selectedLineIds.includes(l.id));
      if (firstLine && firstLine.points.length >= 2) {
        const allPoints = selectedLineIds.flatMap(id => {
          const line = lines.find(l => l.id === id);
          return line?.points || [];
        });

        const xs = allPoints.filter((_, i) => i % 2 === 0);
        const ys = allPoints.filter((_, i) => i % 2 === 1);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);

        setQuickActionPosition({
          x: (minX + maxX) / 2,
          y: minY,
        });
      }
    }
  }, [selectedShapeIds, selectedLineIds, shapes, lines]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (currentLine) {
          cancelLine();
        } else {
          clearSelection();
          setToolMode(TOOL_MODES.SELECT);
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete handled by context
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentLine, cancelLine, clearSelection, setToolMode]);

  // Handle stage click
  const handleStageClick = useCallback((e) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const clickedOnStage = e.target === stage;

    // If clicking on stage background
    if (clickedOnStage) {
      // Stamp tool - place shape
      if (isStampTool(toolMode)) {
        const shapeType = toolMode;
        const extraProps = shapeType === SHAPE_TYPES.CONE ? { color: selectedConeColor } : {};
        addShape(shapeType, pos.x, pos.y, extraProps);
        return;
      }

      // Line tool - add point or start line
      if (isLineTool(toolMode)) {
        if (!currentLine) {
          startLine(pos, toolMode);
        } else {
          addPointToLine(pos);
        }
        return;
      }

      // Select mode - clear selection
      clearSelection();
    }
  }, [toolMode, selectedConeColor, currentLine, addShape, startLine, addPointToLine, clearSelection]);

  // Handle double click (finish line)
  const handleStageDoubleClick = useCallback((e) => {
    if (isLineTool(toolMode) && currentLine) {
      finishLine();
    }
  }, [toolMode, currentLine, finishLine]);

  // Handle mouse move
  const handleMouseMove = useCallback((e) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    setMousePos(pos);
  }, [setMousePos]);

  // Handle shape selection
  const handleShapeSelect = useCallback((shapeId, e) => {
    // If in stamp mode and clicking existing shape, switch to select
    if (isStampTool(toolMode) || isLineTool(toolMode)) {
      setToolMode(TOOL_MODES.SELECT);
    }

    const metaPressed = e.evt?.shiftKey || e.evt?.ctrlKey || e.evt?.metaKey;
    selectShape(shapeId, metaPressed);
  }, [toolMode, setToolMode, selectShape]);

  // Handle line selection
  const handleLineSelect = useCallback((lineId, e) => {
    if (isStampTool(toolMode) || isLineTool(toolMode)) {
      setToolMode(TOOL_MODES.SELECT);
    }

    const metaPressed = e.evt?.shiftKey || e.evt?.ctrlKey || e.evt?.metaKey;
    selectLine(lineId, metaPressed);
  }, [toolMode, setToolMode, selectLine]);

  // Handle shape drag end
  const handleShapeDragEnd = useCallback((shapeId, e) => {
    updateShape(shapeId, {
      x: e.target.x(),
      y: e.target.y(),
    });
  }, [updateShape]);

  // Handle shape transform end
  const handleShapeTransformEnd = useCallback((shapeId, e) => {
    const node = e.target;
    updateShape(shapeId, {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
    });
  }, [updateShape]);

  // Render shape based on type
  const renderShape = (shape) => {
    const isSelected = selectedShapeIds.includes(shape.id);
    const commonProps = {
      key: shape.id,
      id: shape.id,
      x: shape.x,
      y: shape.y,
      rotation: shape.rotation || 0,
      isSelected,
      onSelect: (e) => handleShapeSelect(shape.id, e),
      onDragEnd: (e) => handleShapeDragEnd(shape.id, e),
      onTransformEnd: (e) => handleShapeTransformEnd(shape.id, e),
    };

    switch (shape.type) {
      case SHAPE_TYPES.BALL:
        return <SoccerBall {...commonProps} />;
      case SHAPE_TYPES.GOAL:
        return <Goal {...commonProps} width={shape.width} height={shape.height} />;
      case SHAPE_TYPES.CONE:
        return <Cone {...commonProps} color={shape.color} />;
      case SHAPE_TYPES.ATTACKER:
        return <AttackerMarker {...commonProps} />;
      case SHAPE_TYPES.DEFENDER:
        return <DefenderMarker {...commonProps} />;
      default:
        return null;
    }
  };

  // Render line based on type
  const renderLine = (line) => {
    const isSelected = selectedLineIds.includes(line.id);
    const commonProps = {
      key: line.id,
      id: line.id,
      type: line.type,
      points: line.points,
      hasArrow: line.hasArrow,
      isSelected,
      onSelect: (e) => handleLineSelect(line.id, e),
    };

    if (line.type === LINE_TYPES.DRIBBLE) {
      return <DribbleLine {...commonProps} />;
    }

    return <TacticalLine {...commonProps} />;
  };

  return (
    <div ref={containerRef} className="relative flex-1 overflow-auto bg-slate-900 flex items-center justify-center">
      <Stage
        ref={stageRef}
        width={fieldType.width}
        height={fieldType.height}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onDblClick={handleStageDoubleClick}
        onDblTap={handleStageDoubleClick}
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
      >
        <Layer ref={layerRef}>
          {/* Field background */}
          <FieldBackground
            width={fieldType.width}
            height={fieldType.height}
            fieldType={fieldType.value}
          />

          {/* Render all lines */}
          {lines.map(renderLine)}

          {/* Current line being drawn (preview with mouse position) */}
          {currentLine && currentLine.points.length >= 2 && mousePos && (() => {
            // Include mouse position for live preview
            const previewPoints = [...currentLine.points, mousePos.x, mousePos.y];

            return currentLine.type === LINE_TYPES.DRIBBLE ? (
              <DribbleLine
                points={previewPoints}
                type={currentLine.type}
                hasArrow={true}
                isSelected={false}
              />
            ) : (
              <Arrow
                points={previewPoints}
                stroke="#000"
                strokeWidth={4}
                fill="#000"
                opacity={0.6}
                dash={currentLine.type === LINE_TYPES.MOVEMENT ? [10, 8] : undefined}
                tension={previewPoints.length > 4 ? 0.4 : 0}
                pointerLength={12}
                pointerWidth={10}
                lineCap="round"
              />
            );
          })()}

          {/* Render all shapes */}
          {shapes.map(renderShape)}

          {/* Line anchor points for selected lines */}
          {selectedLineIds.map(lineId => {
            const line = lines.find(l => l.id === lineId);
            if (!line) return null;
            return (
              <LineAnchorPoints
                key={`anchors-${lineId}`}
                line={line}
                onUpdateLine={updateLine}
              />
            );
          })}

          {/* Transformer for selected shapes */}
          <TransformerWrapper
            selectedShapeIds={selectedShapeIds}
            layerRef={layerRef}
          />
        </Layer>
      </Stage>

      {/* Quick actions bubble */}
      <QuickActionsBubble
        position={quickActionPosition}
        containerRef={containerRef}
      />

      {/* Drawing hint overlay */}
      {currentLine && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-800/90 text-sm text-slate-300 px-4 py-2 rounded-lg">
          Click to add points • Double-click to finish • ESC to cancel
        </div>
      )}
    </div>
  );
};

export default DiagramCanvas;

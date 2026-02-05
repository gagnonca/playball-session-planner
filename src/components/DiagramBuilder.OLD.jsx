import React, { useState, useRef } from 'react';
import { Stage, Layer, Rect, Circle, Line, RegularPolygon, Group, Text, Arc, Path, Transformer } from 'react-konva';

const FIELD_TYPES = [
  { value: 'full', label: 'Full Field', width: 1000, height: 650 },
  { value: 'half', label: 'Half Field', width: 1000, height: 500 },
  { value: 'quarter', label: 'Quarter Field', width: 700, height: 500 },
  { value: 'small', label: 'Small Area', width: 600, height: 450 },
];

const ELEMENT_TYPES = {
  ATTACKER: 'attacker',
  DEFENDER: 'defender',
  GOAL: 'goal',
  CONE: 'cone',
  BALL: 'ball',
};

const CONE_COLORS = [
  { value: 'orange', label: 'Orange', color: '#FF6B35' },
  { value: 'yellow', label: 'Yellow', color: '#FDD835' },
  { value: 'blue', label: 'Blue', color: '#42A5F5' },
  { value: 'red', label: 'Red', color: '#EF5350' },
  { value: 'green', label: 'Green', color: '#66BB6A' },
];

// Soccer Ball Component with realistic pattern
const SoccerBall = ({ x, y, onDragEnd, onClick, isSelected, rotation = 0 }) => {
  return (
    <Group
      x={x}
      y={y}
      rotation={rotation}
      draggable
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      {/* White circle base */}
      <Circle
        radius={12}
        fill="white"
        stroke={isSelected ? '#FFD700' : '#000'}
        strokeWidth={isSelected ? 3 : 2}
      />
      {/* Black pentagons pattern (simplified) */}
      <RegularPolygon
        sides={5}
        radius={5}
        fill="black"
        y={-3}
      />
      <RegularPolygon
        sides={5}
        radius={3}
        fill="black"
        x={6}
        y={5}
      />
      <RegularPolygon
        sides={5}
        radius={3}
        fill="black"
        x={-6}
        y={5}
      />
    </Group>
  );
};

// Draggable Player Circle (Red for attackers)
const Player = ({ x, y, color, onDragEnd, onClick, isSelected, rotation = 0 }) => {
  return (
    <Group
      x={x}
      y={y}
      rotation={rotation}
      draggable
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <Circle
        radius={15}
        fill={color}
        stroke={isSelected ? '#FFD700' : '#000'}
        strokeWidth={isSelected ? 3 : 2}
        shadowColor="black"
        shadowBlur={5}
        shadowOpacity={0.3}
      />
      {/* Small direction indicator */}
      <RegularPolygon
        sides={3}
        radius={6}
        fill="#000"
        y={-18}
        opacity={0.5}
      />
    </Group>
  );
};

// Draggable Defender Triangle (Blue)
const Defender = ({ x, y, onDragEnd, onClick, isSelected, rotation = 0 }) => {
  return (
    <RegularPolygon
      x={x}
      y={y}
      sides={3}
      radius={18}
      fill="#3B82F6"
      stroke={isSelected ? '#FFD700' : '#000'}
      strokeWidth={isSelected ? 3 : 2}
      draggable
      onDragEnd={onDragEnd}
      onClick={onClick}
      shadowColor="black"
      shadowBlur={5}
      shadowOpacity={0.3}
      rotation={rotation}
    />
  );
};

// Realistic Goal with net pattern
const Goal = ({ x, y, onDragEnd, onClick, isSelected, rotation = 0, width = 80, height = 40 }) => {
  const netSpacing = 8;
  const netLines = [];

  // Vertical net lines
  for (let i = netSpacing; i < width; i += netSpacing) {
    netLines.push(<Line key={`v${i}`} points={[i, 0, i, height]} stroke="#888" strokeWidth={0.5} />);
  }

  // Horizontal net lines
  for (let i = netSpacing; i < height; i += netSpacing) {
    netLines.push(<Line key={`h${i}`} points={[0, i, width, i]} stroke="#888" strokeWidth={0.5} />);
  }

  return (
    <Group
      x={x}
      y={y}
      rotation={rotation}
      draggable
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      {/* Goal frame */}
      <Rect
        width={width}
        height={height}
        fill="rgba(255, 255, 255, 0.1)"
        stroke={isSelected ? '#FFD700' : '#FFF'}
        strokeWidth={isSelected ? 4 : 3}
      />

      {/* Net pattern */}
      <Group opacity={0.5}>
        {netLines}
      </Group>

      {/* Posts */}
      <Rect
        x={0}
        y={0}
        width={3}
        height={height}
        fill="#FFF"
      />
      <Rect
        x={width - 3}
        y={0}
        width={3}
        height={height}
        fill="#FFF"
      />
      <Rect
        x={0}
        y={0}
        width={width}
        height={3}
        fill="#FFF"
      />
    </Group>
  );
};

// Cone with color options
const Cone = ({ x, y, color, onDragEnd, onClick, isSelected, rotation = 0 }) => {
  return (
    <RegularPolygon
      x={x}
      y={y}
      sides={3}
      radius={12}
      fill={color}
      stroke={isSelected ? '#FFD700' : '#000'}
      strokeWidth={isSelected ? 3 : 1}
      draggable
      onDragEnd={onDragEnd}
      onClick={onClick}
      rotation={rotation}
    />
  );
};

// Soccer Field Background with markings
const SoccerField = ({ width, height }) => {
  const centerX = width / 2;
  const centerY = height / 2;

  return (
    <Group>
      {/* Green field background */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#4CAF50"
      />

      {/* Outer boundary */}
      <Rect
        x={10}
        y={10}
        width={width - 20}
        height={height - 20}
        stroke="white"
        strokeWidth={2}
        fill="transparent"
      />

      {/* Center line */}
      <Line
        points={[centerX, 10, centerX, height - 10]}
        stroke="white"
        strokeWidth={2}
      />

      {/* Center circle */}
      <Circle
        x={centerX}
        y={centerY}
        radius={50}
        stroke="white"
        strokeWidth={2}
        fill="transparent"
      />

      {/* Center spot */}
      <Circle
        x={centerX}
        y={centerY}
        radius={3}
        fill="white"
      />

      {/* Left penalty area */}
      <Rect
        x={10}
        y={centerY - 80}
        width={100}
        height={160}
        stroke="white"
        strokeWidth={2}
        fill="transparent"
      />

      {/* Left goal area */}
      <Rect
        x={10}
        y={centerY - 40}
        width={40}
        height={80}
        stroke="white"
        strokeWidth={2}
        fill="transparent"
      />

      {/* Right penalty area */}
      <Rect
        x={width - 110}
        y={centerY - 80}
        width={100}
        height={160}
        stroke="white"
        strokeWidth={2}
        fill="transparent"
      />

      {/* Right goal area */}
      <Rect
        x={width - 50}
        y={centerY - 40}
        width={40}
        height={80}
        stroke="white"
        strokeWidth={2}
        fill="transparent"
      />

      {/* Penalty spots */}
      <Circle
        x={70}
        y={centerY}
        radius={2}
        fill="white"
      />
      <Circle
        x={width - 70}
        y={centerY}
        radius={2}
        fill="white"
      />
    </Group>
  );
};

export default function DiagramBuilder({ initialDiagram, onSave }) {
  const [fieldType, setFieldType] = useState(
    initialDiagram?.fieldType
      ? FIELD_TYPES.find(f => f.value === initialDiagram.fieldType) || FIELD_TYPES[0]
      : FIELD_TYPES[0]
  );
  const [elements, setElements] = useState(initialDiagram?.elements || []);
  const [selectedElement, setSelectedElement] = useState(null);
  const [drawingMode, setDrawingMode] = useState(null);
  const [lines, setLines] = useState(initialDiagram?.lines || []);
  const [currentLine, setCurrentLine] = useState(null);
  const [selectedConeColor, setSelectedConeColor] = useState(CONE_COLORS[0]);
  const stageRef = useRef(null);
  const transformerRef = useRef(null);

  const addElement = (type, extraProps = {}) => {
    const newElement = {
      id: `${type}-${Date.now()}`,
      type,
      x: fieldType.width / 2,
      y: fieldType.height / 2,
      rotation: 0,
      ...extraProps,
    };
    setElements([...elements, newElement]);
  };

  const handleDragEnd = (id, e) => {
    const updatedElements = elements.map(el =>
      el.id === id ? { ...el, x: e.target.x(), y: e.target.y() } : el
    );
    setElements(updatedElements);
  };

  const handleElementClick = (id, e) => {
    e.cancelBubble = true;
    setSelectedElement(id);
  };

  const handleRotateSelected = (direction) => {
    if (!selectedElement) return;
    const updatedElements = elements.map(el =>
      el.id === selectedElement
        ? { ...el, rotation: (el.rotation || 0) + (direction === 'left' ? -15 : 15) }
        : el
    );
    setElements(updatedElements);
  };

  const handleResizeGoal = (dimension, value) => {
    if (!selectedElement) return;
    const updatedElements = elements.map(el =>
      el.id === selectedElement
        ? { ...el, [dimension]: Math.max(20, parseInt(value) || 40) }
        : el
    );
    setElements(updatedElements);
  };

  const handleDeleteSelected = () => {
    if (selectedElement) {
      setElements(elements.filter(el => el.id !== selectedElement));
      setSelectedElement(null);
    }
  };

  const handleStageClick = (e) => {
    // If clicking on the stage background, deselect
    if (e.target === e.target.getStage()) {
      setSelectedElement(null);
    }

    // Drawing mode handling
    if (drawingMode && currentLine === null) {
      const pos = e.target.getStage().getPointerPosition();
      setCurrentLine({
        points: [pos.x, pos.y],
        type: drawingMode,
      });
    } else if (drawingMode && currentLine) {
      const pos = e.target.getStage().getPointerPosition();
      const newLine = {
        id: `line-${Date.now()}`,
        points: [...currentLine.points, pos.x, pos.y],
        type: currentLine.type,
      };
      setLines([...lines, newLine]);
      setCurrentLine(null);
      setDrawingMode(null);
    }
  };

  const handleExport = () => {
    if (stageRef.current) {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
      if (onSave) {
        onSave({
          dataUrl,
          elements,
          lines,
          fieldType: fieldType.value,
        });
      }
    }
  };

  const handleClear = () => {
    if (confirm('Clear the entire diagram?')) {
      setElements([]);
      setLines([]);
      setSelectedElement(null);
      setCurrentLine(null);
    }
  };

  const handleUndo = () => {
    if (lines.length > 0) {
      setLines(lines.slice(0, -1));
    } else if (elements.length > 0) {
      setElements(elements.slice(0, -1));
      setSelectedElement(null);
    }
  };

  const renderElement = (element) => {
    const commonProps = {
      key: element.id,
      x: element.x,
      y: element.y,
      rotation: element.rotation || 0,
      onDragEnd: (e) => handleDragEnd(element.id, e),
      onClick: (e) => handleElementClick(element.id, e),
      isSelected: selectedElement === element.id,
    };

    switch (element.type) {
      case ELEMENT_TYPES.ATTACKER:
        return <Player {...commonProps} color="#EF4444" />;
      case ELEMENT_TYPES.DEFENDER:
        return <Defender {...commonProps} />;
      case ELEMENT_TYPES.GOAL:
        return <Goal {...commonProps} width={element.width || 80} height={element.height || 40} />;
      case ELEMENT_TYPES.CONE:
        return <Cone {...commonProps} color={element.color || CONE_COLORS[0].color} />;
      case ELEMENT_TYPES.BALL:
        return <SoccerBall {...commonProps} />;
      default:
        return null;
    }
  };

  const selectedElementData = elements.find(el => el.id === selectedElement);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* Left sidebar - Controls */}
        <div className="space-y-4">
          {/* Field Type Selector */}
          <div className="card p-3">
            <label className="label-text mb-2 block font-semibold">Field Type</label>
            <select
              value={fieldType.value}
              onChange={(e) => {
                const selected = FIELD_TYPES.find(f => f.value === e.target.value);
                setFieldType(selected);
              }}
              className="input-field w-full"
            >
              {FIELD_TYPES.map(ft => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
          </div>

          {/* Add Players */}
          <div className="card p-3">
            <label className="label-text mb-2 block font-semibold">Add Players</label>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => addElement(ELEMENT_TYPES.ATTACKER)}
                className="btn btn-secondary w-full justify-start"
              >
                <span className="inline-block w-4 h-4 bg-red-500 rounded-full mr-2"></span>
                Attacker (Red Circle)
              </button>
              <button
                onClick={() => addElement(ELEMENT_TYPES.DEFENDER)}
                className="btn btn-secondary w-full justify-start"
              >
                <span className="inline-block w-4 h-4 bg-blue-500 mr-2" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></span>
                Defender (Blue Triangle)
              </button>
            </div>
          </div>

          {/* Add Equipment */}
          <div className="card p-3">
            <label className="label-text mb-2 block font-semibold">Add Equipment</label>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => addElement(ELEMENT_TYPES.GOAL)}
                className="btn btn-secondary w-full"
              >
                ⚽ Goal
              </button>
              <button
                onClick={() => addElement(ELEMENT_TYPES.BALL)}
                className="btn btn-secondary w-full"
              >
                ⚽ Soccer Ball
              </button>
            </div>
          </div>

          {/* Add Cones */}
          <div className="card p-3">
            <label className="label-text mb-2 block font-semibold">Add Cones</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CONE_COLORS.map(cone => (
                <button
                  key={cone.value}
                  onClick={() => setSelectedConeColor(cone)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${selectedConeColor.value === cone.value
                      ? 'ring-2 ring-blue-500'
                      : 'opacity-70 hover:opacity-100'
                    }`}
                  style={{ backgroundColor: cone.color, color: cone.value === 'yellow' ? '#000' : '#FFF' }}
                >
                  {cone.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => addElement(ELEMENT_TYPES.CONE, { color: selectedConeColor.color })}
              className="btn btn-secondary w-full"
            >
              Add {selectedConeColor.label} Cone
            </button>
          </div>

          {/* Drawing Tools */}
          <div className="card p-3">
            <label className="label-text mb-2 block font-semibold">Drawing Tools</label>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setDrawingMode('arrow')}
                className={`btn w-full ${drawingMode === 'arrow' ? 'btn-primary' : 'btn-secondary'}`}
              >
                → Solid Arrow (Pass)
              </button>
              <button
                onClick={() => setDrawingMode('dashed-arrow')}
                className={`btn w-full ${drawingMode === 'dashed-arrow' ? 'btn-primary' : 'btn-secondary'}`}
              >
                ⇢ Dashed Arrow
              </button>
              <button
                onClick={() => setDrawingMode('movement')}
                className={`btn w-full ${drawingMode === 'movement' ? 'btn-primary' : 'btn-secondary'}`}
              >
                ⋯ Movement Line
              </button>
            </div>
            {drawingMode && (
              <p className="text-xs text-slate-400 mt-2">
                Click twice on field to draw
              </p>
            )}
          </div>

          {/* Selection Tools */}
          {selectedElementData && (
            <div className="card p-3 bg-blue-900/30 border-2 border-blue-500">
              <label className="label-text mb-2 block font-semibold">Selected: {selectedElementData.type}</label>
              <div className="space-y-2">
                {/* Goal Size Controls */}
                {selectedElementData.type === ELEMENT_TYPES.GOAL && (
                  <div className="space-y-2 pb-2 border-b border-blue-500/30">
                    <div>
                      <label className="label-text text-xs">Width</label>
                      <input
                        type="range"
                        min="40"
                        max="200"
                        value={selectedElementData.width || 80}
                        onChange={(e) => handleResizeGoal('width', e.target.value)}
                        className="w-full"
                      />
                      <div className="text-xs text-slate-400 text-center">{selectedElementData.width || 80}px</div>
                    </div>
                    <div>
                      <label className="label-text text-xs">Height</label>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        value={selectedElementData.height || 40}
                        onChange={(e) => handleResizeGoal('height', e.target.value)}
                        className="w-full"
                      />
                      <div className="text-xs text-slate-400 text-center">{selectedElementData.height || 40}px</div>
                    </div>
                  </div>
                )}

                {/* Rotation Controls */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRotateSelected('left')}
                    className="btn btn-secondary flex-1"
                    title="Rotate left 15°"
                  >
                    ↺ Left
                  </button>
                  <button
                    onClick={() => handleRotateSelected('right')}
                    className="btn btn-secondary flex-1"
                    title="Rotate right 15°"
                  >
                    ↻ Right
                  </button>
                </div>
                <button
                  onClick={handleDeleteSelected}
                  className="btn btn-danger w-full"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="card p-3">
            <div className="flex flex-col gap-2">
              <button
                onClick={handleUndo}
                className="btn btn-secondary w-full"
              >
                ↶ Undo
              </button>
              <button
                onClick={handleClear}
                className="btn btn-secondary w-full"
              >
                Clear All
              </button>
              <button
                onClick={handleExport}
                className="btn btn-primary w-full text-lg font-bold"
              >
                ✓ Save Diagram
              </button>
            </div>
          </div>
        </div>

        {/* Right side - Canvas */}
        <div className="flex flex-col">
          <div className="border-2 border-slate-600 rounded-lg overflow-auto bg-slate-800">
            <Stage
              width={fieldType.width}
              height={fieldType.height}
              ref={stageRef}
              onClick={handleStageClick}
            >
              <Layer>
                <SoccerField width={fieldType.width} height={fieldType.height} />

                {/* Render all lines */}
                {lines.map(line => {
                  const isDashed = line.type === 'dashed-arrow';
                  const isMovement = line.type === 'movement';

                  return (
                    <Line
                      key={line.id}
                      points={line.points}
                      stroke={isMovement ? '#FFF' : '#000'}
                      strokeWidth={3}
                      dash={isDashed ? [10, 5] : isMovement ? [5, 5] : undefined}
                      lineCap="round"
                      lineJoin="round"
                    />
                  );
                })}

                {/* Current line being drawn */}
                {currentLine && (
                  <Line
                    points={currentLine.points}
                    stroke="#FFF"
                    strokeWidth={3}
                    dash={currentLine.type === 'dashed-arrow' ? [10, 5] : currentLine.type === 'movement' ? [5, 5] : undefined}
                    lineCap="round"
                    lineJoin="round"
                    opacity={0.5}
                  />
                )}

                {/* Render all elements */}
                {elements.map(renderElement)}
              </Layer>
            </Stage>
          </div>

          <p className="text-xs text-slate-400 mt-2">
            <strong>Tips:</strong> Drag elements to move • Click to select • Use rotation buttons when selected • Click drawing tool then click twice on field to draw lines
          </p>
        </div>
      </div>
    </div>
  );
}

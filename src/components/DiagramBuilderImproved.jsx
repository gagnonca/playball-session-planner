import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Line, RegularPolygon, Group, Transformer } from 'react-konva';

const FIELD_TYPES = [
  { value: 'full', label: 'Full Field', width: 1200, height: 800 },
  { value: 'half', label: 'Half Field', width: 1200, height: 600 },
  { value: 'quarter', label: 'Quarter Field', width: 900, height: 600 },
];

const TOOL_MODES = {
  SELECT: 'select',
  ATTACKER: 'attacker',
  DEFENDER: 'defender',
  GOAL: 'goal',
  CONE: 'cone',
  BALL: 'ball',
  ARROW: 'arrow',
  MOVEMENT: 'movement',
};

// Element components
const SoccerBall = ({ shapeProps, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();

  return (
    <Group
      x={shapeProps.x}
      y={shapeProps.y}
      rotation={shapeProps.rotation || 0}
      id={shapeProps.id}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onChange({
          ...shapeProps,
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onTransformEnd={(e) => {
        const node = shapeRef.current;
        onChange({
          ...shapeProps,
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
        });
      }}
      ref={shapeRef}
    >
      <Circle radius={14} fill="white" stroke={isSelected ? '#FFD700' : '#000'} strokeWidth={isSelected ? 3 : 2} />
      <RegularPolygon sides={5} radius={5} fill="black" y={-3} />
      <RegularPolygon sides={5} radius={3} fill="black" x={6} y={5} />
      <RegularPolygon sides={5} radius={3} fill="black" x={-6} y={5} />
    </Group>
  );
};

const Player = ({ shapeProps, isSelected, onSelect, onChange, color }) => {
  const shapeRef = useRef();

  return (
    <Group
      x={shapeProps.x}
      y={shapeProps.y}
      rotation={shapeProps.rotation || 0}
      id={shapeProps.id}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onChange({
          ...shapeProps,
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onTransformEnd={(e) => {
        const node = shapeRef.current;
        onChange({
          ...shapeProps,
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
        });
      }}
      ref={shapeRef}
    >
      <Circle
        radius={20}
        fill={color}
        stroke={isSelected ? '#FFD700' : '#000'}
        strokeWidth={isSelected ? 3 : 2}
      />
      <RegularPolygon sides={3} radius={8} fill="#FFF" y={-24} opacity={0.8} />
    </Group>
  );
};

const Defender = ({ shapeProps, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();

  return (
    <RegularPolygon
      x={shapeProps.x}
      y={shapeProps.y}
      rotation={shapeProps.rotation || 0}
      id={shapeProps.id}
      sides={3}
      radius={22}
      fill="#3B82F6"
      stroke={isSelected ? '#FFD700' : '#000'}
      strokeWidth={isSelected ? 3 : 2}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onChange({
          ...shapeProps,
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onTransformEnd={(e) => {
        const node = shapeRef.current;
        onChange({
          ...shapeProps,
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
        });
      }}
      ref={shapeRef}
    />
  );
};

const Goal = ({ shapeProps, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();
  const width = shapeProps.width || 120;
  const height = shapeProps.height || 60;

  return (
    <Group
      x={shapeProps.x}
      y={shapeProps.y}
      rotation={shapeProps.rotation || 0}
      id={shapeProps.id}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onChange({
          ...shapeProps,
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onTransformEnd={(e) => {
        const node = shapeRef.current;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        node.scaleX(1);
        node.scaleY(1);

        onChange({
          ...shapeProps,
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(20, width * scaleX),
          height: Math.max(10, height * scaleY),
        });
      }}
      ref={shapeRef}
    >
      <Rect
        width={width}
        height={height}
        fill="rgba(255, 255, 255, 0.15)"
        stroke={isSelected ? '#FFD700' : '#FFF'}
        strokeWidth={isSelected ? 4 : 3}
      />
      {/* Net pattern */}
      {Array.from({ length: Math.floor(width / 12) }).map((_, i) => (
        <Line
          key={`v${i}`}
          points={[i * 12, 0, i * 12, height]}
          stroke="#999"
          strokeWidth={1}
          opacity={0.6}
        />
      ))}
      {Array.from({ length: Math.floor(height / 12) }).map((_, i) => (
        <Line
          key={`h${i}`}
          points={[0, i * 12, width, i * 12]}
          stroke="#999"
          strokeWidth={1}
          opacity={0.6}
        />
      ))}
      <Rect x={0} y={0} width={5} height={height} fill="#FFF" />
      <Rect x={width - 5} y={0} width={5} height={height} fill="#FFF" />
      <Rect x={0} y={0} width={width} height={5} fill="#FFF" />
    </Group>
  );
};

const Cone = ({ shapeProps, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();

  return (
    <RegularPolygon
      x={shapeProps.x}
      y={shapeProps.y}
      rotation={shapeProps.rotation || 0}
      id={shapeProps.id}
      sides={3}
      radius={16}
      fill={shapeProps.color || '#FF6B35'}
      stroke={isSelected ? '#FFD700' : '#000'}
      strokeWidth={isSelected ? 3 : 2}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onChange({
          ...shapeProps,
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onTransformEnd={(e) => {
        const node = shapeRef.current;
        onChange({
          ...shapeProps,
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
        });
      }}
      ref={shapeRef}
    />
  );
};

// Soccer field background
const SoccerField = ({ width, height }) => {
  const centerX = width / 2;
  const centerY = height / 2;

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} fill="#4CAF50" />
      <Rect
        x={10}
        y={10}
        width={width - 20}
        height={height - 20}
        stroke="white"
        strokeWidth={3}
        fill="transparent"
      />
      <Line points={[centerX, 10, centerX, height - 10]} stroke="white" strokeWidth={3} />
      <Circle x={centerX} y={centerY} radius={60} stroke="white" strokeWidth={3} fill="transparent" />
      <Circle x={centerX} y={centerY} radius={4} fill="white" />

      {/* Penalty areas */}
      <Rect x={10} y={centerY - 100} width={120} height={200} stroke="white" strokeWidth={3} fill="transparent" />
      <Rect x={10} y={centerY - 50} width={50} height={100} stroke="white" strokeWidth={3} fill="transparent" />
      <Rect x={width - 130} y={centerY - 100} width={120} height={200} stroke="white" strokeWidth={3} fill="transparent" />
      <Rect x={width - 60} y={centerY - 50} width={50} height={100} stroke="white" strokeWidth={3} fill="transparent" />

      {/* Penalty spots */}
      <Circle x={80} y={centerY} radius={3} fill="white" />
      <Circle x={width - 80} y={centerY} radius={3} fill="white" />
    </Group>
  );
};

// Transformer component
const TransformerComponent = ({ selectedId, shapes, stageRef }) => {
  const transformerRef = useRef();

  useEffect(() => {
    if (selectedId && stageRef.current) {
      const stage = stageRef.current;
      const selectedNode = stage.findOne(`#${selectedId}`);

      if (selectedNode && transformerRef.current) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedId, shapes, stageRef]);

  if (!selectedId) return null;

  return (
    <Transformer
      ref={transformerRef}
      rotateEnabled={true}
      enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
      boundBoxFunc={(oldBox, newBox) => {
        if (newBox.width < 10 || newBox.height < 10) {
          return oldBox;
        }
        return newBox;
      }}
    />
  );
};

export default function DiagramBuilderImproved({ initialDiagram, onSave, onClose }) {
  const [diagramName, setDiagramName] = useState(initialDiagram?.name || '');
  const [fieldType, setFieldType] = useState(FIELD_TYPES[0]);
  const [toolMode, setToolMode] = useState(TOOL_MODES.SELECT);
  const [shapes, setShapes] = useState(initialDiagram?.elements || []);
  const [selectedId, setSelectedId] = useState(null);
  const [lines, setLines] = useState(initialDiagram?.lines || []);
  const [currentLine, setCurrentLine] = useState(null);
  const [selectedConeColor, setSelectedConeColor] = useState('#FF6B35');
  const stageRef = useRef(null);

  const CONE_COLORS = [
    { label: 'Orange', color: '#FF6B35' },
    { label: 'Yellow', color: '#FDD835' },
    { label: 'Blue', color: '#42A5F5' },
    { label: 'Red', color: '#EF5350' },
    { label: 'Green', color: '#66BB6A' },
  ];

  const handleShapeSelect = (id) => {
    setSelectedId(id);
    setToolMode(TOOL_MODES.SELECT); // Automatically switch to select mode
  };

  const handleStageClick = (e) => {
    // Only deselect/add if clicking on stage or field background (not on a shape)
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.getClassName() === 'Group' || e.target.getClassName() === 'Rect';

    if (clickedOnEmpty) {
      setSelectedId(null);

      // Click-to-place mode
      if (toolMode !== TOOL_MODES.SELECT && toolMode !== TOOL_MODES.ARROW && toolMode !== TOOL_MODES.MOVEMENT) {
        const pos = e.target.getStage().getPointerPosition();
        const newShape = {
          id: `shape-${Date.now()}`,
          type: toolMode,
          x: pos.x,
          y: pos.y,
          rotation: 0,
        };

        if (toolMode === TOOL_MODES.CONE) {
          newShape.color = selectedConeColor;
        }

        const newShapes = [...shapes, newShape];
        setShapes(newShapes);
      }

      // Drawing mode
      if ((toolMode === TOOL_MODES.ARROW || toolMode === TOOL_MODES.MOVEMENT) && !currentLine) {
        const pos = e.target.getStage().getPointerPosition();
        setCurrentLine({ points: [pos.x, pos.y], type: toolMode });
      } else if (currentLine) {
        const pos = e.target.getStage().getPointerPosition();
        setLines([
          ...lines,
          {
            id: `line-${Date.now()}`,
            points: [...currentLine.points, pos.x, pos.y],
            type: currentLine.type,
          },
        ]);
        setCurrentLine(null);
        setToolMode(TOOL_MODES.SELECT);
      }
    }
  };

  const handleShapeChange = (id, newAttrs) => {
    setShapes(shapes.map((shape) => (shape.id === id ? newAttrs : shape)));
  };

  const handleDelete = () => {
    if (selectedId) {
      setShapes(shapes.filter((s) => s.id !== selectedId));
      setSelectedId(null);
    }
  };

  const handleExport = () => {
    if (stageRef.current) {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
      onSave({
        name: diagramName,
        dataUrl,
        elements: shapes,
        lines,
        fieldType: fieldType.value,
      });
    }
  };

  const handleClear = () => {
    if (confirm('Clear everything?')) {
      setShapes([]);
      setLines([]);
      setSelectedId(null);
    }
  };

  const renderShape = (shape) => {
    const commonProps = {
      key: shape.id,
      shapeProps: { ...shape, id: shape.id },
      isSelected: shape.id === selectedId,
      onSelect: () => setSelectedId(shape.id),
      onChange: (newAttrs) => handleShapeChange(shape.id, newAttrs),
    };

    switch (shape.type) {
      case TOOL_MODES.ATTACKER:
        return <Player {...commonProps} color="#EF4444" />;
      case TOOL_MODES.DEFENDER:
        return <Defender {...commonProps} />;
      case TOOL_MODES.GOAL:
        return <Goal {...commonProps} />;
      case TOOL_MODES.CONE:
        return <Cone {...commonProps} />;
      case TOOL_MODES.BALL:
        return <SoccerBall {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Toolbar */}
      <div className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          {/* Left side - Tools */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setToolMode(TOOL_MODES.SELECT)}
              className={`btn ${toolMode === TOOL_MODES.SELECT ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-1.5`}
            >
              ↖ Select
            </button>

            <div className="w-px h-8 bg-slate-600"></div>

            <button
              onClick={() => setToolMode(TOOL_MODES.ATTACKER)}
              className={`btn ${toolMode === TOOL_MODES.ATTACKER ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-1.5`}
            >
              <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-1.5"></span>
              Attacker
            </button>
            <button
              onClick={() => setToolMode(TOOL_MODES.DEFENDER)}
              className={`btn ${toolMode === TOOL_MODES.DEFENDER ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-1.5`}
            >
              <span className="inline-block w-3 h-3 bg-blue-500 mr-1.5" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></span>
              Defender
            </button>
            <button
              onClick={() => setToolMode(TOOL_MODES.GOAL)}
              className={`btn ${toolMode === TOOL_MODES.GOAL ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-1.5`}
            >
              ⚽ Goal
            </button>
            <button
              onClick={() => setToolMode(TOOL_MODES.BALL)}
              className={`btn ${toolMode === TOOL_MODES.BALL ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-1.5`}
            >
              ⚽ Ball
            </button>

            <div className="w-px h-8 bg-slate-600"></div>

            {/* Cone colors */}
            <div className="flex gap-1">
              {CONE_COLORS.map((cone) => (
                <button
                  key={cone.color}
                  onClick={() => {
                    setSelectedConeColor(cone.color);
                    setToolMode(TOOL_MODES.CONE);
                  }}
                  className={`w-8 h-8 rounded border-2 transition-all ${
                    toolMode === TOOL_MODES.CONE && selectedConeColor === cone.color
                      ? 'border-blue-400 scale-110'
                      : 'border-slate-600 hover:border-slate-500'
                  }`}
                  style={{ backgroundColor: cone.color }}
                  title={`${cone.label} Cone`}
                />
              ))}
            </div>

            <div className="w-px h-8 bg-slate-600"></div>

            <button
              onClick={() => setToolMode(TOOL_MODES.ARROW)}
              className={`btn ${toolMode === TOOL_MODES.ARROW ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-1.5`}
            >
              → Arrow
            </button>
            <button
              onClick={() => setToolMode(TOOL_MODES.MOVEMENT)}
              className={`btn ${toolMode === TOOL_MODES.MOVEMENT ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-1.5`}
            >
              ⋯ Movement
            </button>
          </div>

          {/* Right side - Actions */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={diagramName}
              onChange={(e) => setDiagramName(e.target.value)}
              placeholder="Diagram name (optional)"
              className="input-field text-sm w-48"
            />
            {selectedId && (
              <button onClick={handleDelete} className="btn btn-danger text-sm px-3 py-1.5">
                Delete
              </button>
            )}
            <button onClick={handleClear} className="btn btn-secondary text-sm px-3 py-1.5">
              Clear All
            </button>
            <button onClick={handleExport} className="btn btn-primary text-sm px-4 py-1.5 font-bold">
              ✓ Save Diagram
            </button>
            <button onClick={onClose} className="btn btn-subtle text-sm px-3 py-1.5">
              Close
            </button>
          </div>
        </div>

        {/* Hint */}
        <div className="mt-3 text-xs text-slate-400">
          {toolMode === TOOL_MODES.SELECT && '↖ Select and drag elements. Use handles to rotate/resize.'}
          {toolMode !== TOOL_MODES.SELECT && toolMode !== TOOL_MODES.ARROW && toolMode !== TOOL_MODES.MOVEMENT && '👆 Click on field to place elements'}
          {(toolMode === TOOL_MODES.ARROW || toolMode === TOOL_MODES.MOVEMENT) && '👆 Click twice to draw a line'}
        </div>
      </div>

      {/* Canvas - Full Screen */}
      <div className="flex-1 overflow-hidden bg-slate-900 flex items-center justify-center">
        <Stage
          width={fieldType.width}
          height={fieldType.height}
          ref={stageRef}
          onClick={handleStageClick}
          onTap={handleStageClick}
        >
            <Layer>
              <SoccerField width={fieldType.width} height={fieldType.height} />

              {/* Lines */}
              {lines.map((line) => (
                <Line
                  key={line.id}
                  points={line.points}
                  stroke={line.type === TOOL_MODES.MOVEMENT ? '#FFF' : '#000'}
                  strokeWidth={4}
                  dash={line.type === TOOL_MODES.MOVEMENT ? [8, 8] : undefined}
                  lineCap="round"
                  lineJoin="round"
                />
              ))}

              {/* Current line being drawn */}
              {currentLine && (
                <Line
                  points={currentLine.points}
                  stroke={currentLine.type === TOOL_MODES.MOVEMENT ? '#FFF' : '#000'}
                  strokeWidth={4}
                  dash={currentLine.type === TOOL_MODES.MOVEMENT ? [8, 8] : undefined}
                  lineCap="round"
                  lineJoin="round"
                  opacity={0.5}
                />
              )}

              {/* Shapes */}
              {shapes.map(renderShape)}

              {/* Transformer */}
              <TransformerComponent selectedId={selectedId} shapes={shapes} stageRef={stageRef} />
            </Layer>
          </Stage>
      </div>
    </div>
  );
}

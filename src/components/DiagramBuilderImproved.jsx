import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Line, RegularPolygon, Group, Transformer, Path } from 'react-konva';

const FIELD_TYPES = [
  { value: 'full', label: 'Full Field', width: 1200, height: 800 },
  { value: 'half', label: 'Half Field', width: 1200, height: 400 },
  { value: 'quarter', label: 'Quarter Field', width: 600, height: 400 },
];

const TOOL_MODES = {
  SELECT: 'select',
  ATTACKER: 'attacker',
  DEFENDER: 'defender',
  GOAL: 'goal',
  CONE: 'cone',
  BALL: 'ball',
  PASS: 'pass',        // Solid line with arrow (pass/shot)
  MOVEMENT: 'movement', // Dotted line with arrow (player movement)
  DRIBBLE: 'dribble',  // Squiggly line (dribbling)
};

// Element components
const SoccerBall = ({ shapeProps, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();
  const scale = 0.05;

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
      scaleX={scale}
      scaleY={scale}
      offsetX={325}
      offsetY={325}
    >
      {/* White background circle */}
      <Path
        data="M647.485,325.372 C647.485,147.474 503.269,3.259 325.371,3.259 C147.473,3.259 3.258,147.474 3.258,325.372 C3.258,503.27 147.473,647.485 325.371,647.485 C503.269,647.485 647.485,503.27 647.485,325.372"
        fill="#FFFFFF"
        stroke={isSelected ? '#FFD700' : '#030000'}
        strokeWidth={isSelected ? 60 : 10}
      />
      {/* Pentagon panels - using actual SVG paths */}
      <Path data="M320.484,208.118 L320.28,207.968 L206.428,290.821 L206.782,290.925 z" fill="#030000" />
      <Path data="M250.466,425.219 L251.45,423.775 L231.827,370.085 L249.729,425.219 z" fill="#030000" />
      <Path data="M110.303,263.143 L105.191,261.561 L57.487,340.917 L110.323,263.583 z" fill="#030000" />
      <Path data="M191.025,521.328 L192.26,519.337 L137.777,498.712 z" fill="#030000" />
      <Path data="M390.829,425.219 L410.711,363.94 L388.286,425.219 z" fill="#030000" />
      <Path data="M533.92,263.392 L533.837,265.228 L561.473,308.04 L534.522,263.206 z" fill="#030000" />
      <Path data="M448.689,522.974 L501.936,500.358 L447.454,520.983 z" fill="#030000" />
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
  const width = shapeProps.width || 100;
  const height = shapeProps.height || 80;

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
      {/* Net background */}
      <Rect
        width={width}
        height={height}
        fill="rgba(255, 255, 255, 0.1)"
        stroke={isSelected ? '#FFD700' : '#FFF'}
        strokeWidth={isSelected ? 4 : 2}
      />

      {/* Net pattern - vertical lines */}
      {Array.from({ length: Math.floor(width / 8) + 1 }).map((_, i) => (
        <Line
          key={`v${i}`}
          points={[i * 8, 0, i * 8, height]}
          stroke="#FFF"
          strokeWidth={0.8}
          opacity={0.5}
        />
      ))}

      {/* Net pattern - horizontal lines */}
      {Array.from({ length: Math.floor(height / 8) + 1 }).map((_, i) => (
        <Line
          key={`h${i}`}
          points={[0, i * 8, width, i * 8]}
          stroke="#FFF"
          strokeWidth={0.8}
          opacity={0.5}
        />
      ))}

      {/* Goal frame - posts and crossbar */}
      <Rect x={0} y={0} width={3} height={height} fill="#FFF" />
      <Rect x={width - 3} y={0} width={3} height={height} fill="#FFF" />
      <Rect x={0} y={0} width={width} height={3} fill="#FFF" />
    </Group>
  );
};

const Cone = ({ shapeProps, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();
  const color = shapeProps.color || '#FF6B35';
  const scale = 0.15;

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
      scaleX={scale}
      scaleY={scale}
      offsetX={100}
      offsetY={100}
    >
      {/* Main cone body using actual SVG path */}
      <Path
        data="m7.07 126.41 54.83-76.61c.89-1.25 2.33-1.99 3.87-1.99h68.67c1.53 0 2.97.74 3.87 1.99l54.62 76.32c1.64 2.29.95 5.48-1.48 6.88-19.92 11.53-75.57 39.11-138.34 21.15-18.22-5.21-33.15-13.15-44.81-21.03-2.23-1.5-2.79-4.54-1.22-6.72z"
        fill={color}
        stroke={isSelected ? '#FFD700' : '#231f20'}
        strokeWidth={isSelected ? 6 : 2}
      />
      {/* Top ellipse (rim) */}
      <Circle
        x={100.1}
        y={47.81}
        radiusX={36.78}
        radiusY={7.89}
        fill="#90330c"
        stroke="#231f20"
        strokeWidth={1.5}
      />
    </Group>
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

// Helper function to create squiggly line points
const createSquigglyLine = (x1, y1, x2, y2) => {
  const points = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // More segments for smoother curve, scale with distance
  const segments = Math.max(16, Math.floor(distance / 5));

  // Scale amplitude with distance but keep it reasonable
  const amplitude = Math.min(8, distance / 20);

  // More waves for longer distances
  const frequency = Math.max(6, distance / 30);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = x1 + dx * t;
    const y = y1 + dy * t;

    // Perpendicular offset
    const perpX = -dy / distance;
    const perpY = dx / distance;
    const wave = Math.sin(t * Math.PI * frequency) * amplitude;

    points.push(x + perpX * wave, y + perpY * wave);
  }

  return points;
};

// Helper function to calculate arrowhead points
const getArrowheadPoints = (x1, y1, x2, y2, size = 12) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowAngle = Math.PI / 6; // 30 degrees

  return [
    x2,
    y2,
    x2 - size * Math.cos(angle - arrowAngle),
    y2 - size * Math.sin(angle - arrowAngle),
    x2 - size * Math.cos(angle + arrowAngle),
    y2 - size * Math.sin(angle + arrowAngle),
  ];
};

export default function DiagramBuilderImproved({ initialDiagram, onSave, onClose }) {
  const [diagramName, setDiagramName] = useState(initialDiagram?.name || '');
  const [fieldType, setFieldType] = useState(FIELD_TYPES[0]);
  const [toolMode, setToolMode] = useState(TOOL_MODES.SELECT);
  const [shapes, setShapes] = useState(initialDiagram?.elements || []);
  const [selectedId, setSelectedId] = useState(null);
  const [lines, setLines] = useState(initialDiagram?.lines || []);
  const [currentLine, setCurrentLine] = useState(null);
  const [mousePos, setMousePos] = useState(null); // For line preview and cursor following
  const [selectedConeColor, setSelectedConeColor] = useState('#FF6B35');
  const [selectedLineId, setSelectedLineId] = useState(null); // For line selection
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState(null);
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

  // Handle escape key to cancel drawing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && currentLine) {
        setCurrentLine(null);
        setMousePos(null);
        setToolMode(TOOL_MODES.SELECT);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentLine]);

  const handleStageMouseMove = (e) => {
    const pos = e.target.getStage().getPointerPosition();
    setMousePos(pos); // Always track for cursor preview
  };

  const handleStageMouseDown = (e) => {
    const isDrawingMode = toolMode === TOOL_MODES.PASS || toolMode === TOOL_MODES.MOVEMENT || toolMode === TOOL_MODES.DRIBBLE;
    const pos = e.target.getStage().getPointerPosition();

    if (!isDrawingMode) return;

    // If starting a new line
    if (!currentLine) {
      setCurrentLine({
        points: [pos.x, pos.y],
        type: toolMode
      });
      return;
    }

    // If continuing an existing line, add point
    setCurrentLine({
      ...currentLine,
      points: [...currentLine.points, pos.x, pos.y],
    });
  };

  const handleStageDoubleClick = (e) => {
    const isDrawingMode = toolMode === TOOL_MODES.PASS || toolMode === TOOL_MODES.MOVEMENT || toolMode === TOOL_MODES.DRIBBLE;

    if (currentLine && isDrawingMode) {
      // Finish the line
      let finalPoints;

      if (currentLine.type === TOOL_MODES.DRIBBLE) {
        // For dribble, use the squiggly line between first and last point
        const points = currentLine.points;
        const startX = points[0];
        const startY = points[1];
        const endX = points[points.length - 2];
        const endY = points[points.length - 1];
        finalPoints = createSquigglyLine(startX, startY, endX, endY);
      } else {
        // For pass and movement, use all points as Bezier curve
        finalPoints = currentLine.points;
      }

      setLines([
        ...lines,
        {
          id: `line-${Date.now()}`,
          points: finalPoints,
          type: currentLine.type,
          isCurved: currentLine.points.length > 4, // More than 2 points = curved
        },
      ]);
      setCurrentLine(null);
      setToolMode(TOOL_MODES.SELECT);
    }
  };

  const handleStageClick = (e) => {
    const isDrawingMode = toolMode === TOOL_MODES.PASS || toolMode === TOOL_MODES.MOVEMENT || toolMode === TOOL_MODES.DRIBBLE;
    const pos = e.target.getStage().getPointerPosition();

    // If we're drawing a line, add point (will be handled by handleStageMouseDown)
    if (currentLine && isDrawingMode) {
      // Points are added in handleStageMouseDown, this is for continuing the line
      return;
    }

    // Check if clicking on a shape - look at the actual target
    const targetName = e.target.getClassName();
    const clickedOnShape = targetName === 'Circle' || targetName === 'RegularPolygon' || targetName === 'Path' || targetName === 'Rect';

    // Check if clicking near any shape for better hit detection
    const clickedShape = shapes.find(shape => {
      const dx = shape.x - pos.x;
      const dy = shape.y - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < 40; // Within 40 pixels = select it
    });

    // If clicked on or near a shape and in select mode, select it
    if ((clickedOnShape || clickedShape) && toolMode === TOOL_MODES.SELECT) {
      if (clickedShape) {
        setSelectedId(clickedShape.id);
      }
      return;
    }

    // Otherwise, handle as empty click for placing/drawing
    setSelectedId(null);
    setSelectedLineId(null);

    // Click-to-place mode - place at mouse position
    if (toolMode !== TOOL_MODES.SELECT && !isDrawingMode) {
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

      setShapes([...shapes, newShape]);
      // Keep tool active for multiple placements - don't auto-switch to select
    }

    // Drawing mode - start line
    if (isDrawingMode && !currentLine) {
      setCurrentLine({ points: [pos.x, pos.y], type: toolMode });
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
    if (selectedLineId) {
      setLines(lines.filter((l) => l.id !== selectedLineId));
      setSelectedLineId(null);
    }
  };

  const handleTemplateClick = (template) => {
    if (template.value === fieldType.value) return;
    setPendingTemplate(template);
    setShowTemplateConfirm(true);
  };

  const handleConfirmTemplateChange = () => {
    if (pendingTemplate) {
      setFieldType(pendingTemplate);
      setShapes([]);
      setLines([]);
      setSelectedId(null);
      setSelectedLineId(null);
    }
    setShowTemplateConfirm(false);
    setPendingTemplate(null);
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
    const isPreview = shape.id === 'preview';
    const commonProps = {
      key: shape.id,
      shapeProps: { ...shape, id: shape.id },
      isSelected: !isPreview && shape.id === selectedId,
      onSelect: isPreview ? () => {} : () => setSelectedId(shape.id),
      onChange: isPreview ? () => {} : (newAttrs) => handleShapeChange(shape.id, newAttrs),
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
        {/* Template Selector Row */}
        <div className="flex gap-2 mb-3 items-center">
          <span className="text-sm text-slate-400">Field Template:</span>
          {FIELD_TYPES.map((template) => (
            <button
              key={template.value}
              onClick={() => handleTemplateClick(template)}
              className={`btn ${
                fieldType.value === template.value ? 'btn-primary' : 'btn-secondary'
              } text-sm px-3 py-1.5`}
            >
              {template.label}
            </button>
          ))}
        </div>

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
              onClick={() => setToolMode(TOOL_MODES.PASS)}
              className={`btn ${toolMode === TOOL_MODES.PASS ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-1.5`}
              title="Pass/Shot - Solid line with arrow"
            >
              → Pass
            </button>
            <button
              onClick={() => setToolMode(TOOL_MODES.MOVEMENT)}
              className={`btn ${toolMode === TOOL_MODES.MOVEMENT ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-1.5`}
              title="Movement - Dotted line with arrow"
            >
              ⋯ Movement
            </button>
            <button
              onClick={() => setToolMode(TOOL_MODES.DRIBBLE)}
              className={`btn ${toolMode === TOOL_MODES.DRIBBLE ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-1.5`}
              title="Dribble - Squiggly line"
            >
              ∿ Dribble
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
            {(selectedId || selectedLineId) && (
              <button onClick={handleDelete} className="btn btn-danger text-sm px-3 py-1.5">
                Delete {selectedLineId ? 'Line' : 'Shape'}
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
          {toolMode !== TOOL_MODES.SELECT && toolMode !== TOOL_MODES.PASS && toolMode !== TOOL_MODES.MOVEMENT && toolMode !== TOOL_MODES.DRIBBLE && '👆 Click on field to place elements'}
          {(toolMode === TOOL_MODES.PASS || toolMode === TOOL_MODES.MOVEMENT || toolMode === TOOL_MODES.DRIBBLE) && !currentLine && '👆 Click to start line, click to add curve points, double-click to finish'}
          {currentLine && '👆 Click to add curve points, double-click to finish (or press ESC to cancel)'}
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
          onMouseMove={handleStageMouseMove}
          onMouseDown={handleStageMouseDown}
          onDblClick={handleStageDoubleClick}
        >
            <Layer>
              <SoccerField width={fieldType.width} height={fieldType.height} />

              {/* Lines */}
              {lines.map((line) => {
                const isMovement = line.type === TOOL_MODES.MOVEMENT;
                const isDribble = line.type === TOOL_MODES.DRIBBLE;
                const lineColor = isMovement ? '#FFF' : '#000';
                const isLineSelected = line.id === selectedLineId;

                // Calculate arrow direction properly for curved lines
                const points = line.points;
                const x2 = points[points.length - 2];
                const y2 = points[points.length - 1];

                // For curved lines, use points further back to get better tangent approximation
                let x1, y1;
                if (line.isCurved && points.length > 4) {
                  // For Bezier curves, look at more points for better direction
                  const lookbackPoints = Math.min(3, Math.floor((points.length / 2) - 1));
                  const offset = lookbackPoints * 2;
                  x1 = points[points.length - 2 - offset];
                  y1 = points[points.length - 1 - offset];
                } else {
                  // For straight lines, use adjacent point
                  x1 = points[points.length - 4] || points[0];
                  y1 = points[points.length - 3] || points[1];
                }

                return (
                  <Group key={line.id}>
                    <Line
                      points={points}
                      stroke={lineColor}
                      strokeWidth={isLineSelected ? 6 : 4}
                      dash={isMovement ? [8, 8] : undefined}
                      lineCap="round"
                      lineJoin="round"
                      tension={isDribble ? 0.3 : (line.isCurved ? 0.5 : 0)}
                      bezier={line.isCurved && !isDribble}
                      onClick={() => {
                        setSelectedLineId(line.id);
                        setSelectedId(null);
                      }}
                      onTap={() => {
                        setSelectedLineId(line.id);
                        setSelectedId(null);
                      }}
                    />
                    {/* Arrowhead for all line types */}
                    <Line
                      points={getArrowheadPoints(x1, y1, x2, y2)}
                      fill={lineColor}
                      stroke={lineColor}
                      strokeWidth={2}
                      closed
                      lineCap="round"
                      lineJoin="round"
                    />
                  </Group>
                );
              })}

              {/* Current line being drawn with preview */}
              {currentLine && mousePos && (
                <>
                  {(() => {
                    const isDribble = currentLine.type === TOOL_MODES.DRIBBLE;
                    const isMovement = currentLine.type === TOOL_MODES.MOVEMENT;
                    const lineColor = isMovement ? '#FFF' : '#000';
                    const isCurved = currentLine.points.length > 4;

                    let previewPoints;
                    if (isDribble) {
                      const startX = currentLine.points[0];
                      const startY = currentLine.points[1];
                      previewPoints = createSquigglyLine(startX, startY, mousePos.x, mousePos.y);
                    } else {
                      // Show all points plus mouse position as preview
                      previewPoints = [...currentLine.points, mousePos.x, mousePos.y];
                    }

                    const endX = mousePos.x;
                    const endY = mousePos.y;
                    const startX = previewPoints[previewPoints.length - 4] || previewPoints[0];
                    const startY = previewPoints[previewPoints.length - 3] || previewPoints[1];

                    return (
                      <Group>
                        {/* Preview line */}
                        <Line
                          points={previewPoints}
                          stroke={lineColor}
                          strokeWidth={4}
                          dash={isMovement ? [8, 8] : undefined}
                          lineCap="round"
                          lineJoin="round"
                          opacity={0.6}
                          tension={isDribble ? 0.3 : (isCurved ? 0.5 : 0)}
                          bezier={isCurved && !isDribble}
                        />
                        {/* Draw control points */}
                        {!isDribble && currentLine.points.length > 2 && currentLine.points.map((_, i) => {
                          if (i % 2 === 1) return null; // Skip y coordinates
                          const x = currentLine.points[i];
                          const y = currentLine.points[i + 1];
                          return (
                            <Circle
                              key={i}
                              x={x}
                              y={y}
                              radius={4}
                              fill={lineColor}
                              opacity={0.5}
                            />
                          );
                        })}
                        {/* Preview arrowhead */}
                        <Line
                          points={getArrowheadPoints(startX, startY, endX, endY)}
                          fill={lineColor}
                          stroke={lineColor}
                          strokeWidth={2}
                          closed
                          opacity={0.6}
                          lineCap="round"
                          lineJoin="round"
                        />
                      </Group>
                    );
                  })()}
                </>
              )}

              {/* Shapes */}
              {shapes.map(renderShape)}

              {/* Cursor-following preview for placement mode */}
              {mousePos && toolMode !== TOOL_MODES.SELECT && !currentLine && (
                <Group opacity={0.5}>
                  {renderShape({
                    id: 'preview',
                    type: toolMode,
                    x: mousePos.x,
                    y: mousePos.y,
                    rotation: 0,
                    color: toolMode === TOOL_MODES.CONE ? selectedConeColor : undefined,
                  })}
                </Group>
              )}

              {/* Transformer */}
              <TransformerComponent selectedId={selectedId} shapes={shapes} stageRef={stageRef} />
            </Layer>
          </Stage>
      </div>

      {/* Template Switch Confirmation Dialog */}
      {showTemplateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-2">Switch Field Template?</h3>
            <p className="text-slate-400 mb-4">
              Switching templates will clear all objects on the field. Are you sure?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowTemplateConfirm(false);
                  setPendingTemplate(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTemplateChange}
                className="btn btn-danger"
              >
                Clear & Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Line, Group, RegularPolygon, Image, Ellipse, Transformer } from 'react-konva';
import {
  TOOLS,
  LINE_TYPES,
  CONE_COLORS,
  FIELD_TYPES as BASE_FIELD_TYPES,
  MOMENTS,
} from '../../constants/diagram';
import { generateId } from '../../utils/id';
import ballSvg from '../../assets/ball.svg';
import coneSvg from '../../assets/cone.svg';
import netSvg from '../../assets/net.svg';
import fieldFullImg from '../../assets/field-full.png';
import fieldSmallImg from '../../assets/field-small.png';
import goalImg from '../../assets/goal-3d.png';

// Augment field types with image references
const FIELD_TYPES = BASE_FIELD_TYPES.map(ft => ({
  ...ft,
  image: ft.id === 'full' ? fieldFullImg : fieldSmallImg,
}));


const DiagramBuilder = ({
  initialDiagram,
  defaultName = '',
  defaultDescription = '',
  ageGroup = '',
  moment = '',
  sectionType = '',
  onSave,
  onClose,
}) => {
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const shapeRefs = useRef({});
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);
  const [selectedConeColor, setSelectedConeColor] = useState(CONE_COLORS[0].color);

  // Diagram metadata
  const [diagramName, setDiagramName] = useState(initialDiagram?.name || defaultName || '');
  const [diagramDescription, setDiagramDescription] = useState(initialDiagram?.description || defaultDescription || '');
  const [diagramAgeGroup, setDiagramAgeGroup] = useState(initialDiagram?.tags?.ageGroup || ageGroup || '');
  // Moments can be array or string (for backwards compat)
  const [diagramMoments, setDiagramMoments] = useState(() => {
    const m = initialDiagram?.tags?.moments || initialDiagram?.tags?.moment || moment || [];
    return Array.isArray(m) ? m : (m ? [m] : []);
  });
  const [diagramType, setDiagramType] = useState(initialDiagram?.tags?.type || sectionType || '');

  // Check if we're in standalone/library mode (can edit tags) vs section mode (tags come from context)
  const isStandaloneMode = !ageGroup && !moment && !sectionType;

  // Shapes state - initialize from initialDiagram if provided
  const [shapes, setShapes] = useState(initialDiagram?.elements || []);
  const [selectedId, setSelectedId] = useState(null);

  // Stamp scale for new shapes (1 = default size)
  const [stampScale, setStampScale] = useState(1);

  // Stamp rotation for new shapes (0 = default)
  const [stampRotation, setStampRotation] = useState(0);

  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState(null);

  // Mouse position for stamp preview
  const [mousePos, setMousePos] = useState(null);

  // Field type - initialize from initialDiagram if provided
  const [fieldType, setFieldType] = useState(() => {
    if (initialDiagram?.fieldType) {
      return FIELD_TYPES.find(ft => ft.id === initialDiagram.fieldType) || FIELD_TYPES[0];
    }
    return FIELD_TYPES[0];
  });

  // Apply size changes to all shapes of same type
  const [applyToAll, setApplyToAll] = useState(false);

  // Line type (pass, movement, dribble) - selected in right panel
  const [lineType, setLineType] = useState(LINE_TYPES.PASS);

  // Lines state - initialize from initialDiagram if provided
  const [lines, setLines] = useState(initialDiagram?.lines || []);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [currentLine, setCurrentLine] = useState(null); // Line being drawn
  const [lineStrokeWidth, setLineStrokeWidth] = useState(3);

  // Load SVG images
  const [ballImage, setBallImage] = useState(null);
  const [coneImage, setConeImage] = useState(null);
  const [netImage, setNetImage] = useState(null);
  const [fieldImages, setFieldImages] = useState({});
  const [goal3dImage, setGoal3dImage] = useState(null);

  useEffect(() => {
    const loadImage = (src, setter) => {
      const img = new window.Image();
      img.onload = () => setter(img);
      img.src = src;
    };
    loadImage(ballSvg, setBallImage);
    loadImage(coneSvg, setConeImage);
    loadImage(netSvg, setNetImage);
    loadImage(goalImg, setGoal3dImage);

    // Load field images
    FIELD_TYPES.forEach(ft => {
      if (ft.image) {
        const img = new window.Image();
        img.onload = () => {
          setFieldImages(prev => ({ ...prev, [ft.id]: img }));
        };
        img.src = ft.image;
      }
    });
  }, []);

  // Track container size for responsive canvas
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    // Initial size
    updateSize();

    // Observe size changes
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Keyboard event handler for delete, copy, paste
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape - cancel line drawing or deselect
      if (e.key === 'Escape') {
        if (currentLine) {
          setCurrentLine(null);
        } else {
          setSelectedId(null);
          setSelectedLineId(null);
        }
        return;
      }

      // Delete selected shape(s) or line - but not when typing in an input
      const activeEl = document.activeElement;
      const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
        e.preventDefault();
        if (selectedLineId) {
          setLines(lines.filter(l => l.id !== selectedLineId));
          setSelectedLineId(null);
        } else if (selectedId) {
          const selectedShape = shapes.find(s => s.id === selectedId);
          if (applyToAll && selectedShape) {
            setShapes(shapes.filter(s => s.type !== selectedShape.type));
          } else {
            setShapes(shapes.filter(s => s.id !== selectedId));
          }
          setSelectedId(null);
        }
        return;
      }
      // Copy (Ctrl/Cmd + C)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedId) {
        e.preventDefault();
        const selectedShape = shapes.find(s => s.id === selectedId);
        if (selectedShape) {
          setClipboard({ ...selectedShape });
        }
      }
      // Paste (Ctrl/Cmd + V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
        e.preventDefault();
        const newShape = {
          ...clipboard,
          id: generateId(),
          x: clipboard.x + 30, // Offset so it's visible
          y: clipboard.y + 30,
        };
        setShapes([...shapes, newShape]);
        setSelectedId(newShape.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedLineId, shapes, lines, clipboard, applyToAll, currentLine]);

  // Attach transformer to selected shape
  useEffect(() => {
    if (selectedId && transformerRef.current && shapeRefs.current[selectedId]) {
      transformerRef.current.nodes([shapeRefs.current[selectedId]]);
      transformerRef.current.getLayer().batchDraw();
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedId]);

  // Canvas dimensions - scale to fill container while maintaining aspect ratio
  const padding = 8; // Minimal padding around canvas
  const availableWidth = containerSize.width - padding * 2;
  const availableHeight = containerSize.height - padding * 2;
  const fieldAspectRatio = fieldType.width / fieldType.height;
  const containerAspectRatio = availableWidth / availableHeight;

  let canvasWidth, canvasHeight;
  if (containerAspectRatio > fieldAspectRatio) {
    // Container is wider than field - fit by height
    canvasHeight = Math.max(300, availableHeight);
    canvasWidth = canvasHeight * fieldAspectRatio;
  } else {
    // Container is taller than field - fit by width
    canvasWidth = Math.max(400, availableWidth);
    canvasHeight = canvasWidth / fieldAspectRatio;
  }

  const handleSave = () => {
    const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2 }) || '';
    onSave?.({
      name: diagramName || 'Diagram',
      description: diagramDescription,
      dataUrl,
      elements: shapes,
      lines: lines,
      fieldType: fieldType.id,
      tags: {
        ageGroup: diagramAgeGroup,
        moments: diagramMoments,
        type: diagramType,
      },
    });
  };

  const toggleMoment = (m) => {
    setDiagramMoments(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  // Handle shape click (selection)
  const handleShapeClick = (id, e) => {
    e.cancelBubble = true; // Prevent stage click

    // If currently drawing a line, finish it first
    if (currentLine && currentLine.points.length >= 2) {
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      const finishedLine = {
        ...currentLine,
        points: [...currentLine.points, pos.x, pos.y],
      };
      setLines([...lines, finishedLine]);
      setCurrentLine(null);
    }

    setSelectedId(id);
    setSelectedLineId(null); // Clear line selection
    setActiveTool(TOOLS.SELECT); // Switch to select mode when clicking a shape
  };

  // Handle line click (selection)
  const handleLineClick = (id, e) => {
    e.cancelBubble = true;

    // If currently drawing a line, finish it first
    if (currentLine && currentLine.points.length >= 2) {
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      const finishedLine = {
        ...currentLine,
        points: [...currentLine.points, pos.x, pos.y],
      };
      setLines([...lines, finishedLine]);
      setCurrentLine(null);
    }

    setSelectedLineId(id);
    setSelectedId(null); // Clear shape selection
    setActiveTool(TOOLS.SELECT);
  };

  // Check if current tool is a line tool
  const isLineTool = activeTool === TOOLS.LINE;

  // Handle canvas click
  const handleStageClick = (e) => {
    // Only handle clicks on the stage background (not on shapes)
    if (e.target !== e.target.getStage()) return;

    // Clear selection when clicking empty space in select mode
    if (activeTool === TOOLS.SELECT) {
      setSelectedId(null);
      return;
    }

    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

    // Place attacker
    if (activeTool === TOOLS.ATTACKER) {
      const newShape = {
        id: generateId(),
        type: 'attacker',
        x: pos.x,
        y: pos.y,
        scaleX: stampScale,
        scaleY: stampScale,
        rotation: stampRotation,
      };
      setShapes([...shapes, newShape]);
    }

    // Place defender
    if (activeTool === TOOLS.DEFENDER) {
      const newShape = {
        id: generateId(),
        type: 'defender',
        x: pos.x,
        y: pos.y,
        scaleX: stampScale,
        scaleY: stampScale,
        rotation: stampRotation,
      };
      setShapes([...shapes, newShape]);
    }

    // Place ball
    if (activeTool === TOOLS.BALL) {
      const newShape = {
        id: generateId(),
        type: 'ball',
        x: pos.x,
        y: pos.y,
        scaleX: stampScale,
        scaleY: stampScale,
        rotation: stampRotation,
      };
      setShapes([...shapes, newShape]);
    }

    // Place goal
    if (activeTool === TOOLS.GOAL) {
      const newShape = {
        id: generateId(),
        type: 'goal',
        x: pos.x,
        y: pos.y,
        scaleX: stampScale,
        scaleY: stampScale,
        rotation: stampRotation,
      };
      setShapes([...shapes, newShape]);
    }

    // Place cone
    if (activeTool === TOOLS.CONE) {
      const newShape = {
        id: generateId(),
        type: 'cone',
        x: pos.x,
        y: pos.y,
        color: selectedConeColor,
        scaleX: stampScale,
        scaleY: stampScale,
        rotation: stampRotation,
      };
      setShapes([...shapes, newShape]);
    }

    // Line drawing
    if (activeTool === TOOLS.LINE) {
      if (!currentLine) {
        // Start new line
        setCurrentLine({
          id: generateId(),
          type: lineType,
          points: [pos.x, pos.y],
          strokeWidth: lineStrokeWidth,
        });
      } else {
        // Add point to current line
        setCurrentLine({
          ...currentLine,
          points: [...currentLine.points, pos.x, pos.y],
        });
      }
    }
  };

  // Handle double-click to finish line
  const handleStageDoubleClick = (e) => {
    if (currentLine && currentLine.points.length >= 4) {
      // Need at least 2 points (4 values) to make a line
      setLines([...lines, currentLine]);
      setCurrentLine(null);
    }
  };

  // Handle shape drag
  const handleShapeDragEnd = (id, e) => {
    setShapes(shapes.map(shape =>
      shape.id === id
        ? { ...shape, x: e.target.x(), y: e.target.y() }
        : shape
    ));
  };

  // Handle shape transform (rotation/scale)
  const handleTransformEnd = (id, e) => {
    const node = e.target;
    setShapes(shapes.map(shape =>
      shape.id === id
        ? {
            ...shape,
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
          }
        : shape
    ));
  };

  // Darken a hex color (used by IconCone and renderCone)
  const darkenColor = (hex, amount = 0.3) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * amount));
    const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * amount));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  };

  // Visual icon components
  const IconSelect = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 4L10 22L12.5 14L20.5 11.5L4 4Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
    </svg>
  );

  const IconAttacker = () => (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#EF4444"/>
      <path d="M4 6 A10 10 0 0 1 20 6 Z" fill="#1a1a1a"/>
    </svg>
  );

  const IconDefender = () => (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <polygon points="12,2 22,22 2,22" fill="#3B82F6"/>
      <polygon points="12,2 15,8 9,8" fill="#1a1a1a"/>
    </svg>
  );

  // Emoji icons for ball and goal
  const IconBall = () => <span className="text-base">⚽</span>;
  const IconGoal = () => <span className="text-base">🥅</span>;

  const IconCone = ({ color = '#FF6B35' }) => (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <polygon points="7,6 17,6 20,20 4,20" fill={color}/>
      <line x1="7" y1="6" x2="4" y2="20" stroke="#000" strokeWidth="1"/>
      <line x1="17" y1="6" x2="20" y2="20" stroke="#000" strokeWidth="1"/>
      <ellipse cx="12" cy="6" rx="5" ry="2" fill={darkenColor(color, 0.3)}/>
    </svg>
  );

  const IconPass = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <line x1="4" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <polygon points="14,7 20,12 14,17" fill="currentColor"/>
    </svg>
  );

  const IconMovement = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <line x1="4" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3"/>
      <polygon points="14,7 20,12 14,17" fill="currentColor"/>
    </svg>
  );

  const IconDribble = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 12 Q7 8, 10 12 T16 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <polygon points="14,7 20,12 14,17" fill="currentColor"/>
    </svg>
  );

  const IconField = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="1" stroke="currentColor" strokeWidth="2" fill="#4ade80" fillOpacity="0.3"/>
      <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  );

  // Handle tool selection - clears selections when switching tools
  const handleToolSelect = (tool) => {
    // Cancel any line being drawn when switching tools
    if (currentLine) {
      setCurrentLine(null);
    }
    setActiveTool(tool);
    // Clear selection when switching to a stamp/line tool (not select mode)
    if (tool !== TOOLS.SELECT) {
      setSelectedId(null);
      setSelectedLineId(null);
      setApplyToAll(false);
    }
  };

  // Tool button component with visual icons
  const ToolButton = ({ tool, icon, label, isActive }) => (
    <button
      onClick={() => handleToolSelect(tool)}
      className={`w-full px-3 py-2 rounded-lg text-left text-sm font-medium transition-all flex items-center gap-3 border ${
        isActive
          ? 'bg-blue-600 text-white border-blue-500'
          : 'text-slate-300 hover:bg-slate-700 hover:text-white border-slate-600/50 bg-slate-800/50'
      }`}
    >
      <span className="flex items-center justify-center w-5 h-5 shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );

  // Check if shape is in selection (either direct selection or via "select all")
  const isShapeSelected = (shape) => {
    if (shape.id === selectedId) return true;
    if (applyToAll && selectedId) {
      const selectedShape = shapes.find(s => s.id === selectedId);
      return selectedShape && selectedShape.type === shape.type;
    }
    return false;
  };

  // Render attacker shape (red circle with dark cap on top)
  const renderAttacker = (shape) => {
    const selected = isShapeSelected(shape);
    const radius = 20;
    return (
      <Group
        key={shape.id}
        ref={(node) => { shapeRefs.current[shape.id] = node; }}
        x={shape.x}
        y={shape.y}
        rotation={shape.rotation || 0}
        scaleX={shape.scaleX || 1}
        scaleY={shape.scaleY || 1}
        draggable
        onClick={(e) => handleShapeClick(shape.id, e)}
        onTap={(e) => handleShapeClick(shape.id, e)}
        onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
        onTransformEnd={(e) => handleTransformEnd(shape.id, e)}
      >
        {/* Selection indicator */}
        {selected && (
          <Circle
            radius={radius + 6}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[4, 4]}
            listening={false}
          />
        )}
        {/* Main red circle */}
        <Circle
          radius={radius}
          fill="#EF4444"
        />
        {/* Dark cap (top ~25% only) */}
        <Line
          points={(() => {
            const pts = [];
            // Arc from ~210° to ~330° (top 25% of circle)
            const startAngle = Math.PI + Math.PI / 6; // ~210°
            const endAngle = 2 * Math.PI - Math.PI / 6; // ~330°
            for (let a = startAngle; a <= endAngle; a += 0.1) {
              pts.push(Math.cos(a) * radius, Math.sin(a) * radius);
            }
            return pts;
          })()}
          closed={true}
          fill="#1a1a1a"
        />
      </Group>
    );
  };

  // Render defender shape (blue triangle with dark cap at the tip)
  const renderDefender = (shape) => {
    const selected = isShapeSelected(shape);
    const radius = 22;
    return (
      <Group
        key={shape.id}
        ref={(node) => { shapeRefs.current[shape.id] = node; }}
        x={shape.x}
        y={shape.y}
        rotation={shape.rotation || 0}
        scaleX={shape.scaleX || 1}
        scaleY={shape.scaleY || 1}
        draggable
        onClick={(e) => handleShapeClick(shape.id, e)}
        onTap={(e) => handleShapeClick(shape.id, e)}
        onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
        onTransformEnd={(e) => handleTransformEnd(shape.id, e)}
      >
        {/* Selection indicator */}
        {selected && (
          <Circle
            radius={radius + 6}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[4, 4]}
            listening={false}
          />
        )}
        {/* Main blue triangle */}
        <RegularPolygon
          sides={3}
          radius={radius}
          fill="#3B82F6"
        />
        {/* Dark cap at the tip - triangle sharing the apex */}
        <Line
          points={[
            0, -radius,                    // Apex (tip of triangle)
            -radius * 0.27, -radius * 0.55, // Bottom-left of cap
            radius * 0.27, -radius * 0.55,  // Bottom-right of cap
          ]}
          closed={true}
          fill="#1a1a1a"
        />
      </Group>
    );
  };

  // Render ball shape (using SVG)
  const renderBall = (shape) => {
    const selected = isShapeSelected(shape);
    return (
      <Group
        key={shape.id}
        ref={(node) => { shapeRefs.current[shape.id] = node; }}
        x={shape.x}
        y={shape.y}
        rotation={shape.rotation || 0}
        scaleX={shape.scaleX || 1}
        scaleY={shape.scaleY || 1}
        draggable
        onClick={(e) => handleShapeClick(shape.id, e)}
        onTap={(e) => handleShapeClick(shape.id, e)}
        onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
        onTransformEnd={(e) => handleTransformEnd(shape.id, e)}
      >
        {/* Selection indicator */}
        {selected && (
          <Circle
            radius={20}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[4, 4]}
            listening={false}
          />
        )}
        {ballImage && (
          <Image
            image={ballImage}
            width={28}
            height={28}
            offsetX={14}
            offsetY={14}
          />
        )}
      </Group>
    );
  };

  // Render goal shape (using 3D image)
  const renderGoal = (shape) => {
    const selected = isShapeSelected(shape);
    const goalWidth = 100;
    const goalHeight = 60;

    return (
      <Group
        key={shape.id}
        ref={(node) => { shapeRefs.current[shape.id] = node; }}
        x={shape.x}
        y={shape.y}
        rotation={shape.rotation || 0}
        scaleX={shape.scaleX || 1}
        scaleY={shape.scaleY || 1}
        draggable
        onClick={(e) => handleShapeClick(shape.id, e)}
        onTap={(e) => handleShapeClick(shape.id, e)}
        onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
        onTransformEnd={(e) => handleTransformEnd(shape.id, e)}
      >
        {/* Selection indicator */}
        {selected && (
          <Rect
            x={-goalWidth / 2 - 6}
            y={-goalHeight / 2 - 6}
            width={goalWidth + 12}
            height={goalHeight + 12}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[4, 4]}
            cornerRadius={4}
            listening={false}
          />
        )}
        {/* 3D Goal image */}
        {goal3dImage && (
          <Image
            image={goal3dImage}
            width={goalWidth}
            height={goalHeight}
            offsetX={goalWidth / 2}
            offsetY={goalHeight / 2}
          />
        )}
      </Group>
    );
  };

  // Render cone shape (flat-top trapezoid with color)
  const renderCone = (shape) => {
    const selected = isShapeSelected(shape);
    return (
      <Group
        key={shape.id}
        ref={(node) => { shapeRefs.current[shape.id] = node; }}
        x={shape.x}
        y={shape.y}
        rotation={shape.rotation || 0}
        scaleX={shape.scaleX || 1}
        scaleY={shape.scaleY || 1}
        draggable
        onClick={(e) => handleShapeClick(shape.id, e)}
        onTap={(e) => handleShapeClick(shape.id, e)}
        onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
        onTransformEnd={(e) => handleTransformEnd(shape.id, e)}
      >
        {/* Selection indicator */}
        {selected && (
          <Circle
            radius={22}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[4, 4]}
            listening={false}
          />
        )}
        {/* Bottom ellipse (base) - drawn first so cone body covers top portion */}
        <Ellipse
          y={8}
          radiusX={16}
          radiusY={4}
          fill={shape.color}
          stroke="#000000"
          strokeWidth={1}
        />
        {/* Cone body - no stroke, just fill */}
        <Line
          points={[-8, -6, 8, -6, 16, 8, -16, 8]}
          closed={true}
          fill={shape.color}
        />
        {/* Left edge */}
        <Line
          points={[-8, -6, -16, 8]}
          stroke="#000000"
          strokeWidth={1.5}
        />
        {/* Right edge */}
        <Line
          points={[8, -6, 16, 8]}
          stroke="#000000"
          strokeWidth={1.5}
        />
        {/* Top ellipse (opening) - darker shade of cone color */}
        <Ellipse
          y={-6}
          radiusX={8}
          radiusY={3}
          fill={darkenColor(shape.color, 0.25)}
          stroke="#000000"
          strokeWidth={1}
        />
      </Group>
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 bg-slate-900 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <input
            type="text"
            placeholder="Diagram name..."
            value={diagramName}
            onChange={(e) => setDiagramName(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-52"
          />
          {isStandaloneMode ? (
            <>
              <input
                type="text"
                placeholder="Description..."
                value={diagramDescription}
                onChange={(e) => setDiagramDescription(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-40"
              />
              <input
                type="text"
                placeholder="Age group..."
                value={diagramAgeGroup}
                onChange={(e) => setDiagramAgeGroup(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-24"
              />
              <select
                value={diagramType}
                onChange={(e) => setDiagramType(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Type...</option>
                <option value="Play">Play</option>
                <option value="Practice">Practice</option>
              </select>
              {diagramType === 'Practice' && (
                <div className="flex items-center gap-1">
                  {MOMENTS.map(m => (
                    <button
                      key={m}
                      onClick={() => toggleMoment(m)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        diagramMoments.includes(m)
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {m.replace('Transition to ', '→')}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            (ageGroup || moment || sectionType) && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {sectionType && (
                  <span className={`px-2 py-0.5 rounded ${
                    sectionType === 'Play' ? 'bg-blue-600/30 text-blue-300' : 'bg-green-600/30 text-green-300'
                  }`}>{sectionType}</span>
                )}
                {ageGroup && <span className="px-2 py-0.5 bg-slate-700 rounded">{ageGroup}</span>}
                {moment && <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded">{moment}</span>}
              </div>
            )
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Main content: Toolbar + Canvas + Right Panel */}
      <div className="flex flex-1 min-h-0 bg-slate-900">
        {/* Left Toolbar - fixed width */}
        <div className="w-44 shrink-0 border-r border-slate-700 p-3 flex flex-col gap-4 overflow-y-auto bg-slate-800/30">
          {/* Select Tool */}
          <div>
            <ToolButton
              tool={TOOLS.SELECT}
              icon={<IconSelect />}
              label="Select"
              isActive={activeTool === TOOLS.SELECT}
            />
          </div>

          {/* Players */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
              Players
            </div>
            <div className="space-y-1.5">
              <ToolButton
                tool={TOOLS.ATTACKER}
                icon={<IconAttacker />}
                label="Attacker"
                isActive={activeTool === TOOLS.ATTACKER}
              />
              <ToolButton
                tool={TOOLS.DEFENDER}
                icon={<IconDefender />}
                label="Defender"
                isActive={activeTool === TOOLS.DEFENDER}
              />
            </div>
          </div>

          {/* Equipment */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
              Equipment
            </div>
            <div className="space-y-1.5">
              <ToolButton
                tool={TOOLS.BALL}
                icon={<IconBall />}
                label="Ball"
                isActive={activeTool === TOOLS.BALL}
              />
              <ToolButton
                tool={TOOLS.GOAL}
                icon={<IconGoal />}
                label="Goal"
                isActive={activeTool === TOOLS.GOAL}
              />
              <ToolButton
                tool={TOOLS.CONE}
                icon={<IconCone color={selectedConeColor} />}
                label="Cone"
                isActive={activeTool === TOOLS.CONE}
              />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
              Lines
            </div>
            <div className="space-y-1.5">
              <ToolButton
                tool={TOOLS.LINE}
                icon={lineType === LINE_TYPES.PASS ? <IconPass /> : lineType === LINE_TYPES.MOVEMENT ? <IconMovement /> : <IconDribble />}
                label="Line"
                isActive={activeTool === TOOLS.LINE}
              />
            </div>
          </div>

          {/* Field Settings */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
              Canvas
            </div>
            <div className="space-y-1.5">
              <ToolButton
                tool={TOOLS.FIELD}
                icon={<IconField />}
                label="Field"
                isActive={activeTool === TOOLS.FIELD}
              />
            </div>
          </div>
        </div>

        {/* Canvas Area - flexible center, stretches to fill */}
        <div ref={containerRef} className="flex-1 flex items-center justify-center min-w-0 overflow-hidden bg-slate-800/20">
          <div className="rounded-lg overflow-hidden ring-2 ring-slate-600 shadow-2xl">
            <Stage
              ref={stageRef}
              width={canvasWidth}
              height={canvasHeight}
              onClick={handleStageClick}
              onDblClick={handleStageDoubleClick}
              onDblTap={handleStageDoubleClick}
              onMouseMove={(e) => {
                const stage = e.target.getStage();
                const pos = stage.getPointerPosition();
                setMousePos(pos);
              }}
              onMouseLeave={() => setMousePos(null)}
              style={{ cursor: [TOOLS.ATTACKER, TOOLS.DEFENDER, TOOLS.BALL, TOOLS.GOAL, TOOLS.CONE].includes(activeTool) ? 'none' : (isLineTool ? 'crosshair' : 'default') }}
            >
              <Layer>
                {/* Field background image */}
                {fieldImages[fieldType.id] && (
                  <Image
                    image={fieldImages[fieldType.id]}
                    width={canvasWidth}
                    height={canvasHeight}
                    listening={false}
                  />
                )}
                {/* Fallback green background if image not loaded */}
                {!fieldImages[fieldType.id] && (
                  <Rect
                    x={0}
                    y={0}
                    width={canvasWidth}
                    height={canvasHeight}
                    fill="#7cb87c"
                    listening={false}
                  />
                )}

                {/* Render placed lines */}
                {lines.map(line => {
                  const isSelected = line.id === selectedLineId;
                  const isDashed = line.type === LINE_TYPES.MOVEMENT;
                  const isWavy = line.type === LINE_TYPES.DRIBBLE;
                  const hasMultiplePoints = line.points.length > 4;

                  // Generate squiggly points for dribble lines (true sine wave)
                  // Leaves straight sections at start and end for cleaner look
                  const getSquigglyPoints = (points) => {
                    if (points.length < 4) return points;
                    const result = [];
                    const waveFreq = 0.08; // Controls wave frequency
                    const waveAmp = 8; // Wave amplitude
                    const straightLen = 20; // Straight section at start/end

                    for (let i = 0; i < points.length - 2; i += 2) {
                      const x1 = points[i], y1 = points[i + 1];
                      const x2 = points[i + 2], y2 = points[i + 3];
                      const dx = x2 - x1, dy = y2 - y1;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      const steps = Math.max(20, Math.floor(dist / 3));
                      // Perpendicular direction for wave offset
                      const nx = -dy / dist, ny = dx / dist;

                      const isFirstSegment = i === 0;
                      const isLastSegment = i === points.length - 4;

                      for (let j = 0; j <= steps; j++) {
                        const t = j / steps;
                        const x = x1 + dx * t;
                        const y = y1 + dy * t;
                        // Calculate distance along entire line for continuous wave
                        const totalDist = i / 2 * dist + t * dist;
                        const distFromStart = t * dist;
                        const distFromEnd = (1 - t) * dist;

                        // Keep straight at start of first segment and end of last segment
                        let amplitude = waveAmp;
                        if (isFirstSegment && distFromStart < straightLen) {
                          amplitude = waveAmp * (distFromStart / straightLen);
                        }
                        if (isLastSegment && distFromEnd < straightLen) {
                          amplitude = waveAmp * (distFromEnd / straightLen);
                        }

                        const offset = Math.sin(totalDist * waveFreq * Math.PI) * amplitude;
                        result.push(x + nx * offset, y + ny * offset);
                      }
                    }
                    return result;
                  };

                  const displayPoints = isWavy ? getSquigglyPoints(line.points) : line.points;
                  // Use tension for smooth curves on multi-point lines (but not squiggly)
                  const lineTension = isWavy ? 0 : (hasMultiplePoints ? 0.4 : 0);

                  return (
                    <Group key={line.id}>
                      {/* Selection highlight */}
                      {isSelected && (
                        <Line
                          points={displayPoints}
                          stroke="#3B82F6"
                          strokeWidth={line.strokeWidth + 6}
                          lineCap="round"
                          lineJoin="round"
                          tension={lineTension}
                          listening={false}
                        />
                      )}
                      {/* Main line */}
                      <Line
                        points={displayPoints}
                        stroke="#000000"
                        strokeWidth={line.strokeWidth}
                        lineCap="round"
                        lineJoin="round"
                        dash={isDashed ? [12, 8] : undefined}
                        tension={lineTension}
                        onClick={(e) => handleLineClick(line.id, e)}
                        onTap={(e) => handleLineClick(line.id, e)}
                      />
                      {/* Arrow head - filled triangle */}
                      {line.points.length >= 4 && (() => {
                        const pts = line.points;
                        const lastX = pts[pts.length - 2];
                        const lastY = pts[pts.length - 1];
                        const prevX = pts[pts.length - 4];
                        const prevY = pts[pts.length - 3];
                        const angle = Math.atan2(lastY - prevY, lastX - prevX);
                        const arrowLen = 14;
                        const arrowAngle = Math.PI / 7;
                        return (
                          <Line
                            points={[
                              lastX - arrowLen * Math.cos(angle - arrowAngle),
                              lastY - arrowLen * Math.sin(angle - arrowAngle),
                              lastX,
                              lastY,
                              lastX - arrowLen * Math.cos(angle + arrowAngle),
                              lastY - arrowLen * Math.sin(angle + arrowAngle),
                            ]}
                            closed={true}
                            fill="#000000"
                            stroke="#000000"
                            strokeWidth={1}
                            listening={false}
                          />
                        );
                      })()}
                    </Group>
                  );
                })}

                {/* Current line being drawn (preview) */}
                {currentLine && mousePos && (() => {
                  const previewPoints = [...currentLine.points, mousePos.x, mousePos.y];
                  const isDashed = currentLine.type === LINE_TYPES.MOVEMENT;
                  const isWavy = currentLine.type === LINE_TYPES.DRIBBLE;
                  const hasMultiplePoints = previewPoints.length > 4;
                  const previewTension = isWavy ? 0 : (hasMultiplePoints ? 0.4 : 0);

                  return (
                    <Group opacity={0.7} listening={false}>
                      <Line
                        points={previewPoints}
                        stroke="#000000"
                        strokeWidth={currentLine.strokeWidth}
                        lineCap="round"
                        lineJoin="round"
                        dash={isDashed ? [12, 8] : undefined}
                        tension={previewTension}
                      />
                      {/* Arrow head preview - filled triangle */}
                      {previewPoints.length >= 4 && (() => {
                        const lastX = mousePos.x;
                        const lastY = mousePos.y;
                        const prevX = previewPoints[previewPoints.length - 4];
                        const prevY = previewPoints[previewPoints.length - 3];
                        const angle = Math.atan2(lastY - prevY, lastX - prevX);
                        const arrowLen = 14;
                        const arrowAngle = Math.PI / 7;
                        return (
                          <Line
                            points={[
                              lastX - arrowLen * Math.cos(angle - arrowAngle),
                              lastY - arrowLen * Math.sin(angle - arrowAngle),
                              lastX,
                              lastY,
                              lastX - arrowLen * Math.cos(angle + arrowAngle),
                              lastY - arrowLen * Math.sin(angle + arrowAngle),
                            ]}
                            closed={true}
                            fill="#000000"
                            stroke="#000000"
                            strokeWidth={1}
                          />
                        );
                      })()}
                    </Group>
                  );
                })()}

                {/* Render placed shapes */}
                {shapes.map(shape => {
                  if (shape.type === 'attacker') return renderAttacker(shape);
                  if (shape.type === 'defender') return renderDefender(shape);
                  if (shape.type === 'ball') return renderBall(shape);
                  if (shape.type === 'goal') return renderGoal(shape);
                  if (shape.type === 'cone') return renderCone(shape);
                  return null;
                })}

                {/* Stamp preview (ghost following mouse) */}
                {mousePos && activeTool === TOOLS.ATTACKER && (
                  <Group x={mousePos.x} y={mousePos.y} scaleX={stampScale} scaleY={stampScale} rotation={stampRotation} opacity={0.6} listening={false}>
                    <Circle radius={20} fill="#EF4444" />
                    <Line
                      points={(() => {
                        const pts = [];
                        const startAngle = Math.PI + Math.PI / 6;
                        const endAngle = 2 * Math.PI - Math.PI / 6;
                        for (let a = startAngle; a <= endAngle; a += 0.1) {
                          pts.push(Math.cos(a) * 20, Math.sin(a) * 20);
                        }
                        return pts;
                      })()}
                      closed={true}
                      fill="#1a1a1a"
                    />
                  </Group>
                )}
                {mousePos && activeTool === TOOLS.DEFENDER && (
                  <Group x={mousePos.x} y={mousePos.y} scaleX={stampScale} scaleY={stampScale} rotation={stampRotation} opacity={0.6} listening={false}>
                    <RegularPolygon sides={3} radius={22} fill="#3B82F6" />
                    <Line
                      points={[0, -22, -22 * 0.27, -22 * 0.55, 22 * 0.27, -22 * 0.55]}
                      closed={true}
                      fill="#1a1a1a"
                    />
                  </Group>
                )}
                {mousePos && activeTool === TOOLS.BALL && ballImage && (
                  <Group x={mousePos.x} y={mousePos.y} scaleX={stampScale} scaleY={stampScale} rotation={stampRotation} opacity={0.6} listening={false}>
                    <Image image={ballImage} width={28} height={28} offsetX={14} offsetY={14} />
                  </Group>
                )}
                {mousePos && activeTool === TOOLS.GOAL && goal3dImage && (
                  <Group x={mousePos.x} y={mousePos.y} scaleX={stampScale} scaleY={stampScale} rotation={stampRotation} opacity={0.6} listening={false}>
                    <Image image={goal3dImage} width={100} height={60} offsetX={50} offsetY={30} />
                  </Group>
                )}
                {mousePos && activeTool === TOOLS.CONE && (
                  <Group x={mousePos.x} y={mousePos.y} scaleX={stampScale} scaleY={stampScale} rotation={stampRotation} opacity={0.6} listening={false}>
                    <Ellipse y={8} radiusX={16} radiusY={4} fill={selectedConeColor} stroke="#000000" strokeWidth={1} />
                    <Line points={[-8, -6, 8, -6, 16, 8, -16, 8]} closed={true} fill={selectedConeColor} />
                    <Line points={[-8, -6, -16, 8]} stroke="#000000" strokeWidth={1.5} />
                    <Line points={[8, -6, 16, 8]} stroke="#000000" strokeWidth={1.5} />
                    <Ellipse y={-6} radiusX={8} radiusY={3} fill={darkenColor(selectedConeColor, 0.25)} stroke="#000000" strokeWidth={1} />
                  </Group>
                )}

                {/* Transformer for resize/rotate */}
                <Transformer
                  ref={transformerRef}
                  rotateEnabled={true}
                  enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Limit minimum size
                    if (newBox.width < 10 || newBox.height < 10) {
                      return oldBox;
                    }
                    return newBox;
                  }}
                />
              </Layer>
            </Stage>
          </div>
        </div>

        {/* Right Context Sidebar - fixed width */}
        {(() => {
          const selectedShape = selectedId ? shapes.find(s => s.id === selectedId) : null;
          const selectedLine = selectedLineId ? lines.find(l => l.id === selectedLineId) : null;
          const isStampTool = [TOOLS.ATTACKER, TOOLS.DEFENDER, TOOLS.BALL, TOOLS.GOAL, TOOLS.CONE].includes(activeTool);
          const isLineToolActive = activeTool === TOOLS.LINE;
          const isFieldToolActive = activeTool === TOOLS.FIELD;

          // Determine what we're working with
          const showLineControls = selectedLine || isLineToolActive;
          const showFieldControls = isFieldToolActive;
          const activeType = selectedShape?.type || (isStampTool ? activeTool : null);

          const currentScale = selectedShape ? (selectedShape.scaleX || 1) : stampScale;
          const currentRotation = selectedShape ? (selectedShape.rotation || 0) : stampRotation;
          const currentLineStroke = selectedLine ? selectedLine.strokeWidth : lineStrokeWidth;
          const currentLineType = selectedLine ? selectedLine.type : lineType;

          // Count shapes of same type when "select all" is enabled
          const selectedTypeCount = selectedShape && applyToAll
            ? shapes.filter(s => s.type === selectedShape.type).length
            : 0;
          const getToolIcon = (type) => {
            const iconMap = {
              [TOOLS.ATTACKER]: <IconAttacker />, attacker: <IconAttacker />,
              [TOOLS.DEFENDER]: <IconDefender />, defender: <IconDefender />,
              [TOOLS.BALL]: <IconBall />, ball: <IconBall />,
              [TOOLS.GOAL]: <IconGoal />, goal: <IconGoal />,
              [TOOLS.CONE]: <IconCone color={selectedShape?.color || selectedConeColor} />,
              cone: <IconCone color={selectedShape?.color || selectedConeColor} />,
            };
            return iconMap[type] || null;
          };
          const toolLabels = {
            [TOOLS.ATTACKER]: 'Attacker', attacker: 'Attacker',
            [TOOLS.DEFENDER]: 'Defender', defender: 'Defender',
            [TOOLS.BALL]: 'Ball', ball: 'Ball',
            [TOOLS.GOAL]: 'Goal', goal: 'Goal',
            [TOOLS.CONE]: 'Cone', cone: 'Cone',
          };
          const lineLabels = {
            [LINE_TYPES.PASS]: 'Pass',
            [LINE_TYPES.MOVEMENT]: 'Run',
            [LINE_TYPES.DRIBBLE]: 'Dribble',
          };

          // Icon for line types in header
          const getLineIcon = (type) => {
            const iconMap = {
              [LINE_TYPES.PASS]: <IconPass />,
              [LINE_TYPES.MOVEMENT]: <IconMovement />,
              [LINE_TYPES.DRIBBLE]: <IconDribble />,
            };
            return iconMap[type] || null;
          };

          return (
            <div className="w-56 shrink-0 border-l border-slate-700 p-3 flex flex-col gap-3 overflow-y-auto bg-slate-800/30">
              {/* Header - shows what's selected or active tool */}
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    {selectedLine ? 'Selected' : selectedShape ? 'Selected' : isLineToolActive ? 'Drawing' : isStampTool ? 'Placing' : isFieldToolActive ? 'Canvas' : 'Properties'}
                  </span>
                  {/* Delete button for shapes */}
                  {selectedShape && (
                    <button
                      onClick={() => {
                        if (applyToAll) {
                          setShapes(shapes.filter(s => s.type !== selectedShape.type));
                        } else {
                          setShapes(shapes.filter(s => s.id !== selectedId));
                        }
                        setSelectedId(null);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                      title={applyToAll ? `Delete all ${selectedTypeCount} ${selectedShape.type}s` : 'Delete'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/>
                      </svg>
                    </button>
                  )}
                  {/* Delete button for lines */}
                  {selectedLine && (
                    <button
                      onClick={() => {
                        setLines(lines.filter(l => l.id !== selectedLineId));
                        setSelectedLineId(null);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                      title="Delete line"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/>
                      </svg>
                    </button>
                  )}
                </div>
                {/* Line selected or line tool active */}
                {showLineControls ? (
                  <div className="text-sm font-medium text-white capitalize flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5">{getLineIcon(currentLineType)}</span>
                    {lineLabels[currentLineType]}
                  </div>
                ) : showFieldControls ? (
                  <div className="text-sm font-medium text-white capitalize flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5"><IconField /></span>
                    Field Settings
                  </div>
                ) : activeType ? (
                  <div className="text-sm font-medium text-white capitalize flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5">{getToolIcon(activeType)}</span>
                    {toolLabels[activeType]}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">Click a tool or shape</div>
                )}

                {/* Select all toggle - now in header when shape selected */}
                {selectedShape && (
                  <label className="flex items-center gap-2 cursor-pointer mt-3 pt-3 border-t border-slate-600/50">
                    <input
                      type="checkbox"
                      checked={applyToAll}
                      onChange={(e) => setApplyToAll(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-500 bg-slate-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-700"
                    />
                    <span className="text-xs text-slate-300">
                      Select all {selectedShape.type}s
                      {applyToAll && selectedTypeCount > 1 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-medium">
                          {selectedTypeCount}
                        </span>
                      )}
                    </span>
                  </label>
                )}
              </div>

              {/* Transform controls - only for shapes (not lines) */}
              {(selectedShape || isStampTool) && !showLineControls && (
                <div className="bg-slate-700/30 rounded-lg p-3 space-y-4">
                  {/* Size slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-400">Size</span>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {Math.round(currentScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.1"
                      value={currentScale}
                      onChange={(e) => {
                        const newScale = parseFloat(e.target.value);
                        if (selectedShape) {
                          if (applyToAll) {
                            setShapes(shapes.map(s =>
                              s.type === selectedShape.type
                                ? { ...s, scaleX: newScale, scaleY: newScale }
                                : s
                            ));
                          } else {
                            setShapes(shapes.map(s =>
                              s.id === selectedId
                                ? { ...s, scaleX: newScale, scaleY: newScale }
                                : s
                            ));
                          }
                        }
                        setStampScale(newScale);
                      }}
                      className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Rotation slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-400">Rotation</span>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {Math.round(currentRotation)}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="15"
                      value={currentRotation}
                      onChange={(e) => {
                        const newRotation = parseFloat(e.target.value);
                        if (selectedShape) {
                          if (applyToAll) {
                            setShapes(shapes.map(s =>
                              s.type === selectedShape.type
                                ? { ...s, rotation: newRotation }
                                : s
                            ));
                          } else {
                            setShapes(shapes.map(s =>
                              s.id === selectedId
                                ? { ...s, rotation: newRotation }
                                : s
                            ));
                          }
                        }
                        setStampRotation(newRotation);
                      }}
                      className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Line controls - type toggle and stroke width */}
              {showLineControls && (
                <div className="bg-slate-700/30 rounded-lg p-3 space-y-4">
                  {/* Line Type Toggle - vertical stack */}
                  <div>
                    <div className="text-xs font-medium text-slate-400 mb-2">Line Type</div>
                    <div className="space-y-1">
                      {[LINE_TYPES.PASS, LINE_TYPES.MOVEMENT, LINE_TYPES.DRIBBLE].map((lt) => (
                        <button
                          key={lt}
                          onClick={() => {
                            if (selectedLine) {
                              setLines(lines.map(l =>
                                l.id === selectedLineId
                                  ? { ...l, type: lt }
                                  : l
                              ));
                            }
                            // Always update the lineType state for new lines
                            setLineType(lt);
                          }}
                          className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all border ${
                            currentLineType === lt
                              ? 'bg-blue-600 text-white border-blue-500'
                              : 'text-slate-300 hover:bg-slate-700 border-slate-600/50 bg-slate-800/50'
                          }`}
                        >
                          <span className="flex items-center justify-center w-4 h-4">
                            {lt === LINE_TYPES.PASS && <IconPass />}
                            {lt === LINE_TYPES.MOVEMENT && <IconMovement />}
                            {lt === LINE_TYPES.DRIBBLE && <IconDribble />}
                          </span>
                          <span>{lineLabels[lt]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stroke Width slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-400">Stroke Width</span>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {currentLineStroke}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      step="1"
                      value={currentLineStroke}
                      onChange={(e) => {
                        const newStroke = parseInt(e.target.value);
                        if (selectedLine) {
                          // Update the selected line's stroke width
                          setLines(lines.map(l =>
                            l.id === selectedLineId
                              ? { ...l, strokeWidth: newStroke }
                              : l
                          ));
                        }
                        // Always update the default for new lines
                        setLineStrokeWidth(newStroke);
                      }}
                      className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Field controls - field type selection */}
              {showFieldControls && (
                <div className="bg-slate-700/30 rounded-lg p-3 space-y-4">
                  <div>
                    <div className="text-xs font-medium text-slate-400 mb-2">Field Type</div>
                    <div className="space-y-1">
                      {FIELD_TYPES.map((ft) => (
                        <button
                          key={ft.id}
                          onClick={() => setFieldType(ft)}
                          className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all border ${
                            fieldType.id === ft.id
                              ? 'bg-blue-600 text-white border-blue-500'
                              : 'text-slate-300 hover:bg-slate-700 border-slate-600/50 bg-slate-800/50'
                          }`}
                        >
                          <span className="flex items-center justify-center w-4 h-4">
                            <IconField />
                          </span>
                          <span>{ft.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 pt-2 border-t border-slate-600/50">
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="text-slate-400">{fieldType.width} × {fieldType.height}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Cone color picker - for selected cones OR when placing cones */}
              {(selectedShape?.type === 'cone' || activeTool === TOOLS.CONE) && (
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-xs font-medium text-slate-400 mb-3">Cone Color</div>
                  <div className="flex gap-2 flex-wrap">
                    {CONE_COLORS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          if (selectedShape) {
                            if (applyToAll) {
                              setShapes(shapes.map(s =>
                                s.type === 'cone'
                                  ? { ...s, color: c.color }
                                  : s
                              ));
                            } else {
                              setShapes(shapes.map(s =>
                                s.id === selectedId
                                  ? { ...s, color: c.color }
                                  : s
                              ));
                            }
                          }
                          setSelectedConeColor(c.color);
                        }}
                        className={`w-8 h-8 rounded-lg transition-all border-2 ${
                          (selectedShape?.color === c.color || (!selectedShape && selectedConeColor === c.color))
                            ? 'border-white scale-110'
                            : 'border-transparent hover:scale-105 hover:border-slate-500'
                        }`}
                        style={{ backgroundColor: c.color }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Quick actions - stacked when shape selected */}
              {selectedShape && (
                <div className="space-y-2">
                  <button
                    onClick={() => setClipboard({ ...selectedShape })}
                    className="w-full px-3 py-2 text-xs font-medium text-slate-300 bg-slate-700/50 hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-2 border border-slate-600/50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    Copy
                    <span className="ml-auto text-slate-500 text-[10px]">⌘C</span>
                  </button>
                  {clipboard && (
                    <button
                      onClick={() => {
                        const newShape = {
                          ...clipboard,
                          id: generateId(),
                          x: clipboard.x + 30,
                          y: clipboard.y + 30,
                        };
                        setShapes([...shapes, newShape]);
                        setSelectedId(newShape.id);
                      }}
                      className="w-full px-3 py-2 text-xs font-medium text-slate-300 bg-slate-700/50 hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-2 border border-slate-600/50"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                        <rect x="8" y="2" width="8" height="4" rx="1"/>
                      </svg>
                      Paste
                      <span className="ml-auto text-slate-500 text-[10px]">⌘V</span>
                    </button>
                  )}
                </div>
              )}

              {/* Hint when placing stamps */}
              {!selectedShape && !showLineControls && isStampTool && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-xs text-blue-300">
                    Click on the field to place
                  </p>
                </div>
              )}

              {/* Hint when drawing lines */}
              {isLineToolActive && !selectedLine && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-xs text-blue-300">
                    {currentLine
                      ? 'Click to add points, double-click to finish'
                      : 'Click to start drawing, double-click to finish'}
                  </p>
                  <p className="text-[10px] text-blue-400/70 mt-1">
                    Press Esc to cancel
                  </p>
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Keyboard shortcuts - minimal */}
              <div className="text-[10px] text-slate-500 pt-3 border-t border-slate-700/50">
                <span>⌫ delete</span> · <span>Esc {currentLine ? 'cancel' : 'deselect'}</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default DiagramBuilder;

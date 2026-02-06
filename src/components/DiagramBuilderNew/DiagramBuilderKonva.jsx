import React, { useRef, useState } from 'react';
import { Stage, Layer, Rect, Transformer } from 'react-konva';
import Toolbar from './Toolbar';
import Ball from './shapes/Ball';
import Goal from './shapes/Goal';
import Cone from './shapes/Cone';
import Attacker from './shapes/Attacker';
import Defender from './shapes/Defender';
import { FIELD_TYPES, CONE_COLORS } from '../../constants/diagram';
import { generateId } from '../../utils/id';
import useKonvaImage from '../../hooks/useKonvaImage';
import ballSvgUrl from '../../assets/ball.svg';
import netSvgUrl from '../../assets/net.svg';

// Use first field type dimensions
const FIELD_WIDTH = FIELD_TYPES[0].width + 100; // Slightly wider for this builder
const FIELD_HEIGHT = FIELD_TYPES[0].height + 8;

const DiagramBuilderKonva = ({ onSave, onClose }) => {
  const stageRef = useRef(null);

  const [toolMode, setToolMode] = useState('select');
  const [selectedConeColor, setSelectedConeColor] = useState(CONE_COLORS[0].color);

  const [items, setItems] = useState([]); // Placed stamps
  const ballImage = useKonvaImage(ballSvgUrl);
  const goalImage = useKonvaImage(netSvgUrl);
  const [selectedId, setSelectedId] = useState(null);

  // Handle canvas click for stamp placement
  const handleStageClick = (e) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Deselect if clicking on empty space
    if (toolMode === 'select') {
      if (e.target === stage) {
        setSelectedId(null);
      }
      return;
    }

    let newItem = null;
    if (toolMode === 'ball') {
      newItem = {
        id: generateId('ball'),
        type: 'ball',
        x: pos.x,
        y: pos.y,
        rotation: 0,
      };
    } else if (toolMode === 'goal') {
      newItem = {
        id: generateId('goal'),
        type: 'goal',
        x: pos.x,
        y: pos.y,
        rotation: 0,
      };
    } else if (toolMode === 'cone') {
      newItem = {
        id: generateId('cone'),
        type: 'cone',
        x: pos.x,
        y: pos.y,
        rotation: 0,
        color: selectedConeColor,
      };
    } else if (toolMode === 'attacker') {
      newItem = {
        id: generateId('attacker'),
        type: 'attacker',
        x: pos.x,
        y: pos.y,
        rotation: 0,
      };
    } else if (toolMode === 'defender') {
      newItem = {
        id: generateId('defender'),
        type: 'defender',
        x: pos.x,
        y: pos.y,
        rotation: 0,
      };
    }
    if (newItem) {
      setItems((prev) => [...prev, newItem]);
    }
  };

  // Stamp click handler for selection
  const handleSelect = (id) => {
    setSelectedId(id);
    setToolMode('select');
  };

  // Drag/transform handlers
  const handleDragEnd = (id, e) => {
    const { x, y } = e.target;
    setItems((prev) => prev.map(item => item.id === id ? { ...item, x, y } : item));
  };
  const handleTransformEnd = (id, e) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const rotation = node.rotation();
    setItems((prev) => prev.map(item =>
      item.id === id
        ? {
            ...item,
            x: node.x(),
            y: node.y(),
            rotation,
            scaleX,
            scaleY,
          }
        : item
    ));
    // Reset scale to 1 after transform for consistent resizing
    node.scaleX(1);
    node.scaleY(1);
  };

  const handleSave = () => {
    const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2 }) || '';
    onSave?.({
      name: 'Diagram',
      dataUrl,
      elements: [],
      lines: [],
      fieldType: 'full',
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-900">
        <h2 className="text-lg font-semibold text-white">Diagram Builder (Demo)</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
      {/* Main layout: toolbar + canvas */}
      <div className="flex flex-1 bg-slate-900">
        <Toolbar
          toolMode={toolMode}
          setToolMode={setToolMode}
          selectedConeColor={selectedConeColor}
          setSelectedConeColor={setSelectedConeColor}
        />
        <div className="flex items-center justify-center flex-1 p-8">
          <div className="rounded-lg overflow-hidden ring-2 ring-slate-600">
            <Stage
              ref={stageRef}
              width={FIELD_WIDTH}
              height={FIELD_HEIGHT}
              onClick={handleStageClick}
            >
              <Layer>
                {/* Green soccer field background */}
                <Rect
                  x={0}
                  y={0}
                  width={FIELD_WIDTH}
                  height={FIELD_HEIGHT}
                  fill="#2d8a2d"
                />
                {/* Field outline */}
                <Rect
                  x={15}
                  y={15}
                  width={FIELD_WIDTH - 30}
                  height={FIELD_HEIGHT - 30}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={2}
                />
                {/* Center line */}
                <Rect
                  x={FIELD_WIDTH / 2 - 1}
                  y={15}
                  width={2}
                  height={FIELD_HEIGHT - 30}
                  fill="rgba(255,255,255,0.7)"
                />
                {/* Center circle */}
                <Rect
                  x={FIELD_WIDTH / 2 - 60}
                  y={FIELD_HEIGHT / 2 - 60}
                  width={120}
                  height={120}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={2}
                  cornerRadius={60}
                />
                {/* Center dot */}
                <Rect
                  x={FIELD_WIDTH / 2 - 4}
                  y={FIELD_HEIGHT / 2 - 4}
                  width={8}
                  height={8}
                  fill="rgba(255,255,255,0.7)"
                  cornerRadius={4}
                />
                {/* Render placed items */}
                {items.map((item) => {
                  const isSelected = item.id === selectedId;
                  const commonProps = {
                    x: item.x,
                    y: item.y,
                    rotation: item.rotation || 0,
                    isSelected,
                    onSelect: () => handleSelect(item.id),
                    onDragEnd: (e) => handleDragEnd(item.id, e),
                    onTransformEnd: (e) => handleTransformEnd(item.id, e),
                  };
                  if (item.type === 'ball') {
                    return <Ball key={item.id} {...commonProps} image={ballImage} />;
                  } else if (item.type === 'goal') {
                    return <Goal key={item.id} {...commonProps} image={goalImage} />;
                  } else if (item.type === 'cone') {
                    return <Cone key={item.id} {...commonProps} color={item.color} />;
                  } else if (item.type === 'attacker') {
                    return <Attacker key={item.id} {...commonProps} />;
                  } else if (item.type === 'defender') {
                    return <Defender key={item.id} {...commonProps} />;
                  }
                  return null;
                })}
                {/* Transformer for selected item */}
                {selectedId && (
                  <Transformer
                    node={stageRef.current?.findOne(`#${selectedId}`)}
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                    rotateEnabled
                  />
                )}
              </Layer>
            </Stage>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagramBuilderKonva;

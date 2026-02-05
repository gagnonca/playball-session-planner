import React, { useRef } from 'react';
import { Group, Path, Ellipse } from 'react-konva';

// Simplified cone path - scaled for 30x30 display
const CONE_BODY_PATH = 'M 3 24 L 12 4 C 12.5 3.5 13.5 3.5 14 4 L 27 24 C 27.5 25 27 26 26 26 L 4 26 C 3 26 2.5 25 3 24 Z';
const CONE_TOP_PATH = 'M 8 6 L 22 6 C 22 4 18 2 15 2 C 12 2 8 4 8 6 Z';

const Cone = ({ id, x, y, rotation = 0, color = '#FF6B35', isSelected, onSelect, onDragEnd, onTransformEnd }) => {
  const groupRef = useRef(null);
  const size = 30;

  return (
    <Group
      ref={groupRef}
      id={id}
      x={x}
      y={y}
      rotation={rotation}
      offsetX={size / 2}
      offsetY={size / 2}
      draggable
      name="selectable shape cone"
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect?.(e);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect?.(e);
      }}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      {/* Cone body */}
      <Path
        data={CONE_BODY_PATH}
        fill={color}
        stroke={isSelected ? '#FFD700' : '#231F20'}
        strokeWidth={isSelected ? 2 : 1}
      />
      {/* Cone top (brown ring) */}
      <Ellipse
        x={15}
        y={5}
        radiusX={7}
        radiusY={2}
        fill="#90330C"
        stroke="#231F20"
        strokeWidth={1}
      />
    </Group>
  );
};

export default Cone;

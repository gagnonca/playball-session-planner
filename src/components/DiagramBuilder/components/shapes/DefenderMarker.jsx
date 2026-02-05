import React, { useRef } from 'react';
import { Group, RegularPolygon, Circle } from 'react-konva';
import { DEFENDER_COLOR } from '../../utils/constants';

const DefenderMarker = ({ id, x, y, rotation = 0, isSelected, onSelect, onDragEnd, onTransformEnd }) => {
  const groupRef = useRef(null);
  const radius = 20;

  return (
    <Group
      ref={groupRef}
      id={id}
      x={x}
      y={y}
      rotation={rotation}
      draggable
      name="selectable shape defender"
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
      {/* Main triangle */}
      <RegularPolygon
        sides={3}
        radius={radius}
        fill={DEFENDER_COLOR}
        stroke={isSelected ? '#FFD700' : '#000000'}
        strokeWidth={isSelected ? 3 : 2}
        shadowColor="rgba(0,0,0,0.3)"
        shadowBlur={5}
        shadowOffset={{ x: 2, y: 2 }}
      />
      {/* Direction indicator (small circle at top) */}
      <Circle
        x={0}
        y={-radius - 6}
        radius={5}
        fill="#FFFFFF"
        stroke="#000000"
        strokeWidth={1}
        opacity={0.9}
      />
    </Group>
  );
};

export default DefenderMarker;

import React, { useRef } from 'react';
import { Group, Circle, RegularPolygon } from 'react-konva';
import { ATTACKER_COLOR } from '../../utils/constants';

const AttackerMarker = ({ id, x, y, rotation = 0, isSelected, onSelect, onDragEnd, onTransformEnd }) => {
  const groupRef = useRef(null);
  const radius = 18;

  return (
    <Group
      ref={groupRef}
      id={id}
      x={x}
      y={y}
      rotation={rotation}
      draggable
      name="selectable shape attacker"
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
      {/* Main circle */}
      <Circle
        radius={radius}
        fill={ATTACKER_COLOR}
        stroke={isSelected ? '#FFD700' : '#000000'}
        strokeWidth={isSelected ? 3 : 2}
        shadowColor="rgba(0,0,0,0.3)"
        shadowBlur={5}
        shadowOffset={{ x: 2, y: 2 }}
      />
      {/* Direction indicator (small triangle at top) */}
      <RegularPolygon
        x={0}
        y={-radius - 6}
        sides={3}
        radius={7}
        fill="#FFFFFF"
        stroke="#000000"
        strokeWidth={1}
        rotation={0}
        opacity={0.9}
      />
    </Group>
  );
};

export default AttackerMarker;

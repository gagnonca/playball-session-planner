import React from 'react';
import { Group, Circle, RegularPolygon } from 'react-konva';

const Attacker = ({ x, y, rotation = 0, isSelected, onSelect, onDragEnd, onTransformEnd }) => {
  const radius = 18;
  return (
    <Group
      x={x}
      y={y}
      rotation={rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      <Circle
        radius={radius}
        fill="#EF4444"
        stroke={isSelected ? '#FFD700' : '#000000'}
        strokeWidth={isSelected ? 3 : 2}
        shadowColor="rgba(0,0,0,0.3)"
        shadowBlur={5}
        shadowOffset={{ x: 2, y: 2 }}
      />
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

export default Attacker;

import React from 'react';
import { Group, RegularPolygon } from 'react-konva';

const Defender = ({ x, y, rotation = 0, isSelected, onSelect, onDragEnd, onTransformEnd }) => {
  const size = 36;
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
      <RegularPolygon
        sides={3}
        radius={size / 2}
        fill="#3B82F6"
        stroke={isSelected ? '#FFD700' : '#000000'}
        strokeWidth={isSelected ? 3 : 2}
        shadowColor="rgba(0,0,0,0.3)"
        shadowBlur={5}
        shadowOffset={{ x: 2, y: 2 }}
        rotation={180}
      />
      {/* Direction indicator (small triangle at top) */}
      <RegularPolygon
        x={0}
        y={-size / 2 - 6}
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

export default Defender;

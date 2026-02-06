import React, { useRef } from 'react';
import { Group, Image, Rect } from 'react-konva';
import useKonvaImage from '../../../../hooks/useKonvaImage';
import netSvg from '../../../../assets/net.svg';

const Goal = ({ id, x, y, rotation = 0, width = 80, height = 40, isSelected, onSelect, onDragEnd, onTransformEnd }) => {
  const image = useKonvaImage(netSvg);
  const groupRef = useRef(null);

  return (
    <Group
      ref={groupRef}
      id={id}
      x={x}
      y={y}
      rotation={rotation}
      offsetX={width / 2}
      offsetY={height / 2}
      draggable
      name="selectable shape goal"
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
      {/* Goal frame background */}
      <Rect
        width={width}
        height={height}
        fill="rgba(255, 255, 255, 0.1)"
        stroke={isSelected ? '#FFD700' : '#FFFFFF'}
        strokeWidth={isSelected ? 4 : 3}
      />
      {/* Net pattern */}
      {image && (
        <Image
          image={image}
          width={width - 6}
          height={height - 6}
          x={3}
          y={3}
          opacity={0.6}
        />
      )}
      {/* Goal posts */}
      <Rect x={0} y={0} width={4} height={height} fill="#FFFFFF" />
      <Rect x={width - 4} y={0} width={4} height={height} fill="#FFFFFF" />
      <Rect x={0} y={0} width={width} height={4} fill="#FFFFFF" />
    </Group>
  );
};

export default Goal;

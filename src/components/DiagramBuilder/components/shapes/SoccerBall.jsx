import React, { useEffect, useRef, useState } from 'react';
import { Group, Image } from 'react-konva';
import ballSvg from '../../../../assets/ball.svg';

const SoccerBall = ({ id, x, y, rotation = 0, isSelected, onSelect, onDragEnd, onTransformEnd }) => {
  const [image, setImage] = useState(null);
  const groupRef = useRef(null);
  const size = 30; // Display size

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = ballSvg;
  }, []);

  if (!image) return null;

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
      name="selectable shape ball"
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
      <Image
        image={image}
        width={size}
        height={size}
        stroke={isSelected ? '#FFD700' : undefined}
        strokeWidth={isSelected ? 3 : 0}
      />
    </Group>
  );
};

export default SoccerBall;

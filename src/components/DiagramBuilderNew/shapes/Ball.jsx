import React from 'react';
import { Image } from 'react-konva';

// Ball SVG asset loader
import { Circle } from 'react-konva';
const Ball = ({ x, y, rotation = 0, isSelected, onSelect, onDragEnd, onTransformEnd, image }) => {
    if (image) {
        return (
            <Image
                x={x}
                y={y}
                width={40}
                height={40}
                offsetX={20}
                offsetY={20}
                rotation={rotation}
                image={image}
                draggable
                onClick={onSelect}
                onTap={onSelect}
                onDragEnd={onDragEnd}
                onTransformEnd={onTransformEnd}
                shadowBlur={isSelected ? 10 : 0}
                shadowColor={isSelected ? '#FFD700' : undefined}
            />
        );
    }
    // Fallback: simple white circle with black stroke
    return (
        <Circle
            x={x}
            y={y}
            radius={20}
            fill="#fff"
            stroke="#222"
            strokeWidth={3}
            rotation={rotation}
            draggable
            onClick={onSelect}
            onTap={onSelect}
            onDragEnd={onDragEnd}
            onTransformEnd={onTransformEnd}
            shadowBlur={isSelected ? 10 : 0}
            shadowColor={isSelected ? '#FFD700' : undefined}
        />
    );
};

export default Ball;

import React from 'react';
import { Image } from 'react-konva';

// Goal SVG asset loader
const Goal = ({ x, y, rotation = 0, isSelected, onSelect, onDragEnd, onTransformEnd, image }) => {
    return (
        <Image
            x={x}
            y={y}
            width={60}
            height={40}
            offsetX={30}
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
};

export default Goal;

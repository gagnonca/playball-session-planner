import React from 'react';
import { Circle, Group } from 'react-konva';

const LineAnchorPoints = ({ line, onUpdateLine }) => {
  if (!line || !line.points || line.points.length < 4) {
    return null;
  }

  const anchors = [];

  // Create anchor at each point
  for (let i = 0; i < line.points.length; i += 2) {
    const x = line.points[i];
    const y = line.points[i + 1];
    const pointIndex = i / 2;
    const isEndpoint = i === 0 || i === line.points.length - 2;

    anchors.push(
      <Circle
        key={`anchor-${line.id}-${i}`}
        x={x}
        y={y}
        radius={isEndpoint ? 8 : 6}
        fill={isEndpoint ? '#3B82F6' : '#FFFFFF'}
        stroke="#1E40AF"
        strokeWidth={2}
        draggable
        onDragMove={(e) => {
          // Update the point position during drag
          const newPoints = [...line.points];
          newPoints[i] = e.target.x();
          newPoints[i + 1] = e.target.y();
          onUpdateLine(line.id, { points: newPoints });
        }}
        onDragEnd={(e) => {
          // Final update when drag ends
          const newPoints = [...line.points];
          newPoints[i] = e.target.x();
          newPoints[i + 1] = e.target.y();
          onUpdateLine(line.id, { points: newPoints });
        }}
        onMouseEnter={(e) => {
          const stage = e.target.getStage();
          stage.container().style.cursor = 'grab';
        }}
        onMouseLeave={(e) => {
          const stage = e.target.getStage();
          stage.container().style.cursor = 'default';
        }}
      />
    );
  }

  return <Group>{anchors}</Group>;
};

export default LineAnchorPoints;

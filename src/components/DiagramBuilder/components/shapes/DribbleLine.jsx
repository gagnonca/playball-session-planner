import React from 'react';
import { Shape } from 'react-konva';
import { generateSquigglyPoints, getEndAngle, drawArrowhead } from '../../utils/lineUtils';
import { LINE_STYLES, LINE_TYPES, ARROW_CONFIG } from '../../utils/constants';

const DribbleLine = ({
  id,
  points,
  hasArrow = true,
  isSelected,
  onSelect,
  onClick,
}) => {
  const style = LINE_STYLES[LINE_TYPES.DRIBBLE];

  const handleClick = (e) => {
    e.cancelBubble = true;
    onSelect?.(e);
    onClick?.(e);
  };

  // Generate the squiggly points
  const squigglyPoints = generateSquigglyPoints(points, {
    amplitude: 6,
    frequency: 8,
    segments: 60,
  });

  return (
    <Shape
      sceneFunc={(context, shape) => {
        if (squigglyPoints.length < 4) return;

        // Draw the squiggly line
        context.beginPath();
        context.moveTo(squigglyPoints[0], squigglyPoints[1]);

        for (let i = 2; i < squigglyPoints.length; i += 2) {
          context.lineTo(squigglyPoints[i], squigglyPoints[i + 1]);
        }

        context.strokeShape(shape);

        // Draw arrowhead at the end if enabled
        if (hasArrow && points.length >= 4) {
          const endX = points[points.length - 2];
          const endY = points[points.length - 1];
          const angle = getEndAngle(points);

          // Calculate arrowhead points
          const { pointerLength, pointerWidth } = ARROW_CONFIG;
          const halfWidth = pointerWidth / 2;

          context.beginPath();
          context.moveTo(endX, endY);
          context.lineTo(
            endX - pointerLength * Math.cos(angle) + halfWidth * Math.sin(angle),
            endY - pointerLength * Math.sin(angle) - halfWidth * Math.cos(angle)
          );
          context.lineTo(
            endX - pointerLength * Math.cos(angle) - halfWidth * Math.sin(angle),
            endY - pointerLength * Math.sin(angle) + halfWidth * Math.cos(angle)
          );
          context.closePath();
          context.fillShape(shape);
        }
      }}
      stroke={isSelected ? '#FFD700' : style.stroke}
      strokeWidth={isSelected ? style.strokeWidth + 2 : style.strokeWidth}
      fill={isSelected ? '#FFD700' : style.stroke}
      lineCap="round"
      lineJoin="round"
      hitStrokeWidth={20}
      name="selectable line dribble"
      onClick={handleClick}
      onTap={handleClick}
    />
  );
};

export default DribbleLine;

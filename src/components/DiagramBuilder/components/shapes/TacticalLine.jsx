import React from 'react';
import { Arrow, Line, Group } from 'react-konva';
import { LINE_TYPES, LINE_STYLES, ARROW_CONFIG } from '../../utils/constants';

const TacticalLine = ({
  id,
  type,
  points,
  hasArrow = true,
  isSelected,
  onSelect,
  onClick,
}) => {
  const style = LINE_STYLES[type] || LINE_STYLES[LINE_TYPES.PASS];

  // Use tension for smooth curves when there are multiple points
  const tension = points.length > 4 ? 0.4 : 0;

  const handleClick = (e) => {
    e.cancelBubble = true;
    onSelect?.(e);
    onClick?.(e);
  };

  // Common props for the line
  const commonProps = {
    points,
    stroke: isSelected ? '#FFD700' : style.stroke,
    strokeWidth: isSelected ? style.strokeWidth + 2 : style.strokeWidth,
    tension,
    lineCap: 'round',
    lineJoin: 'round',
    hitStrokeWidth: 20, // Larger hit area for easier selection
    name: `selectable line ${type}`,
    onClick: handleClick,
    onTap: handleClick,
  };

  // For lines with arrows, use Arrow component
  if (hasArrow && type !== LINE_TYPES.DRIBBLE) {
    return (
      <Arrow
        {...commonProps}
        pointerLength={ARROW_CONFIG.pointerLength}
        pointerWidth={ARROW_CONFIG.pointerWidth}
        fill={isSelected ? '#FFD700' : style.stroke}
        dash={style.dash}
      />
    );
  }

  // For lines without arrows or dribble type, use Line component
  return (
    <Line
      {...commonProps}
      dash={style.dash}
    />
  );
};

export default TacticalLine;

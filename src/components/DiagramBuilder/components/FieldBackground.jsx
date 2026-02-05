import React from 'react';
import { Group, Rect, Circle, Line, Arc } from 'react-konva';

const FieldBackground = ({ width, height, fieldType }) => {
  const centerX = width / 2;
  const centerY = height / 2;

  // Scale factors based on field size
  const scale = Math.min(width / 1200, height / 800);
  const penaltyAreaWidth = 165 * scale;
  const penaltyAreaHeight = 400 * scale;
  const goalAreaWidth = 55 * scale;
  const goalAreaHeight = 180 * scale;
  const centerCircleRadius = 91.5 * scale;
  const penaltySpotDistance = 110 * scale;
  const penaltyArcRadius = 91.5 * scale;

  // Common field markings
  const renderCenterMarkings = () => (
    <>
      {/* Center circle */}
      <Circle
        x={centerX}
        y={centerY}
        radius={centerCircleRadius}
        stroke="white"
        strokeWidth={2}
        listening={false}
      />
      {/* Center spot */}
      <Circle
        x={centerX}
        y={centerY}
        radius={4}
        fill="white"
        listening={false}
      />
    </>
  );

  const renderPenaltyArea = (side) => {
    const isLeft = side === 'left';
    const x = isLeft ? 0 : width - penaltyAreaWidth;
    const penaltySpotX = isLeft ? penaltySpotDistance : width - penaltySpotDistance;

    return (
      <Group listening={false}>
        {/* Penalty area */}
        <Rect
          x={x}
          y={centerY - penaltyAreaHeight / 2}
          width={penaltyAreaWidth}
          height={penaltyAreaHeight}
          stroke="white"
          strokeWidth={2}
        />
        {/* Goal area */}
        <Rect
          x={isLeft ? 0 : width - goalAreaWidth}
          y={centerY - goalAreaHeight / 2}
          width={goalAreaWidth}
          height={goalAreaHeight}
          stroke="white"
          strokeWidth={2}
        />
        {/* Penalty spot */}
        <Circle
          x={penaltySpotX}
          y={centerY}
          radius={3}
          fill="white"
        />
        {/* Penalty arc */}
        <Arc
          x={penaltySpotX}
          y={centerY}
          innerRadius={0}
          outerRadius={penaltyArcRadius}
          angle={106}
          rotation={isLeft ? -53 : 127}
          stroke="white"
          strokeWidth={2}
        />
      </Group>
    );
  };

  const renderFullField = () => (
    <Group listening={false}>
      {/* Green field */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#2D7A3A"
      />
      {/* Field boundary */}
      <Rect
        x={5}
        y={5}
        width={width - 10}
        height={height - 10}
        stroke="white"
        strokeWidth={2}
      />
      {/* Center line */}
      <Line
        points={[centerX, 5, centerX, height - 5]}
        stroke="white"
        strokeWidth={2}
      />
      {renderCenterMarkings()}
      {renderPenaltyArea('left')}
      {renderPenaltyArea('right')}
    </Group>
  );

  const renderHalfField = () => (
    <Group listening={false}>
      {/* Green field */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#2D7A3A"
      />
      {/* Field boundary */}
      <Rect
        x={5}
        y={5}
        width={width - 10}
        height={height - 10}
        stroke="white"
        strokeWidth={2}
      />
      {/* Half center line (at left edge) */}
      <Arc
        x={5}
        y={centerY}
        innerRadius={0}
        outerRadius={centerCircleRadius}
        angle={180}
        rotation={-90}
        stroke="white"
        strokeWidth={2}
      />
      {renderPenaltyArea('right')}
    </Group>
  );

  const renderThirdsField = () => (
    <Group listening={false}>
      {/* Green field */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#2D7A3A"
      />
      {/* Field boundary */}
      <Rect
        x={5}
        y={5}
        width={width - 10}
        height={height - 10}
        stroke="white"
        strokeWidth={2}
      />
      {/* Third lines */}
      <Line
        points={[width / 3, 5, width / 3, height - 5]}
        stroke="white"
        strokeWidth={2}
        dash={[10, 5]}
        opacity={0.5}
      />
      <Line
        points={[(width * 2) / 3, 5, (width * 2) / 3, height - 5]}
        stroke="white"
        strokeWidth={2}
        dash={[10, 5]}
        opacity={0.5}
      />
    </Group>
  );

  const renderPenaltyBox = () => {
    const boxScale = Math.min(width / 800, height / 600);
    const boxPenaltyWidth = 165 * boxScale * 1.5;
    const boxPenaltyHeight = 400 * boxScale * 1.2;
    const boxGoalWidth = 55 * boxScale * 1.5;
    const boxGoalHeight = 180 * boxScale * 1.2;
    const boxPenaltySpot = 110 * boxScale * 1.5;
    const boxPenaltyArc = 91.5 * boxScale * 1.5;

    return (
      <Group listening={false}>
        {/* Green field */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#2D7A3A"
        />
        {/* Field boundary */}
        <Rect
          x={5}
          y={5}
          width={width - 10}
          height={height - 10}
          stroke="white"
          strokeWidth={2}
        />
        {/* Penalty area */}
        <Rect
          x={width - boxPenaltyWidth}
          y={centerY - boxPenaltyHeight / 2}
          width={boxPenaltyWidth}
          height={boxPenaltyHeight}
          stroke="white"
          strokeWidth={2}
        />
        {/* Goal area */}
        <Rect
          x={width - boxGoalWidth}
          y={centerY - boxGoalHeight / 2}
          width={boxGoalWidth}
          height={boxGoalHeight}
          stroke="white"
          strokeWidth={2}
        />
        {/* Penalty spot */}
        <Circle
          x={width - boxPenaltySpot}
          y={centerY}
          radius={4}
          fill="white"
        />
        {/* Penalty arc */}
        <Arc
          x={width - boxPenaltySpot}
          y={centerY}
          innerRadius={0}
          outerRadius={boxPenaltyArc}
          angle={106}
          rotation={127}
          stroke="white"
          strokeWidth={2}
        />
      </Group>
    );
  };

  // Render based on field type
  switch (fieldType) {
    case 'half':
      return renderHalfField();
    case 'thirds':
      return renderThirdsField();
    case 'penalty':
      return renderPenaltyBox();
    case 'full':
    default:
      return renderFullField();
  }
};

export default FieldBackground;

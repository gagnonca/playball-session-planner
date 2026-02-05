// Calculate distance between two points
export const distance = (x1, y1, x2, y2) => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

// Calculate total path length from points array [x1, y1, x2, y2, ...]
export const calculatePathLength = (points) => {
  let length = 0;
  for (let i = 0; i < points.length - 2; i += 2) {
    length += distance(points[i], points[i + 1], points[i + 2], points[i + 3]);
  }
  return length;
};

// Get point at parameter t (0-1) along the path
// Returns { x, y, angle, perpX, perpY }
export const getPointOnPath = (points, t) => {
  if (points.length < 4) {
    return { x: points[0] || 0, y: points[1] || 0, angle: 0, perpX: 0, perpY: -1 };
  }

  const totalLength = calculatePathLength(points);
  const targetLength = t * totalLength;

  let accumulatedLength = 0;
  for (let i = 0; i < points.length - 2; i += 2) {
    const x1 = points[i];
    const y1 = points[i + 1];
    const x2 = points[i + 2];
    const y2 = points[i + 3];
    const segmentLength = distance(x1, y1, x2, y2);

    if (accumulatedLength + segmentLength >= targetLength || i >= points.length - 4) {
      const segmentT = segmentLength > 0 ? (targetLength - accumulatedLength) / segmentLength : 0;
      const clampedT = Math.max(0, Math.min(1, segmentT));

      const x = x1 + (x2 - x1) * clampedT;
      const y = y1 + (y2 - y1) * clampedT;

      // Calculate direction and perpendicular
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const angle = Math.atan2(dy, dx);
      const perpX = -dy / len;
      const perpY = dx / len;

      return { x, y, angle, perpX, perpY };
    }

    accumulatedLength += segmentLength;
  }

  // Fallback to last point
  const lastX = points[points.length - 2];
  const lastY = points[points.length - 1];
  return { x: lastX, y: lastY, angle: 0, perpX: 0, perpY: -1 };
};

// Generate squiggly/wave line points
export const generateSquigglyPoints = (basePoints, options = {}) => {
  const { amplitude = 6, frequency = 8, segments = 50 } = options;

  if (basePoints.length < 4) {
    return basePoints;
  }

  const totalLength = calculatePathLength(basePoints);
  if (totalLength < 10) {
    return basePoints;
  }

  const waveFrequency = Math.max(frequency, totalLength / 30);
  const waveAmplitude = Math.min(amplitude, totalLength / 25);

  const result = [];
  const numSegments = Math.max(segments, Math.floor(totalLength / 3));

  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    const { x, y, perpX, perpY } = getPointOnPath(basePoints, t);
    const wave = Math.sin(t * Math.PI * waveFrequency) * waveAmplitude;

    result.push(x + perpX * wave);
    result.push(y + perpY * wave);
  }

  return result;
};

// Calculate angle at end of line (for arrowhead)
export const getEndAngle = (points) => {
  if (points.length < 4) return 0;
  const x1 = points[points.length - 4];
  const y1 = points[points.length - 3];
  const x2 = points[points.length - 2];
  const y2 = points[points.length - 1];
  return Math.atan2(y2 - y1, x2 - x1);
};

// Generate arrowhead points
export const getArrowheadPoints = (tipX, tipY, angle, length = 12, width = 10) => {
  const halfWidth = width / 2;
  const backAngle1 = angle + Math.PI - Math.atan2(halfWidth, length);
  const backAngle2 = angle + Math.PI + Math.atan2(halfWidth, length);
  const backLength = Math.sqrt(length * length + halfWidth * halfWidth);

  return [
    tipX,
    tipY,
    tipX + Math.cos(backAngle1) * backLength,
    tipY + Math.sin(backAngle1) * backLength,
    tipX + Math.cos(backAngle2) * backLength,
    tipY + Math.sin(backAngle2) * backLength,
  ];
};

// Draw arrowhead on canvas context
export const drawArrowhead = (ctx, points, length = 12, width = 10) => {
  if (points.length < 4) return;

  const tipX = points[points.length - 2];
  const tipY = points[points.length - 1];
  const angle = getEndAngle(points);

  const arrowPoints = getArrowheadPoints(tipX, tipY, angle, length, width);

  ctx.beginPath();
  ctx.moveTo(arrowPoints[0], arrowPoints[1]);
  ctx.lineTo(arrowPoints[2], arrowPoints[3]);
  ctx.lineTo(arrowPoints[4], arrowPoints[5]);
  ctx.closePath();
  ctx.fill();
};

// Check if a point is near a line segment
export const pointToLineDistance = (px, py, x1, y1, x2, y2) => {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  return distance(px, py, xx, yy);
};

// Check if a point is near any segment of a line
export const isPointNearLine = (px, py, points, threshold = 10) => {
  for (let i = 0; i < points.length - 2; i += 2) {
    const dist = pointToLineDistance(
      px,
      py,
      points[i],
      points[i + 1],
      points[i + 2],
      points[i + 3]
    );
    if (dist <= threshold) {
      return true;
    }
  }
  return false;
};

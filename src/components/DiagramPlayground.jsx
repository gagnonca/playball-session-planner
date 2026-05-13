import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group, Rect, Circle, Line, Arrow, Text, Path, Shape, Image as KImage, Transformer } from 'react-konva';
import useKonvaImage from '../hooks/useKonvaImage';
import ballSvg from '../assets/ball.svg';
import coneOrangeSvg from '../assets/cone_orange.svg';
import coneBlueSvg from '../assets/cone_blue.svg';
import coneYellowSvg from '../assets/cone_yellow.svg';

const DEFENDER_COLOR = '#3B82F6';

// Cone variants are provided as full-color SVG assets. Cones use a 3-only
// palette (orange/blue/yellow) in the inspector — anything outside that set
// falls back to orange.
const CONE_ORANGE = '#FF6B35';
const CONE_BLUE   = '#3d5a8a';
const CONE_YELLOW = '#c8853d';
const CONE_VARIANT_BY_COLOR = {
  [CONE_ORANGE]: coneOrangeSvg,
  [CONE_BLUE]:   coneBlueSvg,
  [CONE_YELLOW]: coneYellowSvg,
};
const CONE_COLOR = CONE_ORANGE;
const CONE_SWATCHES = [CONE_ORANGE, CONE_BLUE, CONE_YELLOW];
function coneSrcFor(color) {
  return CONE_VARIANT_BY_COLOR[color] || coneOrangeSvg;
}

// Rounded-corner triangle. Konva's RegularPolygon draws sharp vertices; we
// want a soft, marker-like point. The Shape sceneFunc arcTo's through each
// vertex. Vertices passed in directly so callers can stretch the shape to
// taste (an equilateral triangle "feels" smaller than a circle of the same
// bounding radius — there's empty space in the corners — so the defender
// uses a slightly taller-than-wide isoceles with the centroid pinned at the
// origin for predictable dragging).
function roundedTriangleScene({ ctx, shape, pts, corner }) {
  ctx.beginPath();
  ctx.moveTo((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
  for (let i = 0; i < pts.length; i++) {
    const c1 = pts[(i + 1) % pts.length];
    const c2 = pts[(i + 2) % pts.length];
    ctx.arcTo(c1.x, c1.y, c2.x, c2.y, corner);
  }
  ctx.closePath();
  ctx.fillStrokeShape(shape);
}

// Equilateral defender triangle. Three vertices at distance R from the
// centroid (origin), apex up, so drag and label centering feel natural.
// R bumped to 30 vs the original 26 so the triangle matches the attacker
// circle's visual weight — equilateral triangles only fill ~41% of their
// bounding circle so they read smaller at matching radii.
function equilateralPts(R) {
  const half = R * Math.sin(Math.PI / 3); // R * √3 / 2
  const lower = R * 0.5;
  return [
    { x:     0, y: -R },
    { x:  half, y: lower },
    { x: -half, y: lower },
  ];
}
const DEFENDER_PTS = equilateralPts(30);

// Playground for the redesigned Diagram Builder. Routed at /diagram-playground
// (see App.jsx). Built on react-konva so we can ship without the tldraw
// license. Token-driven surround mirrors section 4 of the design handoff:
//
//   ┌───────────────────────────────────────────────────────────────┐
//   │ Back · | · Title (22px)  · · Full/Half/Third · Export · Save  │
//   ├──────┬──────────────────────────────────────────────┬─────────┤
//   │ tool │                                              │ Inspect │
//   │ rail │             Canvas (pitch + shapes)          │  panel  │
//   │ 72px │                                              │ 280px   │
//   └──────┴──────────────────────────────────────────────┴─────────┘

// --- Tool config ------------------------------------------------------------

const TOOLS = [
  { id: 'select',   label: 'Select',   key: 'V' },
  { id: 'attacker', label: 'Attacker', key: 'A' },
  { id: 'defender', label: 'Defender', key: 'D' },
  { id: 'ball',     label: 'Ball',     key: 'B' },
  { id: 'cone',     label: 'Cone',     key: 'C' },
  { id: 'goal',     label: 'Goal',     key: 'G' },
  { id: 'pass',     label: 'Pass',     key: 'P' },
  { id: 'run',      label: 'Run',      key: 'R' },
  { id: 'dribble',  label: 'Dribble',  key: 'X' },
];

// Pitch SIZE controls the game format — aspect ratio of the full pitch plus
// box / center-circle dimensions used when those markings render. 4v4 has no
// penalty box and no center circle by convention.
const PITCH_SIZES = [
  { value: '4v4',   label: '4v4',   aspect: 1.50, circleRadius: 0,  box: null },
  { value: '7v7',   label: '7v7',   aspect: 1.60, circleRadius: 56, box: { outerW: 95,  outerH: 175, innerW: 35, innerH: 80  } },
  { value: '9v9',   label: '9v9',   aspect: 1.65, circleRadius: 70, box: { outerW: 125, outerH: 220, innerW: 50, innerH: 110 } },
  { value: '11v11', label: '11v11', aspect: 1.55, circleRadius: 82, box: { outerW: 160, outerH: 265, innerW: 60, innerH: 125 } },
];

// Pitch VIEW controls how much of the pitch is shown. Each view divides the
// long axis (full = 1, half = 2, third = 3) so aspect ratios derive cleanly
// from the chosen size.
const PITCH_VIEWS = [
  { value: 'full',  label: 'Full',  divisor: 1 },
  { value: 'half',  label: 'Half',  divisor: 2 },
  { value: 'third', label: 'Third', divisor: 3 },
];

const DEFAULT_PITCH_SIZE = '11v11';
const DEFAULT_PITCH_VIEW = 'full';
const PITCH_MAX_WIDTH = 880;
const findSize = (v) => PITCH_SIZES.find(p => p.value === v) || PITCH_SIZES[3];
const findView = (v) => PITCH_VIEWS.find(p => p.value === v) || PITCH_VIEWS[0];

// Logical canvas viewBox — Konva pixels match these so shapes scale cleanly
// across field types. Width is fixed; height derives from aspect so each
// preset renders in its own viewBox without changing how shapes are stored.
const VB_W = 1000;

const COLORS = ['#c8553d', '#3d7a4a', '#3d5a8a', '#c8853d', '#1a1814'];

// --- Tool rail icons --------------------------------------------------------

const Icon = {
  select:   (c) => <svg width="20" height="20" viewBox="0 0 24 24" stroke={c} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4l8 16 2-6 6-2z" /></svg>,
  attacker: ()  => <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="var(--accent)" /><text x="12" y="16" fontSize="11" fontWeight="600" fill="var(--accent-ink)" textAnchor="middle">A</text></svg>,
  defender: ()  => (
    // Pointy isoceles matching the canvas DEFENDER_PTS proportions (centroid
    // at origin, height ≈ 1.06 * width).
    <svg width="22" height="22" viewBox="-14 -14 28 28">
      <path
        d="M 0 -12 L 10.39 6 L -10.39 6 Z"
        fill={DEFENDER_COLOR}
        stroke="#1a1814"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  ),
  ball:     ()  => <img src={ballSvg} width="18" height="18" alt="" style={{ display: 'block' }} />,
  cone:     ()  => <img src={coneOrangeSvg} width="22" height="22" alt="" style={{ display: 'block' }} />,
  goal:     (c) => <svg width="20" height="20" viewBox="0 0 24 24" stroke={c} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v16M4 4h12l-2 5h-10M4 12h10l-2 5H4" /></svg>,
  pass:     (c) => <svg width="22" height="22" viewBox="0 0 24 24" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h16M16 8l4 4-4 4" /></svg>,
  run:      (c) => <svg width="22" height="22" viewBox="0 0 24 24" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h16M16 8l4 4-4 4" strokeDasharray="3 3" /></svg>,
  dribble:  (c) => <svg width="22" height="22" viewBox="0 0 24 24" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12c3 -3 5 3 8 0s5 3 8 0M16 8l4 4-4 4" /></svg>,
};

// --- Helpers ----------------------------------------------------------------

let _uid = 0;
const uid = (p) => `${p}_${++_uid}_${Math.floor(Math.random() * 1e6)}`;

function nextLabel(kind, shapes) {
  if (kind === 'attacker') {
    const n = shapes.filter(s => s.kind === 'attacker').length + 1;
    return `A${n}`;
  }
  if (kind === 'defender') {
    const n = shapes.filter(s => s.kind === 'defender').length + 1;
    return `D${n}`;
  }
  return '';
}

function isLineKind(kind) {
  return kind === 'pass' || kind === 'run' || kind === 'dribble';
}

function isMarkerKind(kind) {
  return kind === 'attacker' || kind === 'defender' || kind === 'ball' || kind === 'cone' || kind === 'goal';
}

// --- Field background -------------------------------------------------------

// Pitch markings are composed from a SIZE (4v4..11v11, dictates box +
// center-circle dimensions) and a VIEW (full / half / third, dictates how
// much of the pitch is shown and which markings appear). Both axes are
// orthogonal — every combination renders sensibly.
function FieldBackground({ w, h, size, view }) {
  const m = 30; // pitch padding inset
  const lineColor = 'rgba(255,255,255,0.65)';
  const stripeStroke = 'rgba(255,255,255,0.04)';
  const stripeCount = 10;
  const stripeW = w / stripeCount;

  const stripes = (
    <>
      {Array.from({ length: stripeCount }).map((_, i) => (
        i % 2 === 1 ? (
          <Rect key={i} x={i * stripeW} y={0} width={stripeW} height={h} fill={stripeStroke} listening={false} />
        ) : null
      ))}
    </>
  );
  const boundary = (
    <Rect x={m} y={m} width={w - m * 2} height={h - m * 2} stroke={lineColor} strokeWidth={3} fillEnabled={false} listening={false} />
  );
  const halfway = (
    <Line points={[w / 2, m, w / 2, h - m]} stroke={lineColor} strokeWidth={2} listening={false} />
  );
  const centerSpot = (
    <Circle x={w / 2} y={h / 2} radius={3} fill="rgba(255,255,255,0.75)" listening={false} />
  );
  const centerCircle = (r) => (
    <Circle x={w / 2} y={h / 2} radius={r} stroke={lineColor} strokeWidth={2} fillEnabled={false} listening={false} />
  );
  const sizeCfg = findSize(size);
  const box = sizeCfg.box;
  const cr  = sizeCfg.circleRadius;
  const endBox = (side) => {
    if (!box) return null;
    const { outerW, outerH, innerW, innerH } = box;
    const isLeft = side === 'left';
    const outerX = isLeft ? m : w - m - outerW;
    const innerX = isLeft ? m : w - m - innerW;
    return (
      <Group key={side} listening={false}>
        <Rect x={outerX} y={(h - outerH) / 2} width={outerW} height={outerH} stroke={lineColor} strokeWidth={2} fillEnabled={false} listening={false} />
        <Rect x={innerX} y={(h - innerH) / 2} width={innerW} height={innerH} stroke={lineColor} strokeWidth={2} fillEnabled={false} listening={false} />
      </Group>
    );
  };
  const tinyGoal = (side) => {
    // For 4v4: no penalty box, but a small visible goal post on each end.
    const x = side === 'left' ? m - 5 : w - m;
    return (
      <Rect key={`goal-${side}`} x={x} y={(h - 50) / 2} width={5} height={50} fill={lineColor} listening={false} />
    );
  };

  if (view === 'full') {
    return (
      <Group listening={false}>
        {stripes}
        {boundary}
        {halfway}
        {cr > 0 && centerCircle(cr)}
        {centerSpot}
        {box ? [endBox('left'), endBox('right')] : [tinyGoal('left'), tinyGoal('right')]}
      </Group>
    );
  }

  if (view === 'half') {
    // Show one end (right) with its penalty box; the open (left) side gets
    // a half-circle hugging the centerline so it reads as "the goal half".
    // For 4v4, the open side gets the tiny goal marker only.
    return (
      <Group listening={false}>
        {stripes}
        {boundary}
        {cr > 0 && (
          <Path
            data={`M ${m} ${h / 2 - cr} A ${cr} ${cr} 0 0 1 ${m} ${h / 2 + cr}`}
            stroke={lineColor}
            strokeWidth={2}
            listening={false}
          />
        )}
        {box ? endBox('right') : tinyGoal('right')}
      </Group>
    );
  }

  // view === 'third' — outline + two dashed thirds, no boxes or circle.
  // Useful for tactical channel work that doesn't care about goal-line markings.
  return (
    <Group listening={false}>
      {stripes}
      {boundary}
      <Line points={[m + (w - 2 * m) / 3, m, m + (w - 2 * m) / 3, h - m]} stroke={lineColor} strokeWidth={2} dash={[8, 6]} opacity={0.6} listening={false} />
      <Line points={[m + (w - 2 * m) * 2 / 3, m, m + (w - 2 * m) * 2 / 3, h - m]} stroke={lineColor} strokeWidth={2} dash={[8, 6]} opacity={0.6} listening={false} />
    </Group>
  );
}

// --- Shape renderers --------------------------------------------------------

function BallImage(props) {
  const image = useKonvaImage(ballSvg);
  if (!image) return null;
  return <KImage image={image} {...props} />;
}

function ConeImage({ color, ...props }) {
  const image = useKonvaImage(coneSrcFor(color));
  if (!image) return null;
  return <KImage image={image} {...props} />;
}

function MarkerShape({ shape, onClick, onDragMove, onDragEnd, onTransformEnd, draggable, id }) {
  const { kind, x, y, label, color } = shape;
  const rotation = shape.rotation ?? 0;

  // Scale is intentionally NOT read from shape state — match the production
  // DiagramBuilder pattern: visual scale lives on the Konva node within a
  // session and isn't part of the persisted shape data. Resize handles still
  // work; their effect persists until the next reload.
  const common = {
    id, // findOne(`#id`) anchors the Transformer to the right Group
    name: 'selectable',
    x,
    y,
    rotation,
    draggable,
    onMouseDown: onClick,
    onTap: onClick,
    onDragMove,
    onDragEnd,
    onTransformEnd,
  };

  if (kind === 'attacker') {
    const fill = color || '#c8553d';
    return (
      <Group {...common}>
        <Circle radius={22} fill={fill} />
        <Text text={label || 'A'} x={-22} y={-7} width={44} align="center" fontSize={14} fontStyle="600" fill="#ffffff" />
      </Group>
    );
  }
  if (kind === 'defender') {
    const fill = color || DEFENDER_COLOR;
    // Bounding box of the equilateral triangle (DEFENDER_PTS, R=30). The
    // Transformer uses Group.getClientRect to decide its own size; a Shape
    // with a sceneFunc doesn't report a rect, so without this invisible
    // marker the transformer would size itself to the Text label and clip
    // the actual triangle.
    const bboxXs = DEFENDER_PTS.map(p => p.x);
    const bboxYs = DEFENDER_PTS.map(p => p.y);
    const bboxX  = Math.min(...bboxXs) - 2;
    const bboxY  = Math.min(...bboxYs) - 2;
    const bboxW  = Math.max(...bboxXs) - Math.min(...bboxXs) + 4;
    const bboxH  = Math.max(...bboxYs) - Math.min(...bboxYs) + 4;
    return (
      <Group {...common}>
        <Rect
          x={bboxX}
          y={bboxY}
          width={bboxW}
          height={bboxH}
          listening={false}
          opacity={0}
        />
        <Shape
          sceneFunc={(ctx, s) => roundedTriangleScene({ ctx, shape: s, pts: DEFENDER_PTS, corner: 7 })}
          fill={fill}
          stroke="#1a1814"
          strokeWidth={1.5}
          lineJoin="round"
        />
        {label && (
          <Text
            text={label}
            x={-26}
            y={-7}
            width={52}
            align="center"
            fontSize={14}
            fontStyle="600"
            fill="#ffffff"
          />
        )}
      </Group>
    );
  }
  if (kind === 'ball') {
    const size = 26;
    return (
      <Group {...common}>
        <BallImage width={size} height={size} offsetX={size / 2} offsetY={size / 2} />
      </Group>
    );
  }
  if (kind === 'cone') {
    const size = 32;
    return (
      <Group {...common}>
        <ConeImage
          color={color || CONE_COLOR}
          width={size}
          height={size}
          offsetX={size / 2}
          offsetY={size / 2}
        />
      </Group>
    );
  }
  if (kind === 'goal') {
    return (
      <Group {...common}>
        <Rect x={-28} y={-10} width={56} height={20} cornerRadius={2} stroke="#1a1814" strokeWidth={2} fill="rgba(255,255,255,0.8)" />
        <Line points={[-22, -10, -22, 10, -10, 10, -10, -10, 0, -10, 0, 10, 10, 10, 10, -10, 22, -10, 22, 10]} stroke="#1a1814" strokeWidth={1} />
      </Group>
    );
  }
  return null;
}

const LINE_STROKE = '#1a1814';
const DRIBBLE_AMPLITUDE = 11;
const DRIBBLE_SAMPLE_STEP = 22;

// Perpendicular distance from a point to a line segment (clamped to the
// segment, not the infinite line). Used to decide which segment to insert
// a new midpoint into when the user double-clicks a curved line.
function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + dx * t;
  const cy = a.y + dy * t;
  return Math.hypot(p.x - cx, p.y - cy);
}

function defaultBendFor(kind) {
  if (kind === 'pass') return -22;
  if (kind === 'run') return 18;
  if (kind === 'dribble') return 14;
  return 0;
}

// Lines now carry a `points: [{x,y}, ...]` array. Legacy shapes (x1/y1/x2/y2
// with an optional `bend`) get auto-converted here so we don't have to
// migrate stored data eagerly.
function pointsOf(shape) {
  if (Array.isArray(shape.points) && shape.points.length >= 2) return shape.points;
  const { x1, y1, x2, y2, kind, bend } = shape;
  const points = [{ x: x1, y: y1 }];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const offset = bend ?? defaultBendFor(kind);
  if (offset !== 0) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    points.push({ x: midX + nx * offset, y: midY + ny * offset });
  }
  points.push({ x: x2, y: y2 });
  return points;
}

// Sample the user's polyline at uniform intervals, applying an alternating
// perpendicular displacement to create a smooth, continuous dribble wave.
// Phase counter persists across segments so the wave doesn't reset at each
// midpoint — the user's control points just bend the underlying carrier.
function buildDribbleSamples(points, amplitude = DRIBBLE_AMPLITUDE, step = DRIBBLE_SAMPLE_STEP) {
  const samples = [{ ...points[0] }];
  let phase = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const n = Math.max(2, Math.round(len / step));
    for (let j = 1; j < n; j++) {
      const t = j / n;
      const px = a.x + dx * t;
      const py = a.y + dy * t;
      const side = phase++ % 2 === 0 ? 1 : -1;
      samples.push({ x: px + nx * amplitude * side, y: py + ny * amplitude * side });
    }
  }
  samples.push({ ...points[points.length - 1] });
  return samples;
}

// Draw a smooth quadratic-spline path through every point in `pts`, treating
// each interior point as a control and the midpoint of each pair as a knot.
// The first and last points are honored exactly (start and end of the curve).
function smoothSceneFunc(pts) {
  return (ctx, shapeNode) => {
    ctx.beginPath();
    if (pts.length === 0) { ctx.strokeShape(shapeNode); return; }
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    }
    ctx.strokeShape(shapeNode);
  };
}

function LineShape({ shape, scaledPoints, onClick, onDblClick }) {
  const { kind } = shape;
  const renderPts = kind === 'dribble' ? buildDribbleSamples(scaledPoints) : scaledPoints;

  // Arrow tangent = direction of the last rendered segment so the head
  // always aligns with how the curve actually arrives at the endpoint.
  const last = renderPts[renderPts.length - 1];
  const prev = renderPts[renderPts.length - 2] || renderPts[0];
  const arrowDirX = last.x - prev.x;
  const arrowDirY = last.y - prev.y;
  const dirLen = Math.hypot(arrowDirX, arrowDirY) || 1;
  const tailLen = 14;
  const tailX = last.x - (arrowDirX / dirLen) * tailLen;
  const tailY = last.y - (arrowDirY / dirLen) * tailLen;

  return (
    <Group onMouseDown={onClick} onTap={onClick} onDblClick={onDblClick} onDblTap={onDblClick}>
      <Shape
        sceneFunc={smoothSceneFunc(renderPts)}
        stroke={LINE_STROKE}
        strokeWidth={3}
        dash={kind === 'run' ? [10, 8] : undefined}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={22}
      />
      <Arrow
        points={[tailX, tailY, last.x, last.y]}
        stroke={LINE_STROKE}
        strokeWidth={3}
        fill={LINE_STROKE}
        pointerLength={11}
        pointerWidth={11}
        listening={false}
      />
    </Group>
  );
}

// Per-point drag handles. Endpoints (idx === 0 and last) render as larger
// white circles; interior midpoints render as smaller accent dots. Every
// handle is draggable; double-clicking an interior midpoint removes it.
function LineHandles({ points, canvasScale, onMovePoint, onRemovePoint }) {
  const onDrag = (idx) => (e) => {
    const node = e.target;
    onMovePoint(idx, node.x() / canvasScale, node.y() / canvasScale);
  };
  const onDbl = (idx) => () => {
    // Endpoints can't be removed — minimum 2 points.
    if (idx === 0 || idx === points.length - 1) return;
    onRemovePoint(idx);
  };

  return (
    <Group listening>
      {points.map((p, idx) => {
        const isEndpoint = idx === 0 || idx === points.length - 1;
        if (isEndpoint) {
          return (
            <Circle
              key={idx}
              x={p.x}
              y={p.y}
              radius={6}
              fill="#ffffff"
              stroke="#c8553d"
              strokeWidth={2}
              draggable
              onDragMove={onDrag(idx)}
              onDragEnd={onDrag(idx)}
            />
          );
        }
        return (
          <Circle
            key={idx}
            x={p.x}
            y={p.y}
            radius={5}
            fill="#c8553d"
            stroke="#ffffff"
            strokeWidth={2}
            draggable
            onDragMove={onDrag(idx)}
            onDragEnd={onDrag(idx)}
            onDblClick={onDbl(idx)}
            onDblTap={onDbl(idx)}
          />
        );
      })}
    </Group>
  );
}

// --- Top bar ----------------------------------------------------------------

function TopBar({ title, onTitleChange, pitchSize, onPitchSize, pitchView, onPitchView, orientation, onOrientation, onBack, onSave, onExport }) {
  return (
    <header
      className="flex items-center gap-4 px-5 py-3"
      style={{ background: 'var(--bg-elev)', borderBottom: '1px solid var(--line)' }}
    >
      <button
        onClick={onBack}
        className="btn btn-ghost"
        style={{ padding: '4px 8px', fontSize: 13 }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>
      <span style={{ color: 'var(--line-2)' }}>|</span>
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="bg-transparent outline-none flex-1 min-w-0"
        style={{
          color: 'var(--ink)',
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          border: 'none',
          padding: 0,
        }}
        placeholder="Untitled play"
      />
      <div className="inline-flex items-center gap-3">
        <label className="inline-flex items-center gap-1.5">
          <span className="font-mono uppercase" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>SIZE</span>
          <select
            value={pitchSize}
            onChange={(e) => onPitchSize(e.target.value)}
            className="input-field"
            style={{ padding: '6px 10px', fontSize: 13, width: 'auto' }}
            aria-label="Pitch size"
          >
            {PITCH_SIZES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5">
          <span className="font-mono uppercase" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>VIEW</span>
          <select
            value={pitchView}
            onChange={(e) => onPitchView(e.target.value)}
            className="input-field"
            style={{ padding: '6px 10px', fontSize: 13, width: 'auto' }}
            aria-label="Pitch view"
          >
            {PITCH_VIEWS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
        <button
          onClick={() => onOrientation(orientation === 'vertical' ? 'horizontal' : 'vertical')}
          className="btn btn-ghost"
          title={orientation === 'vertical' ? 'Switch to horizontal' : 'Switch to vertical'}
          aria-label="Toggle orientation"
          style={{ padding: '4px 8px' }}
        >
          {orientation === 'vertical' ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="7" width="18" height="10" rx="1.5" />
              <path d="M12 7v10" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="7" y="3" width="10" height="18" rx="1.5" />
              <path d="M7 12h10" />
            </svg>
          )}
        </button>
      </div>
      <button onClick={onExport} className="btn btn-ghost">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
        </svg>
        Export
      </button>
      <button onClick={onSave} className="btn btn-primary">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" />
        </svg>
        Save to session
      </button>
    </header>
  );
}

// --- Tool rail --------------------------------------------------------------

function ToolRail({ tool, onTool }) {
  return (
    <div
      className="flex flex-col items-center gap-1 py-3"
      style={{ width: 72, background: 'var(--bg-elev)', borderRight: '1px solid var(--line)' }}
    >
      {TOOLS.map(t => {
        const active = tool === t.id;
        const fg = active ? 'var(--accent)' : 'var(--ink-2)';
        const render = Icon[t.id];
        return (
          <button
            key={t.id}
            onClick={() => onTool(t.id)}
            title={`${t.label} (${t.key})`}
            className="rounded-[10px] transition-colors"
            style={{
              width: 48,
              height: 48,
              border: '1px solid',
              borderColor: active ? 'var(--accent)' : 'transparent',
              background: active ? 'var(--accent-soft)' : 'transparent',
              color: fg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-sunken)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
          >
            {render('currentColor')}
          </button>
        );
      })}
    </div>
  );
}

// --- Inspector --------------------------------------------------------------

const KIND_PLURALS = {
  attacker: 'attackers',
  defender: 'defenders',
  ball: 'balls',
  cone: 'cones',
  goal: 'goals',
};
function kindPluralLabel(kind) {
  return KIND_PLURALS[kind] || `${kind}s`;
}

function Inspector({ shape, multiCount, onLabel, onColor, onNotes, onDelete, onSelectAll, onSelectAllOfKind, onDeselect }) {
  if (multiCount > 1) {
    return (
      <aside
        className="overflow-y-auto"
        style={{ width: 280, background: 'var(--bg-elev)', borderLeft: '1px solid var(--line)', padding: 22 }}
      >
        <div className="eyebrow mb-3" style={{ fontSize: 10.5 }}>SELECTION</div>
        <div className="card p-4">
          <div className="text-[13.5px] font-medium" style={{ color: 'var(--ink)' }}>
            {multiCount} shapes selected
          </div>
          <div className="text-[12px] mt-1" style={{ color: 'var(--ink-2)' }}>
            Drag a corner to resize the group, or the top handle to rotate. Press <kbd className="font-mono" style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)', padding: '0 6px', borderRadius: 4, fontSize: 11 }}>⌫</kbd> to delete.
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={onDeselect} className="btn btn-ghost flex-1">Deselect</button>
          {onDelete && (
            <button onClick={onDelete} className="btn btn-ghost flex-1" style={{ color: 'var(--danger)' }}>Delete all</button>
          )}
        </div>
        <div className="hairline my-5" />
        <div className="eyebrow mb-2" style={{ fontSize: 10.5 }}>SHORTCUTS</div>
        <ShortcutList />
      </aside>
    );
  }
  if (!shape) {
    return (
      <aside
        className="overflow-y-auto"
        style={{ width: 280, background: 'var(--bg-elev)', borderLeft: '1px solid var(--line)', padding: 22 }}
      >
        <div className="eyebrow mb-3" style={{ fontSize: 10.5 }}>SELECTION</div>
        <div className="card p-4 text-[13px]" style={{ color: 'var(--ink-2)' }}>
          Nothing selected. Pick a tool and click the field, or click an existing shape.
        </div>
        {onSelectAll && (
          <button onClick={onSelectAll} className="btn btn-secondary w-full mt-3" style={{ fontSize: 12.5 }}>
            Select all
            <kbd className="font-mono ml-2" style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)', padding: '0 6px', borderRadius: 4, fontSize: 10.5 }}>⌘A</kbd>
          </button>
        )}

        <div className="hairline my-5" />

        <div className="eyebrow mb-2" style={{ fontSize: 10.5 }}>SHORTCUTS</div>
        <ShortcutList />
      </aside>
    );
  }

  return (
    <aside
      className="overflow-y-auto"
      style={{ width: 280, background: 'var(--bg-elev)', borderLeft: '1px solid var(--line)', padding: 22 }}
    >
      <div className="eyebrow mb-3" style={{ fontSize: 10.5 }}>
        {shape.pending ? 'NEXT STAMP' : 'SELECTION'}
      </div>
      <div className="card p-3.5 mb-4 flex items-center gap-2.5">
        <ShapePreview shape={shape} />
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium capitalize" style={{ color: 'var(--ink)' }}>{shape.kind}</div>
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {shape.pending
              ? 'Click the field to place'
              : isLineKind(shape.kind)
                ? `${Math.round(shape.x1)},${Math.round(shape.y1)} → ${Math.round(shape.x2)},${Math.round(shape.y2)}`
                : `x:${Math.round(shape.x)} y:${Math.round(shape.y)}`}
          </div>
        </div>
      </div>

      {!isLineKind(shape.kind) && shape.kind !== 'cone' && shape.kind !== 'ball' && (
        <>
          <label className="label-text">Label</label>
          <input
            value={shape.label || ''}
            onChange={(e) => onLabel(e.target.value)}
            placeholder="A1"
            className="input-field mb-4"
          />
        </>
      )}

      {shape.kind !== 'ball' && (
        <>
          <div className="mb-1.5 text-[12.5px] font-medium" style={{ color: 'var(--ink-2)' }}>Color</div>
          <div className="flex gap-2 mb-4">
            {(shape.kind === 'cone' ? CONE_SWATCHES : COLORS).map(c => {
              const active = shape.color === c;
              return (
                <button
                  key={c}
                  onClick={() => onColor(c)}
                  aria-pressed={active}
                  className="rounded-[7px]"
                  style={{
                    width: 26,
                    height: 26,
                    background: c,
                    border: active ? '2px solid var(--ink)' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                  title={c}
                />
              );
            })}
          </div>
        </>
      )}

      {onSelectAllOfKind && !shape.pending && !isLineKind(shape.kind) && (
        <button
          onClick={onSelectAllOfKind}
          className="btn btn-ghost w-full justify-center mb-4"
          style={{ fontSize: 12.5 }}
        >
          Select all {kindPluralLabel(shape.kind)}
        </button>
      )}

      <div className="hairline my-4" />

      <div className="eyebrow mb-2" style={{ fontSize: 10.5 }}>NOTES</div>
      <textarea
        value={shape.notes || ''}
        onChange={(e) => onNotes(e.target.value)}
        rows={4}
        placeholder="What's happening in this picture?"
        className="input-field resize-none"
      />

      {onDelete && (
        <>
          <div className="hairline my-4" />
          <button
            onClick={onDelete}
            className="btn btn-ghost w-full justify-center"
            style={{ color: 'var(--danger)' }}
          >
            Delete shape
          </button>
        </>
      )}

      <div className="hairline my-4" />

      <div className="eyebrow mb-2" style={{ fontSize: 10.5 }}>SHORTCUTS</div>
      <ShortcutList />
    </aside>
  );
}

function ShortcutList() {
  const rows = [
    ['A', 'Attacker'],
    ['D', 'Defender'],
    ['B', 'Ball'],
    ['C', 'Cone'],
    ['V', 'Select'],
    ['⌫', 'Delete'],
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(([k, label]) => (
        <div key={k} className="flex items-center justify-between text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
          <span>{label}</span>
          <kbd
            className="font-mono"
            style={{
              background: 'var(--bg-sunken)',
              border: '1px solid var(--line)',
              padding: '1px 7px',
              borderRadius: 5,
              fontSize: 11,
              color: 'var(--ink-2)',
            }}
          >{k}</kbd>
        </div>
      ))}
    </div>
  );
}

function ShapePreview({ shape }) {
  if (isLineKind(shape.kind)) {
    return (
      <div
        className="flex-shrink-0 rounded-[10px] flex items-center justify-center"
        style={{ width: 36, height: 36, background: 'var(--bg-sunken)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" stroke={shape.color || 'var(--ink)'} strokeWidth="1.8" fill="none" strokeLinecap="round">
          {shape.kind === 'pass' && <path d="M3 12h16M16 8l4 4-4 4" />}
          {shape.kind === 'run' && <path d="M3 12h16M16 8l4 4-4 4" strokeDasharray="3 3" />}
          {shape.kind === 'dribble' && <path d="M3 12c3 -3 5 3 8 0s5 3 8 0M16 8l4 4-4 4" />}
        </svg>
      </div>
    );
  }
  const bg = shape.color || (shape.kind === 'attacker' ? '#c8553d' : 'var(--bg-elev)');
  const fg = shape.kind === 'attacker' ? '#ffffff' : 'var(--ink)';
  if (shape.kind === 'attacker') {
    return (
      <div
        className="flex-shrink-0 rounded-[10px] flex items-center justify-center font-semibold"
        style={{ width: 36, height: 36, background: bg, color: fg, fontSize: 14 }}
      >
        {shape.label || 'A'}
      </div>
    );
  }
  if (shape.kind === 'defender') {
    const fill = shape.color || DEFENDER_COLOR;
    return (
      <div
        className="flex-shrink-0 rounded-[10px] flex items-center justify-center"
        style={{ width: 36, height: 36, background: 'var(--bg-sunken)' }}
      >
        <svg width="32" height="32" viewBox="-14 -14 28 28">
          <path
            d="M 0 -12 L 10.39 6 L -10.39 6 Z"
            fill={fill}
            stroke="#1a1814"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <text x="0" y="2" fontSize="7" fontWeight="600" fill="#ffffff" textAnchor="middle">
            {shape.label || 'D'}
          </text>
        </svg>
      </div>
    );
  }
  if (shape.kind === 'cone') {
    return (
      <div
        className="flex-shrink-0 rounded-[10px] flex items-center justify-center"
        style={{ width: 36, height: 36, background: 'var(--bg-sunken)' }}
      >
        <img src={coneSrcFor(shape.color || CONE_COLOR)} width="28" height="28" alt="" style={{ display: 'block' }} />
      </div>
    );
  }
  return (
    <div
      className="flex-shrink-0 rounded-[10px] flex items-center justify-center"
      style={{ width: 36, height: 36, background: 'var(--bg-sunken)' }}
    >
      {shape.kind === 'ball' && <img src={ballSvg} width="22" height="22" alt="" style={{ display: 'block' }} />}
      {shape.kind === 'goal' && <svg width="22" height="14" viewBox="0 0 24 14"><rect x="1" y="1" width="22" height="12" rx="1" stroke="#1a1814" strokeWidth="1.5" fill="rgba(255,255,255,0.8)" /></svg>}
    </div>
  );
}

// --- Main playground --------------------------------------------------------

const STARTER_SHAPES = [
  { id: 'starter-a1', kind: 'attacker', x: 280, y: 200, label: 'A1', color: '#c8553d' },
  { id: 'starter-a2', kind: 'attacker', x: 640, y: 420, label: 'A2', color: '#c8553d' },
  { id: 'starter-d1', kind: 'defender', x: 500, y: 312, label: 'D1' },
  { id: 'starter-ball', kind: 'ball', x: 310, y: 215 },
  { id: 'starter-cone-1', kind: 'cone', x: 180, y: 475 },
  { id: 'starter-cone-2', kind: 'cone', x: 820, y: 175 },
  { id: 'starter-pass', kind: 'pass', x1: 310, y1: 215, x2: 478, y2: 312, color: '#1a1814' },
  { id: 'starter-run',  kind: 'run',  x1: 640, y1: 420, x2: 520, y2: 320, color: '#1a1814' },
];

// Default props for a freshly-picked tool. The pending shape uses these
// until the user edits something in the inspector.
function defaultPendingFor(tool, shapes) {
  if (!isMarkerKind(tool)) return null;
  return {
    pending: true,
    kind: tool,
    x: 0,
    y: 0,
    label: nextLabel(tool, shapes),
    color: tool === 'attacker' ? '#c8553d'
         : tool === 'defender' ? DEFENDER_COLOR
         : tool === 'cone' ? CONE_COLOR
         : null,
    notes: '',
  };
}

export default function DiagramPlayground() {
  const [title, setTitle] = useState('1v1 in the channel');
  const [pitchSize, setPitchSize] = useState(DEFAULT_PITCH_SIZE);
  const [pitchView, setPitchView] = useState(DEFAULT_PITCH_VIEW);
  const [orientation, setOrientation] = useState('horizontal');
  const fieldRotationGroupRef = useRef(null);
  const [tool, setTool] = useState('select');
  const [shapes, setShapes] = useState(STARTER_SHAPES);
  // selectedIds is a Set so multi-select + select-all are first-class.
  // A single-shape inspector view is derived when size === 1.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [drawingLine, setDrawingLine] = useState(null);
  const [pendingShape, setPendingShape] = useState(null);
  const [cursorLogical, setCursorLogical] = useState(null);
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  const sizeCfg = findSize(pitchSize);
  const viewCfg = findView(pitchView);
  // Full-pitch aspect divided by the view's divisor: full=1, half=2, third=3.
  // Half/third views are taller-than-wide on a horizontal canvas, which feels
  // right for end-zone or channel views.
  const fieldAspect = sizeCfg.aspect / viewCfg.divisor;
  const isVertical = orientation === 'vertical';
  const displayAspect = isVertical ? 1 / fieldAspect : fieldAspect;
  const selected = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const onlyId = selectedIds.values().next().value;
    return shapes.find(s => s.id === onlyId) || null;
  }, [selectedIds, shapes]);

  // Selection helpers
  const selectOnly  = useCallback((id) => setSelectedIds(new Set([id])), []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const selectAll = useCallback(() => setSelectedIds(new Set(shapes.map(s => s.id))), [shapes]);
  const selectAllOfKind = useCallback((kind) => {
    setSelectedIds(new Set(shapes.filter(s => s.kind === kind).map(s => s.id)));
  }, [shapes]);

  // Resize observer — keep the stage matching the displayed field surface
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const h = w / displayAspect;
      setStageSize({ width: w, height: h });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [displayAspect]);

  // The field is always drawn in HORIZONTAL orientation internally. In
  // vertical mode we wrap the rendering in a 90° rotation, so the "long"
  // pixel dimension is stageSize.height. Canvas-scale (pixels per logical
  // unit) reads from whichever axis is currently the long one.
  const longPx = isVertical ? stageSize.height : stageSize.width;
  const scale = longPx > 0 ? longPx / VB_W : 1;
  // Field viewBox in pixel space — long axis = VB_W * scale, short axis is
  // (long axis / fieldAspect) so the rendered field exactly fills the
  // container regardless of which view / orientation is active.
  const fieldW = VB_W * scale;
  const fieldH = (VB_W / fieldAspect) * scale;

  // --- Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      // Don't intercept when an input/textarea is focused.
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') {
        setTool('select');
        setDrawingLine(null);
        clearSelection();
        setPendingShape(null);
        return;
      }
      // Cmd/Ctrl+A → select every shape.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setTool('select');
        setPendingShape(null);
        selectAll();
        return;
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedIds.size > 0) {
        e.preventDefault();
        const ids = Array.from(selectedIds);
        ids.forEach(id => deleteShape(id));
        return;
      }
      const match = TOOLS.find(t2 => t2.key.toLowerCase() === e.key.toLowerCase());
      if (match) {
        setTool(match.id);
        if (match.id !== 'select') {
          clearSelection();
          setPendingShape(defaultPendingFor(match.id, shapes));
        } else {
          setPendingShape(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  // --- Shape mutators
  const updateShape = useCallback((id, patch) => {
    setShapes(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const deleteShape = useCallback((id) => {
    setShapes(prev => prev.filter(s => s.id !== id));
    setSelectedIds(curr => {
      if (!curr.has(id)) return curr;
      const next = new Set(curr);
      next.delete(id);
      return next;
    });
  }, []);

  // Attach the Transformer to whichever shape nodes are selected. Marker
  // groups carry id={shape.id}, so findOne('#id') resolves them. Lines are
  // intentionally skipped — they need their own endpoint-handle treatment.
  useEffect(() => {
    const stage = stageRef.current;
    const tf = transformerRef.current;
    if (!stage || !tf) return;
    const nodes = Array.from(selectedIds)
      .map(id => stage.findOne(`#${id}`))
      .filter(Boolean)
      // Only marker shape Groups participate in transform; their Konva name
      // attribute is "selectable". Lines fall through to no-op selection.
      .filter(node => node.name() === 'selectable');
    tf.nodes(nodes);
    tf.getLayer()?.batchDraw();
  }, [selectedIds, shapes]);

  // Per-node handlers (matches production DiagramBuilder). Drag writes x/y;
  // transformEnd writes x/y/rotation. Visual scale stays on the Konva node
  // — multi-select transforms thus apply the same rotation delta to every
  // selected shape (per Konva default) without needing a custom group-vs-
  // individual transform pipeline.
  const handleNodeDragEnd = useCallback((node, canvasScale) => {
    if (!node) return;
    const id = node.id();
    if (!id) return;
    const nx = node.x() / canvasScale;
    const ny = node.y() / canvasScale;
    setShapes(prev => prev.map(s => s.id === id ? { ...s, x: nx, y: ny } : s));
  }, []);

  const handleNodeTransformEnd = useCallback((node, canvasScale) => {
    if (!node) return;
    const id = node.id();
    if (!id) return;
    const nx = node.x() / canvasScale;
    const ny = node.y() / canvasScale;
    const rot = node.rotation();
    setShapes(prev => prev.map(s => s.id === id ? { ...s, x: nx, y: ny, rotation: rot } : s));
  }, []);

  // --- Stage handlers
  // Always read pointer position relative to the rotation Group so the
  // unrotated logical coords stay consistent across horizontal/vertical.
  // Falls back to raw stage coords if the Group ref isn't ready yet.
  const readPointerLogical = () => {
    const group = fieldRotationGroupRef.current;
    const stage = stageRef.current;
    if (!stage) return null;
    if (group?.getRelativePointerPosition) {
      const p = group.getRelativePointerPosition();
      if (p) return { x: p.x / scale, y: p.y / scale };
    }
    const p = stage.getPointerPosition();
    if (!p) return null;
    return { x: p.x / scale, y: p.y / scale };
  };
  const stageToLogical = () => readPointerLogical();

  const handleStageMouseDown = (e) => {
    // If the click hit a shape, that shape's onMouseDown selects it before
    // bubbling here. To dedicate the click to the canvas, only act when the
    // target is the Stage itself.
    if (e.target !== e.target.getStage()) return;

    const logical = stageToLogical();
    if (!logical) return;

    if (tool === 'select') {
      clearSelection();
      return;
    }

    if (isMarkerKind(tool)) {
      const id = uid(tool);
      const fallback = defaultPendingFor(tool, shapes);
      const draft = pendingShape && pendingShape.kind === tool ? pendingShape : fallback;
      const { pending: _pending, ...rest } = draft || {};
      void _pending;
      const placed = { ...rest, id, kind: tool, x: logical.x, y: logical.y, rotation: 0 };
      setShapes(prev => [...prev, placed]);
      selectOnly(id);
      // Carry the coach's choices forward so the next stamp is the same
      // configured marker. Label advances (D1 -> D2 -> D3), color sticks,
      // notes reset since they belong to the specific shape just placed.
      const nextDefault = defaultPendingFor(tool, [...shapes, placed]);
      setPendingShape({
        ...nextDefault,
        color: draft.color ?? nextDefault.color,
        notes: '',
      });
      return;
    }

    if (isLineKind(tool)) {
      setDrawingLine({ kind: tool, x1: logical.x, y1: logical.y });
    }
  };

  const handleStageMouseMove = () => {
    const logical = stageToLogical();
    if (!logical) return;
    if (isMarkerKind(tool)) setCursorLogical(logical);
    if (!drawingLine) return;
    setDrawingLine(prev => prev ? { ...prev, x2: logical.x, y2: logical.y } : null);
  };

  const handleStageMouseLeave = () => {
    setCursorLogical(null);
  };

  const handleStageMouseUp = () => {
    if (!drawingLine) return;
    const logical = stageToLogical() || { x: drawingLine.x1, y: drawingLine.y1 };
    const dx = logical.x - drawingLine.x1;
    const dy = logical.y - drawingLine.y1;
    if (Math.hypot(dx, dy) > 12) {
      const id = uid(drawingLine.kind);
      // Seed a 3-point line so the user sees an immediate curve to grab.
      // pointsOf() can derive the auto-bend midpoint from kind defaults.
      const points = pointsOf({
        kind: drawingLine.kind,
        x1: drawingLine.x1,
        y1: drawingLine.y1,
        x2: logical.x,
        y2: logical.y,
      });
      setShapes(prev => [...prev, { id, kind: drawingLine.kind, points }]);
      selectOnly(id);
      // Drop straight back into select-mode so the new line's handles are
      // immediately usable.
      setTool('select');
      setPendingShape(null);
    }
    setDrawingLine(null);
  };

  // --- Render shapes
  const renderedShapes = useMemo(() => shapes.map(s => {
    const isSelected = selectedIds.has(s.id);
    const onClick = (e) => {
      // Block stage's empty-canvas handler from firing.
      if (e.cancelBubble !== undefined) e.cancelBubble = true;
      // Clicking a shape while a placement tool is active drops you into
      // select-mode for that shape (per user request — feels natural after a
      // few placements you want to nudge what you just dropped).
      if (tool !== 'select') {
        setTool('select');
        setPendingShape(null);
      }
      selectOnly(s.id);
    };
    if (isMarkerKind(s.kind)) {
      const handleDragEnd = (e) => handleNodeDragEnd(e.target, scale);
      const handleTxEnd = (e) => handleNodeTransformEnd(e.target, scale);
      const scaled = { ...s, x: s.x * scale, y: s.y * scale };
      return (
        <MarkerShape
          key={s.id}
          id={s.id}
          shape={scaled}
          draggable={tool === 'select'}
          onClick={onClick}
          onDragMove={undefined}
          onDragEnd={handleDragEnd}
          onTransformEnd={handleTxEnd}
        />
      );
    }
    if (isLineKind(s.kind)) {
      const logicalPts = pointsOf(s);
      const scaledPts = logicalPts.map(p => ({ x: p.x * scale, y: p.y * scale }));
      const handleDblClick = (e) => {
        // e.target is the line shape Group; read the click in the rotation
        // group's local (unrotated) coord system so orientation doesn't skew
        // where the new midpoint lands.
        if (e.cancelBubble !== undefined) e.cancelBubble = true;
        const lp = readPointerLogical();
        if (!lp) return;
        let bestIdx = 1;
        let bestDist = Infinity;
        for (let i = 0; i < logicalPts.length - 1; i++) {
          const d = distToSegment(lp, logicalPts[i], logicalPts[i + 1]);
          if (d < bestDist) { bestDist = d; bestIdx = i + 1; }
        }
        const next = [...logicalPts.slice(0, bestIdx), lp, ...logicalPts.slice(bestIdx)];
        // Drop legacy x1/x2/y1/y2/bend so points is the source of truth.
        updateShape(s.id, { points: next, x1: undefined, y1: undefined, x2: undefined, y2: undefined, bend: undefined });
        selectOnly(s.id);
      };
      return (
        <Group key={s.id}>
          <LineShape
            shape={s}
            scaledPoints={scaledPts}
            onClick={onClick}
            onDblClick={handleDblClick}
          />
          {isSelected && (
            <LineHandles
              points={scaledPts}
              canvasScale={scale}
              onMovePoint={(idx, x, y) => {
                const next = logicalPts.map((p, i) => i === idx ? { x, y } : p);
                updateShape(s.id, { points: next, x1: undefined, y1: undefined, x2: undefined, y2: undefined, bend: undefined });
              }}
              onRemovePoint={(idx) => {
                if (logicalPts.length <= 2) return; // keep two endpoints
                const next = logicalPts.filter((_, i) => i !== idx);
                updateShape(s.id, { points: next });
              }}
            />
          )}
        </Group>
      );
    }
    return null;
  }), [shapes, selectedIds, scale, tool, handleNodeDragEnd, handleNodeTransformEnd, selectOnly, updateShape]);

  const previewLine = drawingLine && drawingLine.x2 != null ? (() => {
    // The preview line uses the same auto-bend seed as a placed line so
    // the user sees the eventual curve while dragging.
    const pts = pointsOf({
      kind: drawingLine.kind,
      x1: drawingLine.x1,
      y1: drawingLine.y1,
      x2: drawingLine.x2,
      y2: drawingLine.y2,
    });
    const scaledPts = pts.map(p => ({ x: p.x * scale, y: p.y * scale }));
    return (
      <LineShape
        shape={{ kind: drawingLine.kind }}
        scaledPoints={scaledPts}
        onClick={() => {}}
        onDblClick={() => {}}
      />
    );
  })() : null;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg-sunken)', color: 'var(--ink)' }}>
      <TopBar
        title={title}
        onTitleChange={setTitle}
        pitchSize={pitchSize}
        onPitchSize={setPitchSize}
        pitchView={pitchView}
        onPitchView={setPitchView}
        orientation={orientation}
        onOrientation={setOrientation}
        onBack={() => { window.location.href = '/'; }}
        onSave={() => alert(`(playground) save "${title}" — ${shapes.length} shapes`)}
        onExport={() => alert('(playground) export — not wired in the playground')}
      />

      <div className="flex flex-1 min-h-0">
        <ToolRail
          tool={tool}
          onTool={(next) => {
            setTool(next);
            if (next !== 'select') {
              clearSelection();
              setPendingShape(defaultPendingFor(next, shapes));
            } else {
              setPendingShape(null);
            }
          }}
        />

        <div className="flex-1 flex items-center justify-center overflow-auto p-8">
          <div
            ref={containerRef}
            style={{
              width: '100%',
              maxWidth: isVertical ? PITCH_MAX_WIDTH / fieldAspect : PITCH_MAX_WIDTH,
              aspectRatio: displayAspect,
              background: 'color-mix(in oklab, var(--good, #4a7c59) 28%, var(--bg-elev))',
              borderRadius: 14,
              border: '1px solid var(--line-2)',
              boxShadow: 'var(--shadow-md)',
              position: 'relative',
              overflow: 'hidden',
              cursor: tool === 'select' ? 'default' : isLineKind(tool) ? 'crosshair' : 'copy',
            }}
          >
            {stageSize.width > 0 && (
              <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
                onMouseLeave={handleStageMouseLeave}
                onTouchStart={handleStageMouseDown}
                onTouchMove={handleStageMouseMove}
                onTouchEnd={handleStageMouseUp}
              >
                <Layer>
                  {/* Field + shapes all live inside a single rotation Group so
                      orientation = 'vertical' just rotates the visual without
                      touching shape data. We use getRelativePointerPosition on
                      this Group in the click handlers so logical coords stay
                      consistent regardless of orientation. */}
                  <Group
                    ref={fieldRotationGroupRef}
                    rotation={isVertical ? 90 : 0}
                    x={isVertical ? stageSize.width : 0}
                    y={0}
                  >
                    <FieldBackground w={fieldW} h={fieldH} size={pitchSize} view={pitchView} />
                    {renderedShapes}
                    {previewLine}
                    {pendingShape && cursorLogical && isMarkerKind(tool) && (
                      <Group listening={false} opacity={0.6}>
                        <MarkerShape
                          shape={{ ...pendingShape, x: cursorLogical.x * scale, y: cursorLogical.y * scale }}
                          draggable={false}
                          onClick={() => {}}
                          onDragMove={() => {}}
                        />
                      </Group>
                    )}
                    <Transformer
                      ref={transformerRef}
                      rotateEnabled
                      keepRatio
                      flipEnabled={false}
                      anchorStroke="#c8553d"
                      anchorFill="#ffffff"
                      anchorCornerRadius={4}
                      borderStroke="#c8553d"
                      borderDash={[4, 4]}
                      boundBoxFunc={(_, newBox) => {
                        if (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8) return _;
                        return newBox;
                      }}
                    />
                  </Group>
                </Layer>
              </Stage>
            )}
          </div>
        </div>

        <Inspector
          shape={selected || pendingShape}
          multiCount={selectedIds.size}
          onLabel={(v) => {
            if (selected) updateShape(selected.id, { label: v });
            else if (pendingShape) setPendingShape(p => ({ ...p, label: v }));
          }}
          onColor={(v) => {
            if (selected) updateShape(selected.id, { color: v });
            if (pendingShape && isMarkerKind(pendingShape.kind)) {
              setPendingShape(p => ({ ...p, color: v }));
            }
          }}
          onNotes={(v) => {
            if (selected) updateShape(selected.id, { notes: v });
            else if (pendingShape) setPendingShape(p => ({ ...p, notes: v }));
          }}
          onDelete={
            selectedIds.size === 1 && selected
              ? () => deleteShape(selected.id)
              : selectedIds.size > 1
                ? () => Array.from(selectedIds).forEach(id => deleteShape(id))
                : undefined
          }
          onSelectAll={shapes.length > 0 ? selectAll : undefined}
          onSelectAllOfKind={
            selected && !isLineKind(selected.kind)
              ? () => selectAllOfKind(selected.kind)
              : undefined
          }
          onDeselect={clearSelection}
        />
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group, Rect, Circle, Line, Arrow, Text, Path, Shape, Image as KImage, Transformer } from 'react-konva';
import useKonvaImage from '../hooks/useKonvaImage';
import { setLeaveGuard } from '../hooks/useTeams';
import useIsMobile from '../hooks/useIsMobile';
import { migrateLegacyToShapes } from '../utils/diagramMigration';
import ballSvg from '../assets/ball.svg';
import coneOrangeSvg from '../assets/cone_orange.svg';
import coneBlueSvg from '../assets/cone_blue.svg';
import coneYellowSvg from '../assets/cone_yellow.svg';
import goalRegulationSvg from '../assets/goals/goal-regulation.svg';
import goalTrainingSvg from '../assets/goals/goal-training.svg';
import goalPugg6Svg from '../assets/goals/goal-pugg-6ft.svg';
import goalPugg4Svg from '../assets/goals/goal-pugg-4ft.svg';
import field4v4Svg from '../assets/fields/soccer-field-4v4.svg?raw';
import field7v7Svg from '../assets/fields/soccer-field-7v7.svg?raw';
import field9v9Svg from '../assets/fields/soccer-field-9v9.svg?raw';
import field11v11Svg from '../assets/fields/soccer-field-11v11.svg?raw';

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

// Goal variants are overhead SVG assets drawn mouth-down (net extends toward
// -y at rotation 0). `vb` is each SVG's viewBox; `crop` trims the transparent
// padding around the frame (+ drop shadow) so the Transformer box hugs the
// goal. `width` is the rendered width in logical px — not true to scale (a
// 4ft Pugg would be ~10px on an 11v11 pitch), just clearly distinguishable.
// Shapes saved before variants existed have no `variant` and render as the
// default (regulation).
const GOAL_VARIANTS = [
  { id: 'regulation', label: 'Regulation', src: goalRegulationSvg, vb: { w: 1200, h: 500 }, crop: { x: 56, y: 96,  width: 1088, height: 298 }, width: 104 },
  { id: 'training',   label: 'Training',   src: goalTrainingSvg,   vb: { w: 700,  h: 460 }, crop: { x: 60, y: 111, width: 580,  height: 275 }, width: 69 },
  { id: 'pugg-6ft',   label: 'Pugg 6 ft',  src: goalPugg6Svg,      vb: { w: 1000, h: 480 }, crop: { x: 68, y: 144, width: 864,  height: 252 }, width: 62 },
  { id: 'pugg-4ft',   label: 'Pugg 4 ft',  src: goalPugg4Svg,      vb: { w: 700,  h: 460 }, crop: { x: 68, y: 146, width: 564,  height: 238 }, width: 47 },
];
const DEFAULT_GOAL_VARIANT = 'regulation';
function goalVariantFor(id) {
  return GOAL_VARIANTS.find(v => v.id === id) || GOAL_VARIANTS[0];
}
// New goals face into the pitch: net toward whichever end line is nearer.
// Half/third views only show the right-hand goal line.
function goalRotationFor(x, view) {
  if (view && view !== 'full') return 90;
  return x < VB_W / 2 ? 270 : 90;
}

// Inline-SVG thumbnail of a goal variant, cropped the same way the canvas is.
function GoalThumb({ variant, width = 40 }) {
  const v = goalVariantFor(variant);
  const { x, y, width: cw, height: ch } = v.crop;
  return (
    <svg width={width} height={width * ch / cw} viewBox={`${x} ${y} ${cw} ${ch}`} style={{ display: 'block' }}>
      <image href={v.src} x={0} y={0} width={v.vb.w} height={v.vb.h} />
    </svg>
  );
}
// Field SVGs carry only the markings; the grass is drawn on the canvas: a
// fixed dark green (not themed) with mowing stripes running across the whole
// canvas, buffer included, so off-field markers sit on the same surface.
// Stripes are laid out in pitch yards from the left goal line, so a Half or
// Third crop shows the same stripes as the Full view.
const PITCH_FIELD_COLOR = '#475E47';
const PITCH_SURROUND_COLOR = PITCH_FIELD_COLOR;
const PITCH_STRIPE_FILL = 'rgba(255,255,255,0.05)';
const PITCH_STRIPES = 12; // across the full pitch length
const PITCH_TILE_BG = PITCH_FIELD_COLOR;

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

// Pitch SIZE is the game format. Each has a to-scale field SVG in
// assets/fields (dimensions per snapsoccer.com's pitch-size guide; 4v4 is
// ours in the same style). `length`/`width` are the pitch in yards (the
// midpoint of each format's allowed range); `svg` describes where that pitch
// sits inside the SVG — its top-left corner and pixels per yard — so the
// canvas can scale and crop it precisely.
const PITCH_SIZES = [
  { value: '4v4',   label: '4v4',   length: 30,  width: 20, svg: { src: field4v4Svg,   vbW: 680,  vbH: 480, x: 40, y: 40, ppy: 20 } },
  { value: '7v7',   label: '7v7',   length: 60,  width: 40, svg: { src: field7v7Svg,   vbW: 680,  vbH: 480, x: 40, y: 40, ppy: 10 } },
  { value: '9v9',   label: '9v9',   length: 75,  width: 50, svg: { src: field9v9Svg,   vbW: 830,  vbH: 580, x: 40, y: 40, ppy: 10 } },
  { value: '11v11', label: '11v11', length: 115, width: 70, svg: { src: field11v11Svg, vbW: 1000, vbH: 640, x: 40, y: 40, ppy: 8  } },
];

// Pitch VIEW is a crop of the full pitch, not a separate drawing: `from` is
// where the visible window starts along the pitch length (as a fraction), and
// it always runs to the right-hand goal line. Half = halfway line → goal,
// third = attacking third → goal.
const PITCH_VIEWS = [
  { value: 'full',  label: 'Full',  from: 0 },
  { value: 'half',  label: 'Half',  from: 1 / 2 },
  { value: 'third', label: 'Third', from: 2 / 3 },
];

const DEFAULT_PITCH_SIZE = '11v11';
const DEFAULT_PITCH_VIEW = 'full';
const PITCH_MAX_WIDTH = 880;
// Team age group → game format (US Soccer small-sided standards). Age groups
// are free text on the team, so accept "U10", "U-10", "10U", "Under 10", or
// a birth year ("2016" → U-age for the season starting each August).
function pitchSizeForAge(ageGroup) {
  if (!ageGroup) return null;
  const t = String(ageGroup).toUpperCase();
  let age = null;
  const u = t.match(/\bU\s*-?\s*(\d{1,2})\b/) || t.match(/\b(\d{1,2})\s*U\b/) || t.match(/UNDER\s*-?\s*(\d{1,2})\b/);
  if (u) {
    age = Number(u[1]);
  } else {
    const year = t.match(/\b(20\d{2})\b/);
    if (year) {
      const now = new Date();
      const seasonEndYear = now.getFullYear() + (now.getMonth() >= 7 ? 1 : 0);
      age = seasonEndYear - Number(year[1]);
    }
  }
  if (!age || age < 4 || age > 23) return null;
  if (age <= 8) return '4v4';
  if (age <= 10) return '7v7';
  if (age <= 12) return '9v9';
  return '11v11';
}

const findSize = (v) => PITCH_SIZES.find(p => p.value === v) || PITCH_SIZES[3];
const findView = (v) => PITCH_VIEWS.find(p => p.value === v) || PITCH_VIEWS[0];

// Inset between the canvas edge and the touchline/goal line, in logical px
// (canvas is VB_W=1000 wide). Room for off-field markers (corner runs,
// starting cones, arrows leaving the box).
const PITCH_MARGIN = 70;

// Logical canvas aspect for a size + view. The visible pitch length fills
// VB_W minus margins; the height follows from the real width at the same
// yards-to-px scale, so markings are never stretched.
function pitchAspectFor(size, view) {
  const sz = findSize(size);
  const vw = findView(view);
  const visibleYards = sz.length * (1 - vw.from);
  const pxPerYard = (VB_W - 2 * PITCH_MARGIN) / visibleYards;
  return VB_W / (sz.width * pxPerYard + 2 * PITCH_MARGIN);
}

// Logical canvas viewBox — Konva pixels match these so shapes scale cleanly
// across field types. Width is fixed; height derives from aspect so each
// preset renders in its own viewBox without changing how shapes are stored.
const VB_W = 1000;

const COLORS = ['#c8553d', '#3d7a4a', DEFENDER_COLOR, '#c8853d', '#1a1814'];

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
      />
    </svg>
  ),
  ball:     ()  => <img src={ballSvg} width="18" height="18" alt="" style={{ display: 'block' }} />,
  cone:     ()  => <img src={coneOrangeSvg} width="22" height="22" alt="" style={{ display: 'block' }} />,
  // Overhead goal matching the canvas assets: trapezoid frame, flat mouth,
  // light net mesh, post caps.
  goal:     (c) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.4 12.5h15.2M8 17l.8-10M12 17V7M16 17l-.8-10" stroke={c} strokeWidth="1" opacity="0.45" />
      <path d="M3 17L5.5 7h13L21 17M3 17h18" stroke={c} strokeWidth="1.6" />
      <circle cx="3" cy="17" r="1.3" fill={c} />
      <circle cx="21" cy="17" r="1.3" fill={c} />
    </svg>
  ),
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

// Browsers rasterize an SVG <img> at its intrinsic size when it's drawn to
// a canvas (Safari especially), so a 680px-wide field would blur once a Half
// or Third crop zooms it 2-3x. Re-declare each SVG at ~3000px wide before
// loading it; the vector content scales cleanly.
//
// Markings are authored at stroke-width 4 in SVG units, but the SVG is drawn
// at very different zooms (an 11v11 full pitch vs a 4v4 third is ~5x), so a
// fixed SVG stroke turns into fat smears when zoomed in. Rewrite the line
// width, dash pattern and spot radius per zoom so they land at a constant
// size in canvas px.
const FIELD_RASTER_WIDTH = 3000;
const FIELD_LINE_PX = 3;
const FIELD_DASH_PX = [3, 14];
const FIELD_SPOT_PX = 4;
const fieldImageUrls = new Map();
function fieldImageUrl(svg, f) {
  const key = `${f.toFixed(3)}@${svg.src}`;
  if (!fieldImageUrls.has(key)) {
    const r = FIELD_RASTER_WIDTH / svg.vbW;
    const u = (px) => +(px / f).toFixed(3); // canvas px -> svg units
    const sized = svg.src
      .replace(/width="\d+" height="\d+"/, `width="${Math.round(svg.vbW * r)}" height="${Math.round(svg.vbH * r)}"`)
      .replace(/stroke-width="4"/g, `stroke-width="${u(FIELD_LINE_PX)}"`)
      // Touchline/goal line sit on the pitch clip edge, so only their inner
      // half shows; they're authored at 2x to read at the same weight.
      .replace(/stroke-width="8"/g, `stroke-width="${u(2 * FIELD_LINE_PX)}"`)
      .replace(/stroke-dasharray="[^"]*"/g, `stroke-dasharray="${FIELD_DASH_PX.map(u).join(' ')}"`)
      .replace(/ r="4"/g, ` r="${u(FIELD_SPOT_PX)}"`);
    fieldImageUrls.set(key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`);
  }
  return fieldImageUrls.get(key);
}

// The full pitch SVG is always placed at the same yards-to-px scale; the
// view only decides which window of it is visible (half/third are crops
// ending at the right-hand goal line), so markings stay identical across
// views.
function FieldBackground({ w, h, size, view, bg = PITCH_SURROUND_COLOR }) {
  const sz = findSize(size);
  const vw = findView(view);
  const m = PITCH_MARGIN * (w / VB_W);
  const k = (w - 2 * m) / (sz.length * (1 - vw.from)); // px per yard
  const f = k / sz.svg.ppy;                               // svg px -> canvas px
  // Line widths are keyed to logical (VB_W) px so they don't swell with the
  // stage's on-screen width either.
  const image = useKonvaImage(fieldImageUrl(sz.svg, f * (VB_W / w)));
  const pitchX = m - sz.length * vw.from * k;            // pitch left edge (may be off-canvas)
  const stripeW = (sz.length / PITCH_STRIPES) * k;
  const stripes = [];
  for (let i = Math.floor(-pitchX / stripeW); pitchX + i * stripeW < w; i++) {
    if (((i % 2) + 2) % 2 === 1) stripes.push(i);
  }

  return (
    <Group listening={false}>
      {/* Konva-drawn fill so toDataURL exports the surround too (a CSS
          background on the container isn't captured by the Konva export). */}
      <Rect x={0} y={0} width={w} height={h} fill={bg} listening={false} />
      {stripes.map(i => (
        <Rect key={i} x={pitchX + i * stripeW} y={0} width={stripeW} height={h} fill={PITCH_STRIPE_FILL} listening={false} />
      ))}
      {image && (
        <Group clipX={0} clipY={0} clipWidth={w} clipHeight={h} listening={false}>
          <KImage
            image={image}
            x={pitchX - sz.svg.x * f}
            y={m - sz.svg.y * f}
            width={sz.svg.vbW * f}
            height={sz.svg.vbH * f}
            listening={false}
          />
        </Group>
      )}
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

function GoalImage({ variant }) {
  const v = goalVariantFor(variant);
  const image = useKonvaImage(v.src);
  const w = v.width;
  const h = w * v.crop.height / v.crop.width;
  // Invisible hit/bbox rect so the goal is clickable and the Transformer
  // sizes correctly while the image is still loading.
  return (
    <>
      <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#000" opacity={0} />
      {image && (
        <KImage image={image} crop={v.crop} x={-w / 2} y={-h / 2} width={w} height={h} />
      )}
    </>
  );
}

// Markers (players, ball, cones, goals) are drawn at this fraction of their
// authored geometry, so the inspector's 1.0x is a comfortable default on
// every pitch size. `shape.scale` stays relative to it (1.0 = default).
const MARKER_BASE_SCALE = 0.7;

function MarkerShape({ shape, onClick, onDragMove, onDragEnd, onTransformEnd, draggable, id }) {
  const { kind, x, y, label, color } = shape;
  const rotation = shape.rotation ?? 0;
  const scale    = shape.scale ?? 1;

  const common = {
    id, // findOne(`#id`) anchors the Transformer to the right Group
    name: 'selectable',
    x,
    y,
    scaleX: scale * MARKER_BASE_SCALE,
    scaleY: scale * MARKER_BASE_SCALE,
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
          sceneFunc={(ctx, s) => roundedTriangleScene({ ctx, shape: s, pts: DEFENDER_PTS, corner: 2 })}
          fill={fill}
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
        <GoalImage variant={shape.variant} />
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

function TopBar({ title, onTitleChange, pitchSize, onPitchSize, pitchView, onPitchView, orientation, onOrientation, onBack, onSave, onExport, onUndo, onRedo, canUndo, canRedo, mobile }) {
  // Phone: back / title / undo / redo / Save on the first row, pitch
  // controls wrap to a second row, no PNG export.
  return (
    <header
      className={mobile ? 'flex flex-wrap items-center gap-x-1.5 gap-y-2 px-2 py-2' : 'flex items-center gap-4 px-5 py-3'}
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
        {!mobile && 'Back'}
      </button>
      {!mobile && <span style={{ color: 'var(--line-2)' }}>|</span>}
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="bg-transparent outline-none flex-1 min-w-0"
        style={{
          color: 'var(--ink)',
          fontSize: mobile ? 17 : 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          border: 'none',
          padding: 0,
        }}
        placeholder="Untitled play"
      />
      <div className={mobile ? 'order-last w-full flex items-center gap-3 px-1' : 'inline-flex items-center gap-3'}>
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
      <div className="inline-flex items-center gap-0.5">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="btn btn-ghost"
          title="Undo (⌘Z)"
          aria-label="Undo"
          style={{ padding: '4px 8px', opacity: canUndo ? 1 : 0.35, cursor: canUndo ? 'pointer' : 'not-allowed' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14l-4-4 4-4" />
            <path d="M5 10h9a5 5 0 0 1 0 10h-3" />
          </svg>
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="btn btn-ghost"
          title="Redo (⇧⌘Z)"
          aria-label="Redo"
          style={{ padding: '4px 8px', opacity: canRedo ? 1 : 0.35, cursor: canRedo ? 'pointer' : 'not-allowed' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14l4-4-4-4" />
            <path d="M19 10h-9a5 5 0 0 0 0 10h3" />
          </svg>
        </button>
      </div>
      {!mobile && <button onClick={onExport} className="btn btn-ghost">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
        </svg>
        Export
      </button>}
      <button onClick={onSave} className="btn btn-primary">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" />
        </svg>
        {mobile ? 'Save' : 'Save to session'}
      </button>
    </header>
  );
}

// --- Tool rail --------------------------------------------------------------

function ToolRail({ tool, onTool, horizontal }) {
  return (
    <div
      className={horizontal ? 'flex items-center gap-1 px-2 py-1.5 overflow-x-auto no-scrollbar' : 'flex flex-col items-center gap-1 py-3'}
      style={horizontal
        ? { background: 'var(--bg-elev)', borderBottom: '1px solid var(--line)' }
        : { width: 72, background: 'var(--bg-elev)', borderRight: '1px solid var(--line)' }}
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
              width: horizontal ? 44 : 48,
              height: horizontal ? 44 : 48,
              flexShrink: 0,
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

// Read-only render of a diagram from its vector data (shapes + pitch),
// drawn with exactly the editor's pieces. Used wherever we must not trust an
// image — the public Community shows diagrams only this way.
export function DiagramStatic({ diagram, width: maxWidth = 320, maxHeight = Infinity, stageRef }) {
  const shapes = Array.isArray(diagram?.shapes) ? diagram.shapes : [];
  const pitchSize = diagram?.pitchSize || DEFAULT_PITCH_SIZE;
  const pitchView = diagram?.pitchView || DEFAULT_PITCH_VIEW;
  const isVertical = diagram?.orientation === 'vertical';
  const fieldAspect = pitchAspectFor(pitchSize, pitchView);
  const displayAspect = isVertical ? 1 / fieldAspect : fieldAspect;
  // Fit inside maxWidth × maxHeight, keeping the pitch's proportions.
  const width = Math.min(maxWidth, maxHeight * displayAspect);
  const stageW = Math.round(width);
  const stageH = Math.round(width / displayAspect);
  const scale = (isVertical ? stageH : stageW) / VB_W;
  const fieldW = VB_W * scale;
  const fieldH = (VB_W / fieldAspect) * scale;
  const noop = () => {};
  return (
    <Stage ref={stageRef} width={stageW} height={stageH} listening={false}>
      <Layer listening={false}>
        <Group rotation={isVertical ? 90 : 0} x={isVertical ? stageW : 0}>
          <FieldBackground w={fieldW} h={fieldH} size={pitchSize} view={pitchView} />
          {shapes.map(s => {
            if (isMarkerKind(s.kind)) {
              // Markers are fixed-pixel in the editor, whose canvas is at most
              // PITCH_MAX_WIDTH wide and ~700px tall; scale them by how this
              // canvas compares, so a thumbnail keeps the editor's proportions.
              const editorW = Math.min(PITCH_MAX_WIDTH, 700 * displayAspect);
              const markerScale = (s.scale ?? 1) * (stageW / editorW);
              return <MarkerShape key={s.id} shape={{ ...s, x: s.x * scale, y: s.y * scale, scale: markerScale }} draggable={false} onClick={noop} />;
            }
            if (isLineKind(s.kind)) {
              const pts = pointsOf(s).map(p => ({ x: p.x * scale, y: p.y * scale }));
              return <LineShape key={s.id} shape={s} scaledPoints={pts} onClick={noop} onDblClick={noop} />;
            }
            return null;
          })}
        </Group>
      </Layer>
    </Stage>
  );
}

const KIND_PLURALS = {
  attacker: 'attackers',
  defender: 'defenders',
  ball: 'balls',
  cone: 'cones',
  goal: 'goals',
  pass: 'passes',
  run: 'runs',
  dribble: 'dribbles',
};
const LINE_KINDS = ['pass', 'run', 'dribble'];
function kindPluralLabel(kind) {
  return KIND_PLURALS[kind] || `${kind}s`;
}

// Shared by every inspector state (empty / single / multi) so the panel is
// exactly 280px in all of them. If the width varied, the canvas column would
// resize with it — and since the pitch height follows its width, the canvas
// would visibly jump every time the selection changed.
const INSPECTOR_STYLE = {
  width: 280,
  flexShrink: 0,
  boxSizing: 'border-box',
  scrollbarGutter: 'stable',
  background: 'var(--bg-elev)',
  borderLeft: '1px solid var(--line)',
  padding: 22,
};

function Inspector({
  shape, multiCount,
  onLabel, onColor, onVariant, onDelete,
  onSelectAll, onSelectAllOfKind, onSelectKind, kindCounts = {}, onDeselect,
  onSize, onRotation,
  applyToAllOfKind, onApplyToAllOfKindChange,
  description, onDescriptionChange,
}) {
  if (multiCount > 1) {
    return (
      <aside
        className="overflow-y-auto"
        style={INSPECTOR_STYLE}
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
        <div className="diagram-shortcuts">
          <div className="eyebrow mb-2" style={{ fontSize: 10.5 }}>SHORTCUTS</div>
          <ShortcutList />
        </div>
      </aside>
    );
  }
  if (!shape) {
    return (
      <aside
        className="overflow-y-auto"
        style={INSPECTOR_STYLE}
      >
        <div className="eyebrow mb-3" style={{ fontSize: 10.5 }}>SELECTION</div>
        <div className="card p-4 text-[13px]" style={{ color: 'var(--ink-2)' }}>
          Nothing selected. Pick a tool and click the field, or click an existing shape.
        </div>
        {onSelectAll && (
          <button onClick={onSelectAll} className="btn btn-secondary w-full mt-3" style={{ fontSize: 12.5 }}>
            Select all
            <kbd className="font-mono ml-2" style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)', padding: '0 6px', borderRadius: 4, fontSize: 10.5 }}>⇧⌘A</kbd>
          </button>
        )}
        {onSelectKind && LINE_KINDS.some(k => kindCounts[k] > 0) && (
          <LineKindButtons kindCounts={kindCounts} onSelectKind={onSelectKind} />
        )}

        {onDescriptionChange && (
          <>
            <div className="hairline my-5" />
            <div className="eyebrow mb-2" style={{ fontSize: 10.5 }}>DESCRIPTION</div>
            <textarea
              value={description || ''}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={4}
              placeholder="Describe this diagram — coaching points, key actions, etc."
              className="input-field resize-none"
            />
          </>
        )}

        <div className="hairline my-5" />

        <div className="diagram-shortcuts">

          <div className="eyebrow mb-2" style={{ fontSize: 10.5 }}>SHORTCUTS</div>

          <ShortcutList />

        </div>
      </aside>
    );
  }

  return (
    <aside
      className="overflow-y-auto"
      style={INSPECTOR_STYLE}
    >
      <div className="eyebrow mb-3" style={{ fontSize: 10.5 }}>
        {shape.pending ? 'NEXT STAMP' : 'SELECTION'}
      </div>
      <div className="card p-3.5 mb-4 flex items-center gap-2.5">
        <ShapePreview shape={shape} />
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium capitalize" style={{ color: 'var(--ink)' }}>
            {shape.kind === 'goal' ? `${goalVariantFor(shape.variant).label} goal` : shape.kind}
          </div>
          {/* Single-line, no-wrap meta line — pending hint used to wrap to two
              lines and bump every downstream element. */}
          <div
            className="font-mono"
            style={{ fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {shape.pending
              ? 'Click to place'
              : isLineKind(shape.kind)
                ? `${Math.round(shape.x1)},${Math.round(shape.y1)} → ${Math.round(shape.x2)},${Math.round(shape.y2)}`
                : `x:${Math.round(shape.x)} y:${Math.round(shape.y)}`}
          </div>
        </div>
      </div>

      {shape.kind === 'goal' && onVariant && (
        <>
          <div className="mb-1.5 text-[12.5px] font-medium" style={{ color: 'var(--ink-2)' }}>Goal type</div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {GOAL_VARIANTS.map(v => {
              const active = (shape.variant || DEFAULT_GOAL_VARIANT) === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => onVariant(v.id)}
                  aria-pressed={active}
                  title={v.label}
                  className="rounded-[10px] flex flex-col items-center gap-1.5"
                  style={{
                    padding: '10px 6px 8px',
                    background: 'var(--bg-sunken)',
                    border: active ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    className="rounded-[7px] flex items-center justify-center w-full"
                    style={{ height: 44, background: PITCH_TILE_BG }}
                  >
                    <GoalThumb variant={v.id} width={Math.round(v.width * 0.6)} />
                  </div>
                  <span className="text-[12px] font-medium" style={{ color: active ? 'var(--ink)' : 'var(--ink-2)' }}>{v.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {!isLineKind(shape.kind) && shape.kind !== 'cone' && shape.kind !== 'ball' && shape.kind !== 'goal' && (
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

      {shape.kind !== 'ball' && shape.kind !== 'goal' && (
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

      {isLineKind(shape.kind) && !shape.pending && (
        <div
          className="rounded-[10px] p-3 mb-4"
          style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}
        >
          <div className="eyebrow mb-2" style={{ fontSize: 10 }}>SHAPE</div>
          <ul className="text-[12px] m-0 pl-0 list-none flex flex-col gap-1.5" style={{ color: 'var(--ink-2)', lineHeight: 1.4 }}>
            <li className="flex gap-2">
              <span style={{ color: 'var(--ink-3)' }}>＋</span>
              <span>
                <kbd className="font-mono" style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', padding: '0 5px', borderRadius: 3, fontSize: 10.5 }}>Dbl-click</kbd>
                {' '}the line to <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>add a midpoint</strong>.
              </span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: 'var(--ink-3)' }}>×</span>
              <span>
                <kbd className="font-mono" style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', padding: '0 5px', borderRadius: 3, fontSize: 10.5 }}>Dbl-click</kbd>
                {' '}a midpoint handle to <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>remove it</strong>.
              </span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: 'var(--ink-3)' }}>↔</span>
              <span>Drag any handle to bend the line.</span>
            </li>
          </ul>
        </div>
      )}

      {!isLineKind(shape.kind) && (onSize || onRotation) && (
        <>
          {onApplyToAllOfKindChange && !shape.pending && (
            <label className="flex items-center gap-2 mb-3 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
              <input
                type="checkbox"
                checked={!!applyToAllOfKind}
                onChange={(e) => onApplyToAllOfKindChange(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Apply to all {kindPluralLabel(shape.kind)}
            </label>
          )}

          {onSize && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12.5px] font-medium" style={{ color: 'var(--ink-2)' }}>Size</span>
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {((shape.scale ?? 1)).toFixed(1)}×
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.1}
                value={shape.scale ?? 1}
                onChange={(e) => onSize(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>
          )}

          {onRotation && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12.5px] font-medium" style={{ color: 'var(--ink-2)' }}>Rotation</span>
                <span className="font-mono inline-flex items-center gap-2" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {/* Pending goals auto-face the nearer goal line until the
                      coach picks a rotation; offer a way back to that. */}
                  {shape.pending && shape.kind === 'goal' && shape.rotation != null && (
                    <button
                      onClick={() => onRotation(null)}
                      className="underline"
                      style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                    >
                      Auto
                    </button>
                  )}
                  {shape.pending && shape.kind === 'goal' && shape.rotation == null
                    ? 'Auto'
                    : `${Math.round(shape.rotation ?? 0)}°`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={15}
                value={shape.rotation ?? 0}
                onChange={(e) => onRotation(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>
          )}
        </>
      )}

      {onSelectAllOfKind && !shape.pending && (
        <button
          onClick={onSelectAllOfKind}
          className="btn btn-ghost w-full justify-center mb-4"
          style={{ fontSize: 12.5 }}
        >
          Select all {kindPluralLabel(shape.kind)}
        </button>
      )}

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

      <div className="diagram-shortcuts">

        <div className="eyebrow mb-2" style={{ fontSize: 10.5 }}>SHORTCUTS</div>

        <ShortcutList />

      </div>
    </aside>
  );
}

// Line types have no ⌘ shortcut (⌘P/⌘R/⌘X are print/reload/cut), so the
// empty-selection panel offers a select-all button per line type instead.
function LineKindButtons({ kindCounts, onSelectKind }) {
  return (
    <div className="flex gap-2 mt-2">
      {LINE_KINDS.map(k => {
        const n = kindCounts[k] || 0;
        return (
          <button
            key={k}
            onClick={() => onSelectKind(k)}
            disabled={n === 0}
            className="btn btn-ghost flex-1"
            style={{ fontSize: 11.5, padding: '6px 2px', opacity: n === 0 ? 0.45 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0 }}
            title={`Select all ${kindPluralLabel(k)}`}
          >
            {Icon[k]('currentColor')}
            <span style={{ whiteSpace: 'nowrap' }}>
              <span className="capitalize">{kindPluralLabel(k)}</span>
              <span className="font-mono ml-1" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{n}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ShortcutList() {
  const rows = [
    ['A', 'Attacker'],
    ['D', 'Defender'],
    ['B', 'Ball'],
    ['C', 'Cone'],
    ['G', 'Goal'],
    ['P', 'Pass'],
    ['R', 'Run'],
    ['X', 'Dribble'],
    ['V', 'Select'],
    ['⌘ + key', 'Select all of a stamp'],
    ['⇧⌘A', 'Select everything'],
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
  if (shape.kind === 'goal') {
    return (
      <div
        className="flex-shrink-0 rounded-[10px] flex items-center justify-center"
        style={{ width: 36, height: 36, background: PITCH_TILE_BG }}
      >
        <GoalThumb variant={shape.variant} width={30} />
      </div>
    );
  }
  return (
    <div
      className="flex-shrink-0 rounded-[10px] flex items-center justify-center"
      style={{ width: 36, height: 36, background: 'var(--bg-sunken)' }}
    >
      {shape.kind === 'ball' && <img src={ballSvg} width="22" height="22" alt="" style={{ display: 'block' }} />}
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
    ...(tool === 'goal' ? { variant: DEFAULT_GOAL_VARIANT } : {}),
    notes: '',
  };
}

// Initial diagrams from the legacy DiagramBuilder carry `elements`+`lines`
// arrays but never a `shapes` field. We can render their PNG as a read-only
// backdrop but not edit them — coach can Convert or Start over.
//
// Detection rule: any non-empty `shapes` array means "new playground" (real
// editable state). Otherwise, the presence of legacy markers, legacy lines,
// OR a saved image URL counts as legacy. The old check returned false as
// soon as `shapes` was an array, even empty — so a previous accidental save
// that wrote `shapes: []` made the diagram look "blank" instead of legacy.
function isLegacyDiagram(d) {
  if (!d) return false;
  if (Array.isArray(d.shapes) && d.shapes.length > 0) return false;
  const hasLegacyMarkers = Array.isArray(d.elements) && d.elements.length > 0;
  const hasLegacyLines = Array.isArray(d.lines) && d.lines.length > 0;
  const hasImage = !!(d.dataUrl || d.imageDataUrl);
  return hasLegacyMarkers || hasLegacyLines || hasImage;
}

// Migrator moved to ../utils/diagramMigration.js so the Library can run bulk
// conversions without depending on this component file.

export default function DiagramPlayground({
  initialDiagram = null,
  defaultName = '',
  defaultDescription = '',
  ageGroup = '',
  moment = '',
  sectionType = '',
  onSave,
  onClose,
} = {}) {
  const startsLegacy = isLegacyDiagram(initialDiagram);
  const isMobile = useIsMobile();
  const [title, setTitle] = useState(
    initialDiagram?.name || defaultName || '1v1 in the channel'
  );
  const [description, setDescription] = useState(
    initialDiagram?.description || defaultDescription || ''
  );
  // Saved diagrams keep their size; new ones open at the team's format.
  const [pitchSize, setPitchSize] = useState(
    initialDiagram?.pitchSize || pitchSizeForAge(ageGroup) || DEFAULT_PITCH_SIZE
  );
  const [pitchView, setPitchView] = useState(initialDiagram?.pitchView || DEFAULT_PITCH_VIEW);
  const [orientation, setOrientation] = useState(initialDiagram?.orientation || 'horizontal');
  const [legacyImage, setLegacyImage] = useState(startsLegacy ? (initialDiagram?.dataUrl || initialDiagram?.imageDataUrl || null) : null);
  const isLegacy = !!legacyImage;
  const fieldRotationGroupRef = useRef(null);
  const [tool, setTool] = useState('select');
  // Shapes live inside a 3-tuple { shapes, past, future } so undo/redo are
  // one O(1) swap. Every wrapped setShapes() call pushes the prior snapshot
  // into past and clears future; undo/redo just trade between the three
  // slots. Capped at HISTORY_LIMIT to keep memory bounded for big sessions.
  const [shapeHistory, setShapeHistory] = useState({
    // New diagrams start empty. STARTER_SHAPES used to load by default and
    // got accidentally saved as the user's "diagram" if they hit Save without
    // editing anything — surfacing later as a template-y look.
    shapes: Array.isArray(initialDiagram?.shapes) ? initialDiagram.shapes : [],
    past: [],
    future: [],
  });
  const shapes = shapeHistory.shapes;

  // Unsaved-changes tracking: compare what's on screen with what the editor
  // opened with. Leaving dirty (Back, any link, browser Back, closing the tab)
  // asks first; Save clears it.
  const editState = JSON.stringify({ shapes, title, description, pitchSize, pitchView, orientation });
  const [openedWith] = useState(editState);
  const savedRef = useRef(false);
  const dirty = editState !== openedWith && !savedRef.current;
  const [leaveTo, setLeaveTo] = useState(null);
  useEffect(() => {
    if (!dirty) return undefined;
    const unguard = setLeaveGuard((_target, proceed) => {
      if (savedRef.current) return false;
      setLeaveTo(() => proceed);
      return true;
    });
    const onUnload = (e) => { if (!savedRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onUnload);
    return () => { unguard(); window.removeEventListener('beforeunload', onUnload); };
  }, [dirty]);
  const setShapes = useCallback((updater) => {
    setShapeHistory(curr => {
      const next = typeof updater === 'function' ? updater(curr.shapes) : updater;
      if (next === curr.shapes) return curr;
      const HISTORY_LIMIT = 50;
      const past = curr.past.length >= HISTORY_LIMIT
        ? [...curr.past.slice(curr.past.length - HISTORY_LIMIT + 1), curr.shapes]
        : [...curr.past, curr.shapes];
      return { shapes: next, past, future: [] };
    });
  }, []);
  const undo = useCallback(() => {
    setShapeHistory(curr => {
      if (curr.past.length === 0) return curr;
      const prev = curr.past[curr.past.length - 1];
      return {
        shapes: prev,
        past: curr.past.slice(0, -1),
        future: [...curr.future, curr.shapes],
      };
    });
  }, []);
  const redo = useCallback(() => {
    setShapeHistory(curr => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[curr.future.length - 1];
      return {
        shapes: next,
        past: [...curr.past, curr.shapes],
        future: curr.future.slice(0, -1),
      };
    });
  }, []);
  const canUndo = shapeHistory.past.length > 0;
  const canRedo = shapeHistory.future.length > 0;
  // selectedIds is a Set so multi-select + select-all are first-class.
  // A single-shape inspector view is derived when size === 1.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [drawingLine, setDrawingLine] = useState(null);
  const [pendingShape, setPendingShape] = useState(null);
  // Per-kind stamp settings (color, size, rotation, goal type) chosen in the
  // inspector while a stamp tool is active. They apply to every placement and
  // are remembered for the rest of this editor session, so switching to
  // Select to nudge something and back doesn't lose them.
  const stampPrefsRef = useRef({});
  const pendingFor = useCallback((kind, shapeList) => {
    const base = defaultPendingFor(kind, shapeList);
    return base && { ...base, ...stampPrefsRef.current[kind] };
  }, []);
  const updatePending = (patch) => {
    if (!pendingShape || !isMarkerKind(pendingShape.kind)) return;
    const kind = pendingShape.kind;
    stampPrefsRef.current[kind] = { ...stampPrefsRef.current[kind], ...patch };
    setPendingShape(p => (p ? { ...p, ...patch } : p));
  };
  const [cursorLogical, setCursorLogical] = useState(null);
  // When true, slider edits in the inspector scope to every shape of the
  // selected shape's kind. Stays sticky across selections (matches prod).
  const [applyToAllOfKind, setApplyToAllOfKind] = useState(false);
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  // Resolved background color from the editor container so the Konva pitch
  // fill exactly matches what the user sees (handles theme + accent changes).
  const [pitchBg, setPitchBg] = useState(PITCH_SURROUND_COLOR);

  // Half/third views are taller-than-wide on a horizontal canvas (they're a
  // true crop of the pitch); vertical orientation turns them landscape.
  const fieldAspect = pitchAspectFor(pitchSize, pitchView);
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
  const kindCounts = useMemo(() => {
    const counts = {};
    for (const sh of shapes) counts[sh.kind] = (counts[sh.kind] || 0) + 1;
    return counts;
  }, [shapes]);
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

  // Resolve the editor's computed pitch background once on mount. The CSS
  // mix is theme-dependent (`color-mix(... var(--good), var(--bg-elev))`),
  // so reading the computed color matches whatever the coach sees. We also
  // watch the documentElement for theme attribute changes to re-resolve.
  useEffect(() => {
    if (!containerRef.current) return;
    const read = () => {
      const bg = getComputedStyle(containerRef.current).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        setPitchBg(bg);
      }
    };
    read();
    // Theme toggle rewrites inline style on <html>; observe attribute changes.
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-theme'] });
    return () => obs.disconnect();
  }, []);

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
      // Cmd/Ctrl+Shift+A → select every shape.
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setTool('select');
        setPendingShape(null);
        selectAll();
        return;
      }
      // Cmd/Ctrl + a stamp's key → select all of that kind (⌘A attackers,
      // ⌘D defenders, ⌘B balls, ⌘C cones, ⌘G goals). Overrides the browser's
      // bookmark/find-next for D/G while the editor has focus.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        const stamp = TOOLS.find(t2 => isMarkerKind(t2.id) && t2.key.toLowerCase() === e.key.toLowerCase());
        if (stamp) {
          e.preventDefault();
          setTool('select');
          setPendingShape(null);
          selectAllOfKind(stamp.id);
          return;
        }
      }
      // Cmd/Ctrl+Z → undo; add Shift or use Ctrl+Y for redo.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
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
          setPendingShape(pendingFor(match.id, shapes));
        } else {
          setPendingShape(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Re-subscribe when shapes change too, so ⌘+key / ⇧⌘A and new-stamp
    // labels read the current list (deleteShape is declared below and stable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, shapes, selectAll, selectAllOfKind, pendingFor, clearSelection, undo, redo]);

  // --- Shape mutators
  const updateShape = useCallback((id, patch) => {
    setShapes(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, [setShapes]);

  const deleteShape = useCallback((id) => {
    setShapes(prev => prev.filter(s => s.id !== id));
    setSelectedIds(curr => {
      if (!curr.has(id)) return curr;
      const next = new Set(curr);
      next.delete(id);
      return next;
    });
  }, [setShapes]);

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
  }, [setShapes]);

  const handleNodeTransformEnd = useCallback((node, canvasScale) => {
    if (!node) return;
    const id = node.id();
    if (!id) return;
    // Read accumulated transform off the node, bake into shape state, then
    // reset the node so future renders read from shape data without doubling
    // up. (Matches the DiagramBuilderNew handleTransformEnd pattern.)
    // The node's scale includes MARKER_BASE_SCALE; store it relative to that.
    const xferScale = (node.scaleX() + node.scaleY()) / 2 / MARKER_BASE_SCALE;
    const nx = node.x() / canvasScale;
    const ny = node.y() / canvasScale;
    const rot = node.rotation();
    const nextScale = Math.max(0.25, xferScale);
    setShapes(prev => prev.map(s => s.id === id ? {
      ...s,
      x: nx,
      y: ny,
      rotation: rot,
      scale: nextScale,
    } : s));
    // Leave the node at its final rendered scale. (Resetting to 1 relied on
    // React re-applying scaleX, which it skips when the prop value is
    // unchanged — e.g. after a rotate-only transform.)
    node.scaleX(nextScale * MARKER_BASE_SCALE);
    node.scaleY(nextScale * MARKER_BASE_SCALE);
  }, [setShapes]);

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
      const draft = pendingShape && pendingShape.kind === tool ? pendingShape : pendingFor(tool, shapes);
      const { pending: _pending, ...rest } = draft || {};
      void _pending;
      // Goals auto-face the nearer goal line unless the coach set a rotation.
      const rotation = draft.rotation ?? (tool === 'goal' ? goalRotationFor(logical.x, pitchView) : 0);
      const placed = { ...rest, id, kind: tool, x: logical.x, y: logical.y, rotation, scale: draft.scale ?? 1 };
      setShapes(prev => [...prev, placed]);
      // Stay in stamp mode: the inspector keeps showing the NEXT STAMP
      // settings (not the shape just placed) so edits keep applying to every
      // placement. Label advances (D1 -> D2 -> D3); the rest comes from the
      // remembered stamp settings.
      setPendingShape(pendingFor(tool, [...shapes, placed]));
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
      // New lines start straight — just two endpoints. Double-clicking the
      // line later adds a midpoint to curve it. (We used to seed an auto-bend
      // midpoint here, but coaches expect a straight line by default.)
      const points = [
        { x: drawingLine.x1, y: drawingLine.y1 },
        { x: logical.x, y: logical.y },
      ];
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

  const handleSave = () => {
    // Render the current Konva stage to PNG so library/PDF/section
    // thumbnails keep working. pixelRatio=2 for retina-quality output.
    let dataUrl = '';
    try {
      dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2 }) || '';
    } catch {
      // toDataURL throws on tainted canvases; image-less diagrams are
      // still savable without a thumbnail.
      dataUrl = '';
    }
    if (typeof onSave !== 'function') {
      alert(`(playground) save "${title}" — ${shapes.length} shapes`);
      return;
    }
    // While still in legacy mode (no Convert / Start over taken), the
    // user hasn't replaced the legacy data. Preserve the original
    // elements/lines so a stray Save doesn't wipe their diagram into
    // an empty shell.
    const stillLegacy = isLegacy && shapes.length === 0;
    savedRef.current = true;
    onSave({
      name: title || 'Diagram',
      description,
      dataUrl: dataUrl || legacyImage || '',
      shapes,
      pitchSize,
      pitchView,
      orientation,
      elements: stillLegacy ? (initialDiagram?.elements || []) : [],
      lines: stillLegacy ? (initialDiagram?.lines || []) : [],
      fieldType: pitchView === 'full' ? 'full' : 'small',
      tags: {
        ageGroup,
        moments: moment ? [moment] : [],
        type: sectionType,
      },
    });
  };

  return (
    // Locked to the viewport height (not min-height): otherwise a tall
    // inspector grows the page, and the vertically centered canvas slides down
    // whenever the selection shows more controls. The inspector scrolls
    // internally instead.
    // On a phone the page scrolls instead: tools on top, the field at full
    // width, the inspector below it.
    <div
      className={isMobile ? 'diagram-mobile flex flex-col min-h-screen' : 'flex flex-col h-screen overflow-hidden'}
      style={{ ...(isMobile ? {} : { height: '100dvh' }), background: 'var(--bg-sunken)', color: 'var(--ink)' }}
    >
      <TopBar
        mobile={isMobile}
        title={title}
        onTitleChange={setTitle}
        pitchSize={pitchSize}
        onPitchSize={setPitchSize}
        pitchView={pitchView}
        onPitchView={setPitchView}
        orientation={orientation}
        onOrientation={setOrientation}
        onBack={onClose || (() => { window.location.href = '/'; })}
        onSave={handleSave}
        onExport={() => {
          try {
            const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2 });
            if (dataUrl) {
              const a = document.createElement('a');
              a.href = dataUrl;
              a.download = `${title || 'diagram'}.png`;
              a.click();
            }
          } catch {
            alert('Export failed — try Save instead.');
          }
        }}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div className={isMobile ? 'flex flex-col' : 'flex flex-1 min-h-0'}>
        <ToolRail
          horizontal={isMobile}
          tool={tool}
          onTool={(next) => {
            setTool(next);
            if (next !== 'select') {
              clearSelection();
              setPendingShape(pendingFor(next, shapes));
            } else {
              setPendingShape(null);
            }
          }}
        />

        <div className={isMobile ? 'flex justify-center p-3' : 'flex-1 min-w-0 flex items-center justify-center overflow-auto p-8'}>
          <div
            ref={containerRef}
            style={{
              width: '100%',
              maxWidth: isMobile
                ? `min(100%, calc((100dvh - 200px) * ${displayAspect}))`
                : `min(${isVertical ? PITCH_MAX_WIDTH / fieldAspect : PITCH_MAX_WIDTH}px, calc((100vh - 190px) * ${displayAspect}))`,
              // Drags on the field draw/move shapes; don't let them scroll the page.
              touchAction: 'none',
              aspectRatio: displayAspect,
              background: PITCH_SURROUND_COLOR,
              borderRadius: 14,
              border: '1px solid var(--line-2)',
              boxShadow: 'var(--shadow-md)',
              position: 'relative',
              overflow: 'hidden',
              cursor: tool === 'select' ? 'default' : isLineKind(tool) ? 'crosshair' : 'copy',
            }}
          >
            {isLegacy && (
              // Legacy diagrams (old elements/lines format) render as a
              // read-only image overlay. Coach can "Start over" to discard
              // and create a new diagram with the new builder.
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                }}
              >
                <img
                  src={legacyImage}
                  alt={title}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    right: 12,
                    background: 'rgba(20, 20, 20, 0.85)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    fontSize: 13,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <span style={{ flex: 1 }}>
                    This diagram was made with the legacy editor. Convert to edit
                    here, or start over.
                  </span>
                  <button
                    onClick={() => {
                      const migrated = migrateLegacyToShapes(
                        initialDiagram?.elements,
                        initialDiagram?.lines,
                      );
                      if (migrated.length === 0) {
                        alert('Nothing converted — this diagram has no editable shapes. Use "Start over" instead.');
                        return;
                      }
                      const msg =
                        `Found ${migrated.length} editable shape${migrated.length === 1 ? '' : 's'}. ` +
                        'Bring them in? Labels and line curves may need touch-ups.';
                      if (!window.confirm(msg)) return;
                      setShapeHistory({ shapes: migrated, past: [], future: [] });
                      setLegacyImage(null);
                    }}
                    className="btn btn-primary"
                    style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}
                  >
                    Convert
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Discard the existing diagram and start fresh?')) {
                        setLegacyImage(null);
                        setShapeHistory({ shapes: [], past: [], future: [] });
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}
                  >
                    Start over
                  </button>
                </div>
              </div>
            )}
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
                    <FieldBackground w={fieldW} h={fieldH} size={pitchSize} view={pitchView} bg={pitchBg} />
                    {renderedShapes}
                    {previewLine}
                    {pendingShape && cursorLogical && isMarkerKind(tool) && (
                      <Group listening={false} opacity={0.6}>
                        <MarkerShape
                          shape={{
                            ...pendingShape,
                            x: cursorLogical.x * scale,
                            y: cursorLogical.y * scale,
                            rotation: pendingShape.rotation ?? (pendingShape.kind === 'goal' ? goalRotationFor(cursorLogical.x, pitchView) : 0),
                          }}
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
            else if (pendingShape) setPendingShape(p => ({ ...p, label: v })); // labels auto-advance; not remembered
          }}
          onColor={(v) => {
            if (selected) updateShape(selected.id, { color: v });
            else updatePending({ color: v });
          }}
          onVariant={(v) => {
            if (selected) updateShape(selected.id, { variant: v });
            else updatePending({ variant: v });
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
            selected ? () => selectAllOfKind(selected.kind) : undefined
          }
          onSelectKind={(k) => {
            setTool('select');
            setPendingShape(null);
            selectAllOfKind(k);
          }}
          kindCounts={kindCounts}
          onDeselect={clearSelection}
          onSize={
            selected && !isLineKind(selected.kind)
              ? (v) => {
                  if (applyToAllOfKind) {
                    setShapes(prev => prev.map(s => s.kind === selected.kind ? { ...s, scale: v } : s));
                  } else {
                    updateShape(selected.id, { scale: v });
                  }
                }
              : pendingShape && isMarkerKind(pendingShape.kind)
                ? (v) => updatePending({ scale: v })
                : undefined
          }
          onRotation={
            selected && !isLineKind(selected.kind)
              ? (v) => {
                  if (applyToAllOfKind) {
                    setShapes(prev => prev.map(s => s.kind === selected.kind ? { ...s, rotation: v } : s));
                  } else {
                    updateShape(selected.id, { rotation: v });
                  }
                }
              : pendingShape && isMarkerKind(pendingShape.kind)
                ? (v) => updatePending({ rotation: v })
                : undefined
          }
          applyToAllOfKind={applyToAllOfKind}
          onApplyToAllOfKindChange={setApplyToAllOfKind}
          description={description}
          onDescriptionChange={setDescription}
        />
      </div>
      {leaveTo && (
        <>
          <div className="modal-backdrop" onClick={() => setLeaveTo(null)} />
          <div className="modal-scroll fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="card p-6 w-full max-w-md animate-fade-in" style={{ boxShadow: 'var(--shadow-lg)' }}>
              <h2 className="text-[18px] font-semibold mb-2" style={{ letterSpacing: '-0.015em' }}>Leave without saving?</h2>
              <p className="text-[13.5px] mb-5" style={{ color: 'var(--ink-2)' }}>You'll lose the changes you made to this diagram.</p>
              <div className="flex flex-col gap-2">
                <button className="btn btn-primary" onClick={() => { setLeaveTo(null); handleSave(); }}>Save diagram</button>
                <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => { const go = leaveTo; setLeaveTo(null); go(); }}>Leave without saving</button>
                <button className="btn btn-secondary" onClick={() => setLeaveTo(null)}>Keep editing</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

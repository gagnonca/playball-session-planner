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

const FIELD_TYPES = {
  full:  { ratio: 16 / 10, maxWidth: 880 },
  half:  { ratio: 1.1,     maxWidth: 640 },
  third: { ratio: 0.7,     maxWidth: 460 },
};

// Logical canvas viewBox — Konva pixels match these so shapes scale cleanly
// across field types. Stage width/height shrink with the container; we keep
// the logical coordinate system constant so shape positions feel stable.
const VB_W = 1000;
const VB_H = 625;

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

function FieldBackground({ w, h }) {
  const m = 30; // pitch padding
  const stripeCount = 10;
  const stripeW = w / stripeCount;
  const stripeStroke = 'rgba(255,255,255,0.04)';
  const lineColor = 'rgba(255,255,255,0.65)';
  return (
    <Group listening={false}>
      {/* mowing stripes */}
      {Array.from({ length: stripeCount }).map((_, i) => (
        i % 2 === 1 ? (
          <Rect key={i} x={i * stripeW} y={0} width={stripeW} height={h} fill={stripeStroke} />
        ) : null
      ))}
      {/* boundary */}
      <Rect x={m} y={m} width={w - m * 2} height={h - m * 2} stroke={lineColor} strokeWidth={3} fillEnabled={false} />
      {/* halfway line */}
      <Line points={[w / 2, m, w / 2, h - m]} stroke={lineColor} strokeWidth={2} />
      {/* center circle + dot */}
      <Circle x={w / 2} y={h / 2} radius={74} stroke={lineColor} strokeWidth={2} fillEnabled={false} />
      <Circle x={w / 2} y={h / 2} radius={3} fill="rgba(255,255,255,0.75)" />
      {/* penalty boxes */}
      <Rect x={m} y={(h - 265) / 2} width={160} height={265} stroke={lineColor} strokeWidth={2} fillEnabled={false} />
      <Rect x={w - m - 160} y={(h - 265) / 2} width={160} height={265} stroke={lineColor} strokeWidth={2} fillEnabled={false} />
      <Rect x={m} y={(h - 125) / 2} width={60} height={125} stroke={lineColor} strokeWidth={2} fillEnabled={false} />
      <Rect x={w - m - 60} y={(h - 125) / 2} width={60} height={125} stroke={lineColor} strokeWidth={2} fillEnabled={false} />
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

function MarkerShape({ shape, onClick, onDragMove, onTransformEnd, draggable, id }) {
  const { kind, x, y, label, color } = shape;

  // scale + rotation are baked back into shape state via onTransformEnd; the
  // Konva Transformer also reads them on its next attach. Default 1 / 0.
  const scale = shape.scale ?? 1;
  const rotation = shape.rotation ?? 0;

  const common = {
    id, // findOne(`#id`) anchors the Transformer to the right Group
    name: 'selectable',
    x,
    y,
    scaleX: scale,
    scaleY: scale,
    rotation,
    draggable,
    onMouseDown: onClick,
    onTap: onClick,
    onDragMove,
    onTransformEnd,
    onDragEnd: onTransformEnd,
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
    return (
      <Group {...common}>
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

function LineShape({ shape, selected, onClick }) {
  const { kind, x1, y1, x2, y2 } = shape;
  // Soft arc for visual richness — control point perpendicular to the
  // straight line, like the design's curved arrows.
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = kind === 'dribble' ? 18 : kind === 'pass' ? -22 : 18;
  const ctlX = midX + nx * bend;
  const ctlY = midY + ny * bend;

  const sceneFunc = (ctx, shapeNode) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    if (kind === 'dribble') {
      // Wavy line: small perpendicular zig-zags from start to end
      const steps = Math.max(4, Math.round(len / 24));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const px = x1 + dx * t;
        const py = y1 + dy * t;
        const side = (i % 2 === 0 ? 1 : -1);
        const ox = nx * 8 * side;
        const oy = ny * 8 * side;
        ctx.lineTo(px + ox, py + oy);
      }
    } else {
      ctx.quadraticCurveTo(ctlX, ctlY, x2, y2);
    }
    ctx.strokeShape(shapeNode);
  };

  return (
    <Group onMouseDown={onClick} onTap={onClick}>
      <Path
        sceneFunc={sceneFunc}
        stroke="#ffffff"
        strokeWidth={3}
        dash={kind === 'run' ? [10, 8] : undefined}
        lineCap="round"
        hitStrokeWidth={20}
      />
      <Arrow
        points={[x2 - dx * 0.04, y2 - dy * 0.04, x2, y2]}
        stroke="#ffffff"
        strokeWidth={3}
        fill="#ffffff"
        pointerLength={10}
        pointerWidth={10}
      />
      {selected && (
        <>
          <Circle x={x1} y={y1} radius={5} fill="#c8553d" />
          <Circle x={x2} y={y2} radius={5} fill="#c8553d" />
        </>
      )}
    </Group>
  );
}

// --- Top bar ----------------------------------------------------------------

function TopBar({ title, onTitleChange, fieldType, onFieldType, onBack, onSave, onExport }) {
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
      <div
        role="tablist"
        aria-label="Field type"
        className="inline-flex p-1 rounded-[10px]"
        style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}
      >
        {Object.keys(FIELD_TYPES).map(key => {
          const active = fieldType === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => onFieldType(key)}
              className="px-3 py-1.5 text-[12.5px] rounded-[7px] transition-colors"
              style={{
                background: active ? 'var(--bg-elev)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--ink-2)',
                border: active ? '1px solid var(--line-2)' : '1px solid transparent',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
                fontWeight: active ? 500 : 400,
                textTransform: 'capitalize',
              }}
            >
              {key}
            </button>
          );
        })}
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

function Inspector({ shape, multiCount, onLabel, onColor, onNotes, onDelete, onSelectAll, onDeselect }) {
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

      {!isLineKind(shape.kind) && shape.kind !== 'cone' && (
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
  const [fieldType, setFieldType] = useState('full');
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

  const fieldCfg = FIELD_TYPES[fieldType];
  const selected = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const onlyId = selectedIds.values().next().value;
    return shapes.find(s => s.id === onlyId) || null;
  }, [selectedIds, shapes]);

  // Selection helpers
  const selectOnly  = useCallback((id) => setSelectedIds(new Set([id])), []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const selectAll = useCallback(() => setSelectedIds(new Set(shapes.map(s => s.id))), [shapes]);

  // Resize observer — keep the stage matching the displayed field surface
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const h = w / fieldCfg.ratio;
      setStageSize({ width: w, height: h });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [fieldCfg.ratio]);

  // Logical → screen scaling. Konva renders in pixel coordinates; we use a
  // scale factor so the same shape data fits any field type at any width.
  const scale = stageSize.width > 0 ? stageSize.width / VB_W : 1;

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

  // Apply Konva node transforms (drag end, transform end) back to shape data.
  // The shape's `scale` / `rotation` are the source of truth; we read whatever
  // the Transformer applied to the node, bake it into shape state, then reset
  // the node back to identity so the next transform stacks predictably.
  const commitNodeTransform = useCallback((node, canvasScale) => {
    if (!node) return;
    const id = node.id();
    if (!id) return;
    const xferScale = (node.scaleX() + node.scaleY()) / 2;
    const newRotation = node.rotation();
    setShapes(prev => prev.map(s => {
      if (s.id !== id) return s;
      return {
        ...s,
        // node.x() / node.y() are in pixels; divide by the canvas scale to get
        // back to the logical coordinate system shape state uses.
        x: node.x() / canvasScale,
        y: node.y() / canvasScale,
        scale: Math.max(0.25, (s.scale ?? 1) * xferScale),
        rotation: newRotation,
      };
    }));
    node.scaleX(1);
    node.scaleY(1);
  }, []);

  // --- Stage handlers
  const stageToLogical = (clientPos) => ({
    x: clientPos.x / scale,
    y: clientPos.y / scale,
  });

  const handleStageMouseDown = (e) => {
    // If the click hit a shape, that shape's onMouseDown selects it before
    // bubbling here. To dedicate the click to the canvas, only act when the
    // target is the Stage itself.
    if (e.target !== e.target.getStage()) return;

    const stage = e.target;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const logical = stageToLogical(pos);

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
      const placed = { ...rest, id, kind: tool, x: logical.x, y: logical.y, scale: 1, rotation: 0 };
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

  const handleStageMouseMove = (e) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const logical = stageToLogical(pos);
    // Track cursor so a marker preview can follow it. We only update when
    // a placement tool is active; select-mode doesn't need a ghost.
    if (isMarkerKind(tool)) setCursorLogical(logical);
    if (!drawingLine) return;
    setDrawingLine(prev => prev ? { ...prev, x2: logical.x, y2: logical.y } : null);
  };

  const handleStageMouseLeave = () => {
    setCursorLogical(null);
  };

  const handleStageMouseUp = (e) => {
    if (!drawingLine) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const logical = pos ? stageToLogical(pos) : { x: drawingLine.x1, y: drawingLine.y1 };
    const dx = logical.x - drawingLine.x1;
    const dy = logical.y - drawingLine.y1;
    if (Math.hypot(dx, dy) > 12) {
      const id = uid(drawingLine.kind);
      setShapes(prev => [...prev, { id, kind: drawingLine.kind, x1: drawingLine.x1, y1: drawingLine.y1, x2: logical.x, y2: logical.y, color: '#1a1814' }]);
      selectOnly(id);
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
      // node.x() is in pixel coords — convert back to logical on commit.
      const handleTransformEnd = (e) => commitNodeTransform(e.target, scale);
      const scaled = { ...s, x: s.x * scale, y: s.y * scale };
      return (
        <MarkerShape
          key={s.id}
          id={s.id}
          shape={scaled}
          draggable={tool === 'select'}
          onClick={onClick}
          onDragMove={undefined}
          onTransformEnd={handleTransformEnd}
        />
      );
    }
    if (isLineKind(s.kind)) {
      const scaled = { ...s, x1: s.x1 * scale, y1: s.y1 * scale, x2: s.x2 * scale, y2: s.y2 * scale };
      return (
        <LineShape
          key={s.id}
          shape={scaled}
          selected={isSelected}
          onClick={onClick}
        />
      );
    }
    return null;
  }), [shapes, selectedIds, scale, tool, commitNodeTransform, selectOnly]);

  const previewLine = drawingLine && drawingLine.x2 != null ? (
    <LineShape
      shape={{
        kind: drawingLine.kind,
        x1: drawingLine.x1 * scale,
        y1: drawingLine.y1 * scale,
        x2: drawingLine.x2 * scale,
        y2: drawingLine.y2 * scale,
      }}
      selected={false}
      onClick={() => {}}
    />
  ) : null;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg-sunken)', color: 'var(--ink)' }}>
      <TopBar
        title={title}
        onTitleChange={setTitle}
        fieldType={fieldType}
        onFieldType={setFieldType}
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
              maxWidth: fieldCfg.maxWidth,
              aspectRatio: fieldCfg.ratio,
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
                  <FieldBackground w={stageSize.width} h={stageSize.height} />
                </Layer>
                <Layer>
                  {renderedShapes}
                  {previewLine}
                  {/* Cursor ghost — translucent stamp that follows the pointer
                      when a marker tool is active. Non-listening so it never
                      intercepts clicks. */}
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
                  {/* Resize / rotate handles for selected marker shape(s).
                      Lines aren't supported by the transformer here. */}
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
                      // prevent zero/negative scaling from a frantic drag
                      if (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8) return _;
                      return newBox;
                    }}
                  />
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
          onDeselect={clearSelection}
        />
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group, Rect, Circle, Line, Arrow, Text, Path, Shape, Ellipse, Image as KImage } from 'react-konva';
import useKonvaImage from '../hooks/useKonvaImage';
import ballSvg from '../assets/ball.svg';

const DEFENDER_COLOR = '#3B82F6';
const CONE_COLOR = '#FF6B35';

// Rounded-corner equilateral triangle. Konva's RegularPolygon draws sharp
// vertices; the design wants a soft, marker-like point so this uses a Shape
// sceneFunc + arcTo through each corner.
//
// Geometry: inscribed-circle radius. Apex pointing up. For an equilateral
// triangle with center at origin and the apex up, the three vertices sit
// at angles -90°, 30°, 150° on a circle of radius `radius`.
function roundedTriangleScene({ ctx, shape, radius, corner }) {
  const r = radius;
  const apex  = { x: 0,                y: -r };
  const right = { x:  r * Math.cos(Math.PI / 6),  y: r * Math.sin(Math.PI / 6) };
  const left  = { x: -r * Math.cos(Math.PI / 6),  y: r * Math.sin(Math.PI / 6) };
  const pts = [apex, right, left];

  ctx.beginPath();
  // Start at the midpoint of the apex→right edge; arcTo through every vertex
  // and closePath links back cleanly.
  ctx.moveTo((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
  for (let i = 0; i < pts.length; i++) {
    const corner1 = pts[(i + 1) % pts.length];
    const corner2 = pts[(i + 2) % pts.length];
    ctx.arcTo(corner1.x, corner1.y, corner2.x, corner2.y, corner);
  }
  ctx.closePath();
  ctx.fillStrokeShape(shape);
}

// Darken a hex color by `amount` (0..1). Used to derive the cone ring from
// the body color so recolored cones still read as "cone with shadow".
function darken(hex, amount = 0.45) {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const f = 1 - amount;
  const to2 = v => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

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
    // Equilateral triangle SVG matching the Konva rounded-triangle scene.
    // Inscribed circle radius 10, three vertices at -90/30/150 deg.
    <svg width="22" height="22" viewBox="-12 -12 24 24">
      <path
        d="M 0 -10 L 8.66 5 L -8.66 5 Z"
        fill={DEFENDER_COLOR}
        stroke="#1a1814"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  ),
  ball:     ()  => <img src={ballSvg} width="18" height="18" alt="" style={{ display: 'block' }} />,
  cone:     ()  => (
    // Tintable triangle + ring so the rail icon matches the recolorable cone.
    <svg width="22" height="22" viewBox="-12 -12 24 24">
      <path d="M 0 -10 L 8.66 5 L -8.66 5 Z" fill={CONE_COLOR} stroke="#1a1814" strokeWidth="1" strokeLinejoin="round" />
      <ellipse cx="0" cy="-4" rx="4" ry="1.4" fill={darken(CONE_COLOR, 0.4)} stroke="#1a1814" strokeWidth="0.6" />
    </svg>
  ),
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

function MarkerShape({ shape, selected, onClick, onDragMove, draggable }) {
  const { kind, x, y, label, color } = shape;

  const common = {
    x, y,
    draggable,
    onMouseDown: onClick,
    onTap: onClick,
    onDragMove,
  };

  if (kind === 'attacker') {
    const fill = color || '#c8553d';
    return (
      <Group {...common}>
        <Circle radius={22} fill={fill} />
        <Text text={label || 'A'} x={-22} y={-7} width={44} align="center" fontSize={14} fontStyle="600" fill="#ffffff" />
        {selected && <Circle radius={32} stroke="#c8553d" strokeWidth={2} dash={[4, 4]} fillEnabled={false} listening={false} />}
      </Group>
    );
  }
  if (kind === 'defender') {
    // Blue filled equilateral triangle with rounded vertices. Label centered
    // visually at the centroid (which is r/3 below the geometric center for
    // an apex-up equilateral; we shift the text y so its baseline sits there).
    const fill = color || DEFENDER_COLOR;
    const radius = 26;
    return (
      <Group {...common}>
        <Shape
          sceneFunc={(ctx, s) => roundedTriangleScene({ ctx, shape: s, radius, corner: 8 })}
          fill={fill}
          stroke="#1a1814"
          strokeWidth={1.5}
          lineJoin="round"
        />
        {label && (
          <Text
            text={label}
            x={-radius}
            y={-7}
            width={radius * 2}
            align="center"
            fontSize={13}
            fontStyle="600"
            fill="#ffffff"
          />
        )}
        {selected && (
          <Shape
            sceneFunc={(ctx, s) => roundedTriangleScene({ ctx, shape: s, radius: radius + 10, corner: 10 })}
            stroke="#c8553d"
            strokeWidth={2}
            dash={[4, 4]}
            fillEnabled={false}
            listening={false}
          />
        )}
      </Group>
    );
  }
  if (kind === 'ball') {
    // Display size matches DiagramBuilder/SoccerBall.jsx (30x30) so the
    // playground feels at home with the production canvas.
    const size = 26;
    return (
      <Group {...common}>
        <BallImage width={size} height={size} offsetX={size / 2} offsetY={size / 2} />
        {selected && <Circle radius={size / 2 + 6} stroke="#c8553d" strokeWidth={2} dash={[4, 4]} fillEnabled={false} listening={false} />}
      </Group>
    );
  }
  if (kind === 'cone') {
    // Konva-native cone so the color picker can tint it (the SVG asset
    // is fixed-color, which clashed with the accent palette). Body =
    // rounded triangle from the same scene helper as the defender;
    // ring = darker shade of the body, automatically derived from the
    // current fill so recolored cones still read as cones.
    const body = color || CONE_COLOR;
    const ring = darken(body, 0.4);
    const radius = 16;
    return (
      <Group {...common}>
        <Shape
          sceneFunc={(ctx, s) => roundedTriangleScene({ ctx, shape: s, radius, corner: 4 })}
          fill={body}
          stroke="#1a1814"
          strokeWidth={1}
          lineJoin="round"
        />
        <Ellipse
          x={0}
          y={-radius + 6}
          radiusX={7}
          radiusY={2}
          fill={ring}
          stroke="#1a1814"
          strokeWidth={0.8}
        />
        {selected && (
          <Shape
            sceneFunc={(ctx, s) => roundedTriangleScene({ ctx, shape: s, radius: radius + 8, corner: 6 })}
            stroke="#c8553d"
            strokeWidth={2}
            dash={[4, 4]}
            fillEnabled={false}
            listening={false}
          />
        )}
      </Group>
    );
  }
  if (kind === 'goal') {
    return (
      <Group {...common}>
        <Rect x={-28} y={-10} width={56} height={20} cornerRadius={2} stroke="#1a1814" strokeWidth={2} fill="rgba(255,255,255,0.8)" />
        <Line points={[-22, -10, -22, 10, -10, 10, -10, -10, 0, -10, 0, 10, 10, 10, 10, -10, 22, -10, 22, 10]} stroke="#1a1814" strokeWidth={1} />
        {selected && <Rect x={-38} y={-20} width={76} height={40} cornerRadius={4} stroke="#c8553d" strokeWidth={2} dash={[4, 4]} fillEnabled={false} listening={false} />}
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

function Inspector({ shape, onLabel, onColor, onNotes, onDelete }) {
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

      {!isLineKind(shape.kind) && (
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
        {COLORS.map(c => {
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
        <svg width="28" height="28" viewBox="-12 -12 24 24">
          <path
            d="M 0 -10 L 8.66 5 L -8.66 5 Z"
            fill={fill}
            stroke="#1a1814"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <text x="0" y="2.5" fontSize="6.5" fontWeight="600" fill="#ffffff" textAnchor="middle">
            {shape.label || 'D'}
          </text>
        </svg>
      </div>
    );
  }
  if (shape.kind === 'cone') {
    const body = shape.color || CONE_COLOR;
    return (
      <div
        className="flex-shrink-0 rounded-[10px] flex items-center justify-center"
        style={{ width: 36, height: 36, background: 'var(--bg-sunken)' }}
      >
        <svg width="26" height="26" viewBox="-12 -12 24 24">
          <path d="M 0 -10 L 8.66 5 L -8.66 5 Z" fill={body} stroke="#1a1814" strokeWidth="1" strokeLinejoin="round" />
          <ellipse cx="0" cy="-4" rx="4" ry="1.4" fill={darken(body, 0.4)} stroke="#1a1814" strokeWidth="0.6" />
        </svg>
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
  const [selectedId, setSelectedId] = useState(null);
  const [drawingLine, setDrawingLine] = useState(null); // { kind, x1, y1 } when mid-drag
  // `pendingShape` is the synthesized stamp the inspector binds to BEFORE
  // anything is placed. The user can tweak label/color/notes; those values
  // flow into the next placement. Only meaningful for marker tools — line
  // tools don't have inspector-editable defaults pre-draw.
  const [pendingShape, setPendingShape] = useState(null);
  const [cursorLogical, setCursorLogical] = useState(null); // { x, y } in logical coords, or null
  const containerRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  const fieldCfg = FIELD_TYPES[fieldType];
  const selected = shapes.find(s => s.id === selectedId) || null;

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
        setSelectedId(null);
        setPendingShape(null);
        return;
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId) {
        e.preventDefault();
        deleteShape(selectedId);
        return;
      }
      const match = TOOLS.find(t2 => t2.key.toLowerCase() === e.key.toLowerCase());
      if (match) {
        setTool(match.id);
        if (match.id !== 'select') {
          setSelectedId(null);
          setPendingShape(defaultPendingFor(match.id, shapes));
        } else {
          setPendingShape(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // --- Shape mutators
  const updateShape = useCallback((id, patch) => {
    setShapes(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const deleteShape = useCallback((id) => {
    setShapes(prev => prev.filter(s => s.id !== id));
    setSelectedId(curr => curr === id ? null : curr);
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
      setSelectedId(null);
      return;
    }

    if (isMarkerKind(tool)) {
      const id = uid(tool);
      const fallback = defaultPendingFor(tool, shapes);
      const draft = pendingShape && pendingShape.kind === tool ? pendingShape : fallback;
      const { pending: _pending, ...rest } = draft || {};
      void _pending;
      setShapes(prev => [...prev, { ...rest, id, kind: tool, x: logical.x, y: logical.y }]);
      setSelectedId(id);
      // Reset pending defaults so the next placement gets a fresh label
      // (A1 -> A2 -> A3) and the inspector reflects the next stamp.
      setPendingShape(defaultPendingFor(tool, [...shapes, { kind: tool }]));
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
      setSelectedId(id);
    }
    setDrawingLine(null);
  };

  // --- Render shapes
  const renderedShapes = useMemo(() => shapes.map(s => {
    const isSelected = s.id === selectedId;
    const onClick = (e) => {
      // Block stage's empty-canvas handler from firing too.
      if (e.cancelBubble !== undefined) e.cancelBubble = true;
      setSelectedId(s.id);
    };
    if (isMarkerKind(s.kind)) {
      const onDragMove = (e) => {
        const node = e.target;
        updateShape(s.id, { x: node.x() / scale, y: node.y() / scale });
      };
      // Konva nodes render at pixel coordinates — multiply by scale.
      const scaled = { ...s, x: s.x * scale, y: s.y * scale };
      return (
        <MarkerShape
          key={s.id}
          shape={scaled}
          selected={isSelected}
          draggable={tool === 'select'}
          onClick={onClick}
          onDragMove={onDragMove}
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
  }), [shapes, selectedId, scale, tool, updateShape]);

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
            // Picking a placement tool clears the selection so the inspector
            // shows a pending preview of what you're about to drop next.
            if (next !== 'select') {
              setSelectedId(null);
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
                        selected={false}
                        draggable={false}
                        onClick={() => {}}
                        onDragMove={() => {}}
                      />
                    </Group>
                  )}
                </Layer>
              </Stage>
            )}
          </div>
        </div>

        <Inspector
          shape={selected || pendingShape}
          onLabel={(v) => {
            if (selected) updateShape(selected.id, { label: v });
            else if (pendingShape) setPendingShape(p => ({ ...p, label: v }));
          }}
          onColor={(v) => {
            if (selected) updateShape(selected.id, { color: v });
            else if (pendingShape) setPendingShape(p => ({ ...p, color: v }));
          }}
          onNotes={(v) => {
            if (selected) updateShape(selected.id, { notes: v });
            else if (pendingShape) setPendingShape(p => ({ ...p, notes: v }));
          }}
          onDelete={selected ? () => deleteShape(selected.id) : undefined}
        />
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group, Rect, Circle, Line, Arrow, Text, Path, RegularPolygon, Ellipse, Image as KImage } from 'react-konva';
import useKonvaImage from '../hooks/useKonvaImage';
import ballSvg from '../assets/ball.svg';

// Cone path lifted from src/components/DiagramBuilder/components/shapes/Cone.jsx
// so the playground cones match the production look (orange body + brown ring).
const CONE_BODY_PATH = 'M 3 24 L 12 4 C 12.5 3.5 13.5 3.5 14 4 L 27 24 C 27.5 25 27 26 26 26 L 4 26 C 3 26 2.5 25 3 24 Z';
const CONE_BODY_COLOR = '#FF6B35';
const CONE_RING_COLOR = '#90330C';
const DEFENDER_COLOR = '#3B82F6';

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
  defender: ()  => <svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 4 L21 20 L3 20 Z" fill={DEFENDER_COLOR} stroke="#1a1814" strokeWidth="1.2" strokeLinejoin="round" /></svg>,
  ball:     ()  => <img src={ballSvg} width="18" height="18" alt="" style={{ display: 'block' }} />,
  cone:     ()  => (
    <svg width="22" height="22" viewBox="0 0 30 28">
      <path d={CONE_BODY_PATH} fill={CONE_BODY_COLOR} stroke="#1a1814" strokeWidth="1" />
      <ellipse cx="15" cy="5" rx="7" ry="2" fill={CONE_RING_COLOR} stroke="#1a1814" strokeWidth="1" />
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
    // Blue filled triangle — sides=3, base of 44 (radius 24 fits visually
    // similar weight to the attacker circle). Label sits below the apex
    // since the triangle is too narrow to host text legibly inside.
    const fill = color || DEFENDER_COLOR;
    return (
      <Group {...common}>
        <RegularPolygon
          sides={3}
          radius={24}
          fill={fill}
          stroke="#1a1814"
          strokeWidth={1.5}
        />
        {label && (
          <Text
            text={label}
            x={-22}
            y={28}
            width={44}
            align="center"
            fontSize={12}
            fontStyle="600"
            fill="#1a1814"
          />
        )}
        {selected && (
          <RegularPolygon
            sides={3}
            radius={34}
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
    // Path-based cone from DiagramBuilder/Cone.jsx — orange body, brown ring.
    // The Path is authored in a 30x30 coordinate space; offset so its center
    // lines up with the group origin.
    return (
      <Group {...common} offsetX={15} offsetY={15}>
        <Path
          data={CONE_BODY_PATH}
          fill={CONE_BODY_COLOR}
          stroke="#1a1814"
          strokeWidth={1}
        />
        <Ellipse
          x={15}
          y={5}
          radiusX={7}
          radiusY={2}
          fill={CONE_RING_COLOR}
          stroke="#1a1814"
          strokeWidth={1}
        />
        {selected && (
          <Rect
            x={-4}
            y={-4}
            width={38}
            height={38}
            cornerRadius={6}
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
      <div className="eyebrow mb-3" style={{ fontSize: 10.5 }}>SELECTION</div>
      <div className="card p-3.5 mb-4 flex items-center gap-2.5">
        <ShapePreview shape={shape} />
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium capitalize" style={{ color: 'var(--ink)' }}>{shape.kind}</div>
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {isLineKind(shape.kind)
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

      <div className="hairline my-4" />

      <button
        onClick={onDelete}
        className="btn btn-ghost w-full justify-center"
        style={{ color: 'var(--danger)' }}
      >
        Delete shape
      </button>

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
    return (
      <div
        className="flex-shrink-0 rounded-[10px] flex items-center justify-center"
        style={{ width: 36, height: 36, background: 'var(--bg-sunken)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M12 4 L21 20 L3 20 Z" fill={shape.color || DEFENDER_COLOR} stroke="#1a1814" strokeWidth="1.2" strokeLinejoin="round" />
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
      {shape.kind === 'cone' && (
        <svg width="24" height="22" viewBox="0 0 30 28">
          <path d={CONE_BODY_PATH} fill={CONE_BODY_COLOR} stroke="#1a1814" strokeWidth="1" />
          <ellipse cx="15" cy="5" rx="7" ry="2" fill={CONE_RING_COLOR} stroke="#1a1814" strokeWidth="1" />
        </svg>
      )}
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

export default function DiagramPlayground() {
  const [title, setTitle] = useState('1v1 in the channel');
  const [fieldType, setFieldType] = useState('full');
  const [tool, setTool] = useState('select');
  const [shapes, setShapes] = useState(STARTER_SHAPES);
  const [selectedId, setSelectedId] = useState(null);
  const [drawingLine, setDrawingLine] = useState(null); // { kind, x1, y1 } when mid-drag
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
      if (e.key === 'Escape') { setTool('select'); setDrawingLine(null); setSelectedId(null); return; }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId) {
        e.preventDefault();
        deleteShape(selectedId);
        return;
      }
      const match = TOOLS.find(t2 => t2.key.toLowerCase() === e.key.toLowerCase());
      if (match) setTool(match.id);
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
      const label = nextLabel(tool, shapes);
      const color = tool === 'attacker' ? '#c8553d' : tool === 'defender' ? DEFENDER_COLOR : null;
      setShapes(prev => [...prev, { id, kind: tool, x: logical.x, y: logical.y, label, color }]);
      setSelectedId(id);
      return;
    }

    if (isLineKind(tool)) {
      setDrawingLine({ kind: tool, x1: logical.x, y1: logical.y });
    }
  };

  const handleStageMouseMove = (e) => {
    if (!drawingLine) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const logical = stageToLogical(pos);
    setDrawingLine(prev => prev ? { ...prev, x2: logical.x, y2: logical.y } : null);
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
        <ToolRail tool={tool} onTool={setTool} />

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
                </Layer>
              </Stage>
            )}
          </div>
        </div>

        <Inspector
          shape={selected}
          onLabel={(v) => updateShape(selected.id, { label: v })}
          onColor={(v) => updateShape(selected.id, { color: v })}
          onNotes={(v) => updateShape(selected.id, { notes: v })}
          onDelete={() => deleteShape(selected.id)}
        />
      </div>
    </div>
  );
}

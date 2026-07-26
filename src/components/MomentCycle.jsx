/**
 * The four moments of the game. They form a clockwise loop:
 *
 *   Attacking → Losing the Ball → Defending → Winning the Ball → Attacking …
 *
 * "Winning the Ball" builds up the attack; "Losing the Ball" starts the defense.
 *
 * - MomentCycle → interactive circular selector (default view)
 * - MomentInfo  → read-only helper explaining the circle + what each moment means
 */

// Cycle order, positioned at the four compass points of the ring.
const MOMENTS = [
  {
    value: 'Attacking', label: 'Attacking', emoji: '⚡', sub: 'In possession', pos: 'top',
    desc: 'Your team has the ball and is trying to score — passing, dribbling, shooting, creating space.',
  },
  {
    value: 'Losing the Ball', label: 'Losing the Ball', emoji: '↩️', sub: 'Start to defend', pos: 'right',
    desc: 'The instant you lose possession. React immediately — press the ball or recover goal-side. This starts your defending.',
  },
  {
    value: 'Defending', label: 'Defending', emoji: '🛡️', sub: 'Out of possession', pos: 'bottom',
    desc: 'The opponent has the ball. Focus on shape, pressing, tackling, and communication to win it back.',
  },
  {
    value: 'Winning the Ball', label: 'Winning the Ball', emoji: '🔄', sub: 'Build the attack', pos: 'left',
    desc: 'The instant you win the ball back. Play forward quickly and exploit the disorganised defense — this builds your attack.',
  },
];

const POS_STYLE = {
  top: { top: 0, left: '50%', transform: 'translateX(-50%)' },
  right: { right: 0, top: '50%', transform: 'translateY(-50%)' },
  bottom: { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
  left: { left: 0, top: '50%', transform: 'translateY(-50%)' },
};

// Clockwise arrowheads sit in the gaps between nodes (NE, SE, SW, NW),
// rotated to follow the ring's tangent.
const ARROWS = [
  { x: 76.9, y: 23.1, rot: 45 },
  { x: 76.9, y: 76.9, rot: 135 },
  { x: 23.1, y: 76.9, rot: 225 },
  { x: 23.1, y: 23.1, rot: 315 },
];

export default function MomentCycle({ value, onChange }) {
  return (
    <div
      role="radiogroup"
      aria-label="Moment of the game"
      style={{ position: 'relative', width: '100%', maxWidth: 300, aspectRatio: '1 / 1', margin: '0 auto' }}
    >
      {/* Ring + clockwise arrows */}
      <svg
        viewBox="0 0 100 100"
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="var(--line-2)"
          strokeWidth="1.5"
          strokeDasharray="1.5 3"
          strokeLinecap="round"
        />
        {ARROWS.map((a, i) => (
          <path
            key={i}
            d="M -3.4 -3 L 3.4 0 L -3.4 3 Z"
            fill="var(--accent)"
            transform={`translate(${a.x} ${a.y}) rotate(${a.rot})`}
          />
        ))}
      </svg>

      {MOMENTS.map((node) => {
        const active = value === node.value;
        return (
          <button
            key={node.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(node.value)}
            className="absolute flex flex-col items-center justify-center text-center transition-all"
            style={{
              ...POS_STYLE[node.pos],
              width: 104,
              padding: '8px 6px',
              borderRadius: 16,
              border: '1.5px solid',
              borderColor: active ? 'var(--accent)' : 'var(--line)',
              background: active ? 'var(--accent-soft)' : 'var(--bg-elev)',
              color: active ? 'var(--accent)' : 'var(--ink-2)',
              boxShadow: active ? '0 2px 8px var(--accent-soft)' : '0 1px 2px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--line-2)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--line)'; }}
          >
            <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>{node.emoji}</span>
            <span style={{ fontSize: 12.5, fontWeight: active ? 700 : 600, letterSpacing: '-0.01em', marginTop: 3 }}>
              {node.label}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 500, color: active ? 'var(--accent)' : 'var(--ink-3)', marginTop: 1 }}>
              {node.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Read-only helper — shown behind the "?"                             */
/* ------------------------------------------------------------------ */

export function MomentInfo() {
  return (
    <div
      className="rounded-2xl p-4 mb-3"
      style={{ border: '1px solid var(--line)', background: 'var(--bg-elev)' }}
    >
      <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>
        The game moves in a continuous circle. When you have the ball you're{' '}
        <strong style={{ color: 'var(--ink)' }}>attacking</strong>; lose it and you must
        immediately <strong style={{ color: 'var(--ink)' }}>defend</strong>. The two
        transitions connect them — <strong style={{ color: 'var(--ink)' }}>winning the ball</strong>{' '}
        builds your attack, <strong style={{ color: 'var(--ink)' }}>losing the ball</strong>{' '}
        starts your defense.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {MOMENTS.map((m) => (
          <div key={m.value} className="flex gap-2">
            <span aria-hidden style={{ fontSize: 15, lineHeight: 1.4 }}>{m.emoji}</span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                {m.label}
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)' }}> · {m.sub}</span>
              </div>
              <p style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--ink-2)' }}>{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

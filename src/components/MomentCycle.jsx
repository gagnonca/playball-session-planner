/**
 * MomentCycle — the four moments of the game arranged as a clockwise loop so
 * the cyclical relationship is obvious:
 *
 *   Attacking → Losing the Ball → Defending → Winning the Ball → Attacking …
 *
 * "Winning the Ball" builds up the attack; "Losing the Ball" starts the defense.
 */

// Cycle order, positioned at the four compass points of the ring.
const NODES = [
  { value: 'Attacking', label: 'Attacking', emoji: '⚡', sub: 'In possession', pos: 'top' },
  { value: 'Losing the Ball', label: 'Losing the Ball', emoji: '↩️', sub: 'Start to defend', pos: 'right' },
  { value: 'Defending', label: 'Defending', emoji: '🛡️', sub: 'Out of possession', pos: 'bottom' },
  { value: 'Winning the Ball', label: 'Winning the Ball', emoji: '🔄', sub: 'Build the attack', pos: 'left' },
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

      {NODES.map((node) => {
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

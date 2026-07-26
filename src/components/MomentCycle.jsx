/**
 * The four moments of the game. They form a clockwise loop:
 *
 *   Attacking → Losing the Ball → Defending → Winning the Ball → Attacking …
 *
 * "Winning the Ball" builds up the attack; "Losing the Ball" starts the defense.
 *
 * - MomentPills   → compact default selector (titles + subtitle)
 * - MomentCycle   → circular view with directional arrows + verbose descriptions
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

/* ------------------------------------------------------------------ */
/* Compact default selector                                            */
/* ------------------------------------------------------------------ */

export function MomentPills({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Moment of the game">
      {MOMENTS.map((m) => {
        const active = value === m.value;
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m.value)}
            className="inline-flex flex-col items-start rounded-2xl px-3 py-1.5 transition-all"
            style={{
              border: '1.5px solid',
              borderColor: active ? 'var(--accent)' : 'var(--line)',
              background: active ? 'var(--accent-soft)' : 'var(--bg-elev)',
              color: active ? 'var(--accent)' : 'var(--ink-2)',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--line-2)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--line)'; }}
          >
            <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: active ? 700 : 600, letterSpacing: '-0.005em' }}>
              <span aria-hidden>{m.emoji}</span>
              <span>{m.label}</span>
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 500, color: active ? 'var(--accent)' : 'var(--ink-3)' }}>
              {m.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Circular view (shown in the "?" popup)                              */
/* ------------------------------------------------------------------ */

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

export default function MomentCycle({ value, onChange, verbose = false }) {
  return (
    <div>
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

      {verbose && (
        <div className="mt-4 flex flex-col gap-2.5">
          {MOMENTS.map((m) => {
            const active = value === m.value;
            return (
              <div
                key={m.value}
                className="rounded-xl px-3 py-2"
                style={{
                  border: '1px solid',
                  borderColor: active ? 'var(--accent)' : 'var(--line)',
                  background: active ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                <div className="flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--ink)' }}>
                  <span aria-hidden>{m.emoji}</span>
                  <span>{m.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)' }}>· {m.sub}</span>
                </div>
                <p className="mt-0.5" style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--ink-2)' }}>
                  {m.desc}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

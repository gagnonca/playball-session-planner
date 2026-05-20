import React from 'react';

// Small pitch preview used on SessionCards. If the session has a real CDN
// image we render that; otherwise a synthesized "main drill" pitch keyed off
// the first section's name so cards stay visually distinct.

function diagramKindFor(session) {
  const text = (session?.summary?.title || '')
    + ' '
    + (session?.sections?.[0]?.name || '');
  const m = text.toLowerCase();
  if (m.includes('channel')) return 'channels';
  if (m.includes('rondo')) return 'rondo';
  if (m.includes('switch')) return 'switch';
  if (m.includes('gate')) return 'gates';
  if (m.includes('build')) return 'buildout';
  if (m.includes('goal') || m.includes('finish')) return 'goal';
  if (m.includes('ssg') || m.includes('joker') || m.includes('small-sided') || m.includes('small sided')) return 'ssg';
  return 'channels';
}

function findSectionImage(session) {
  const sections = session?.sections || [];
  for (const s of sections) {
    if (s?.imageDataUrl) return s.imageDataUrl;
    for (const v of s?.variations || []) {
      if (v?.imageDataUrl) return v.imageDataUrl;
    }
  }
  return null;
}

export default function DiagramPreview({ session, tint = '#c8553d', height = 108, showBadge = true }) {
  const image = findSectionImage(session);
  if (image) {
    return (
      <div
        style={{
          position: 'relative',
          height,
          borderRadius: 8,
          overflow: 'hidden',
          background: '#9bb37a',
          backgroundImage: `url(${image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {showBadge && (
          <div
            style={{
              position: 'absolute', bottom: 6, left: 8,
              padding: '2px 7px', borderRadius: 3,
              background: 'rgba(26,24,20,0.78)', color: '#fff',
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
            }}
          >
            MAIN DRILL
          </div>
        )}
      </div>
    );
  }

  const kind = diagramKindFor(session);
  const isShort = height < 80;
  return (
    <div style={{ position: 'relative', height, borderRadius: 8, overflow: 'hidden', background: '#9bb37a' }}>
      <div
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 28px, rgba(0,0,0,0.04) 28px 56px)',
        }}
      />
      <svg viewBox="0 0 400 220" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <g fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4">
          <rect x="4" y="4" width="392" height="212" />
          <line x1="200" y1="4" x2="200" y2="216" />
          <circle cx="200" cy="110" r="32" />
          <rect x="4" y="56" width="44" height="108" />
          <rect x="352" y="56" width="44" height="108" />
        </g>
        {kind === 'channels' && (
          <>
            <g stroke="#fff" strokeWidth="1.4" strokeDasharray="4 4" opacity="0.85">
              <line x1="100" y1="32" x2="300" y2="32" />
              <line x1="100" y1="188" x2="300" y2="188" />
            </g>
            <circle cx="120" cy="48" r="9" fill={tint} stroke="#fff" strokeWidth="1.6" />
            <circle cx="220" cy="48" r="9" fill="#1a1814" stroke="#fff" strokeWidth="1.6" />
            <circle cx="120" cy="172" r="9" fill={tint} stroke="#fff" strokeWidth="1.6" />
            <circle cx="220" cy="172" r="9" fill="#1a1814" stroke="#fff" strokeWidth="1.6" />
            <path d="M120 48 Q 200 30, 280 48" stroke="#fff" strokeWidth="2" fill="none" />
            <path d="M120 172 Q 200 192, 280 172" stroke="#fff" strokeWidth="2" fill="none" />
          </>
        )}
        {kind === 'rondo' && (
          <>
            <circle cx="200" cy="110" r="60" stroke="#fff" strokeWidth="1.4" fill="none" strokeDasharray="3 3" />
            <circle cx="200" cy="50" r="9" fill={tint} stroke="#fff" strokeWidth="1.6" />
            <circle cx="260" cy="110" r="9" fill={tint} stroke="#fff" strokeWidth="1.6" />
            <circle cx="200" cy="170" r="9" fill={tint} stroke="#fff" strokeWidth="1.6" />
            <circle cx="140" cy="110" r="9" fill={tint} stroke="#fff" strokeWidth="1.6" />
            <circle cx="200" cy="90" r="9" fill="#1a1814" stroke="#fff" strokeWidth="1.6" />
            <circle cx="180" cy="130" r="9" fill="#1a1814" stroke="#fff" strokeWidth="1.6" />
            <circle cx="200" cy="110" r="3.5" fill="#fff" />
          </>
        )}
        {kind === 'switch' && (
          <>
            <circle cx="80" cy="60" r="9" fill={tint} stroke="#fff" strokeWidth="1.6" />
            <circle cx="320" cy="160" r="9" fill={tint} stroke="#fff" strokeWidth="1.6" />
            <circle cx="180" cy="110" r="9" fill={tint} stroke="#fff" strokeWidth="1.6" />
            <circle cx="220" cy="80" r="9" fill="#1a1814" stroke="#fff" strokeWidth="1.6" />
            <path d="M80 60 Q 180 80, 180 110 Q 220 140, 320 160" stroke="#fff" strokeWidth="2" fill="none" />
            <circle cx="80" cy="60" r="3.5" fill="#fff" />
          </>
        )}
        {kind === 'goal' && (
          <>
            <rect x="352" y="80" width="44" height="60" fill="rgba(255,255,255,0.18)" />
            <circle cx="220" cy="110" r="9" fill={tint} stroke="#fff" strokeWidth="1.6" />
            <circle cx="280" cy="110" r="9" fill="#1a1814" stroke="#fff" strokeWidth="1.6" />
            <path d="M220 110 L 340 110" stroke="#fff" strokeWidth="2.2" fill="none" />
            <path d="M340 110 l -8 -5 M340 110 l -8 5" stroke="#fff" strokeWidth="2.2" fill="none" />
            <circle cx="210" cy="110" r="3.5" fill="#fff" />
          </>
        )}
        {kind === 'ssg' && (
          <>
            <rect x="4" y="80" width="14" height="60" fill="rgba(255,255,255,0.2)" />
            <rect x="382" y="80" width="14" height="60" fill="rgba(255,255,255,0.2)" />
            {[60, 80, 100, 130, 160].map((y, i) => (
              <circle key={i} cx={80 + i * 38} cy={y} r="7" fill={tint} stroke="#fff" strokeWidth="1.4" />
            ))}
            {[80, 110, 140, 170, 100].map((y, i) => (
              <circle key={i} cx={220 + i * 30} cy={y} r="7" fill="#1a1814" stroke="#fff" strokeWidth="1.4" />
            ))}
            <circle cx="200" cy="110" r="3.5" fill="#fff" />
          </>
        )}
        {kind === 'gates' && (
          <>
            {[80, 160, 240, 320].map((x, i) => (
              <g key={i}>
                <rect x={x - 2} y="80" width="4" height="20" fill="#fff" />
                <rect x={x - 2} y="120" width="4" height="20" fill="#fff" />
              </g>
            ))}
            <circle cx="60" cy="110" r="9" fill={tint} stroke="#fff" strokeWidth="1.6" />
            <path d="M60 110 Q 110 100, 130 110 Q 180 130, 200 110 Q 260 90, 280 110 Q 320 130, 340 110" stroke="#fff" strokeWidth="2" fill="none" />
          </>
        )}
        {kind === 'buildout' && (
          <>
            {[
              [40, 110], [80, 70], [80, 150],
              [140, 60], [140, 110], [140, 160],
              [220, 50], [220, 170], [260, 110],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="7" fill={tint} stroke="#fff" strokeWidth="1.4" />
            ))}
            {[[300, 110], [340, 80], [340, 150]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="7" fill="#1a1814" stroke="#fff" strokeWidth="1.4" />
            ))}
            <path d="M40 110 L 140 110 L 220 50" stroke="#fff" strokeWidth="1.6" fill="none" />
          </>
        )}
      </svg>
      {!isShort && showBadge && (
        <div
          style={{
            position: 'absolute', bottom: 6, left: 8,
            padding: '2px 7px', borderRadius: 3,
            background: 'rgba(26,24,20,0.78)', color: '#fff',
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          }}
        >
          MAIN DRILL
        </div>
      )}
    </div>
  );
}

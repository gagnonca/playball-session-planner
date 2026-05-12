import React, { useMemo, useState } from 'react';
import appStoreBadge from '../assets/app-store-badge.svg';

// Mirrors the iOS app's schedule: month grid + grouped-by-week list view
// of every session that has a `summary.date`. Pure read of teamsData — no
// API or data-shape changes.

const TEAM_TONES = ['#c8553d', '#3d7a4a', '#3d5a8a', '#9a5a3a', '#6a4a8a', '#3a6a7a'];
function teamTone(team) {
  if (team?.color) return team.color;
  const key = team?.id || team?.name || '';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TEAM_TONES[h % TEAM_TONES.length];
}

// Parse a session date string (legacy YYYY-MM-DD or already-formatted display).
function parseSessionDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d) {
  const n = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  n.setDate(n.getDate() - n.getDay());
  return n;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function monthLabel(d) {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function Schedule({ teamsContext }) {
  const { teamsData, navigateToTeams, navigateToSessionBuilder, navigateToLibrary, navigateToTeamDetail } = teamsContext;
  const teams = teamsData?.teams || [];

  // Visible month — defaults to today. Caller can move +/- a month.
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [view, setView] = useState('month'); // 'month' | 'list'
  const [filterTeamId, setFilterTeamId] = useState('all');

  // Flatten every dated session into an event list.
  const events = useMemo(() => {
    const out = [];
    for (const team of teams) {
      const tone = teamTone(team);
      for (const session of team.sessions || []) {
        const date = parseSessionDate(session.summary?.date);
        if (!date) continue;
        out.push({
          id: session.id,
          teamId: team.id,
          teamName: team.name,
          teamColor: tone,
          title: session.summary?.title || 'Untitled session',
          date,
          duration: session.summary?.duration || '',
          moment: session.summary?.moment || '',
          sectionCount: session.sections?.length || 0,
        });
      }
    }
    return out.sort((a, b) => a.date - b.date);
  }, [teams]);

  const filteredEvents = useMemo(() => (
    filterTeamId === 'all' ? events : events.filter(e => e.teamId === filterTeamId)
  ), [events, filterTeamId]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <header
        className="sticky top-0 z-10"
        style={{ background: 'rgb(var(--bg-rgb) / 0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--line)' }}
      >
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <button onClick={navigateToTeams} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 13 }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => navigateToLibrary && navigateToLibrary('sessions')} className="btn btn-ghost">Library</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-10 pb-16">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="overline mb-2">SCHEDULE · {monthLabel(cursor).toUpperCase()}</div>
            <h1 className="text-[40px] font-semibold leading-[1.04]" style={{ letterSpacing: '-0.02em' }}>The weeks ahead.</h1>
            <p className="mt-2 text-[14.5px] max-w-[540px]" style={{ color: 'var(--ink-2)' }}>
              Practices and games for every team you coach.{' '}
              <span style={{ color: 'var(--ink-3)' }}>iOS app sync coming soon &mdash; for now this view aggregates every session that has a date.</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              role="tablist"
              aria-label="View"
              className="inline-flex p-1 rounded-[10px]"
              style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}
            >
              {[
                { key: 'month', label: 'Month' },
                { key: 'list', label: 'List' },
              ].map(opt => {
                const active = view === opt.key;
                return (
                  <button
                    key={opt.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setView(opt.key)}
                    className="px-3 py-1.5 text-[12.5px] rounded-[7px] transition-colors"
                    style={{
                      background: active ? 'var(--bg-elev)' : 'transparent',
                      color: active ? 'var(--ink)' : 'var(--ink-2)',
                      border: active ? '1px solid var(--line-2)' : '1px solid transparent',
                      boxShadow: active ? 'var(--shadow-sm)' : 'none',
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div
              className="inline-flex items-center rounded-[8px]"
              style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}
            >
              <button
                onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
                className="btn btn-ghost"
                style={{ padding: '6px 8px' }}
                aria-label="Previous month"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
                className="btn btn-ghost"
                style={{ padding: '6px 10px', fontSize: 12.5 }}
              >
                Today
              </button>
              <button
                onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
                className="btn btn-ghost"
                style={{ padding: '6px 8px' }}
                aria-label="Next month"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Team filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          <FilterChip selected={filterTeamId === 'all'} onClick={() => setFilterTeamId('all')}>All teams</FilterChip>
          {teams.map(t => (
            <FilterChip
              key={t.id}
              selected={filterTeamId === t.id}
              onClick={() => setFilterTeamId(t.id)}
              color={teamTone(t)}
            >
              {t.name}
            </FilterChip>
          ))}
        </div>

        {view === 'month' ? (
          <MonthView
            cursor={cursor}
            events={filteredEvents}
            onOpenEvent={(e) => navigateToSessionBuilder(e.teamId, e.id)}
          />
        ) : (
          <ListView
            cursor={cursor}
            events={filteredEvents}
            onOpenEvent={(e) => navigateToSessionBuilder(e.teamId, e.id)}
            onOpenTeam={(teamId) => navigateToTeamDetail(teamId)}
          />
        )}

        {/* iOS companion */}
        <div className="mt-10 card p-5 flex flex-wrap items-center gap-4">
          <div
            className="w-11 h-11 rounded-[11px] flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="2" width="12" height="20" rx="2.4" />
              <path d="M10 18h4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-semibold leading-tight" style={{ letterSpacing: '-0.015em' }}>
              Your schedule, in your pocket
            </div>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-2)' }}>
              Get notified before each practice. Tap into a session at the field, edit a drill, and it&rsquo;s back here when you sit down at home.
            </p>
          </div>
          <a
            href="https://apps.apple.com/us/app/playball-equal-playing-time/id6744836650"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 opacity-90 hover:opacity-100 transition-opacity"
          >
            <img src={appStoreBadge} alt="Download on the App Store" className="h-10" />
          </a>
        </div>
      </main>
    </div>
  );
}

function FilterChip({ selected, onClick, color, children }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors"
      style={{
        background: selected ? 'var(--ink)' : 'var(--bg-elev)',
        border: '1px solid',
        borderColor: selected ? 'var(--ink)' : 'var(--line)',
        color: selected ? 'var(--bg)' : 'var(--ink)',
        fontSize: 12.5,
        fontWeight: selected ? 500 : 400,
      }}
    >
      {color && (
        <span
          className="inline-block rounded-full"
          style={{ width: 8, height: 8, background: color, opacity: selected ? 0.85 : 1 }}
        />
      )}
      {children}
    </button>
  );
}

function MonthView({ cursor, events, onOpenEvent }) {
  const today = new Date();
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i);
    return {
      date,
      inMonth: date.getMonth() === cursor.getMonth(),
      isToday: sameDay(date, today),
      events: events.filter(e => sameDay(e.date, date)),
    };
  });

  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div
      className="overflow-hidden rounded-[14px]"
      style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--line)' }}
      >
        {daysOfWeek.map((d, i) => (
          <div
            key={i}
            className="font-mono"
            style={{
              padding: '10px 12px',
              fontSize: 10.5,
              color: 'var(--ink-3)',
              letterSpacing: '0.1em',
              borderLeft: i === 0 ? 'none' : '1px solid var(--line)',
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {cells.map((c, i) => (
          <div
            key={i}
            style={{
              minHeight: 96,
              padding: 8,
              borderTop: i >= 7 ? '1px solid var(--line)' : 'none',
              borderLeft: i % 7 !== 0 ? '1px solid var(--line)' : 'none',
              background: c.inMonth ? 'transparent' : 'var(--bg-sunken)',
              opacity: c.inMonth ? 1 : 0.55,
            }}
          >
            <div
              className="font-mono"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: c.isToday ? 'var(--accent)' : 'transparent',
                color: c.isToday ? 'var(--accent-ink)' : 'var(--ink-2)',
                fontSize: 11.5,
                fontWeight: c.isToday ? 600 : 400,
                marginBottom: 4,
              }}
            >
              {c.date.getDate()}
            </div>
            <div className="flex flex-col gap-[3px]">
              {c.events.slice(0, 3).map((e, k) => (
                <button
                  key={k}
                  onClick={() => onOpenEvent && onOpenEvent(e)}
                  className="w-full text-left rounded-[4px] overflow-hidden whitespace-nowrap"
                  style={{
                    background: `color-mix(in oklab, ${e.teamColor} 18%, var(--bg-elev))`,
                    color: 'var(--ink)',
                    padding: '3px 6px',
                    fontSize: 11,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  title={e.title}
                >
                  <span
                    className="inline-block flex-shrink-0 rounded-full"
                    style={{ width: 4, height: 4, background: e.teamColor }}
                  />
                  <span className="font-mono" style={{ fontSize: 9.5, opacity: 0.7, flexShrink: 0 }}>
                    {e.duration ? `${String(e.duration).match(/\d+/)?.[0] || ''}m` : ''}
                  </span>
                  <span className="overflow-hidden" style={{ textOverflow: 'ellipsis' }}>{e.title}</span>
                </button>
              ))}
              {c.events.length > 3 && (
                <span className="text-[10.5px] font-mono uppercase" style={{ color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                  +{c.events.length - 3} more
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListView({ cursor, events, onOpenEvent }) {
  // Group by ISO week starting on Sunday.
  const groups = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const wk = startOfWeek(e.date);
      const key = wk.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, { weekStart: wk, items: [] });
      map.get(key).items.push(e);
    }
    return Array.from(map.values()).sort((a, b) => a.weekStart - b.weekStart);
  }, [events]);

  if (groups.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="overline mb-3">NO SESSIONS</div>
        <h3 className="text-[18px] font-semibold mb-2" style={{ letterSpacing: '-0.015em' }}>
          No scheduled sessions yet
        </h3>
        <p className="text-[13.5px] max-w-md mx-auto" style={{ color: 'var(--ink-2)' }}>
          Schedule a session in any team and it&rsquo;ll show up here, grouped by week.
        </p>
      </div>
    );
  }

  const today = new Date();
  const thisWeekStart = startOfWeek(today);
  const nextWeekStart = addDays(thisWeekStart, 7);

  const weekHeading = (weekStart) => {
    if (sameDay(weekStart, thisWeekStart)) return 'THIS WEEK';
    if (sameDay(weekStart, nextWeekStart)) return 'NEXT WEEK';
    return `WEEK OF ${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}`;
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col gap-7">
      {groups.map(g => (
        <div key={g.weekStart.toISOString()}>
          <div className="overline mb-3">{weekHeading(g.weekStart)}</div>
          <div className="flex flex-col gap-2">
            {g.items.map(e => (
              <button
                key={`${e.teamId}:${e.id}`}
                onClick={() => onOpenEvent && onOpenEvent(e)}
                className="card card-hover p-3.5 text-left"
                style={{ display: 'flex', alignItems: 'center', gap: 18 }}
              >
                <div
                  style={{ width: 4, height: 44, background: e.teamColor, borderRadius: 4, flexShrink: 0 }}
                />
                <div style={{ minWidth: 78 }}>
                  <div className="font-mono uppercase" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                    {dayLabels[e.date.getDay()]}
                  </div>
                  <div className="text-[16px] font-semibold" style={{ letterSpacing: '-0.02em' }}>
                    {e.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[15px] font-semibold truncate" style={{ letterSpacing: '-0.015em' }}>
                      {e.title}
                    </span>
                    {e.moment && (
                      <span className="px-2 py-0.5 rounded-full text-[11px]" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        {e.moment}
                      </span>
                    )}
                  </div>
                  <div className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
                    {e.teamName}
                    {e.duration ? ` · ${e.duration}` : ''}
                    {e.sectionCount ? ` · ${e.sectionCount} section${e.sectionCount === 1 ? '' : 's'}` : ''}
                  </div>
                </div>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--ink-3)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 4 }} className="text-[12px] text-center" >
        <span className="font-mono uppercase" style={{ color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
          Showing {events.length} session{events.length === 1 ? '' : 's'} across all dates · {monthLabel(cursor)} cursor
        </span>
      </div>
    </div>
  );
}

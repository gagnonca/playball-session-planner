import React, { useEffect, useMemo, useState } from 'react';
import { DiagramStatic } from './DiagramPlayground';
import { listCommunity, getCommunityItem, countAdd, reportItem } from '../data/community';
import { useStore, library, diagrams as diagramStore } from '../data/store';
import { libraryPayloadToSession, toast, uid, nowIso } from '../utils/helpers';
import { sessionWithRenderedImages, withRenderedImages, imageFor } from '../utils/renderDiagram';

// The public Community library: sessions, exercises and diagrams other
// coaches published. Anyone can browse (signed out too); adding a copy to
// your team or library needs an account.
//
// Everything here came from strangers, so it is rendered defensively:
// diagrams only from vector shapes (DiagramStatic — never an image), and
// text as plain text (formatting tags are turned into line breaks).

const KINDS = [
  { id: 'session', label: 'Sessions' },
  { id: 'exercise', label: 'Exercises' },
  { id: 'diagram', label: 'Diagrams' },
];
const MOMENTS = ['Attacking', 'Losing the Ball', 'Defending', 'Winning the Ball'];
const AGE_GROUPS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19'];

function plainText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<li>/gi, '\n• ')
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/ul>|<\/ol>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function Preview({ diagram, width }) {
  if (!diagram) {
    return (
      <div className="w-full flex items-center justify-center text-[11.5px]" style={{ aspectRatio: '16 / 10', background: 'var(--bg-sunken)', color: 'var(--ink-3)' }}>
        No diagram
      </div>
    );
  }
  return (
    <div className="w-full flex items-center justify-center overflow-hidden" style={{ background: '#475E47' }}>
      <DiagramStatic diagram={diagram} width={width} />
    </div>
  );
}

function Tag({ children, accent }) {
  return (
    <span className="px-2 py-0.5 text-[11px] rounded-full" style={accent ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : { background: 'var(--bg-sunken)', color: 'var(--ink-2)' }}>
      {children}
    </span>
  );
}

// Everything needed to put a copy of a Community item into my account.
function useAddTargets() {
  const teams = useStore(s => s.teamsData?.teams || []);
  const signedIn = useStore(s => s.status === 'ready' && !s.demo);
  return { teams: teams.filter(t => !t.archived), signedIn };
}

function AddControls({ item, full, onAdded, onSignIn }) {
  const { teams, signedIn } = useAddTargets();
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return <button className="btn btn-secondary" onClick={onSignIn}>Sign in to add</button>;
  }

  const add = async () => {
    setBusy(true);
    try {
      const detail = full || await getCommunityItem(item.id);
      const p = detail.payload;
      if (item.kind === 'session') {
        const team = teams.find(t => t.id === (teamId || teams[0]?.id));
        if (!team) { toast('Create a team first, then add sessions to it.'); return; }
        // Thumbnails are drawn here from the vector data, never taken from the author.
        const session = libraryPayloadToSession(await sessionWithRenderedImages(p), { ageGroup: team.ageGroup, defaultDuration: team.defaultDuration });
        const { createSessionOnTeam } = onAdded;
        createSessionOnTeam(team.id, session);
        toast(`Added "${item.title}" to ${team.name}`);
      } else if (item.kind === 'exercise') {
        library.putExercise({
          id: uid(), version: null, name: item.title, type: p.type || 'Other',
          tags: { type: p.type || '', ageGroup: item.tags?.ageGroup || '', moment: item.tags?.moment || '' },
          payload: await withRenderedImages(p), updatedAt: nowIso(),
        });
        toast(`Added "${item.title}" to your exercises`);
      } else {
        diagramStore.put({
          id: `diagram_${uid()}`, version: null, name: item.title, description: '',
          ...p, dataUrl: await imageFor(p), elements: [], lines: [], fieldType: p.pitchView === 'full' ? 'full' : 'small',
          tags: { ageGroup: item.tags?.ageGroup || '', moments: item.tags?.moment ? [item.tags.moment] : [], type: item.tags?.type || '' },
          createdAt: nowIso(), updatedAt: nowIso(),
        });
        toast(`Added "${item.title}" to your diagrams`);
      }
      countAdd(item.id);
    } catch (e) {
      toast(e.message || "Couldn't add that item.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      {item.kind === 'session' && teams.length > 1 && (
        <select value={teamId || teams[0]?.id} onChange={e => setTeamId(e.target.value)} className="input-field py-1.5 text-[12.5px]" onClick={e => e.stopPropagation()}>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      <button className="btn btn-primary" disabled={busy} onClick={(e) => { e.stopPropagation(); add(); }}>
        {busy ? 'Adding…' : item.kind === 'session' ? (teams.length > 1 ? 'Add' : `Add to ${teams[0]?.name || 'team'}`) : 'Add to my library'}
      </button>
    </span>
  );
}

function DetailModal({ item, onClose, onAdded, onSignIn, mine }) {
  const [full, setFull] = useState(null);
  const [error, setError] = useState('');
  const signedIn = useStore(s => s.status === 'ready' && !s.demo);

  useEffect(() => {
    let alive = true;
    getCommunityItem(item.id).then(d => { if (alive) setFull(d); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [item.id]);

  const report = async () => {
    const reason = window.prompt('What is wrong with this item? (optional)');
    if (reason === null) return;
    try { await reportItem(item.id, reason); toast('Thanks — we will take a look.'); onClose(); }
    catch (e) { toast(e.message || "Couldn't send the report."); }
  };

  const p = full?.payload;
  const blocks = item.kind === 'session' ? (p?.sections || []) : item.kind === 'exercise' && p ? [p] : [];

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="card w-full max-w-2xl max-h-[88vh] flex flex-col animate-fade-in" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="p-5 flex items-start justify-between gap-3" style={{ borderBottom: '1px solid var(--line)' }}>
            <div className="min-w-0">
              <div className="eyebrow mb-1">{KINDS.find(k => k.id === item.kind)?.label.replace(/s$/, '').toUpperCase()} · SHARED BY A PLAYBALL COACH</div>
              <h2 className="text-[20px] font-semibold truncate" style={{ letterSpacing: '-0.02em' }}>{item.title}</h2>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {item.tags?.moment && <Tag accent>{item.tags.moment}</Tag>}
                {item.tags?.ageGroup && <Tag>{item.tags.ageGroup}</Tag>}
                {p?.summary?.duration && <Tag>{p.summary.duration} min</Tag>}
              </div>
            </div>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>

          <div className="p-5 overflow-y-auto flex-1">
            {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
            {!full && !error && <p style={{ color: 'var(--ink-3)' }}>Loading…</p>}
            {item.kind === 'diagram' && p && <Preview diagram={p} width={600} />}
            {p?.summary?.notes && <p className="text-[13.5px] whitespace-pre-line mb-4" style={{ color: 'var(--ink-2)' }}>{plainText(p.summary.notes)}</p>}
            {blocks.map((b, i) => (
              <div key={i} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  {b.type && <span className="font-mono text-[10.5px] uppercase" style={{ color: 'var(--accent)', letterSpacing: '0.08em' }}>{b.type}{b.time ? ` · ${b.time} min` : ''}</span>}
                </div>
                <div className="text-[15px] font-semibold mb-2">{b.name || 'Untitled'}</div>
                {(b.diagramData || b.variations?.find(v => v.diagramData)) && (
                  <div className="mb-2 rounded-[10px] overflow-hidden"><Preview diagram={b.diagramData || b.variations.find(v => v.diagramData).diagramData} width={600} /></div>
                )}
                {b.objective && <p className="text-[13px] whitespace-pre-line mb-1"><strong>Objective:</strong> {plainText(b.objective)}</p>}
                {b.organization && <p className="text-[13px] whitespace-pre-line mb-1"><strong>Organization:</strong> {plainText(b.organization)}</p>}
                {b.guidedQA && <p className="text-[13px] whitespace-pre-line" style={{ color: 'var(--ink-2)' }}>{b.guidedQA}</p>}
                {(b.variations || []).length > 0 && (
                  <p className="text-[12px] mt-1" style={{ color: 'var(--ink-3)' }}>{b.variations.length} variation{b.variations.length === 1 ? '' : 's'}</p>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid var(--line)' }}>
            {signedIn && !mine
              ? <button className="text-[12px]" style={{ color: 'var(--ink-3)' }} onClick={report}>Report</button>
              : <span />}
            {mine
              ? <span className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>This is yours</span>
              : <AddControls item={item} full={full} onAdded={onAdded} onSignIn={onSignIn} />}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Community({ onSignIn, createSessionOnTeam }) {
  const [kind, setKind] = useState('session');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [moment, setMoment] = useState('');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const published = useStore(s => s.published);
  const mineIds = useMemo(() => new Set(published.map(p => p.id)), [published]);

  // Debounce typing into the search box.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;
    listCommunity({ kind, q: query, ageGroup, moment })
      .then(list => { if (alive) { setItems(list); setError(''); } })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [kind, query, ageGroup, moment]);

  const onAdded = { createSessionOnTeam };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 p-1 rounded-[10px]" style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}>
          {KINDS.map(k => (
            <button
              key={k.id}
              onClick={() => { setItems(null); setKind(k.id); }}
              className="px-3.5 py-1.5 rounded-[8px] text-[13px]"
              style={kind === k.id ? { background: 'var(--bg-elev)', border: '1px solid var(--line)', fontWeight: 500 } : { border: '1px solid transparent', color: 'var(--ink-2)' }}
            >
              {k.label}
            </button>
          ))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the Community…" className="input-field flex-1 min-w-[180px] max-w-xs" />
        <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)} className="input-field w-auto">
          <option value="">All ages</option>
          {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {kind !== 'diagram' && (
          <select value={moment} onChange={e => setMoment(e.target.value)} className="input-field w-auto">
            <option value="">All moments</option>
            {MOMENTS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      {error && <div className="card p-6 text-center" style={{ color: 'var(--danger)' }}>{error}</div>}
      {!error && items === null && <div className="card p-6 text-center" style={{ color: 'var(--ink-3)' }}>Loading the Community…</div>}
      {!error && items?.length === 0 && (
        <div className="card p-10 text-center" style={{ color: 'var(--ink-2)' }}>
          <div className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>Nothing here yet</div>
          <p className="text-[13px]">Be the first: publish a session from its Share menu, or an exercise or diagram from your Library.</p>
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {(items || []).map(item => (
          <button key={item.id} onClick={() => setOpen(item)} className="card text-left overflow-hidden flex flex-col hover:opacity-95" style={{ padding: 0 }}>
            <Preview diagram={item.preview} width={300} />
            <div className="p-4 flex flex-col gap-2 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold" style={{ letterSpacing: '-0.015em' }}>{item.title}</div>
                {mineIds.has(item.id) && <Tag accent>Yours</Tag>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.tags?.moment && <Tag accent>{item.tags.moment}</Tag>}
                {item.tags?.ageGroup && <Tag>{item.tags.ageGroup}</Tag>}
                {item.kind === 'session' && <Tag>{item.sectionCount} part{item.sectionCount === 1 ? '' : 's'}</Tag>}
              </div>
              {item.kind === 'session' && item.sectionNames?.length > 0 && (
                <p className="text-[12px] line-clamp-2" style={{ color: 'var(--ink-3)' }}>{item.sectionNames.join(' · ')}</p>
              )}
              {item.kind === 'exercise' && item.objective && (
                <p className="text-[12px] line-clamp-2" style={{ color: 'var(--ink-3)' }}>{plainText(item.objective)}</p>
              )}
              <div className="mt-auto text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                {item.addCount > 0 ? `Added by ${item.addCount} coach${item.addCount === 1 ? '' : 'es'}` : 'New'}
              </div>
            </div>
          </button>
        ))}
      </div>

      {open && (
        <DetailModal
          item={open}
          mine={mineIds.has(open.id)}
          onClose={() => setOpen(null)}
          onAdded={onAdded}
          onSignIn={onSignIn}
        />
      )}
    </div>
  );
}

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { parseMinutes } from '../../utils/sessionDuration';

// Left rail for the redesigned Session Builder.
// - SummaryTile at the top (selected = right pane shows SessionSummary)
// - PLAN (N) overline + Add ghost button
// - Vertical list of SectionTiles (drag handle, number chip, kind label, duration)

const MOMENT_EMOJI = {
  attacking: '⚡',
  defending: '🛡',
  'building up': '🏗',
  'transition to attack': '🔄',
  'transition to defense': '↩',
};

function getKindTone(type) {
  const t = (type || '').toLowerCase();
  if (t === 'warm-up' || t === 'warmup' || t === 'warm up') {
    return { fg: 'var(--warn)', bg: 'rgb(var(--warn-rgb) / 0.16)' };
  }
  if (t === 'play' || t === 'game') {
    return { fg: 'var(--good)', bg: 'rgb(var(--good-rgb) / 0.18)' };
  }
  if (t === 'cool down' || t === 'cool-down' || t === 'cooldown') {
    return { fg: 'var(--ink-3)', bg: 'var(--bg-sunken)' };
  }
  // Practice / Skill / default
  return { fg: 'var(--accent)', bg: 'var(--accent-soft)' };
}

function SummaryTile({ summary, sectionCount, active, onClick }) {
  const target = parseMinutes(summary?.duration);
  const dateStr = summary?.date || '';
  const moment = summary?.moment || '';
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-[12px] transition-colors"
      style={{
        padding: '12px 14px',
        background: active ? 'var(--bg-elev)' : 'transparent',
        border: '1.5px solid',
        borderColor: active ? 'var(--accent)' : 'var(--line)',
        boxShadow: active ? '0 0 0 3px rgb(var(--accent-rgb) / 0.12)' : 'var(--shadow-sm)',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--line-2)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--line)'; }}
    >
      <div className="eyebrow mb-1" style={{ fontSize: 10 }}>SESSION SUMMARY</div>
      <div className="text-[15px] font-semibold leading-tight truncate" style={{ letterSpacing: '-0.015em', color: 'var(--ink)' }}>
        {summary?.title || 'Untitled session'}
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {moment && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <span aria-hidden>{MOMENT_EMOJI[moment.toLowerCase()] || '•'}</span>
            <span style={{ textTransform: 'capitalize' }}>{moment}</span>
          </span>
        )}
        {target > 0 && (
          <span className="font-mono uppercase" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
            {target} MIN
          </span>
        )}
        {sectionCount > 0 && (
          <span className="font-mono uppercase" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
            {sectionCount} {sectionCount === 1 ? 'SEC' : 'SECS'}
          </span>
        )}
      </div>
      {dateStr && (
        <div className="mt-1.5 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>{dateStr}</div>
      )}
    </button>
  );
}

function SectionTile({ section, index, active, onClick, onDelete, dragAttributes, dragListeners, isDragging }) {
  const tone = getKindTone(section.type);
  const minutes = parseMinutes(section.time);
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      className="rounded-[10px] transition-colors cursor-pointer group"
      style={{
        padding: '8px 10px',
        background: active ? 'var(--bg-elev)' : 'transparent',
        border: '1px solid',
        borderColor: active ? 'var(--line-2)' : 'transparent',
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
        opacity: isDragging ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
      onMouseEnter={(e) => {
        setHovered(true);
        if (!active) e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.04)';
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <button
        {...dragAttributes}
        {...dragListeners}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab active:cursor-grabbing flex-shrink-0"
        title="Drag to reorder"
        style={{ color: 'var(--ink-3)', padding: 2, background: 'transparent', border: 'none' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.2" />
          <circle cx="15" cy="6" r="1.2" />
          <circle cx="9" cy="12" r="1.2" />
          <circle cx="15" cy="12" r="1.2" />
          <circle cx="9" cy="18" r="1.2" />
          <circle cx="15" cy="18" r="1.2" />
        </svg>
      </button>
      <div
        className="flex-shrink-0 inline-flex items-center justify-center rounded-[7px] font-mono"
        style={{
          width: 26,
          height: 26,
          background: tone.bg,
          color: tone.fg,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono uppercase truncate" style={{ fontSize: 9.5, color: tone.fg, letterSpacing: '0.08em' }}>
          {section.type || 'Section'}
        </div>
        <div className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)', letterSpacing: '-0.005em' }}>
          {section.name || 'Untitled'}
        </div>
      </div>
      {onDelete && (hovered || active) ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete "${section.name || 'Untitled section'}"?`)) {
              onDelete();
            }
          }}
          className="flex-shrink-0"
          title="Delete section"
          aria-label="Delete section"
          style={{
            padding: 3,
            background: 'transparent',
            border: 'none',
            color: 'var(--ink-3)',
            cursor: 'pointer',
            borderRadius: 6,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgb(var(--danger-rgb) / 0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      ) : minutes > 0 && (
        <span className="font-mono flex-shrink-0" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {minutes}&prime;
        </span>
      )}
    </div>
  );
}

function SortableSectionTile({ section, index, active, onClick, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}>
      <SectionTile
        section={section}
        index={index}
        active={active}
        onClick={onClick}
        onDelete={onDelete}
        dragAttributes={attributes}
        dragListeners={listeners}
        isDragging={isDragging}
      />
    </div>
  );
}

export default function SessionRail({
  summary,
  sections,
  selectedSectionId, // null = summary view
  onSelectSummary,
  onSelectSection,
  onReorderSections,
  onAddSection,
  onDeleteSection,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderSections(arrayMove(sections, oldIndex, newIndex));
  };

  const summaryActive = selectedSectionId == null;

  return (
    <aside
      className="flex-shrink-0 sticky top-[57px] self-start flex flex-col gap-3"
      style={{
        width: 300,
        height: 'calc(100vh - 57px)',
        padding: '20px 14px',
        borderRight: '1px solid var(--line)',
        background: 'var(--bg)',
        overflowY: 'auto',
      }}
    >
      <SummaryTile
        summary={summary}
        sectionCount={sections.length}
        active={summaryActive}
        onClick={onSelectSummary}
      />

      <div className="flex items-center justify-between mt-2 px-1">
        <span className="eyebrow" style={{ fontSize: 10.5 }}>
          PLAN ({sections.length})
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1">
            {sections.map((s, idx) => (
              <SortableSectionTile
                key={s.id}
                section={s}
                index={idx}
                active={selectedSectionId === s.id}
                onClick={() => onSelectSection(s.id)}
                onDelete={onDeleteSection ? () => onDeleteSection(s.id) : undefined}
              />
            ))}
            {sections.length === 0 && (
              <div
                className="text-center rounded-[10px] px-3 py-6"
                style={{ background: 'var(--bg-sunken)', color: 'var(--ink-2)', fontSize: 12.5 }}
              >
                No sections yet.<br />
                <button onClick={onAddSection} className="mt-2 underline" style={{ color: 'var(--accent)' }}>
                  Add the first one
                </button>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {sections.length > 0 && (
        <button
          onClick={onAddSection}
          className="rounded-[10px] mt-1 transition-colors"
          style={{
            padding: '10px 12px',
            border: '1px dashed var(--line-2)',
            background: 'transparent',
            color: 'var(--ink-2)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.color = 'var(--accent)';
            e.currentTarget.style.background = 'var(--accent-soft)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--line-2)';
            e.currentTarget.style.color = 'var(--ink-2)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add section
        </button>
      )}
    </aside>
  );
}


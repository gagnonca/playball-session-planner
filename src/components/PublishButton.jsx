import React, { useState } from 'react';
import { useStore, findPublished, publishItem, unpublishItem } from '../data/store';
import { toast } from '../utils/helpers';

// Publish one of my items to the public Community, or manage its public copy.
//   kind: 'session' | 'exercise' | 'diagram'
//   getPayload(): the item's current content (read at click time)
//   disabledReason: why it can't be published (e.g. image-only legacy diagram)
export default function PublishButton({ kind, sourceId, title, tags, getPayload, disabledReason, size = 'sm' }) {
  const published = useStore(s => findPublished(s, kind, sourceId));
  const demo = useStore(s => s.demo);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const publish = async (isUpdate) => {
    if (!isUpdate && !window.confirm(
      `Publish "${title || 'this item'}" to the PlayBall Community?\n\n` +
      'Any coach can view it and add a copy. Your name and email are not shown. ' +
      'Only text and drawn diagrams are published — never images. You can unpublish any time.'
    )) return;
    setBusy(true);
    const r = await publishItem(kind, sourceId, { title, tags, payload: getPayload() });
    setBusy(false);
    setOpen(false);
    toast(r.ok ? (isUpdate ? 'Public copy updated' : 'Published to the Community') : r.error, r.ok ? 1600 : 4000);
  };

  const unpublish = async () => {
    setBusy(true);
    const r = await unpublishItem(kind, sourceId);
    setBusy(false);
    setOpen(false);
    toast(r.ok ? 'Removed from the Community' : `Couldn't unpublish — ${r.error}`);
  };

  const pad = size === 'sm' ? '2px 8px' : '5px 12px';
  const font = size === 'sm' ? 11.5 : 13;
  const blocked = demo ? 'Create a free account to publish' : disabledReason;

  if (!published) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!blocked) publish(false); }}
        disabled={busy || Boolean(blocked)}
        title={blocked || 'Share a copy in the public Community'}
        className="rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ padding: pad, fontSize: font, border: '1px solid var(--line)', background: 'var(--bg-elev)', color: 'var(--ink-2)' }}
      >
        {busy ? 'Publishing…' : 'Publish'}
      </button>
    );
  }

  return (
    <span className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        title={published.hidden ? 'Hidden from the Community after reports — contact support' : 'In the public Community'}
        className="rounded-full"
        style={{
          padding: pad, fontSize: font,
          border: `1px solid ${published.hidden ? 'var(--warn)' : 'var(--good)'}`,
          background: published.hidden ? 'rgb(var(--warn-rgb) / 0.12)' : 'rgb(var(--good-rgb) / 0.12)',
          color: published.hidden ? 'var(--warn)' : 'var(--good)',
        }}
      >
        {busy ? 'Working…' : published.hidden ? 'Public · hidden' : 'Public ✓'}
      </button>
      {open && (
        <span
          className="absolute right-0 top-full mt-1 z-30 flex flex-col rounded-[10px] p-1 min-w-[170px]"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-md)' }}
        >
          <button className="text-left px-3 py-1.5 rounded-[8px] text-[12.5px] hover:bg-[var(--bg-sunken)]" onClick={() => publish(true)}>
            Update public copy
          </button>
          <button className="text-left px-3 py-1.5 rounded-[8px] text-[12.5px] hover:bg-[var(--bg-sunken)]" style={{ color: 'var(--danger)' }} onClick={unpublish}>
            Unpublish
          </button>
        </span>
      )}
    </span>
  );
}

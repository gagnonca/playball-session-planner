-- Public Community library: sessions, exercises and diagrams a coach chose to
-- publish. Each row is a published COPY (re-published on demand), not a live
-- view of the coach's private item, so half-finished edits never go public.
--
-- `payload` is written only by the API after sanitizing (api/_lib/publicContent.js):
-- text with basic formatting + vector diagram shapes. No image fields, ever.
--
-- Run once in the Supabase SQL editor before deploying the Community.

create table if not exists public_items (
  id              text primary key,
  coach_id        text not null references coaches(coach_id) on delete cascade,
  kind            text not null check (kind in ('session', 'exercise', 'diagram')),
  source_id       text not null,                 -- the coach's own item it came from
  title           text not null,
  tags            jsonb not null default '{}'::jsonb,
  payload         jsonb not null,
  add_count       integer not null default 0,
  report_count    integer not null default 0,
  hidden          boolean not null default false, -- moderation: hidden from everyone but the owner
  published_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unpublished_at  timestamptz,
  unique (coach_id, kind, source_id)
);
create index if not exists public_items_browse_idx
  on public_items (kind, updated_at desc) where unpublished_at is null and hidden = false;

create table if not exists public_reports (
  id          bigserial primary key,
  item_id     text not null references public_items(id) on delete cascade,
  coach_id    text not null,                     -- who reported (signed-in)
  reason      text,
  created_at  timestamptz not null default now(),
  unique (item_id, coach_id)                     -- one report per coach per item
);

-- Same lock as every PlayBall table (0009): only the API server reads/writes.
alter table public_items   enable row level security;
alter table public_reports enable row level security;

-- Session templates and favorites move from browser storage to the account.
--
-- A template is a named, ordered list of library exercise ids. It's resolved
-- against the library when a session is created from it, so later library
-- edits flow into future sessions (that's why it isn't a copied session row).
--
-- A favorite pins a library item to the top of its tab. `key` is the group
-- key the Library groups by (lowercased name) for sessions/exercises, and the
-- diagram id for diagrams.
--
-- Run once in the Supabase SQL editor before deploying.

create table if not exists session_templates (
  id            text primary key,
  coach_id      text not null references coaches(coach_id) on delete cascade,
  name          text not null,
  exercise_ids  jsonb not null default '[]'::jsonb,
  version       integer not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists session_templates_live_idx on session_templates (coach_id) where deleted_at is null;

drop trigger if exists session_templates_bump_version on session_templates;
create trigger session_templates_bump_version before update on session_templates
  for each row execute function bump_row_version();

create table if not exists favorites (
  coach_id    text not null references coaches(coach_id) on delete cascade,
  kind        text not null check (kind in ('session', 'exercise', 'diagram')),
  key         text not null,
  created_at  timestamptz not null default now(),
  primary key (coach_id, kind, key)
);

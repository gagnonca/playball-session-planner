-- Accounts v2: one account, every device.
--
-- 1. coaches.display_name — the name other coaches see ("Managed by Corey").
-- 2. teams.merged_into — when a coach merges two of their teams (typically
--    the iPhone team with games into the web team with sessions), the source
--    row stays as a pointer so devices holding it remap to the target
--    instead of treating the team as deleted.
-- 3. team_requests — a coach asking to join a team that's already on someone
--    else's account (they held its old share code). The owner approves as
--    co-coach or assistant, or declines.
--
-- Additive only; no existing rows change.

alter table coaches add column if not exists display_name text;
alter table teams add column if not exists merged_into text references teams(id) on delete set null;

create table if not exists team_requests (
  team_id     text not null references teams(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  primary key (team_id, user_id)
);
create index if not exists team_requests_team_pending_idx on team_requests (team_id) where status = 'pending';

-- Same rule as 0009: RLS on, no policies. Only the API (service role) reads it.
alter table team_requests enable row level security;

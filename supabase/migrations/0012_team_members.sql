-- iOS teams on accounts, and sharing a team with other coaches.
--
-- 1. `teams.ios` carries the settings only the iOS app uses (match format,
--    periods, colours, mascot, captains). The roster is already on
--    `teams.players` (0004) and games are rows in `games` (0003).
-- 2. `teams.share_code_readonly`: once the owner moves an iOS team onto an
--    account, the old 6-character share code stops accepting pushes, so
--    anyone still holding it can no longer overwrite the team.
-- 3. `team_members` grants another account access to a team. The owner is
--    not listed here — ownership stays `teams.coach_id`.
--      cocoach   — reads everything, edits and deletes the team's games
--      assistant — reads everything; can only keep private copies of games
--    Private copies are ordinary `games` rows owned by the member's own
--    coach_id, so the owner never sees them.
-- 4. `team_invites`: single-use links the owner sends by Messages, email, …
--
-- Run once in the Supabase SQL editor. Additive only; no existing rows change.

alter table teams add column if not exists ios jsonb;
alter table teams add column if not exists share_code_readonly boolean not null default false;

create table if not exists team_members (
  team_id     text not null references teams(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('cocoach', 'assistant')),
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists team_members_user_idx on team_members (user_id);

create table if not exists team_invites (
  token        text primary key,
  team_id      text not null references teams(id) on delete cascade,
  role         text not null check (role in ('cocoach', 'assistant')),
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  accepted_by  uuid references auth.users(id) on delete set null,
  accepted_at  timestamptz,
  revoked_at   timestamptz
);
create index if not exists team_invites_team_idx on team_invites (team_id);

-- Same rule as 0009: RLS on, no policies. Only the API (service role) reads these.
alter table team_members enable row level security;
alter table team_invites enable row level security;

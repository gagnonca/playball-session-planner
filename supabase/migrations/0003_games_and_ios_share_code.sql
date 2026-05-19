-- Games table — durable storage for iOS-pushed game records (and future
-- web-created game plans). Mirrored from /api/team-share/push for active
-- iOS coaches; surfaced on the web team page.

create table if not exists games (
  id                text primary key,
  team_id           text not null references teams(id) on delete cascade,
  coach_id          text not null,
  name              text not null,
  date              timestamptz,
  is_home           boolean not null default false,
  payload           jsonb not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index if not exists games_team_live_idx  on games (team_id)  where deleted_at is null;
create index if not exists games_coach_live_idx on games (coach_id) where deleted_at is null;

-- iOS share code carried on the team row so /api/team-share/push can find
-- the same Postgres row across re-pushes, and so a web user can claim an
-- iOS-pushed (anon) team into their account.
alter table teams add column if not exists ios_share_code text;
create unique index if not exists teams_ios_share_code_uniq
  on teams (ios_share_code)
  where ios_share_code is not null;

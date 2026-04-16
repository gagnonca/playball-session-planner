-- PlayBall Supabase schema
-- Run once in Supabase SQL Editor.

create table if not exists coaches (
  coach_id          text primary key,
  devices           jsonb not null default '[]'::jsonb,
  default_team_id   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists teams (
  id                text primary key,
  coach_id          text not null references coaches(coach_id) on delete cascade,
  name              text not null,
  age_group         text,
  default_duration  text,
  sharing           jsonb not null default '{"isShared":false}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists teams_coach_idx on teams (coach_id);
create index if not exists teams_share_token_idx on teams ((sharing->>'shareToken'))
  where sharing->>'shareToken' is not null;

create table if not exists sessions (
  id                text primary key,
  team_id           text not null references teams(id) on delete cascade,
  coach_id          text not null,
  summary           jsonb not null,
  sections          jsonb not null default '[]'::jsonb,
  is_template       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists sessions_team_idx on sessions (team_id);
create index if not exists sessions_coach_idx on sessions (coach_id);

create table if not exists library_exercises (
  id                text primary key,
  coach_id          text not null references coaches(coach_id) on delete cascade,
  name              text not null,
  type              text,
  tags              jsonb not null default '{}'::jsonb,
  payload           jsonb not null,
  updated_at        timestamptz not null default now()
);
create index if not exists library_exercises_coach_idx on library_exercises (coach_id);

create table if not exists library_sessions (
  id                text primary key,
  coach_id          text not null references coaches(coach_id) on delete cascade,
  name              text not null,
  tags              jsonb not null default '{}'::jsonb,
  payload           jsonb not null,
  updated_at        timestamptz not null default now()
);
create index if not exists library_sessions_coach_idx on library_sessions (coach_id);

create table if not exists library_hidden (
  coach_id          text not null references coaches(coach_id) on delete cascade,
  entity_kind       text not null,
  entity_id         text not null,
  primary key (coach_id, entity_kind, entity_id)
);

create table if not exists diagrams (
  id                text primary key,
  coach_id          text not null references coaches(coach_id) on delete cascade,
  name              text,
  payload           jsonb not null,
  updated_at        timestamptz not null default now()
);
create index if not exists diagrams_coach_idx on diagrams (coach_id);

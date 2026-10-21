-- "Previous season" teams. The web sidebar lists archived teams under a
-- separate Previous Seasons section; nothing else about the team changes
-- (sessions, games, sharing all keep working).

alter table teams add column if not exists archived boolean not null default false;

-- Admin moderation timestamp on Community items (added to 0010 after some
-- databases had already run it). Safe to run on any database: adds one
-- nullable column, touches no rows.
alter table public_items add column if not exists moderated_at timestamptz;

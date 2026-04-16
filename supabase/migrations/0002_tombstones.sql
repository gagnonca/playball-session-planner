-- Soft delete: deleted rows stay in the table with deleted_at set.
-- All reads filter `deleted_at is null`. Replaces hard deletes, which left
-- Redis's blob cache looking newer than Postgres and resurrected deleted items.

alter table teams              add column if not exists deleted_at timestamptz;
alter table sessions           add column if not exists deleted_at timestamptz;
alter table library_exercises  add column if not exists deleted_at timestamptz;
alter table library_sessions   add column if not exists deleted_at timestamptz;
alter table diagrams           add column if not exists deleted_at timestamptz;

create index if not exists teams_live_idx             on teams             (coach_id) where deleted_at is null;
create index if not exists sessions_live_idx          on sessions          (coach_id) where deleted_at is null;
create index if not exists library_exercises_live_idx on library_exercises (coach_id) where deleted_at is null;
create index if not exists library_sessions_live_idx  on library_sessions  (coach_id) where deleted_at is null;
create index if not exists diagrams_live_idx          on diagrams          (coach_id) where deleted_at is null;

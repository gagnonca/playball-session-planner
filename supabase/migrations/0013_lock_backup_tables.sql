-- The 2026-10-21 backup tables were created without RLS, so anyone holding
-- the public anon key could read or change them through Supabase's API.
-- Same rule as 0009: RLS on, no policies; only the service role reads them.
-- Applied 2026-10-26.

alter table public.backup_20261021_coaches enable row level security;
alter table public.backup_20261021_teams enable row level security;
alter table public.backup_20261021_sessions enable row level security;
alter table public.backup_20261021_games enable row level security;
alter table public.backup_20261021_library_exercises enable row level security;
alter table public.backup_20261021_library_sessions enable row level security;
alter table public.backup_20261021_library_hidden enable row level security;
alter table public.backup_20261021_diagrams enable row level security;

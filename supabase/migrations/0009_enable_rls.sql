-- Row Level Security ON for every PlayBall table, with NO policies.
--
-- Why: Supabase exposes the public schema over its REST API to anyone holding
-- the project's anon key. Accounts put that key in the web app's JavaScript,
-- so without RLS anyone could read or change every coach's rows directly.
-- With RLS on and no policies, the anon/authenticated roles get nothing; the
-- API server uses the service-role key, which bypasses RLS, so the app (and
-- the current production site) keep working unchanged.
--
-- Must be run BEFORE the anon key is added to Vercel (setup step 7).
-- Non-destructive: changes access rules only, no rows are touched.

alter table coaches            enable row level security;
alter table teams              enable row level security;
alter table sessions           enable row level security;
alter table games              enable row level security;
alter table library_exercises  enable row level security;
alter table library_sessions   enable row level security;
alter table library_hidden     enable row level security;
alter table diagrams           enable row level security;
alter table session_templates  enable row level security;
alter table favorites          enable row level security;

-- Check: every table in public should show rls_on = true.
--   select tablename, rowsecurity as rls_on from pg_tables where schemaname = 'public' order by 1;

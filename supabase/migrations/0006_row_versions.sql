-- Optimistic concurrency: every editable row carries an integer `version`
-- that Postgres bumps on every UPDATE (trigger below), no matter who writes
-- it — the web v2 API, the iOS team-share mirror, share revoke, link-ios.
--
-- Web writes are compare-and-set: `update ... where version = <the version
-- the client last saw>`. Zero rows matched means someone else saved first →
-- the API answers 409 with the current row instead of silently overwriting.
--
-- Run once in the Supabase SQL editor BEFORE deploying the v3 API.

alter table teams              add column if not exists version integer not null default 1;
alter table sessions           add column if not exists version integer not null default 1;
alter table games              add column if not exists version integer not null default 1;
alter table library_exercises  add column if not exists version integer not null default 1;
alter table library_sessions   add column if not exists version integer not null default 1;
alter table diagrams           add column if not exists version integer not null default 1;

create or replace function bump_row_version() returns trigger
language plpgsql as $$
begin
  new.version := old.version + 1;
  return new;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['teams','sessions','games','library_exercises','library_sessions','diagrams'] loop
    execute format('drop trigger if exists %I_bump_version on %I', t, t);
    execute format(
      'create trigger %I_bump_version before update on %I for each row execute function bump_row_version()',
      t, t
    );
  end loop;
end
$$;

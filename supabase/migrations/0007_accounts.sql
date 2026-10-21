-- Accounts: a coach row is owned by a Supabase Auth user (Google, Apple, or
-- emailed code — no passwords). Existing device-linked coaches are claimed
-- by the first account that signs in on one of their linked devices; from
-- then on that coach only accepts account auth.
--
-- Run once in the Supabase SQL editor before deploying account sign-in.

alter table coaches add column if not exists user_id uuid unique references auth.users(id) on delete set null;
alter table coaches add column if not exists claimed_at timestamptz;

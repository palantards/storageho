-- 20260228123000_profiles_compat.sql
-- Ensure profile columns used by app code exist in Supabase-first schema.

alter table public.profiles
  add column if not exists name text,
  add column if not exists company text,
  add column if not exists locale text;

update public.profiles
set name = coalesce(name, display_name)
where name is null;
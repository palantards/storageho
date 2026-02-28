-- 20260228133000_containers_cover_photo_path.sql
-- Align containers table with current app schema.

alter table public.containers
  add column if not exists cover_photo_path text;

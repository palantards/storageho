-- 20260301143000_rooms_system_flag.sql
-- Adds system-room support for setup-first flow (optional room on container create).

alter table if exists public.rooms
  add column if not exists is_system boolean not null default false;

update public.rooms
set is_system = false
where is_system is null;

create index if not exists rooms_household_location_is_system_idx
  on public.rooms (household_id, location_id, is_system);

create unique index if not exists rooms_location_system_unique_idx
  on public.rooms (location_id)
  where is_system = true;

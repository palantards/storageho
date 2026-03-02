begin;

-- Floors are now first-class and backed directly by household_canvas_layers.
-- locations is removed; legacy location_id fields now point to floor layer ids.

-- 0) Drop old FK constraints to locations first to avoid violations while reshaping.
alter table if exists public.user_preferences
  drop constraint if exists user_preferences_active_location_id_locations_id_fk;
alter table if exists public.user_preferences
  drop constraint if exists user_preferences_active_location_id_fkey;

alter table if exists public.rooms
  drop constraint if exists rooms_location_id_locations_id_fk;
alter table if exists public.rooms
  drop constraint if exists rooms_location_id_fkey;

alter table if exists public.household_canvas_layers
  drop constraint if exists household_canvas_layers_location_id_locations_id_fk;
alter table if exists public.household_canvas_layers
  drop constraint if exists household_canvas_layers_location_id_fkey;

-- 0.5) Ensure every legacy location id has a layer row to map to.
with missing as (
  select
    r.household_id,
    r.location_id,
    (array_agg(r.created_by))[1] as created_by
  from public.rooms r
  left join public.household_canvas_layers l on l.id = r.location_id
  where l.id is null
  group by r.household_id, r.location_id
)
insert into public.household_canvas_layers (id, household_id, location_id, name, sort_order, created_by)
select
  m.location_id,
  m.household_id,
  m.location_id,
  concat('Imported floor ', row_number() over (partition by m.household_id order by m.location_id)),
  coalesce((select max(sort_order) from public.household_canvas_layers l2 where l2.household_id = m.household_id), -1) + row_number() over (partition by m.household_id order by m.location_id),
  m.created_by
from missing m
on conflict (household_id, location_id) do nothing;

-- 1) Ensure every layer has a stable legacy location_id mirror.
update public.household_canvas_layers
set location_id = coalesce(location_id, id)
where location_id is null;

-- 2) If rooms/user_preferences still point at old locations ids,
-- remap them through layer.location_id -> layer.id.
update public.rooms r
set location_id = l.id
from public.household_canvas_layers l
where r.location_id = l.location_id
  and r.household_id = l.household_id
  and r.location_id <> l.id;

update public.user_preferences p
set active_location_id = l.id
from public.household_canvas_layers l
where p.active_location_id = l.location_id
  and p.active_household_id = l.household_id
  and p.active_location_id <> l.id;

-- Location ids are now floor ids.
update public.household_canvas_layers
set location_id = id
where location_id <> id;

-- 3) Remove locations table entirely.
drop table if exists public.locations cascade;

-- 4) Keep location_id as legacy floor mirror and enforce consistency.
alter table public.household_canvas_layers
  alter column location_id set not null;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'household_canvas_layers_location_matches_id_chk'
  ) then
    alter table public.household_canvas_layers
      drop constraint household_canvas_layers_location_matches_id_chk;
  end if;
  alter table public.household_canvas_layers
    add constraint household_canvas_layers_location_matches_id_chk
    check (location_id = id);
end $$;

-- 5) Re-point room/user preference references to floor layers.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'rooms_location_id_household_canvas_layers_id_fk'
  ) then
    alter table public.rooms
      drop constraint rooms_location_id_household_canvas_layers_id_fk;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'rooms_location_id_household_canvas_layers_id_fk'
  ) then
    alter table public.rooms
      add constraint rooms_location_id_household_canvas_layers_id_fk
      foreign key (location_id)
      references public.household_canvas_layers(id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'user_preferences_active_location_id_household_canvas_layers_id_fk'
  ) then
    alter table public.user_preferences
      drop constraint user_preferences_active_location_id_household_canvas_layers_id_fk;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'user_preferences_active_location_id_household_canvas_layers_id_fk'
  ) then
    alter table public.user_preferences
      add constraint user_preferences_active_location_id_household_canvas_layers_id_fk
      foreign key (active_location_id)
      references public.household_canvas_layers(id)
      on delete set null;
  end if;
end $$;

commit;

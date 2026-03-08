begin;

-- If both tables exist, backfill any missing rows into household_floors first.
do $$
begin
  if to_regclass('public.household_canvas_layers') is not null
     and to_regclass('public.household_floors') is not null then
    insert into public.household_floors (
      id,
      household_id,
      location_id,
      name,
      sort_order,
      created_by,
      created_at
    )
    select
      l.id,
      l.household_id,
      coalesce(l.location_id, l.id),
      l.name,
      coalesce(l.sort_order, 0),
      coalesce(l.created_by, h.created_by),
      coalesce(l.created_at, now())
    from public.household_canvas_layers l
    left join public.households h on h.id = l.household_id
    on conflict do nothing;
  end if;
end
$$;

-- Drop any leftover FKs pointing to the legacy table.
alter table if exists public.rooms
  drop constraint if exists rooms_location_id_household_canvas_layers_id_fk;

alter table if exists public.user_preferences
  drop constraint if exists user_preferences_active_location_id_household_canvas_layers_id_fk;

-- Remove the legacy table.
drop table if exists public.household_canvas_layers cascade;

-- Ensure canonical FKs exist after cleanup.
do $$
begin
  if to_regclass('public.household_floors') is not null
     and to_regclass('public.rooms') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.rooms'::regclass
         and conname = 'rooms_location_id_household_floors_id_fk'
     ) then
    alter table public.rooms
      add constraint rooms_location_id_household_floors_id_fk
      foreign key (location_id)
      references public.household_floors(id)
      on delete cascade;
  end if;

  if to_regclass('public.household_floors') is not null
     and to_regclass('public.user_preferences') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.user_preferences'::regclass
         and conname = 'user_preferences_active_location_id_household_floors_id_fk'
     ) then
    alter table public.user_preferences
      add constraint user_preferences_active_location_id_household_floors_id_fk
      foreign key (active_location_id)
      references public.household_floors(id)
      on delete set null;
  end if;
end
$$;

commit;


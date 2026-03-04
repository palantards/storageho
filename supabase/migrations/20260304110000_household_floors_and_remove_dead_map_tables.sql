begin;

-- Rename floor table from canvas-era naming to domain naming.
do $$
begin
  if to_regclass('public.household_canvas_layers') is not null
     and to_regclass('public.household_floors') is null then
    alter table public.household_canvas_layers rename to household_floors;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.household_canvas_layers_household_sort_idx') is not null
     and to_regclass('public.household_floors_household_sort_idx') is null then
    alter index public.household_canvas_layers_household_sort_idx
      rename to household_floors_household_sort_idx;
  end if;

  if to_regclass('public.household_canvas_layers_location_idx') is not null
     and to_regclass('public.household_floors_location_idx') is null then
    alter index public.household_canvas_layers_location_idx
      rename to household_floors_location_idx;
  end if;

  if to_regclass('public.household_canvas_layers_household_name_idx') is not null
     and to_regclass('public.household_floors_household_name_idx') is null then
    alter index public.household_canvas_layers_household_name_idx
      rename to household_floors_household_name_idx;
  end if;

  if to_regclass('public.household_canvas_layers_household_location_unique_idx') is not null
     and to_regclass('public.household_floors_household_location_unique_idx') is null then
    alter index public.household_canvas_layers_household_location_unique_idx
      rename to household_floors_household_location_unique_idx;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.household_floors') is not null
     and exists (
       select 1
       from pg_constraint
       where conname = 'household_canvas_layers_location_matches_id_chk'
     )
     and not exists (
       select 1
       from pg_constraint
       where conname = 'household_floors_location_matches_id_chk'
     ) then
    alter table public.household_floors
      rename constraint household_canvas_layers_location_matches_id_chk
      to household_floors_location_matches_id_chk;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.household_floors') is not null then
    if exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'household_floors'
        and policyname = 'household_canvas_layers_select'
    ) then
      alter policy household_canvas_layers_select
      on public.household_floors
      rename to household_floors_select;
    end if;

    if exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'household_floors'
        and policyname = 'household_canvas_layers_insert'
    ) then
      alter policy household_canvas_layers_insert
      on public.household_floors
      rename to household_floors_insert;
    end if;

    if exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'household_floors'
        and policyname = 'household_canvas_layers_update'
    ) then
      alter policy household_canvas_layers_update
      on public.household_floors
      rename to household_floors_update;
    end if;

    if exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'household_floors'
        and policyname = 'household_canvas_layers_delete'
    ) then
      alter policy household_canvas_layers_delete
      on public.household_floors
      rename to household_floors_delete;
    end if;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.household_floors') is not null then
    drop trigger if exists household_canvas_layers_set_updated_at on public.household_floors;
    drop trigger if exists household_floors_set_updated_at on public.household_floors;

    create trigger household_floors_set_updated_at
    before update on public.household_floors
    for each row execute function public.set_updated_at();
  end if;
end
$$;

do $$
begin
  -- rooms FK: handle old-only, new-only, and mixed states.
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rooms'::regclass
      and conname = 'rooms_location_id_household_canvas_layers_id_fk'
  ) then
    if exists (
      select 1
      from pg_constraint
      where conrelid = 'public.rooms'::regclass
        and conname = 'rooms_location_id_household_floors_id_fk'
    ) then
      alter table public.rooms
        drop constraint if exists rooms_location_id_household_canvas_layers_id_fk;
    else
      alter table public.rooms
        rename constraint rooms_location_id_household_canvas_layers_id_fk
        to rooms_location_id_household_floors_id_fk;
    end if;
  end if;

  -- user_preferences FK: handle old-only, new-only, and mixed states.
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_preferences'::regclass
      and conname = 'user_preferences_active_location_id_household_canvas_layers_id_fk'
  ) then
    if exists (
      select 1
      from pg_constraint
      where conrelid = 'public.user_preferences'::regclass
        and conname = 'user_preferences_active_location_id_household_floors_id_fk'
    ) then
      alter table public.user_preferences
        drop constraint if exists user_preferences_active_location_id_household_canvas_layers_id_fk;
    else
      alter table public.user_preferences
        rename constraint user_preferences_active_location_id_household_canvas_layers_id_fk
        to user_preferences_active_location_id_household_floors_id_fk;
    end if;
  end if;
end
$$;

-- Remove dead map/canvas tables that are no longer used.
drop table if exists public.household_canvas_placements cascade;
drop table if exists public.household_canvas_layouts cascade;
drop table if exists public.placements cascade;
drop table if exists public.room_layouts cascade;

-- Remove now-unused enum types from dropped map tables.
drop type if exists public.household_canvas_shape_type;
drop type if exists public.household_canvas_entity_type;
drop type if exists public.placement_entity_type;

commit;

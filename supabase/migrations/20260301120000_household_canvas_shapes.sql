-- 20260301120000_household_canvas_shapes.sql
-- Adds shape support and enforces one floor -> one location mapping.

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'household_canvas_shape_type'
  ) then
    create type public.household_canvas_shape_type as enum ('rectangle', 'square', 'triangle');
  end if;
end
$$;

alter table if exists public.household_canvas_placements
  add column if not exists shape_type public.household_canvas_shape_type not null default 'rectangle';

update public.household_canvas_placements
set shape_type = 'rectangle'
where shape_type is null;

alter table if exists public.household_canvas_placements
  drop constraint if exists household_canvas_placements_shape_type_container_check;

alter table if exists public.household_canvas_placements
  add constraint household_canvas_placements_shape_type_container_check
  check (entity_type <> 'container' or shape_type = 'rectangle');

create index if not exists household_canvas_placements_layer_shape_idx
  on public.household_canvas_placements (layer_id, entity_type, shape_type);

with duplicate_layers as (
  select
    l.id as layer_id,
    l.household_id,
    l.location_id,
    l.created_by,
    l.name,
    row_number() over (
      partition by l.household_id, l.location_id
      order by l.created_at, l.id
    ) as row_num
  from public.household_canvas_layers l
  where l.location_id is not null
),
relinked_layers as (
  select
    d.layer_id,
    d.household_id,
    d.created_by,
    coalesce(nullif(trim(d.name), ''), 'Floor') as layer_name,
    gen_random_uuid() as generated_location_id
  from duplicate_layers d
  where d.row_num > 1
),
inserted_duplicate_locations as (
  insert into public.locations (id, household_id, name, description, created_by, created_at)
  select
    r.generated_location_id,
    r.household_id,
    concat(r.layer_name, ' [', substring(r.layer_id::text from 1 for 8), ']'),
    'Auto-generated to enforce one location per floor',
    r.created_by,
    now()
  from relinked_layers r
)
update public.household_canvas_layers l
set
  location_id = r.generated_location_id,
  updated_at = now()
from relinked_layers r
where l.id = r.layer_id;

with missing_layers as (
  select
    l.id as layer_id,
    l.household_id,
    l.created_by,
    coalesce(nullif(trim(l.name), ''), 'Floor') as layer_name,
    gen_random_uuid() as generated_location_id
  from public.household_canvas_layers l
  where l.location_id is null
),
inserted_missing_locations as (
  insert into public.locations (id, household_id, name, description, created_by, created_at)
  select
    m.generated_location_id,
    m.household_id,
    concat(m.layer_name, ' [', substring(m.layer_id::text from 1 for 8), ']'),
    'Auto-generated for household canvas floor',
    m.created_by,
    now()
  from missing_layers m
)
update public.household_canvas_layers l
set
  location_id = m.generated_location_id,
  updated_at = now()
from missing_layers m
where l.id = m.layer_id;

create unique index if not exists household_canvas_layers_household_location_unique_idx
  on public.household_canvas_layers (household_id, location_id);
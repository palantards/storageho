-- 20260301093000_household_canvas.sql
-- Household-level multi-floor canvas with layers and placements.

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'household_canvas_entity_type'
  ) then
    create type public.household_canvas_entity_type as enum ('room', 'container');
  end if;
end
$$;

create table if not exists public.household_canvas_layouts (
  household_id uuid primary key references public.households(id) on delete cascade,
  width real not null default 30,
  height real not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists household_canvas_layouts_width_idx
  on public.household_canvas_layouts (width);

create table if not exists public.household_canvas_layers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  name text not null,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create index if not exists household_canvas_layers_household_sort_idx
  on public.household_canvas_layers (household_id, sort_order, created_at);

create index if not exists household_canvas_layers_location_idx
  on public.household_canvas_layers (location_id);

create table if not exists public.household_canvas_placements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  layer_id uuid not null references public.household_canvas_layers(id) on delete cascade,
  entity_type public.household_canvas_entity_type not null,
  entity_id uuid not null,
  x real not null default 0,
  y real not null default 0,
  width real not null default 3,
  height real not null default 2,
  rotation real not null default 0,
  label text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (layer_id, entity_type, entity_id)
);

create index if not exists household_canvas_placements_household_idx
  on public.household_canvas_placements (household_id);

create index if not exists household_canvas_placements_layer_idx
  on public.household_canvas_placements (layer_id, entity_type);

drop trigger if exists household_canvas_layouts_set_updated_at on public.household_canvas_layouts;
create trigger household_canvas_layouts_set_updated_at
before update on public.household_canvas_layouts
for each row execute function public.set_updated_at();

drop trigger if exists household_canvas_layers_set_updated_at on public.household_canvas_layers;
create trigger household_canvas_layers_set_updated_at
before update on public.household_canvas_layers
for each row execute function public.set_updated_at();

drop trigger if exists household_canvas_placements_set_updated_at on public.household_canvas_placements;
create trigger household_canvas_placements_set_updated_at
before update on public.household_canvas_placements
for each row execute function public.set_updated_at();

alter table public.household_canvas_layouts enable row level security;
alter table public.household_canvas_layers enable row level security;
alter table public.household_canvas_placements enable row level security;

drop policy if exists household_canvas_layouts_select on public.household_canvas_layouts;
create policy household_canvas_layouts_select
on public.household_canvas_layouts for select
to authenticated
using (public.is_household_member(household_id));

drop policy if exists household_canvas_layouts_insert on public.household_canvas_layouts;
create policy household_canvas_layouts_insert
on public.household_canvas_layouts for insert
to authenticated
with check (public.can_write_household(household_id));

drop policy if exists household_canvas_layouts_update on public.household_canvas_layouts;
create policy household_canvas_layouts_update
on public.household_canvas_layouts for update
to authenticated
using (public.can_write_household(household_id))
with check (public.can_write_household(household_id));

drop policy if exists household_canvas_layouts_delete on public.household_canvas_layouts;
create policy household_canvas_layouts_delete
on public.household_canvas_layouts for delete
to authenticated
using (public.can_manage_household(household_id));

drop policy if exists household_canvas_layers_select on public.household_canvas_layers;
create policy household_canvas_layers_select
on public.household_canvas_layers for select
to authenticated
using (public.is_household_member(household_id));

drop policy if exists household_canvas_layers_insert on public.household_canvas_layers;
create policy household_canvas_layers_insert
on public.household_canvas_layers for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.can_write_household(household_id)
);

drop policy if exists household_canvas_layers_update on public.household_canvas_layers;
create policy household_canvas_layers_update
on public.household_canvas_layers for update
to authenticated
using (public.can_write_household(household_id))
with check (public.can_write_household(household_id));

drop policy if exists household_canvas_layers_delete on public.household_canvas_layers;
create policy household_canvas_layers_delete
on public.household_canvas_layers for delete
to authenticated
using (public.can_write_household(household_id));

drop policy if exists household_canvas_placements_select on public.household_canvas_placements;
create policy household_canvas_placements_select
on public.household_canvas_placements for select
to authenticated
using (public.is_household_member(household_id));

drop policy if exists household_canvas_placements_insert on public.household_canvas_placements;
create policy household_canvas_placements_insert
on public.household_canvas_placements for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.can_write_household(household_id)
);

drop policy if exists household_canvas_placements_update on public.household_canvas_placements;
create policy household_canvas_placements_update
on public.household_canvas_placements for update
to authenticated
using (public.can_write_household(household_id))
with check (public.can_write_household(household_id));

drop policy if exists household_canvas_placements_delete on public.household_canvas_placements;
create policy household_canvas_placements_delete
on public.household_canvas_placements for delete
to authenticated
using (public.can_write_household(household_id));

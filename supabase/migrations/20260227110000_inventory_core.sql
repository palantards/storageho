-- 20260227110000_inventory_core.sql
-- Inventory domain for Home + Storage app

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ===== Enums =====
do $$
begin
  if not exists (select 1 from pg_type where typname = 'household_role') then
    create type public.household_role as enum ('owner', 'admin', 'member', 'viewer');
  end if;

  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type public.membership_status as enum ('invited', 'active', 'removed');
  end if;

  if not exists (select 1 from pg_type where typname = 'container_status') then
    create type public.container_status as enum ('active', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'photo_entity_type') then
    create type public.photo_entity_type as enum ('container', 'item');
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_entity_type') then
    create type public.activity_entity_type as enum (
      'household',
      'location',
      'room',
      'container',
      'item',
      'photo',
      'membership',
      'tag',
      'container_item'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_action_type') then
    create type public.activity_action_type as enum (
      'created',
      'updated',
      'archived',
      'moved',
      'quantity_changed',
      'photo_added',
      'photo_removed',
      'tag_added',
      'tag_removed',
      'invite_sent',
      'membership_updated',
      'imported',
      'exported'
    );
  end if;
end
$$;

-- ===== Profiles =====
create table if not exists public.profiles (
  user_id uuid primary key,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'name'
  ) then
    execute '
      update public.profiles
      set display_name = coalesce(display_name, name)
      where display_name is null
    ';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_user_id_users_id_fk'
  ) then
    alter table public.profiles drop constraint profiles_user_id_users_id_fk;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_user_id_auth_users_fk'
  ) then
    alter table public.profiles
      add constraint profiles_user_id_auth_users_fk
      foreign key (user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end
$$;

-- ===== Core entities =====
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role public.household_role not null default 'member',
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  invited_by uuid references auth.users(id) on delete set null,
  constraint household_member_user_or_email check (user_id is not null or invited_email is not null)
);

create unique index if not exists household_members_household_user_active_idx
  on public.household_members (household_id, user_id)
  where user_id is not null and status in ('active', 'invited');

create unique index if not exists household_members_household_invite_active_idx
  on public.household_members (household_id, lower(invited_email))
  where invited_email is not null and status = 'invited';

create index if not exists household_members_user_id_idx
  on public.household_members (user_id);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create unique index if not exists locations_household_name_idx
  on public.locations (household_id, lower(name));

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create unique index if not exists rooms_location_name_idx
  on public.rooms (location_id, lower(name));

create table if not exists public.containers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  parent_container_id uuid references public.containers(id) on delete set null,
  name text not null,
  code text,
  description text,
  status public.container_status not null default 'active',
  archived_at timestamptz,
  qr_deep_link text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create unique index if not exists containers_household_code_unique_idx
  on public.containers (household_id, lower(code))
  where code is not null;

create index if not exists containers_household_room_idx
  on public.containers (household_id, room_id);

create index if not exists containers_parent_idx
  on public.containers (parent_container_id);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  barcode text,
  serial_number text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create index if not exists items_household_idx on public.items (household_id);

create table if not exists public.item_aliases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  alias_text text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists item_aliases_item_alias_unique_idx
  on public.item_aliases (item_id, lower(alias_text));

create index if not exists item_aliases_household_idx
  on public.item_aliases (household_id);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);

create unique index if not exists tags_household_name_unique_idx
  on public.tags (household_id, lower(name));

create table if not exists public.item_tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists item_tags_unique_idx
  on public.item_tags (item_id, tag_id);

create index if not exists item_tags_household_idx
  on public.item_tags (household_id);

create table if not exists public.container_tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists container_tags_unique_idx
  on public.container_tags (container_id, tag_id);

create index if not exists container_tags_household_idx
  on public.container_tags (household_id);

create table if not exists public.container_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists container_items_unique_idx
  on public.container_items (container_id, item_id);

create index if not exists container_items_household_idx
  on public.container_items (household_id);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  entity_type public.photo_entity_type not null,
  entity_id uuid not null,
  storage_path_original text not null,
  storage_path_thumb text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create index if not exists photos_household_entity_idx
  on public.photos (household_id, entity_type, entity_id, created_at desc);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action_type public.activity_action_type not null,
  entity_type public.activity_entity_type not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_household_created_idx
  on public.activity_log (household_id, created_at desc);

create index if not exists activity_log_entity_idx
  on public.activity_log (entity_type, entity_id, created_at desc);

-- ===== Search indexes =====
create index if not exists items_name_trgm_idx
  on public.items using gin (lower(name) gin_trgm_ops);
create index if not exists items_description_trgm_idx
  on public.items using gin (lower(coalesce(description, '')) gin_trgm_ops);
create index if not exists item_aliases_alias_trgm_idx
  on public.item_aliases using gin (lower(alias_text) gin_trgm_ops);
create index if not exists containers_name_trgm_idx
  on public.containers using gin (lower(name) gin_trgm_ops);
create index if not exists containers_code_trgm_idx
  on public.containers using gin (lower(coalesce(code, '')) gin_trgm_ops);
create index if not exists rooms_name_trgm_idx
  on public.rooms using gin (lower(name) gin_trgm_ops);
create index if not exists locations_name_trgm_idx
  on public.locations using gin (lower(name) gin_trgm_ops);
create index if not exists tags_name_trgm_idx
  on public.tags using gin (lower(name) gin_trgm_ops);

-- ===== Utility triggers/functions =====
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists household_members_set_updated_at on public.household_members;
create trigger household_members_set_updated_at
before update on public.household_members
for each row execute function public.set_updated_at();

drop trigger if exists containers_set_updated_at on public.containers;
create trigger containers_set_updated_at
before update on public.containers
for each row execute function public.set_updated_at();

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

drop trigger if exists container_items_set_updated_at on public.container_items;
create trigger container_items_set_updated_at
before update on public.container_items
for each row execute function public.set_updated_at();

create or replace function public.add_household_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_members (
    household_id,
    user_id,
    role,
    status,
    invited_email,
    invited_by
  ) values (
    new.id,
    new.created_by,
    'owner',
    'active',
    null,
    new.created_by
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists households_owner_membership on public.households;
create trigger households_owner_membership
after insert on public.households
for each row execute function public.add_household_owner_membership();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (user_id)
  do update set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    updated_at = now();

  update public.household_members hm
  set
    user_id = new.id,
    status = 'active',
    updated_at = now()
  where hm.user_id is null
    and hm.status = 'invited'
    and hm.invited_email is not null
    and lower(hm.invited_email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_inventory on auth.users;
create trigger on_auth_user_created_inventory
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- ===== RLS helper functions =====
create or replace function public.current_household_role(target_household uuid)
returns public.household_role
language sql
stable
security definer
set search_path = public
as $$
  select hm.role
  from public.household_members hm
  where hm.household_id = target_household
    and hm.user_id = auth.uid()
    and hm.status = 'active'
  limit 1;
$$;

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household
      and hm.user_id = auth.uid()
      and hm.status = 'active'
  );
$$;

create or replace function public.can_write_household(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_household_role(target_household) in ('owner', 'admin', 'member'), false);
$$;

create or replace function public.can_manage_household(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_household_role(target_household) in ('owner', 'admin'), false);
$$;

create or replace function public.storage_household_id(path text)
returns uuid
language plpgsql
immutable
as $$
declare
  candidate text;
begin
  candidate := split_part(path, '/', 2);
  if candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return candidate::uuid;
  end if;
  return null;
end;
$$;

grant execute on function public.current_household_role(uuid) to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.can_write_household(uuid) to authenticated;
grant execute on function public.can_manage_household(uuid) to authenticated;
grant execute on function public.storage_household_id(text) to authenticated;

-- ===== Enable RLS =====
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.locations enable row level security;
alter table public.rooms enable row level security;
alter table public.containers enable row level security;
alter table public.items enable row level security;
alter table public.item_aliases enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;
alter table public.container_tags enable row level security;
alter table public.container_items enable row level security;
alter table public.photos enable row level security;
alter table public.activity_log enable row level security;

-- ===== Profiles policies =====
drop policy if exists profiles_select on public.profiles;
create policy profiles_select
on public.profiles for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.household_members me
    join public.household_members them
      on me.household_id = them.household_id
    where me.user_id = auth.uid()
      and me.status = 'active'
      and them.user_id = profiles.user_id
      and them.status = 'active'
  )
);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert
on public.profiles for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update
on public.profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ===== Household policies =====
drop policy if exists households_select on public.households;
create policy households_select
on public.households for select
to authenticated
using (public.is_household_member(id));

drop policy if exists households_insert on public.households;
create policy households_insert
on public.households for insert
to authenticated
with check (auth.uid() = created_by);

drop policy if exists households_update on public.households;
create policy households_update
on public.households for update
to authenticated
using (public.can_manage_household(id))
with check (public.can_manage_household(id));

drop policy if exists households_delete on public.households;
create policy households_delete
on public.households for delete
to authenticated
using (public.current_household_role(id) = 'owner');

-- ===== Membership policies =====
drop policy if exists household_members_select on public.household_members;
create policy household_members_select
on public.household_members for select
to authenticated
using (public.is_household_member(household_id));

drop policy if exists household_members_insert on public.household_members;
create policy household_members_insert
on public.household_members for insert
to authenticated
with check (public.can_manage_household(household_id));

drop policy if exists household_members_update on public.household_members;
create policy household_members_update
on public.household_members for update
to authenticated
using (public.can_manage_household(household_id))
with check (public.can_manage_household(household_id));

drop policy if exists household_members_delete on public.household_members;
create policy household_members_delete
on public.household_members for delete
to authenticated
using (public.can_manage_household(household_id));

-- ===== Shared helper policies =====
drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations for select to authenticated using (public.is_household_member(household_id));
drop policy if exists locations_insert on public.locations;
create policy locations_insert on public.locations for insert to authenticated with check (public.can_write_household(household_id));
drop policy if exists locations_update on public.locations;
create policy locations_update on public.locations for update to authenticated using (public.can_write_household(household_id)) with check (public.can_write_household(household_id));
drop policy if exists locations_delete on public.locations;
create policy locations_delete on public.locations for delete to authenticated using (public.can_write_household(household_id));

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select to authenticated using (public.is_household_member(household_id));
drop policy if exists rooms_insert on public.rooms;
create policy rooms_insert on public.rooms for insert to authenticated with check (public.can_write_household(household_id));
drop policy if exists rooms_update on public.rooms;
create policy rooms_update on public.rooms for update to authenticated using (public.can_write_household(household_id)) with check (public.can_write_household(household_id));
drop policy if exists rooms_delete on public.rooms;
create policy rooms_delete on public.rooms for delete to authenticated using (public.can_write_household(household_id));

drop policy if exists containers_select on public.containers;
create policy containers_select on public.containers for select to authenticated using (public.is_household_member(household_id));
drop policy if exists containers_insert on public.containers;
create policy containers_insert on public.containers for insert to authenticated with check (public.can_write_household(household_id));
drop policy if exists containers_update on public.containers;
create policy containers_update on public.containers for update to authenticated using (public.can_write_household(household_id)) with check (public.can_write_household(household_id));
drop policy if exists containers_delete on public.containers;
create policy containers_delete on public.containers for delete to authenticated using (public.can_write_household(household_id));

drop policy if exists items_select on public.items;
create policy items_select on public.items for select to authenticated using (public.is_household_member(household_id));
drop policy if exists items_insert on public.items;
create policy items_insert on public.items for insert to authenticated with check (public.can_write_household(household_id));
drop policy if exists items_update on public.items;
create policy items_update on public.items for update to authenticated using (public.can_write_household(household_id)) with check (public.can_write_household(household_id));
drop policy if exists items_delete on public.items;
create policy items_delete on public.items for delete to authenticated using (public.can_write_household(household_id));

drop policy if exists item_aliases_select on public.item_aliases;
create policy item_aliases_select on public.item_aliases for select to authenticated using (public.is_household_member(household_id));
drop policy if exists item_aliases_insert on public.item_aliases;
create policy item_aliases_insert on public.item_aliases for insert to authenticated with check (public.can_write_household(household_id));
drop policy if exists item_aliases_update on public.item_aliases;
create policy item_aliases_update on public.item_aliases for update to authenticated using (public.can_write_household(household_id)) with check (public.can_write_household(household_id));
drop policy if exists item_aliases_delete on public.item_aliases;
create policy item_aliases_delete on public.item_aliases for delete to authenticated using (public.can_write_household(household_id));

drop policy if exists tags_select on public.tags;
create policy tags_select on public.tags for select to authenticated using (public.is_household_member(household_id));
drop policy if exists tags_insert on public.tags;
create policy tags_insert on public.tags for insert to authenticated with check (public.can_write_household(household_id));
drop policy if exists tags_update on public.tags;
create policy tags_update on public.tags for update to authenticated using (public.can_write_household(household_id)) with check (public.can_write_household(household_id));
drop policy if exists tags_delete on public.tags;
create policy tags_delete on public.tags for delete to authenticated using (public.can_write_household(household_id));

drop policy if exists item_tags_select on public.item_tags;
create policy item_tags_select on public.item_tags for select to authenticated using (public.is_household_member(household_id));
drop policy if exists item_tags_insert on public.item_tags;
create policy item_tags_insert on public.item_tags for insert to authenticated with check (public.can_write_household(household_id));
drop policy if exists item_tags_delete on public.item_tags;
create policy item_tags_delete on public.item_tags for delete to authenticated using (public.can_write_household(household_id));

drop policy if exists container_tags_select on public.container_tags;
create policy container_tags_select on public.container_tags for select to authenticated using (public.is_household_member(household_id));
drop policy if exists container_tags_insert on public.container_tags;
create policy container_tags_insert on public.container_tags for insert to authenticated with check (public.can_write_household(household_id));
drop policy if exists container_tags_delete on public.container_tags;
create policy container_tags_delete on public.container_tags for delete to authenticated using (public.can_write_household(household_id));

drop policy if exists container_items_select on public.container_items;
create policy container_items_select on public.container_items for select to authenticated using (public.is_household_member(household_id));
drop policy if exists container_items_insert on public.container_items;
create policy container_items_insert on public.container_items for insert to authenticated with check (public.can_write_household(household_id));
drop policy if exists container_items_update on public.container_items;
create policy container_items_update on public.container_items for update to authenticated using (public.can_write_household(household_id)) with check (public.can_write_household(household_id));
drop policy if exists container_items_delete on public.container_items;
create policy container_items_delete on public.container_items for delete to authenticated using (public.can_write_household(household_id));

drop policy if exists photos_select on public.photos;
create policy photos_select on public.photos for select to authenticated using (public.is_household_member(household_id));
drop policy if exists photos_insert on public.photos;
create policy photos_insert on public.photos for insert to authenticated with check (public.can_write_household(household_id));
drop policy if exists photos_delete on public.photos;
create policy photos_delete on public.photos for delete to authenticated using (public.can_write_household(household_id));

drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log for select to authenticated using (public.is_household_member(household_id));
drop policy if exists activity_log_insert on public.activity_log;
create policy activity_log_insert on public.activity_log for insert to authenticated with check (public.can_write_household(household_id));

-- ===== Storage bucket/policies =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-private',
  'inventory-private',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists inventory_object_read on storage.objects;
create policy inventory_object_read
on storage.objects for select
to authenticated
using (
  bucket_id = 'inventory-private'
  and split_part(name, '/', 1) = 'household'
  and public.is_household_member(public.storage_household_id(name))
);

drop policy if exists inventory_object_insert on storage.objects;
create policy inventory_object_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'inventory-private'
  and split_part(name, '/', 1) = 'household'
  and public.can_write_household(public.storage_household_id(name))
);

drop policy if exists inventory_object_update on storage.objects;
create policy inventory_object_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'inventory-private'
  and split_part(name, '/', 1) = 'household'
  and public.can_write_household(public.storage_household_id(name))
)
with check (
  bucket_id = 'inventory-private'
  and split_part(name, '/', 1) = 'household'
  and public.can_write_household(public.storage_household_id(name))
);

drop policy if exists inventory_object_delete on storage.objects;
create policy inventory_object_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'inventory-private'
  and split_part(name, '/', 1) = 'household'
  and public.can_write_household(public.storage_household_id(name))
);
